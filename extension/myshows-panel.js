const RezkaMyShowsPanel = (() => {
    const M = RezkaMyShows;
    const labels = { watching: 'Смотрю', queued: 'В очереди', sending: 'Отправляем', confirming: 'Подтверждаем', checking: 'Проверяем',
        attention: 'Нужно внимание', done: 'Отмечено', cancelled: 'Остановлено' };
    let dispose = () => {}, selectedFilter = 'queue';
    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    function button(text, action, className = 'myshows-button') {
        const node = element('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node;
    }
    function link(text, url) {
        const node = element('a', 'myshows-link', text); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
    }
    const date = time => new Date(time).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    function mount(root, query = '', getTarget = () => null) {
        dispose();
        let state = null, closed = false, busy = false, filter = selectedFilter, limit = 50, signature = '';
        let current = null, currentRequest = 0, currentTabId = null;
        root.append(element('h1', '', 'MyShows'), element('p', 'intro', 'Смотрите на Rezka — отметки появятся в MyShows автоматически.'));
        const connection = element('section', 'myshows-connection'); connection.setAttribute('aria-label', 'Подключение MyShows');
        const account = element('p', 'myshows-account', 'Проверяем подключение…');
        const description = element('p', 'myshows-description');
        const connectButton = button('Подключить MyShows', () => command('connect'));
        const disconnectButton = button('Отключить', () => command('disconnect'), 'text-button');
        const connectionActions = element('div', 'myshows-actions'); connectionActions.append(connectButton, disconnectButton);
        connection.append(account, description, connectionActions);
        const enabledLabel = element('label', 'setting setting-toggle');
        const enabledText = element('span', 'setting-text');
        const enabledName = element('span', 'setting-name', 'Автоматические отметки'); enabledName.id = 'myshows-enabled-label';
        enabledText.append(enabledName, element('span', 'setting-description', 'Новые просмотры и сохранённая очередь'));
        const enabled = element('input', 'switch'); enabled.type = 'checkbox'; enabled.setAttribute('role', 'switch'); enabled.setAttribute('aria-labelledby', enabledName.id);
        enabled.addEventListener('change', () => command('configure', { enabled: enabled.checked }));
        enabledLabel.append(enabledText, enabled);
        const thresholdLabel = element('label', 'setting stacked');
        const thresholdText = element('span', 'setting-text'); thresholdText.append(element('span', 'setting-name', 'Когда отмечать серию'), element('span', 'setting-description', 'По просмотренной части. Перемотка вперёд не засчитывается.'));
        const threshold = element('select'); threshold.setAttribute('aria-label', 'Просмотренная часть для отметки');
        for (const value of [80, 90, 95]) { const option = element('option', '', `${value}% серии`); option.value = value; threshold.append(option); }
        threshold.addEventListener('change', () => command('configure', { threshold: Number(threshold.value) }));
        thresholdLabel.append(thresholdText, threshold);
        const currentSection = element('section', 'myshows-current'); currentSection.setAttribute('aria-label', 'Текущая серия');
        currentSection.append(element('h2', 'myshows-journal-title', 'Текущая серия'));
        const currentTitle = element('p', 'myshows-account');
        const currentDescription = element('p', 'myshows-description', 'Откройте нужную серию на Rezka. Здесь можно засчитать её, не дожидаясь порога просмотра.');
        const forceCurrent = button('Засчитать серию', () => {
            if (current) command('force', { tabId: current.tabId, key: current.key, account: state.account });
        }); forceCurrent.hidden = true;
        currentSection.append(currentTitle, currentDescription, forceCurrent);
        const message = element('p', 'myshows-message'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); message.hidden = true;
        const heading = element('h2', 'myshows-journal-title', 'Синхронизация');
        const summary = element('p', 'myshows-description');
        const filters = element('div', 'myshows-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Записи синхронизации');
        for (const [value, name] of [['queue', 'Очередь'], ['attention', 'Внимание'], ['history', 'История']]) {
            const node = button(name, () => { filter = selectedFilter = value; limit = 50; signature = ''; renderList(); });
            node.dataset.filter = value; filters.append(node);
        }
        const list = element('div', 'myshows-list');
        const more = button('Показать ещё', () => { limit += 50; signature = ''; renderList(); }, 'text-button'); more.hidden = true;
        const historyLink = link('Открыть историю в MyShows', M.historyUrl);
        root.append(connection, enabledLabel, thresholdLabel, currentSection, message, heading, summary, filters, list, more, historyLink);
        async function command(type, extra = {}) {
            if (busy) return;
            busy = true; controls();
            try {
                const reply = await chrome.runtime.sendMessage({ type: 'myshows:' + type, ...extra });
                if (!reply?.ok) throw new Error(reply?.error || 'Не удалось выполнить действие. Повторите попытку.');
                await refresh();
                if (reply.notice && !closed) { message.hidden = false; message.textContent = reply.notice; }
            } catch (error) { message.hidden = false; message.textContent = error.message; }
            finally { busy = false; if (!closed) controls(); }
        }
        function controls() {
            const connected = state?.connection === 'connected';
            const connecting = state?.connection === 'connecting';
            enabled.disabled = busy || !connected;
            threshold.disabled = busy || !state;
            connectButton.disabled = busy || connecting;
            disconnectButton.disabled = busy || connecting;
            connectButton.hidden = connected;
            disconnectButton.hidden = !connected;
            const currentEntry = current && state?.entries.find(entry => entry.account === state.account && entry.key === current.key);
            forceCurrent.disabled = busy || !connected || !current || !M.canForce(currentEntry);
            forceCurrent.textContent = currentEntry?.status === 'done' ? 'Уже отмечено' : currentEntry && !M.canForce(currentEntry)
                ? (currentEntry.status === 'attention' ? 'Нужна проверка в списке' : 'Уже в синхронизации') : 'Засчитать серию';
            for (const action of list.querySelectorAll('button')) action.disabled = busy || (action.dataset.requiresConnection === 'true' && !connected);
        }
        async function refreshCurrent() {
            const request = ++currentRequest;
            const tabId = getTarget()?.id;
            if (currentTabId !== tabId) { current = null; currentTabId = tabId; showCurrent(); }
            if (!Number.isInteger(tabId)) return;
            try {
                const reply = await chrome.runtime.sendMessage({ type: 'myshows:current', tabId });
                if (closed || request !== currentRequest || getTarget()?.id !== tabId) return;
                current = reply?.ok ? reply.current : null;
            } catch { if (!closed && request === currentRequest) current = null; }
            if (!closed && request === currentRequest) showCurrent();
        }
        function showCurrent() {
            currentTitle.textContent = current ? `${current.episode.title} · ${M.label(current.episode)}` : '';
            currentTitle.hidden = !current;
            currentDescription.textContent = current ? 'Засчитать эту серию сейчас, даже если порог просмотра не достигнут. Работает и при выключенных автоотметках.'
                : 'Откройте нужную серию на Rezka. Если она уже открыта, обновите страницу после обновления расширения.';
            forceCurrent.hidden = !current;
            controls();
        }
        function renderList() {
            if (!state || closed) return;
            const entries = state.entries.filter(entry => entry.account === state.account);
            const queue = entries.filter(entry => !M.terminal.has(entry.status) && entry.status !== 'attention');
            const attention = entries.filter(entry => entry.status === 'attention');
            const done = entries.filter(entry => entry.status === 'done');
            summary.textContent = `В очереди и в просмотре: ${queue.length} · Нужно внимание: ${attention.length} · Отмечено: ${done.length}`;
            filters.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.filter === filter)));
            let items = (filter === 'queue' ? queue : filter === 'attention' ? attention : entries.filter(entry => M.terminal.has(entry.status)))
                .filter(entry => `${entry.episode.title} ${entry.episode.originalTitle} ${M.label(entry.episode)}`.toLocaleLowerCase('ru').includes(query))
                .sort((a, b) => b.updatedAt - a.updatedAt);
            const nextSignature = JSON.stringify(items.slice(0, limit).map(e => [e.id, e.status, e.reason, Math.floor(e.progress), e.events, e.nextAt, e.manualAt, e.manualPending]));
            if (signature === nextSignature) return;
            signature = nextSignature;
            const focused = document.activeElement?.dataset.myshowsAction;
            const expanded = new Set([...list.querySelectorAll('details[open]')].map(node => node.dataset.id));
            list.replaceChildren();
            if (!items.length) {
                const empty = element('div', 'myshows-empty');
                empty.append(element('h3', '', query ? 'Ничего не найдено' : filter === 'history' ? 'Отметки появятся здесь' : filter === 'attention' ? 'Всё в порядке' : 'Очередь пуста'),
                    element('p', '', query ? 'Попробуйте название сериала или номер S01E01.' : filter === 'history' ? 'Здесь сохраняются результаты и история каждой синхронизации.' : filter === 'attention' ? 'Серий, требующих проверки, нет.' : 'Подключите MyShows и начните смотреть серию. Просмотр появится здесь примерно через 10 секунд.'));
                list.append(empty);
            }
            for (const entry of items.slice(0, limit)) {
                const row = element('article', 'myshows-entry');
                row.append(element('h3', '', entry.episode.title));
                const meta = element('div', 'myshows-entry-meta');
                meta.append(element('span', 'myshows-episode', M.label(entry.episode)), element('span', 'myshows-state', labels[entry.status] || 'Нужно внимание'));
                meta.lastChild.dataset.status = entry.status; row.append(meta);
                if (entry.status === 'watching') row.append(element('p', 'myshows-description', `Просмотрено ${Math.floor(entry.progress)}% · Отметим после ${state.threshold}%`));
                if (entry.manualAt) row.append(element('p', 'myshows-description', 'По кнопке «Засчитать серию»'));
                if (entry.reason) row.append(element('p', 'myshows-description', entry.reason));
                const actions = element('div', 'myshows-actions');
                if (M.canForce(entry)) {
                    const force = button('Засчитать серию', () => command('force', { id: entry.id, account: state.account }), 'text-button');
                    force.dataset.myshowsAction = entry.id + '-force'; force.dataset.requiresConnection = 'true'; actions.append(force);
                }
                if (entry.status === 'attention') {
                    const retry = button(entry.submittedAt ? 'Проверить' : 'Повторить', () => command('retry', { id: entry.id }), 'text-button');
                    retry.dataset.myshowsAction = entry.id + '-retry'; actions.append(retry);
                }
                if (['watching', 'queued', 'attention'].includes(entry.status)) {
                    const cancel = button('Остановить', () => command('cancel', { id: entry.id }), 'text-button');
                    cancel.dataset.myshowsAction = entry.id + '-cancel'; actions.append(cancel);
                }
                if (entry.episodeId) actions.append(link('Серия в MyShows', `https://myshows.me/view/episode/${entry.episodeId}/`));
                else if (entry.submittedAt) actions.append(link('Проверить в MyShows', M.historyUrl));
                row.append(actions);
                const details = element('details', 'myshows-events'); details.dataset.id = entry.id; details.open = expanded.has(entry.id);
                details.append(element('summary', '', 'История · ' + date(entry.updatedAt || entry.createdAt)));
                const events = element('ol');
                events.append(element('li', '', date(entry.createdAt) + (entry.origin === 'manual' ? ' · Добавлена вручную' : ' · Начат просмотр')));
                for (const event of entry.events || []) events.append(element('li', '', `${date(event.at)} · ${labels[event.status] || event.status}${event.reason ? '. ' + event.reason : ''}`));
                details.append(events); row.append(details); list.append(row);
            }
            more.hidden = items.length <= limit;
            if (focused) [...list.querySelectorAll('button')].find(node => node.dataset.myshowsAction === focused)?.focus();
            controls();
        }
        function update(value) {
            if (closed) return;
            state = value || M.initial();
            const connected = state.connection === 'connected';
            account.textContent = connected ? `Подключён ${state.account}` : state.connection === 'connecting' ? 'Подключаем MyShows…' : 'MyShows не подключён';
            description.textContent = connected ? (state.enabled ? 'Отметки и очередь обрабатываются автоматически.' : 'Автоотметки на паузе. Можно засчитать отдельную серию вручную.')
                : 'Откроем MyShows и подключим существующий API-токен. Нужны вход в аккаунт в этом Chrome и доступ к скробблингу (MyShows PRO).';
            enabled.checked = state.enabled; threshold.value = state.threshold;
            message.textContent = state.message || ''; message.hidden = !state.message;
            renderList(); controls();
        }
        async function refresh() {
            const reply = await chrome.runtime.sendMessage({ type: 'myshows:state' });
            if (!reply?.ok) throw new Error('Не удалось загрузить очередь. Откройте раздел заново.');
            update(reply.state);
        }
        const listener = (changes, area) => { if (area === 'local' && changes[M.key]) update(changes[M.key].newValue); };
        chrome.storage.onChanged.addListener(listener);
        refresh().catch(error => { if (!closed) { account.textContent = 'Не удалось загрузить MyShows'; message.textContent = error.message; message.hidden = false; } });
        refreshCurrent();
        const currentTimer = setInterval(refreshCurrent, 2000);
        dispose = () => { closed = true; ++currentRequest; clearInterval(currentTimer); chrome.storage.onChanged.removeListener(listener); };
        return dispose;
    }
    return { mount, unmount: () => dispose() };
})();
