const RezkaMyShowsPanel = (() => {
    const M = RezkaMyShows;
    const labels = { watching: 'Смотрю', queued: 'В очереди', sending: 'Отправляем', confirming: 'Подтверждаем', checking: 'Проверяем',
        attention: 'Нужно внимание', done: 'Отмечено в MyShows', cancelled: 'Отменено', reset: 'Сброшено в расширении' };
    const resetHint = 'Сбросить локальную отметку и прогресс. Состояние в MyShows не изменится. Повторное засчитывание — вручную.';
    const cancelledDescription = entry => entry.submittedAt
        ? 'Запрос уже отправлен. Проверьте результат в MyShows: остановка синхронизации не снимает отметку на сайте.'
        : `Отправка отменена. Можно продолжить отслеживание или засчитать ${M.isMovie(entry.episode) ? 'фильм' : 'серию'} вручную.`;
    let dispose = () => {}, updateQuery = null, selectedFilter = 'queue', settingsOpen = false;
    const element = (tag, className, value) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (value !== undefined) node.textContent = value;
        return node;
    };
    const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
    const describe = (node, value) => { text(node, value); node.hidden = !value; };
    function button(name, action, className = 'myshows-button') {
        const node = element('button', className, name); node.type = 'button'; node.addEventListener('click', action); return node;
    }
    function link(name, url) {
        const node = element('a', 'myshows-link', name); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
    }
    const date = time => new Date(time).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const visible = node => node?.isConnected && !node.closest('[hidden]') && !node.disabled;
    function keepFocus(previous, fallback) {
        if (!previous) return;
        if (!visible(previous)) fallback?.focus({ preventScroll: true });
        else if (document.activeElement !== previous) previous.focus({ preventScroll: true });
    }
    function mount(root, query = '', getTarget = () => null) {
        dispose();
        let state = null, closed = false, busy = false, filter = selectedFilter, limit = 50, searchQuery = query;
        let current = null, currentRequest = 0, currentTabId = null, currentPending = false, searchTimer;
        let knownStatuses = null, lastConfirmation = '', lastSearch = '', lastStateMessage = '';
        const rows = new Map();
        root.append(element('h1', '', 'MyShows'));
        const connection = element('section', 'myshows-connection'); connection.setAttribute('aria-label', 'Подключение MyShows');
        const account = element('p', 'myshows-account', 'Проверяем подключение…');
        const connectionDescription = element('p', 'myshows-description');
        const connectButton = button('Подключить MyShows', () => command('connect'), 'myshows-button myshows-primary');
        connection.append(account, connectionDescription, connectButton);
        const currentSection = element('section', 'myshows-current'); currentSection.setAttribute('aria-label', 'Текущий просмотр');
        const currentHeading = element('div', 'myshows-current-heading');
        const currentBody = element('div', 'myshows-current-body');
        const currentTitle = element('h3', 'myshows-account');
        const currentProgress = element('p', 'myshows-progress');
        const currentCredit = element('span', 'myshows-progress-credit');
        const currentValue = element('strong', 'myshows-progress-value');
        currentCredit.append(document.createTextNode('Учтено '), currentValue);
        const currentThreshold = element('span', 'myshows-progress-threshold');
        const currentThresholdText = element('span');
        currentThreshold.append(element('span', 'visually-hidden', ' · '), currentThresholdText);
        currentProgress.append(currentCredit, currentThreshold);
        const progressTrack = element('div', 'myshows-progress-track'); progressTrack.hidden = true;
        const progressMeter = element('progress', 'myshows-progress-meter'); progressMeter.max = 100;
        progressMeter.setAttribute('aria-label', 'Учтённая часть просмотра');
        const thresholdMarker = element('span', 'myshows-threshold-marker'); thresholdMarker.setAttribute('aria-hidden', 'true');
        progressTrack.append(progressMeter, thresholdMarker);
        const confirmation = element('p', 'myshows-confirmation');
        const currentState = element('p', 'myshows-state'); currentState.tabIndex = -1;
        const currentHeadingTitle = element('h2', 'myshows-journal-title', 'Текущий просмотр');
        currentHeading.append(currentHeadingTitle, currentState);
        const currentDescription = element('p', 'myshows-description');
        const currentEntry = () => current && state?.entries.find(entry => entry.account === state.account && entry.key === current.key);
        const forceCurrent = button('Засчитать серию', () => {
            if (current) command('force', { tabId: current.tabId, key: current.key, account: state.account });
        }, 'myshows-button myshows-primary');
        const withCurrent = type => { const entry = currentEntry(); if (entry) command(type, { id: entry.id, account: state.account }); };
        const retryCurrent = button('Проверить', () => withCurrent('retry'), 'myshows-button myshows-primary');
        retryCurrent.dataset.myshowsCurrent = 'retry';
        const resumeCurrent = button('Продолжить отслеживание', () => withCurrent('resume'));
        resumeCurrent.dataset.myshowsCurrent = 'resume';
        const cancelCurrent = button('Отменить отправку', () => withCurrent('cancel'), 'text-button');
        cancelCurrent.dataset.myshowsCurrent = 'cancel';
        const resetCurrent = button('Сбросить запись', () => withCurrent('reset'), 'text-button');
        resetCurrent.dataset.myshowsCurrent = 'reset'; resetCurrent.title = resetHint;
        const currentLink = link('Проверить в MyShows', M.historyUrl);
        const currentActions = element('div', 'myshows-actions'); currentActions.append(forceCurrent, retryCurrent, resumeCurrent, cancelCurrent, resetCurrent, currentLink);
        currentBody.append(currentTitle, currentProgress, progressTrack, confirmation, currentDescription, currentActions);
        currentSection.append(currentHeading, currentBody);
        const message = element('p', 'myshows-message'); message.setAttribute('role', 'status'); message.hidden = true;
        const announcement = element('p', 'visually-hidden'); announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-atomic', 'true');
        const settings = element('details', 'myshows-settings'); settings.open = settingsOpen;
        const settingsSummary = element('summary', '', 'Настройки MyShows');
        settings.addEventListener('toggle', () => { if (!closed) settingsOpen = settings.open; });
        const enabledLabel = element('label', 'setting setting-toggle');
        const enabledText = element('span', 'setting-text');
        const enabledName = element('span', 'setting-name', 'Автоматические отметки'); enabledName.id = 'myshows-enabled-label';
        const enabledDescription = element('span', 'setting-description', 'Учёт просмотра и обработка очереди'); enabledDescription.id = 'myshows-enabled-description';
        enabledText.append(enabledName, enabledDescription);
        const enabled = element('input', 'switch'); enabled.type = 'checkbox'; enabled.setAttribute('role', 'switch');
        enabled.setAttribute('aria-labelledby', enabledName.id); enabled.setAttribute('aria-describedby', enabledDescription.id);
        enabled.addEventListener('change', () => command('configure', { enabled: enabled.checked }));
        enabledLabel.append(enabledText, enabled);
        const thresholdLabel = element('label', 'setting stacked');
        const thresholdText = element('span', 'setting-text');
        const thresholdDescription = element('span', 'setting-description', `После перемотки или продолжения с сохранённого места позиция учитывается через ${M.positionDelay} секунд просмотра. Пауза и загрузка не считаются.`);
        thresholdDescription.id = 'myshows-threshold-description';
        thresholdText.append(element('span', 'setting-name', 'Когда отмечать просмотр'), thresholdDescription);
        const threshold = element('select'); threshold.setAttribute('aria-label', 'Просмотренная часть для отметки'); threshold.setAttribute('aria-describedby', thresholdDescription.id);
        for (const value of [80, 90, 95]) { const option = element('option', '', `${value}% просмотра`); option.value = value; threshold.append(option); }
        threshold.addEventListener('change', () => command('configure', { threshold: Number(threshold.value) }));
        thresholdLabel.append(thresholdText, threshold);
        const disconnectButton = button('Отключить MyShows', () => command('disconnect'), 'text-button');
        settings.append(settingsSummary, enabledLabel, thresholdLabel, disconnectButton);
        const heading = element('h2', 'myshows-journal-title', 'Журнал синхронизации'); heading.tabIndex = -1;
        const filters = element('div', 'myshows-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Записи синхронизации');
        for (const [value, name] of [['queue', 'Очередь'], ['attention', 'Внимание'], ['history', 'История']]) {
            const node = button(name, () => { filter = selectedFilter = value; limit = 50; renderList(); });
            node.append(document.createTextNode(' '), element('span', 'myshows-filter-count', '0'));
            node.dataset.filter = value; node.dataset.name = name; filters.append(node);
        }
        const searchSummary = element('p', 'myshows-description'); searchSummary.hidden = true;
        const searchAnnouncement = element('p', 'visually-hidden'); searchAnnouncement.setAttribute('role', 'status'); searchAnnouncement.setAttribute('aria-atomic', 'true');
        const list = element('div', 'myshows-list');
        const empty = element('div', 'myshows-empty');
        const emptyTitle = element('h3'), emptyText = element('p'); empty.append(emptyTitle, emptyText);
        const more = button('Показать ещё', () => { limit += 50; renderList(); }, 'text-button'); more.hidden = true;
        root.append(connection, currentSection, message, announcement, settings, heading, filters, searchSummary, searchAnnouncement, list, more, link('Открыть историю в MyShows', M.historyUrl));
        const connected = () => state?.connection === 'connected';
        const progressText = entry => Number.isFinite(entry?.progress)
            ? `Учтено ${Math.floor(entry.progress)}% · ${connected() && state.enabled ? 'порог' : 'автоотметки на паузе, порог'} ${state.threshold}%` : '';
        const mediaLinkText = entry => M.isMovie(entry?.episode) ? 'Фильм в MyShows' : 'Серия в MyShows';
        function statusText(entry) {
            if (entry?.status === 'watching' && (!connected() || !state.enabled)) return 'Учёт на паузе';
            if (entry?.status === 'queued' && (!connected() || (!state.enabled && !entry.manualPending))) return 'Очередь на паузе';
            return labels[entry?.status] || '';
        }
        function explanation(entry) {
            if (entry?.status === 'reset') return `Локальная отметка и прогресс сброшены. В MyShows ничего не изменилось. Нажмите «Засчитать ${M.isMovie(entry.episode) ? 'фильм' : 'серию'}», чтобы отметить просмотр заново.`;
            if (entry?.status === 'cancelled') return cancelledDescription(entry);
            if (entry?.reason) return entry.reason;
            if (entry?.status === 'done') return entry.manualAt ? 'Просмотр засчитан вручную. Отметка проверена на сайте.' : 'Отметка проверена на сайте.';
            if (entry?.status === 'attention') return 'Не удалось завершить синхронизацию. Повторите проверку.';
            if (M.active.has(entry?.status)) return entry.status === 'queued' && (!connected() || (!state.enabled && !entry.manualPending))
                ? 'Включите автоотметки, чтобы продолжить обработку очереди.' : 'Просмотр будет отмечен после проверки результата в MyShows.';
            return connected() && !state.enabled ? 'Учёт просмотра на паузе. Можно засчитать вручную.' : '';
        }
        async function command(type, extra = {}) {
            if (busy) return;
            busy = true; controls(); describe(message, '');
            try {
                const reply = await chrome.runtime.sendMessage({ type: 'myshows:' + type, ...extra });
                if (!reply?.ok) throw new Error(reply?.error || 'Не удалось выполнить действие. Повторите попытку.');
                await refresh();
                if (reply.notice && !closed) describe(message, reply.notice);
            } catch (error) { if (!closed) describe(message, error.message); }
            finally { busy = false; if (!closed) controls(); }
        }
        function controls() {
            const connecting = state?.connection === 'connecting';
            enabled.disabled = busy || !connected(); threshold.disabled = busy || !state;
            if (state) { enabled.checked = state.enabled; threshold.value = state.threshold; }
            connectButton.disabled = busy || connecting; connectButton.hidden = connected();
            disconnectButton.disabled = busy || connecting; disconnectButton.hidden = !connected();
            showCurrent();
            for (const view of rows.values()) updateRowActions(view);
        }
        function showCurrent() {
            const focused = currentSection.contains(document.activeElement) ? document.activeElement : null;
            const entry = currentEntry();
            const movie = M.isMovie(current?.episode);
            text(currentHeadingTitle, current ? (movie ? 'Текущий фильм' : 'Текущая серия') : 'Текущий просмотр');
            currentSection.setAttribute('aria-label', currentHeadingTitle.textContent);
            text(forceCurrent, movie ? 'Засчитать фильм' : 'Засчитать серию');
            describe(currentTitle, current ? `${current.episode.title} · ${M.label(current.episode)}` : '');
            const hasProgress = !!current && Number.isFinite(entry?.progress);
            currentProgress.hidden = progressTrack.hidden = !hasProgress;
            if (hasProgress) {
                const value = Math.max(0, Math.min(100, Math.floor(entry.progress)));
                text(currentValue, `${value}%`);
                text(currentThresholdText, `${connected() && state.enabled ? 'порог' : 'автоотметки на паузе, порог'} ${state.threshold}%`);
                progressMeter.value = value;
                progressMeter.setAttribute('aria-valuetext', progressText(entry));
                progressTrack.style.setProperty('--myshows-threshold', `${state.threshold}%`);
                thresholdMarker.title = `Порог автоотметки: ${state.threshold}%`;
            }
            const status = current ? statusText(entry) || (connected() && state.enabled ? 'Ожидаем просмотр' : 'Учёт на паузе') : 'Просмотр не выбран';
            describe(currentState, status); currentState.dataset.status = entry?.status || '';
            describe(currentDescription, !current ? 'Откройте фильм или серию на Rezka. Если страница уже открыта, проверьте её подключение вверху панели.'
                : !connected() ? 'Подключите MyShows, чтобы учитывать просмотр фильмов и серий.'
                : explanation(entry) || (entry ? '' : `Запустите просмотр или засчитайте ${movie ? 'фильм' : 'серию'} вручную.`));
            forceCurrent.hidden = !current || !M.canForce(entry) || entry?.status === 'attention'; forceCurrent.disabled = busy || !connected();
            retryCurrent.hidden = entry?.status !== 'attention'; retryCurrent.disabled = busy || !connected();
            text(retryCurrent, entry?.submittedAt ? 'Проверить' : 'Повторить');
            cancelCurrent.hidden = !M.canCancel(entry); cancelCurrent.disabled = busy;
            resetCurrent.hidden = !M.canReset(entry); resetCurrent.disabled = busy;
            text(cancelCurrent, entry?.submittedAt ? 'Остановить синхронизацию' : 'Отменить отправку');
            resumeCurrent.hidden = !M.canResume(entry); resumeCurrent.disabled = busy || !connected();
            currentLink.hidden = !M.remoteId(entry) && !entry?.submittedAt; currentLink.href = M.watchUrl(entry);
            text(currentLink, entry?.status === 'done' ? mediaLinkText(entry) : 'Проверить в MyShows');
            const playback = connected() && state.enabled && (!entry || entry.status === 'watching') ? current?.playback : null;
            let confirmationText = '', phase = '';
            if (playback) {
                const complete = playback.seconds >= M.positionDelay;
                phase = complete ? 'confirmed' : playback.state;
                confirmationText = complete ? 'Позиция подтверждена просмотром.' : `Подтверждение позиции: ${playback.seconds} из ${M.positionDelay} секунд`;
                if (!complete && playback.state === 'paused') confirmationText += ' · пауза';
                else if (!complete && playback.state === 'buffering') confirmationText += ' · ждём воспроизведение';
                else if (!complete && playback.state === 'seeking') confirmationText += ' · перемотка';
            }
            describe(confirmation, confirmationText);
            const confirmationKey = current ? `${current.key}:${phase}` : '';
            if (confirmationKey !== lastConfirmation) {
                if (phase) text(announcement, `${current.episode.title}. ${phase === 'confirmed' ? 'Позиция подтверждена просмотром.'
                    : phase === 'paused' ? 'Подтверждение позиции на паузе.' : phase === 'buffering' ? 'Ждём воспроизведение для подтверждения позиции.'
                        : `Подтверждаем позицию за ${M.positionDelay} секунд просмотра.`}`);
                lastConfirmation = confirmationKey;
            }
            keepFocus(focused, currentState);
        }
        async function refreshCurrent() {
            const tabId = getTarget()?.id;
            if (currentTabId !== tabId) { current = null; currentTabId = tabId; ++currentRequest; showCurrent(); }
            if (!Number.isInteger(tabId) || currentPending) return;
            const request = ++currentRequest; currentPending = true;
            try {
                const reply = await chrome.runtime.sendMessage({ type: 'myshows:current', tabId });
                if (closed || request !== currentRequest || getTarget()?.id !== tabId) return;
                current = reply?.ok ? reply.current : null;
            } catch { if (!closed && request === currentRequest) current = null; }
            finally { currentPending = false; }
            if (!closed && request === currentRequest) showCurrent();
        }
        function createRow(entry) {
            const row = element('article', 'myshows-entry'); row.dataset.id = entry.id;
            const title = element('h3'), episode = element('span', 'myshows-episode'), status = element('span', 'myshows-state');
            const identity = element('div', 'myshows-entry-identity'); identity.append(title, episode);
            const meta = element('div', 'myshows-entry-meta'); meta.append(identity, status);
            const progress = element('p', 'myshows-description'), position = element('p', 'myshows-description'), manual = element('p', 'myshows-description'), reason = element('p', 'myshows-description');
            const actions = element('div', 'myshows-actions');
            const view = { row, title, episode, status, progress, position, manual, reason, entry, actions, buttons: {} };
            for (const [type, name] of [['resume', 'Продолжить отслеживание'], ['force', 'Засчитать серию'], ['retry', 'Проверить'], ['cancel', 'Отменить отправку'], ['reset', 'Сбросить запись']]) {
                const node = button(name, () => command(type, { id: view.entry.id, account: state.account }), 'text-button');
                node.dataset.myshowsAction = entry.id + '-' + type; view.buttons[type] = node; actions.append(node);
            }
            view.link = link(mediaLinkText(entry), M.watchUrl(entry)); actions.append(view.link);
            view.details = element('details', 'myshows-events'); view.details.dataset.id = entry.id;
            view.summary = element('summary'); view.events = element('ol');
            view.details.append(view.summary, view.events);
            row.append(meta, progress, position, manual, reason, actions, view.details);
            return view;
        }
        function updateRowActions(view) {
            const { entry, buttons } = view;
            text(buttons.force, M.isMovie(entry.episode) ? 'Засчитать фильм' : 'Засчитать серию');
            buttons.resume.hidden = !M.canResume(entry); buttons.force.hidden = !M.canForce(entry);
            buttons.retry.hidden = entry.status !== 'attention'; buttons.cancel.hidden = !M.canCancel(entry);
            buttons.reset.hidden = !M.canReset(entry);
            text(buttons.retry, entry.submittedAt ? 'Проверить' : 'Повторить');
            text(buttons.cancel, entry.submittedAt ? 'Остановить синхронизацию' : 'Отменить отправку');
            for (const [type, node] of Object.entries(buttons)) node.disabled = busy || (!['cancel', 'reset'].includes(type) && !connected());
            view.link.hidden = !M.remoteId(entry) && !entry.submittedAt; view.link.href = M.watchUrl(entry);
            text(view.link, M.remoteId(entry) ? mediaLinkText(entry) : 'Проверить в MyShows');
        }
        function updateRow(view, entry) {
            view.entry = entry;
            text(view.title, entry.episode.title); text(view.episode, M.label(entry.episode));
            text(view.status, statusText(entry)); view.status.dataset.status = entry.status;
            describe(view.progress, entry.status === 'watching' ? progressText(entry) : '');
            describe(view.position, entry.status === 'watching' && entry.confirmedPosition > 0 && entry.progress > entry.watchedProgress
                ? 'По позиции плеера, подтверждённой просмотром' : '');
            describe(view.manual, entry.manualAt ? (entry.status === 'done' ? 'Засчитано вручную' : 'Добавлено вручную') : '');
            describe(view.reason, explanation(entry));
            text(view.summary, 'История · ' + date(entry.updatedAt || entry.createdAt));
            const eventSignature = JSON.stringify([entry.createdAt, entry.origin, entry.events]);
            if (eventSignature !== view.eventSignature) {
                view.eventSignature = eventSignature;
                view.events.replaceChildren(element('li', '', date(entry.createdAt) + (entry.origin === 'manual' ? ' · Добавлена вручную' : ' · Начат просмотр')));
                for (const event of entry.events || []) view.events.append(element('li', '', `${date(event.at)} · ${labels[event.status] || event.status}${event.reason ? '. ' + event.reason : ''}`));
            }
            updateRowActions(view);
        }
        function renderList() {
            if (!state || closed) return;
            const entries = state.entries.filter(entry => entry.account === state.account);
            const groups = { queue: entries.filter(entry => !M.terminal.has(entry.status) && entry.status !== 'attention'),
                attention: entries.filter(entry => entry.status === 'attention'), history: entries.filter(entry => M.terminal.has(entry.status)) };
            for (const node of filters.querySelectorAll('button')) {
                text(node.querySelector('.myshows-filter-count'), String(groups[node.dataset.filter].length));
                node.setAttribute('aria-pressed', String(node.dataset.filter === filter));
            }
            filters.hidden = !!searchQuery;
            const items = (searchQuery ? entries.filter(entry => `${entry.episode.title} ${entry.episode.originalTitle || ''} ${M.label(entry.episode)}`.toLocaleLowerCase('ru').includes(searchQuery)) : groups[filter])
                .sort((a, b) => b.updatedAt - a.updatedAt);
            describe(searchSummary, searchQuery ? `Результаты во всём журнале: ${items.length}` : '');
            const searchKey = searchQuery ? `${searchQuery}:${items.length}` : '';
            if (searchKey !== lastSearch) {
                lastSearch = searchKey; clearTimeout(searchTimer);
                if (searchQuery) searchTimer = setTimeout(() => text(searchAnnouncement, `По запросу «${searchQuery}» найдено во всём журнале: ${items.length}.`), 250);
                else text(searchAnnouncement, '');
            }
            const focused = list.contains(document.activeElement) || document.activeElement === more ? document.activeElement : null;
            const liveIds = new Set(entries.map(entry => entry.id));
            for (const [id, view] of rows) if (!liveIds.has(id)) { view.row.remove(); rows.delete(id); }
            const shown = items.slice(0, limit), shownIds = new Set(shown.map(entry => entry.id));
            for (const child of [...list.children]) if (!shownIds.has(child.dataset.id)) child.remove();
            if (!shown.length) {
                text(emptyTitle, searchQuery ? 'Ничего не найдено' : filter === 'history' ? 'История пока пуста' : filter === 'attention' ? 'Всё в порядке' : 'Очередь пуста');
                text(emptyText, searchQuery ? 'Проверены очередь, проблемы и история. Попробуйте название фильма, сериала или номер S01E01.'
                    : filter === 'history' ? 'Здесь будут отмеченные и отменённые фильмы и серии.' : filter === 'attention' ? 'Просмотров, требующих проверки, нет.'
                        : !connected() ? 'Подключите MyShows, чтобы отмечать просмотренные фильмы и серии.' : !state.enabled ? 'Автоотметки на паузе. Можно засчитать текущий просмотр вручную.'
                            : 'Начните смотреть фильм или серию. Прогресс появится примерно через 10 секунд.');
                list.append(empty);
            }
            shown.forEach((entry, index) => {
                let view = rows.get(entry.id); if (!view) { view = createRow(entry); rows.set(entry.id, view); }
                updateRow(view, entry);
                if (list.children[index] !== view.row) list.insertBefore(view.row, list.children[index] || null);
            });
            more.hidden = items.length <= limit;
            keepFocus(focused, searchQuery ? heading : filters.querySelector(`[data-filter="${filter}"]`));
        }
        function update(value) {
            if (closed) return;
            const next = value || M.initial();
            if (state && (next.enabled !== state.enabled || next.account !== state.account || next.connection !== state.connection)) {
                ++currentRequest;
                if (current) current = { ...current, playback: null };
            }
            const statuses = new Map(next.entries.filter(entry => entry.account === next.account).map(entry => [entry.id, entry.status]));
            if (knownStatuses && state?.account === next.account) {
                const changed = next.entries.filter(entry => entry.account === next.account && knownStatuses.get(entry.id) !== entry.status
                    && ['done', 'attention', 'cancelled', 'reset'].includes(entry.status));
                if (changed.length) text(announcement, changed.map(entry => `${entry.episode.title}, ${M.label(entry.episode)}: ${labels[entry.status]}.`).join(' '));
            }
            knownStatuses = statuses; state = next;
            connection.dataset.connected = String(connected());
            text(account, connected() ? `Подключён ${state.account}` : state.connection === 'connecting' ? 'Подключаем MyShows…' : 'MyShows не подключён');
            describe(connectionDescription, connected() ? (state.enabled ? 'Автоотметки включены' : 'Автоотметки на паузе')
                : 'Войдите в MyShows в этом Chrome. Для подключения нужны существующий токен и доступ к скробблингу (MyShows PRO).');
            if (state.message || lastStateMessage) describe(message, state.message || '');
            lastStateMessage = state.message || '';
            renderList(); controls();
        }
        async function refresh() {
            const reply = await chrome.runtime.sendMessage({ type: 'myshows:state' });
            if (!reply?.ok) throw new Error('Не удалось загрузить журнал. Откройте раздел заново.');
            update(reply.state);
        }
        const listener = (changes, area) => { if (area === 'local' && changes[M.key]) update(changes[M.key].newValue); };
        chrome.storage.onChanged.addListener(listener);
        updateQuery = value => {
            if (closed) return false;
            value = value.trim().toLocaleLowerCase('ru');
            if (value !== searchQuery) { searchQuery = value; limit = 50; renderList(); }
            if (currentTabId !== getTarget()?.id) refreshCurrent();
            return true;
        };
        controls();
        refresh().catch(error => { if (!closed) { text(account, 'Не удалось загрузить MyShows'); describe(message, error.message); } });
        refreshCurrent();
        const currentTimer = setInterval(refreshCurrent, 1000);
        dispose = () => { closed = true; ++currentRequest; settingsOpen = settings.open; clearInterval(currentTimer); clearTimeout(searchTimer); chrome.storage.onChanged.removeListener(listener); updateQuery = null; };
        return dispose;
    }
    return { mount, setQuery: query => updateQuery?.(query) || false, unmount: () => dispose() };
})();
