(() => {
    'use strict';
    const M = RezkaMyShows;
    const alarm = 'rezka-myshows-sync';
    let writes = Promise.resolve(), running = false, connecting = false, activeJob = null;
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const errors = {
        login: 'Войдите в MyShows в этом Chrome и повторите проверку.',
        account: 'В MyShows открыт другой аккаунт. Войдите в подключённый аккаунт и повторите проверку.',
        token: 'Откройте «Токен» в истории MyShows и создайте API-токен. Затем подключите аккаунт снова.',
        auth: 'MyShows отклонил токен. Подключите аккаунт снова.',
        identity: 'На странице нет идентификатора IMDb. Автоматическое сопоставление недоступно.',
        match: 'MyShows не нашёл точное соответствие. Сопоставьте запись в истории MyShows, подтвердите её и нажмите «Проверить».',
        manual: 'Сопоставьте и подтвердите эту запись в истории MyShows, затем нажмите «Проверить».',
        missing: 'Запись пока не найдена в истории MyShows. Повторная отправка остановлена, чтобы не создать дубль.',
        duplicate: 'В MyShows найдено несколько записей этого просмотра. Проверьте их в истории MyShows.',
        progress: 'MyShows ещё не получил нужный процент просмотра. Проверьте запись в его истории.',
        layout: 'Не удалось прочитать страницу MyShows. Откройте историю и повторите проверку.',
        page: 'Страница MyShows недоступна. Откройте историю и повторите проверку.',
        pending: 'MyShows ещё не подтвердил отметку. Проверим снова автоматически.',
        unwatched: 'История подтверждена, но серия ещё не отмечена. Проверим снова автоматически.',
        network: 'Не удалось связаться с MyShows. Проверим снова автоматически.',
        rejected: 'MyShows отклонил запись. Проверьте доступность скробблинга в аккаунте.',
        validation: 'MyShows отклонил данные серии. Проверьте сериал, сезон и номер серии перед повторной отправкой.',
        source: 'MyShows отклонил название источника. Обновите расширение и повторите отправку.',
        paused: 'Синхронизация отменена. Запрос уже отправлен: запись могла сохраниться в MyShows. Проверьте её на сайте; отмена здесь не снимает отметку просмотра.'
    };
    const fail = code => { const error = new Error(code); error.code = code; return error; };
    async function read() { return (await chrome.storage.local.get(M.key))[M.key] || M.initial(); }
    function edit(change) {
        const result = writes.catch(() => {}).then(async () => {
            const state = await read();
            const value = await change(state);
            await chrome.storage.local.set({ [M.key]: state });
            return value;
        });
        writes = result;
        return result;
    }
    // Extension-origin IndexedDB is not exposed to Rezka/MyShows content scripts.
    // Do not put tokens into chrome.storage.local, messages to the panel, or logs.
    function secret(value) {
        return new Promise((resolve, reject) => {
            const open = indexedDB.open('rezka-myshows-credentials', 1);
            open.onupgradeneeded = () => open.result.createObjectStore('credentials');
            open.onerror = () => reject(fail('storage'));
            open.onsuccess = () => {
                const db = open.result;
                const tx = db.transaction('credentials', value === undefined ? 'readonly' : 'readwrite');
                const table = tx.objectStore('credentials');
                const request = value === undefined ? table.get('active') : value === null ? table.delete('active') : table.put(value, 'active');
                tx.oncomplete = () => { db.close(); resolve(request.result); };
                tx.onerror = tx.onabort = () => { db.close(); reject(fail('storage')); };
            };
        });
    }
    async function api(path, credential, body) {
        await rulesReady;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch('https://myshows.me/scrobble/' + path, {
                method: body ? 'POST' : 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store',
                headers: { Authorization: 'Bearer ' + credential.token, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: body ? JSON.stringify(body) : undefined, signal: controller.signal
            });
            let data = null;
            if (body) { try { data = await response.json(); } catch { /* An accepted write with no readable reply needs reconciliation. */ } }
            return { status: response.status, data };
        } catch { throw fail('network'); }
        finally { clearTimeout(timer); }
    }
    async function site(tabId, message) {
        const expectedPath = message.type === 'myshows:site-verify' ? `/view/episode/${message.episodeId}/` : '/profile/watch-history/';
        for (let i = 0; i < 35; i++) {
            try {
                const tab = await chrome.tabs.get(tabId);
                const url = new URL(tab.url);
                if (url.origin !== 'https://myshows.me' || url.pathname !== expectedPath) { await sleep(300); continue; }
                // The document/content script can be ready while ads keep tab.status at "loading".
                const reply = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
                if (reply?.ok) return reply;
                if (reply?.code === 'page') { await sleep(300); continue; }
                if (reply) throw fail(Object.hasOwn(errors, reply.code) ? reply.code : 'page');
            } catch (error) { if (error.code) throw error; }
            await sleep(300);
        }
        throw fail('page');
    }
    async function closeOwned(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.url?.startsWith('https://myshows.me/')) await chrome.tabs.remove(tabId);
        } catch { /* Already closed or navigated elsewhere by the user. */ }
    }
    async function openOwned(url, active = false) {
        const tab = await chrome.tabs.create({ url, active });
        // Recover only tabs created by this integration after a worker restart.
        await edit(state => { state.ownedTabs = [...(state.ownedTabs || []), tab.id]; });
        return tab.id;
    }
    async function release(tabId) {
        await closeOwned(tabId);
        await edit(state => { state.ownedTabs = (state.ownedTabs || []).filter(id => id !== tabId); });
    }
    async function connect() {
        if (connecting || running) throw fail('busy');
        connecting = true;
        let tabId;
        try {
            await edit(state => { state.enabled = false; state.connection = 'connecting'; state.message = 'Подключаем аккаунт MyShows…'; });
            const state = await read();
            if (state.connectTab) {
                try { const tab = await chrome.tabs.get(state.connectTab); if (tab.url === M.historyUrl) tabId = tab.id; } catch { /* Closed. */ }
            }
            if (!tabId) tabId = await openOwned(M.historyUrl, true);
            await edit(state => { state.connectTab = tabId; });
            const value = await site(tabId, { type: 'myshows:site-connect' });
            const credential = { token: value.token, account: value.account };
            if (typeof credential.account !== 'string' || !/^[a-z0-9_.-]{1,100}$/.test(credential.account)
                || typeof credential.token !== 'string' || credential.token.length < 16 || credential.token.length > 2048) throw fail('token');
            const check = await api('check', credential);
            if (check.status !== 200) throw fail(check.status === 401 || check.status === 403 ? 'auth' : 'network');
            const current = await site(tabId, { type: 'myshows:site-account' });
            if (current.account !== credential.account) throw fail('account');
            await secret(credential);
            await edit(state => {
                state.account = credential.account; state.connection = 'connected'; state.enabled = true; state.message = '';
                delete state.connectTab;
            });
            await release(tabId); tabId = null;
        } catch (error) {
            await edit(state => { state.connection = 'error'; state.enabled = false; state.message = errors[error.code] || errors.network; });
        } finally { connecting = false; kick(); }
    }
    async function live(entry) {
        const state = await read();
        const current = state.entries.find(e => e.id === entry.id);
        if (state.connection !== 'connected' || state.account !== entry.account || !current || M.terminal.has(current.status)
            || (!state.enabled && !current.manualPending)) throw fail('paused');
        return current;
    }
    async function changeEntry(id, change) { return edit(state => { const entry = state.entries.find(e => e.id === id); if (entry) return change(entry, state); }); }
    function shortenUnsentSource(entry) {
        const legacy = entry.source?.match(/^Rezka Custom · ([a-f0-9-]{36})$/);
        if (!entry.submittedAt && legacy) entry.source = M.sourceFor(legacy[1]);
    }
    function repairRejectedEntries(state) {
        for (const entry of state.entries) {
            const rejected = entry.events?.some(event => event.status === 'attention' && event.reason === errors.rejected);
            // 0.6.0/0.6.1 saved rejected 4xx requests as submitted. Only explicit rejection
            // evidence permits retry; a timeout or a missing record is never enough.
            if (/^Rezka Custom · [a-f0-9-]{36}$/.test(entry.source) && entry.submittedAt && rejected
                && !entry.episodeId && !entry.scrobbleId && !entry.exact && !entry.events.some(event => ['done', 'confirming'].includes(event.status))) {
                delete entry.submittedAt;
                entry.lastError = { stage: 'submit', code: 'legacy_rejected' };
                if (entry.status !== 'cancelled') {
                    entry.attempts = 0; entry.nextAt = 0;
                    entry.manualPending = !!entry.manualAt && (state.enabled || entry.manualPending);
                    M.transition(entry, 'queued', 'Исправлен формат отправки. Повторяем ранее отклонённую запись.');
                }
            }
            shortenUnsentSource(entry);
        }
    }
    async function perform(entry, credential) {
        let tabId;
        try {
            await live(entry);
            // Check the browser account before sending a write with the saved token.
            tabId = await openOwned(M.historyUrl);
            activeJob = { id: entry.id, tabId };
            const who = await site(tabId, { type: 'myshows:site-account' });
            if (who.account !== entry.account) throw fail('account');
            if (!entry.submittedAt) {
                if (!entry.episode.imdb) throw fail('identity');
                entry = await live(entry);
                // Persist intent BEFORE the network call. A crash can only trigger a read, never a duplicate POST.
                const sending = await changeEntry(entry.id, current => {
                    if (M.terminal.has(current.status)) return null;
                    shortenUnsentSource(current);
                    current.submittedAt = Date.now(); M.transition(current, 'sending'); return current;
                });
                if (!sending) throw fail('paused');
                entry = sending;
                let response;
                try { response = await api('stop', credential, M.payload(entry, REZKA_BUILD.version)); }
                catch { response = { status: 0, data: null }; }
                if ([401, 403, 429].includes(response.status)) {
                    await changeEntry(entry.id, (current, state) => {
                        delete current.submittedAt;
                        if (M.terminal.has(current.status)) return;
                        current.nextAt = Date.now() + 60000;
                        M.transition(current, 'queued', response.status === 429 ? 'MyShows просит подождать. Повторим через минуту.' : errors.auth);
                        if (response.status !== 429) { state.connection = 'error'; state.enabled = false; state.message = errors.auth; }
                    });
                    return;
                }
                if ([400, 404, 405, 410, 413, 415, 422].includes(response.status)) {
                    const validation = typeof response.data?.error === 'string' && response.data.error.startsWith('validation failed:');
                    const sourceError = validation && response.data.error.includes('sourceApp:len');
                    await changeEntry(entry.id, current => {
                        // An explicit rejection did not create a record. Retrying is a new submission,
                        // unlike uncertain responses which must remain on the reconciliation path.
                        delete current.submittedAt;
                        if (M.terminal.has(current.status)) return;
                        current.manualPending = false; current.attempts = (current.attempts || 0) + 1; current.nextAt = 0;
                        current.code = sourceError ? 'source' : validation ? 'validation' : 'rejected';
                        current.lastError = { stage: 'submit', httpStatus: response.status, code: validation ? 'validation' : 'rejected', ...(sourceError ? { field: 'source_app' } : {}) };
                        M.transition(current, 'attention', errors[current.code]);
                    });
                    return;
                }
                if (response.status >= 400 && response.status < 500) throw fail('rejected');
                const result = response.data;
                await changeEntry(entry.id, current => {
                    if (result?.action === 'scrobble' && result.match === 'exact' && result.objectType === 'episode'
                        && Number.isSafeInteger(result.objectId) && result.objectId > 0) {
                        current.episodeId = result.objectId; current.exact = true;
                        if (Number.isSafeInteger(result.id)) current.scrobbleId = result.id;
                        if (!M.terminal.has(current.status)) M.transition(current, 'confirming');
                    } else {
                        current.exact = false;
                        if (!M.terminal.has(current.status)) M.transition(current, 'checking', result ? errors.match : 'Ответ MyShows не получен. Проверяем историю перед повтором.');
                    }
                });
                await live(entry);
                // Fresh server-rendered history, including the record just created.
                await chrome.tabs.reload(tabId);
            }
            entry = await live(entry);
            const state = await read();
            const result = await site(tabId, { type: 'myshows:site-reconcile', account: entry.account, source: entry.source,
                episodeId: entry.episodeId, season: entry.episode.season, number: entry.episode.number,
                threshold: entry.threshold || state.threshold, allowApprove: !!entry.exact });
            await live(entry);
            await changeEntry(entry.id, current => { current.episodeId = result.episodeId; if (!M.terminal.has(current.status)) M.transition(current, 'checking'); });
            await live(entry);
            await chrome.tabs.update(tabId, { url: `https://myshows.me/view/episode/${result.episodeId}/` });
            const verified = await site(tabId, { type: 'myshows:site-verify', account: entry.account, episodeId: result.episodeId });
            if (!verified.watched) throw fail('unwatched');
            await changeEntry(entry.id, current => { if (!M.terminal.has(current.status)) { M.transition(current, 'done'); current.manualPending = false; current.completedAt = Date.now(); current.nextAt = 0; current.ranges = []; } });
        } catch (error) {
            await changeEntry(entry.id, (current, state) => {
                if (M.terminal.has(current.status)) return;
                const code = error.code || 'network';
                if (code === 'paused') { M.transition(current, current.submittedAt ? 'checking' : 'queued'); return; }
                current.attempts = (current.attempts || 0) + 1;
                current.code = code;
                if (code === 'account' || code === 'login') {
                    state.enabled = false; state.message = errors[code];
                    for (const item of state.entries) item.manualPending = false;
                }
                const retryable = ['page', 'network', 'pending', 'unwatched', 'missing'].includes(code);
                const nextStatus = retryable && current.attempts < 5 ? (current.submittedAt ? 'checking' : 'queued') : 'attention';
                if (nextStatus === 'attention') current.manualPending = false;
                current.nextAt = Date.now() + Math.min(3600000, 60000 * 2 ** (current.attempts - 1));
                M.transition(current, nextStatus, errors[code] || errors.network);
            });
        } finally { activeJob = null; if (tabId) await release(tabId); }
    }
    async function process() {
        if (running || connecting) return;
        running = true;
        try {
            for (let i = 0; i < 8; i++) {
                const state = await read();
                if (state.connection !== 'connected') break;
                const credential = await secret();
                if (!credential || credential.account !== state.account) {
                    await edit(state => { state.enabled = false; state.connection = 'error'; state.message = errors.auth; }); break;
                }
                const entry = state.entries.find(e => e.account === state.account && (state.enabled || e.manualPending)
                    && M.active.has(e.status) && (e.nextAt || 0) <= Date.now());
                if (!entry) break;
                await perform(entry, credential);
            }
        } finally { running = false; }
    }
    function kick() { process().catch(() => { /* Durable queue remains intact; alarm retries after a storage failure. */ }); }
    async function progress(message, sender) {
        const episode = M.validEpisode(message.episode);
        const duration = message.duration;
        const url = new URL(sender.url);
        const rezkaId = Number(url.pathname.match(/\/(\d+)-[^/]+\.html$/)?.[1]);
        if (!episode || rezkaId !== episode.rezkaId || !Number.isFinite(duration) || duration < 60 || duration > 43200
            || !Array.isArray(message.ranges) || message.ranges.length > 1000) throw fail('input');
        const ranges = M.mergeRanges(message.ranges, duration);
        const confirmedPosition = message.confirmedPosition ?? 0;
        if (!Number.isFinite(confirmedPosition) || confirmedPosition < 0 || confirmedPosition > duration
            || (confirmedPosition > 0 && !ranges.some(([start, end]) => start <= confirmedPosition && end >= confirmedPosition))) throw fail('input');
        if (!ranges.length) return;
        const tracking = await edit(state => {
            if (!state.enabled || state.connection !== 'connected' || state.account !== message.account) return;
            const key = M.episodeKey(episode);
            let entry = state.entries.find(e => e.account === state.account && e.key === key);
            if (entry && entry.status !== 'watching') return false;
            if (!entry) {
                const id = crypto.randomUUID();
                entry = { id, source: M.sourceFor(id), key, account: state.account, episode, url: url.origin + url.pathname,
                    createdAt: Date.now(), duration, ranges: [], progress: 0, status: 'watching', events: [] };
                state.entries.push(entry);
            }
            // Different cuts/translations must not fill each other's missing footage.
            if (Math.abs(entry.duration - duration) > Math.max(5, entry.duration * .02)) { entry.ranges = []; entry.confirmedPosition = 0; }
            entry.duration = duration; entry.episode = episode;
            entry.ranges = M.mergeRanges([...entry.ranges, ...ranges], duration);
            entry.watchedProgress = M.percent(entry.ranges, duration);
            entry.confirmedPosition = Math.min(duration, Math.max(entry.confirmedPosition || 0, confirmedPosition));
            entry.progress = Math.max(entry.watchedProgress, entry.confirmedPosition / duration * 100); entry.updatedAt = Date.now();
            if (entry.progress >= state.threshold) { entry.threshold = state.threshold; M.transition(entry, 'queued'); }
            return entry.status === 'watching';
        });
        kick();
        return { tracking };
    }
    async function panel(message) {
        if (message.type === 'myshows:state') return { state: await read() };
        if (message.type === 'myshows:current') return { current: await currentEpisode(message.tabId) };
        if (message.type === 'myshows:force') return force(message);
        if (message.type === 'myshows:connect') {
            if (running || connecting) return { error: 'Дождитесь завершения текущей проверки.' };
            connect().catch(() => {}); return {};
        }
        if (message.type === 'myshows:disconnect') {
            if (connecting) return { error: 'Дождитесь завершения подключения.' };
            await edit(state => { state.enabled = false; state.connection = 'disconnected'; state.message = ''; });
            await secret(null); return {};
        }
        if (message.type === 'myshows:configure') {
            await edit(state => {
                if (typeof message.enabled === 'boolean') {
                    state.enabled = message.enabled && state.connection === 'connected';
                    if (state.enabled) state.message = '';
                    else for (const entry of state.entries) entry.manualPending = false;
                }
                if ([80, 90, 95].includes(message.threshold)) state.threshold = message.threshold;
                for (const entry of state.entries) {
                    if (entry.account === state.account && entry.status === 'watching' && entry.progress >= state.threshold) {
                        entry.threshold = state.threshold; M.transition(entry, 'queued');
                    }
                }
            }); kick(); return {};
        }
        if (message.type === 'myshows:resume') {
            const result = await changeEntry(message.id, (entry, state) => {
                if (state.connection !== 'connected' || message.account !== state.account || entry.account !== state.account) return { error: 'Подключите аккаунт этой записи.' };
                if (!M.canResume(entry) || activeJob?.id === entry.id) return { error: 'Сначала проверьте результат отправки в MyShows. Повторная отправка остановлена, чтобы не создать дубль.' };
                delete entry.manualAt; delete entry.code; delete entry.lastError;
                entry.manualPending = false; entry.attempts = 0; entry.nextAt = 0; entry.threshold = state.threshold;
                M.transition(entry, entry.progress >= state.threshold ? 'queued' : 'watching', 'Ручная отправка отменена. Продолжаем учитывать фактический просмотр.');
                return { notice: state.enabled ? 'Отслеживание серии продолжено.' : 'Серия возвращена к отслеживанию. Включите автоматические отметки, чтобы продолжить учёт просмотра.' };
            });
            kick(); return result || { error: 'Запись недоступна.' };
        }
        if (message.type === 'myshows:retry' || message.type === 'myshows:cancel') {
            let cancelled = false;
            await changeEntry(message.id, (entry, state) => {
                if (entry.account !== state.account) return;
                if (message.type === 'myshows:cancel') {
                    if (!M.canCancel(entry)) return;
                    entry.manualPending = false; entry.nextAt = 0; cancelled = true;
                    M.transition(entry, 'cancelled', entry.submittedAt ? errors.paused : 'Отправка отменена. Серия не будет отмечена автоматически, пока вы не продолжите отслеживание.'); return;
                }
                if (entry.status !== 'attention') return;
                entry.attempts = 0; entry.nextAt = 0;
                if (entry.manualAt) entry.manualPending = true;
                M.transition(entry, entry.submittedAt ? 'checking' : 'queued');
            });
            if (cancelled && activeJob?.id === message.id) await closeOwned(activeJob.tabId);
            kick(); return cancelled ? { notice: 'Синхронизация отменена. Запись сохранена в «Истории».' } : {};
        }
        throw fail('input');
    }
    async function currentEpisode(tabId) {
        if (!Number.isInteger(tabId)) return null;
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab.active || !RezkaNetwork.isSite(tab.url)) return null;
            const reply = await chrome.tabs.sendMessage(tabId, { type: 'myshows:player-current' }, { frameId: 0 });
            if (reply?.build !== REZKA_BUILD.id) return null;
            const episode = M.validEpisode(reply.episode);
            const url = new URL(tab.url);
            if (!episode || episode.rezkaId !== Number(url.pathname.match(/\/(\d+)-[^/]+\.html$/)?.[1])) return null;
            return { tabId, episode, key: M.episodeKey(episode), url: url.origin + url.pathname };
        } catch { return null; }
    }
    async function force(message) {
        // Never trust panel-supplied episode metadata: obtain it from the actual top frame.
        const current = message.id ? null : await currentEpisode(message.tabId);
        if (!message.id && (!current || current.key !== message.key)) return { error: 'На странице выбрана другая серия или вкладка недоступна. Проверьте текущую серию и нажмите ещё раз.' };
        const result = await edit(state => {
            if (state.connection !== 'connected') return { error: 'Сначала подключите MyShows.' };
            if (!message.account || message.account !== state.account) return { error: 'Аккаунт изменился. Откройте раздел MyShows заново.' };
            let entry = state.entries.find(e => e.account === state.account && (message.id ? e.id === message.id : e.key === current.key));
            if (message.id && !entry) return { error: 'Запись недоступна в подключённом аккаунте.' };
            if (!M.canForce(entry)) return { notice: entry.status === 'done' ? 'Серия уже отмечена в MyShows.' : 'Серия уже отправлена на синхронизацию. Следите за её статусом в списке.' };
            if (!entry) {
                const id = crypto.randomUUID();
                entry = { id, source: M.sourceFor(id), key: current.key, account: state.account, episode: current.episode, url: current.url,
                    createdAt: Date.now(), duration: 0, ranges: [], progress: 0, status: 'watching', events: [], origin: 'manual' };
                state.entries.push(entry);
            } else if (current) entry.episode = current.episode;
            entry.manualAt = Date.now(); entry.manualPending = true; entry.threshold = 100;
            entry.attempts = 0; entry.nextAt = 0; delete entry.code;
            M.transition(entry, 'queued', 'Запрошена ручная отметка без ожидания порога просмотра.');
            return { notice: 'Серия добавлена в очередь вручную. Проверяем отметку в MyShows.' };
        });
        kick(); return result;
    }
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (!message?.type?.startsWith('myshows:') || message.type.startsWith('myshows:site-')) return;
        if (sender.id !== chrome.runtime.id) return;
        const isPanel = !sender.tab && sender.url === chrome.runtime.getURL('popup.html');
        const isPlayer = sender.tab && sender.frameId === 0 && RezkaNetwork.isSite(sender.url);
        if (!isPanel && !(isPlayer && message.type === 'myshows:progress')) { respond({ ok: false }); return; }
        (isPanel ? panel(message) : progress(message, sender)).then(result => respond({ ok: !result?.error, ...result }), () => respond({ ok: false, error: 'Не удалось сохранить изменения. Повторите попытку.' }));
        return true;
    });
    chrome.alarms.onAlarm.addListener(value => { if (value.name === alarm) kick(); });
    async function startup() {
        // Chrome may clear alarms on restart. Recreate the compatible one-minute alarm.
        await chrome.alarms.create(alarm, { periodInMinutes: 1 });
        const state = await read();
        for (const id of state.ownedTabs || []) if (id !== state.connectTab) await closeOwned(id);
        await edit(current => {
            repairRejectedEntries(current);
            current.ownedTabs = current.connectTab ? [current.connectTab] : [];
            if (current.connection === 'connecting') { current.connection = 'error'; current.enabled = false; current.message = 'Подключение прервалось. Нажмите «Подключить MyShows» ещё раз.'; }
        });
        kick();
    }
    startup().catch(() => {});
})();
