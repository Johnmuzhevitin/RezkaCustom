// Explicit account marks and compact card actions; never infer watched from playback.
const RezkaWatched = (() => {
    const noop = { registerRoot() {} };
    if (window.top !== window || !RezkaNetwork.isSite(location.href)) return noop;
    const SETTING = 'r4:dim-watched';
    const REVISION = 'ui:watched-revision';
    const ROW = '.b-videosaves__list_item';
    const CARD = '.b-content__inline_item, .b-seriesupdate__block_list_item, .card';
    const ACTION_CARD = '.b-content__inline_item, article.card';
    const roots = new Map();
    let enabled = false, initialized = false, preferenceRevision = 0;
    let watched = new Set(), marked = new Set(), liveStates;
    let scanTimer, request, refreshAgain = false, generation = 0, lastRefresh = 0;
    let saving, noticeTimer;
    let historyFilter = 'watching', historyUI;
    const { titleID } = RezkaWatchedSite;
    const isHistory = () => /^\/continue\/(?:page\/\d+\/)?$/.test(location.pathname);

    function readList(doc) {
        return RezkaWatchedSite.readList(doc)?.watched || null;
    }
    function announce(message, error = false) {
        let notice = document.getElementById('rc-watched-notice');
        if (!notice) {
            notice = document.createElement('div'); notice.id = 'rc-watched-notice';
            notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
            document.body.append(notice);
        }
        notice.classList.toggle('rc-watched-error', error);
        if (notice.textContent !== message) notice.textContent = message;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { notice.classList.remove('rc-watched-error'); notice.textContent = ''; }, 8000);
    }
    function invalidate() {
        chrome.storage.local.set({ [REVISION]: Date.now() + ':' + Math.random() }).catch(() => {});
    }
    async function toggle(card) {
        if (saving) return;
        const href = card.querySelector('a[href]')?.getAttribute('href'), id = titleID(href);
        if (!id) return;
        const desired = !watched.has(id);
        saving = id;
        generation++; request?.abort(); request = undefined; refreshAgain = false;
        apply();
        announce('Сохраняем отметку…');
        try {
            watched = await RezkaWatchedSite.setWatched(href, desired);
            // Keep any native history controls in this document in agreement.
            for (const row of document.querySelectorAll('#videosaves-list ' + ROW)) {
                if (titleID(row.querySelector('.title a[href]')?.getAttribute('href')) !== id) continue;
                row.classList.toggle('watched-row', desired);
                const view = row.querySelector('.view');
                view?.classList.toggle('watched', desired);
                if (view) view.title = view.getAttribute(desired ? 'data-text-unwatch' : 'data-text-watch') || '';
                for (const info of row.querySelectorAll('.info-holder')) info.style.display = desired ? 'none' : '';
            }
            if (liveStates?.has(id)) liveStates.set(id, desired);
            announce(desired ? 'Отмечено как просмотренное' : 'Отметка «Просмотрено» снята');
            invalidate();
        } catch {
            announce('Не удалось сохранить отметку. Проверьте подключение и вход на сайт, затем нажмите галочку ещё раз.', true);
        } finally {
            saving = undefined;
            apply();
            // Reconcile uncertain responses and any remote change queued during the write.
            void refresh(true, true);
        }
    }
    function applyControls() {
        const signedIn = !!document.querySelector('.b-tophead__contwatch');
        for (const root of roots.keys()) {
            for (const card of root.querySelectorAll(ACTION_CARD)) {
                const id = titleID(card.querySelector('a[href]')?.getAttribute('href'));
                let button = [...card.children].find(child => child.classList.contains('rc-watch-toggle'));
                if (!signedIn || !id) {
                    button?.remove(); card.classList.remove('rc-watched-card'); continue;
                }
                if (!button) {
                    button = document.createElement('button'); button.type = 'button'; button.className = 'rc-watch-toggle';
                    button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m4 10 4 4 8-8"/></svg>';
                    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void toggle(card); });
                    card.classList.add('rc-watched-card'); card.append(button);
                }
                const value = watched.has(id), busy = saving === id;
                const label = busy ? 'Сохраняем отметку…' : value ? 'Просмотрено — снять отметку' : 'Отметить как просмотренное';
                button.title = label + '\nСохраняется в «Досмотреть». У сериалов отметка также отключает уведомления о новых сериях.';
                button.setAttribute('aria-label', label);
                button.setAttribute('aria-pressed', String(value));
                button.setAttribute('aria-busy', String(busy));
                button.setAttribute('aria-disabled', String(!!saving));
            }
        }
    }
    function applyHistory() {
        const list = isHistory() && document.querySelector('#videosaves-list');
        if (historyUI && (historyUI.list !== list || !historyUI.tabs.isConnected)) {
            historyUI.tabs.remove(); historyUI.empty.remove(); historyUI = undefined;
        }
        if (!list) return;
        if (!historyUI) {
            const tabs = document.createElement('div'); tabs.className = 'rc-history-tabs';
            tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Статус просмотра');
            const buttons = ['watching', 'completed'].map((filter, index) => {
                const button = document.createElement('button'); button.type = 'button';
                button.id = 'rc-history-' + filter;
                button.textContent = index ? 'Завершено' : 'Смотрю';
                button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', list.id);
                button.addEventListener('click', () => { historyFilter = filter; applyHistory(); });
                tabs.append(button);
                return button;
            });
            tabs.addEventListener('keydown', event => {
                const index = buttons.indexOf(event.target);
                if (index < 0) return;
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1
                    : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - index : -1;
                if (next < 0) return;
                event.preventDefault(); buttons[next].click(); buttons[next].focus();
            });
            const empty = document.createElement('p'); empty.className = 'rc-history-empty';
            empty.setAttribute('role', 'status');
            list.before(tabs); list.after(empty);
            list.setAttribute('role', 'tabpanel'); list.tabIndex = 0;
            historyUI = { list, tabs, buttons, empty };
        }
        const completed = historyFilter === 'completed';
        const selected = historyUI.buttons[Number(completed)];
        for (const button of historyUI.buttons) {
            button.setAttribute('aria-selected', String(button === selected));
            button.tabIndex = button === selected ? 0 : -1;
        }
        list.setAttribute('aria-labelledby', selected.id);
        let visible = 0;
        for (const row of list.querySelectorAll(ROW)) {
            const id = titleID(row.querySelector('.title a[href]')?.getAttribute('href'));
            if (!id) continue; // The native table header uses the same row class.
            const hide = watched.has(id) !== completed;
            if (hide && row.contains(document.activeElement)) selected.focus();
            row.classList.toggle('rc-history-hidden', hide);
            if (!hide) visible++;
        }
        const message = visible ? '' : completed ? 'Пока нет завершённых просмотров.' : 'Нет незавершённых просмотров.';
        if (historyUI.empty.textContent !== message) historyUI.empty.textContent = message;
        historyUI.empty.hidden = visible > 0;
    }
    function apply() {
        const next = new Set();
        if (enabled) {
            for (const root of roots.keys()) {
                for (const link of root.querySelectorAll('a[href]')) {
                    if (!watched.has(titleID(link.getAttribute('href')))) continue;
                    // Keep row cells together; the dedicated history tabs opt out of dimming in CSS.
                    const row = link.closest(ROW);
                    const target = row || link.closest(CARD) || link;
                    if (target) next.add(target);
                }
            }
            if (watched.has(titleID(location.href))) {
                for (const heading of document.querySelectorAll('.b-post__title, .b-post__origtitle')) next.add(heading);
            }
        }
        // A whole card and its nested links must not multiply the opacity.
        for (const target of [...next]) {
            for (let parent = target.parentElement; parent; parent = parent.parentElement) {
                if (next.has(parent)) { next.delete(target); break; }
            }
        }
        for (const element of marked) if (!next.has(element)) element.classList.remove('rc-watched');
        for (const element of next) if (!element.classList.contains('rc-watched')) element.classList.add('rc-watched');
        marked = next;
        applyHistory();
        applyControls();
    }
    function readLiveList() {
        if (!isHistory()) return;
        const ids = readList(document);
        if (!ids) return;
        const states = new Map();
        for (const row of document.querySelectorAll('#videosaves-list ' + ROW)) {
            const id = titleID(row.querySelector('.title a[href]')?.getAttribute('href'));
            if (id) states.set(id, ids.has(id));
        }
        let changed = false;
        if (!liveStates) watched = ids;
        else {
            // Apply local changes only: another history tab may display an older
            // list, but must not overwrite fresh marks received from the server.
            for (const [id, value] of states) {
                if (liveStates.get(id) === value) continue;
                if (value) watched.add(id); else watched.delete(id);
                changed = true;
            }
            for (const id of liveStates.keys()) if (!states.has(id)) { watched.delete(id); changed = true; }
        }
        liveStates = states;
        // Only invalidation is persisted, never the user's viewing history.
        if (changed) invalidate();
    }
    function schedule() {
        if (!initialized || scanTimer) return;
        scanTimer = setTimeout(() => {
            scanTimer = undefined;
            readLiveList();
            apply();
        }, 60);
    }
    function observe(root, observer) {
        observer.observe(root, { childList: true, subtree: true, attributes: true,
            attributeFilter: ['href', 'class'], attributeOldValue: true });
    }
    function registerRoot(root) {
        if (roots.has(root)) return;
        const observer = new MutationObserver(records => {
            if (records.some(record => {
                if (record.type !== 'attributes' || record.attributeName !== 'class') return true;
                // Ignore our own class writes and unrelated player/hover classes.
                return record.target.matches(ROW + ', ' + ROW + ' .view')
                    && /(?:^|\s)watched(?:-row)?(?:\s|$)/.test(record.oldValue || '') !==
                        /(?:^|\s)watched(?:-row)?(?:\s|$)/.test(record.target.className);
            })) schedule();
        });
        roots.set(root, observer);
        if (initialized) { observe(root, observer); schedule(); }
    }
    async function refresh(force = false, remote = false) {
        if (!initialized) return;
        if (saving) { refreshAgain = true; return; }
        if (request) { if (force) refreshAgain = true; return; }
        if (!force && Date.now() - lastRefresh < 60000) return;
        if (!document.querySelector('.b-tophead__contwatch')) {
            watched.clear(); apply(); return;
        }
        // The live history page is authoritative after its own successful AJAX changes.
        if (!remote && isHistory() && document.querySelector('#videosaves-list')) {
            readLiveList(); apply(); return;
        }
        lastRefresh = Date.now();
        const current = generation, controller = new AbortController();
        request = controller;
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const state = await RezkaWatchedSite.load(controller.signal);
            if (generation === current) { watched = state.watched; apply(); }
        } catch {
            // Keep this tab's last confirmed state; a later focus retries the read.
        } finally {
            clearTimeout(timeout);
            if (request === controller) {
                request = undefined;
                if (refreshAgain) { refreshAgain = false; void refresh(true, true); }
            }
        }
    }
    function setEnabled(value) {
        enabled = value !== false;
        generation++;
        request?.abort(); request = undefined;
        refreshAgain = false;
        clearTimeout(scanTimer); scanTimer = undefined;
        for (const [root, observer] of roots) {
            observer.disconnect();
            observe(root, observer);
        }
        readLiveList(); apply(); void refresh(true);
    }

    const style = document.createElement('style');
    style.id = 'rc-watched-style'; style.textContent = REZKA_WATCHED_CSS;
    document.head.append(style);
    registerRoot(document);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (Object.hasOwn(changes, SETTING)) {
            preferenceRevision++;
            initialized = true;
            setEnabled(changes[SETTING].newValue);
        }
        if (Object.hasOwn(changes, REVISION)) void refresh(true, true);
    });
    const initialRevision = preferenceRevision;
    chrome.storage.local.get(SETTING).then(values => {
        if (preferenceRevision !== initialRevision) return;
        initialized = true; setEnabled(values[SETTING]);
    }).catch(() => { if (!initialized) { initialized = true; setEnabled(true); } });
    window.addEventListener('focus', () => void refresh());
    window.addEventListener('pageshow', () => void refresh());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void refresh();
    });
    return { registerRoot };
})();
