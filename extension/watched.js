// Explicit account marks and compact card actions; never infer watched from playback.
const RezkaWatched = (() => {
    const noop = { registerRoot() {} };
    if (window.top !== window || !RezkaNetwork.isSite(location.href)) return noop;
    const SETTING = 'r4:dim-watched';
    const REVISION = 'ui:watched-revision';
    const revisionSource = crypto.randomUUID();
    const ROW = '.b-videosaves__list_item';
    const PART_ROW = '.b-post__partcontent_item';
    const CARD = '.b-content__inline_item, .b-seriesupdate__block_list_item, .card';
    const ACTION_ITEM = '.b-content__inline_item, article.card, ' + PART_ROW;
    const CONTENT = [CARD, ROW, PART_ROW, 'a[href]', '#videosaves-list', '.view',
        '.b-tophead__contwatch', '.b-post__title', '.b-post__origtitle'].join(', ');
    const REPAIR = '.rc-watch-toggle, .rc-watch-cell, .rc-watching-status, .rc-watching-filter, .rc-history-tabs, .rc-history-empty';
    const roots = new Map();
    let enabled = false, initialized = false, preferenceRevision = 0;
    let watched = new Set(), savedTitles = new Set(), marked = new Set(), liveStates;
    const watchingCards = new Map();
    let statusSequence = 0;
    let scanTimer, request, refreshAgain = false, generation = 0, lastRefresh = 0;
    let saving, noticeTimer, revision = 0;
    let historyFilter = 'watching', historyUI;
    const { titleID } = RezkaWatchedSite;
    const isHistory = () => /^\/continue\/(?:page\/\d+\/)?$/.test(location.pathname);

    function actionHref(item) {
        if (item.matches(PART_ROW)) {
            // The current title is plain text, with neither a link nor data-url.
            return item.querySelector('.title a[href]')?.getAttribute('href')
                || item.getAttribute('data-url') || (item.classList.contains('current') ? location.href : null);
        }
        return item.querySelector('a[href]')?.getAttribute('href');
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
        chrome.storage.local.set({ [REVISION]: revisionSource + ':' + ++revision }).catch(() => {});
    }
    async function toggle(card) {
        if (saving) return;
        const href = actionHref(card), id = titleID(href);
        if (!id) return;
        const desired = !watched.has(id);
        saving = id;
        generation++; request?.abort(); request = undefined; refreshAgain = false;
        apply();
        announce('Сохраняем отметку…');
        let confirmed = false;
        try {
            const state = await RezkaWatchedSite.setWatched(href, desired);
            watched = state.watched;
            savedTitles = new Set(state.entries.keys());
            confirmed = true;
            lastRefresh = Date.now();
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
            const reconcile = !confirmed || refreshAgain;
            refreshAgain = false;
            saving = undefined;
            apply();
            // The adapter already returned verified history. Only uncertainty or a
            // foreign update received during the write requires another request.
            if (reconcile) void refresh(true, true);
        }
    }
    function applyControls() {
        const signedIn = !!document.querySelector('.b-tophead__contwatch');
        for (const root of roots.keys()) {
            for (const card of root.querySelectorAll(ACTION_ITEM)) {
                const part = card.matches(PART_ROW);
                const id = titleID(actionHref(card));
                let cell = [...card.children].find(child => child.classList.contains('rc-watch-cell'));
                let button = [...(cell || card).children].find(child => child.classList.contains('rc-watch-toggle'));
                if (!signedIn || !id) {
                    button?.remove(); cell?.remove();
                    card.classList.remove('rc-watched-card', 'rc-watched-part'); continue;
                }
                if (part && !cell) {
                    cell = document.createElement('div'); cell.className = 'td rc-watch-cell';
                    card.append(cell);
                }
                if (!button) {
                    button = document.createElement('button'); button.type = 'button'; button.className = 'rc-watch-toggle';
                    button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m4 10 4 4 8-8"/></svg>';
                    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void toggle(card); });
                    (cell || card).append(button);
                }
                card.classList.add(part ? 'rc-watched-part' : 'rc-watched-card');
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
            const hide = watched.has(id) !== completed || (typeof RezkaExclusions !== 'undefined' && RezkaExclusions.has(id));
            if (hide && row.contains(document.activeElement)) selected.focus();
            row.classList.toggle('rc-history-hidden', hide);
            if (!hide) visible++;
        }
        const message = visible ? '' : completed ? 'Пока нет завершённых просмотров.' : 'Нет незавершённых просмотров.';
        if (historyUI.empty.textContent !== message) historyUI.empty.textContent = message;
        historyUI.empty.hidden = visible > 0;
    }
    function describeWatching(link, id, include) {
        const previous = link.getAttribute('aria-describedby') || '';
        const ids = new Set(previous.split(/\s+/).filter(Boolean));
        if (include) ids.add(id); else ids.delete(id);
        const next = [...ids].join(' ');
        if (next === previous) return;
        if (next) link.setAttribute('aria-describedby', next);
        else link.removeAttribute('aria-describedby');
    }
    function ensureWatchingFilter(root) {
        if (root.querySelector('#rc-watching-bronze')) return;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('rc-watching-filter');
        svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
        // The chosen poster treatment maps luminance to bronze/gold in sRGB.
        // Each shadow root owns its filter reference; never alter the poster DOM.
        svg.innerHTML = '<defs><filter id="rc-watching-bronze" color-interpolation-filters="sRGB">'
            + '<feColorMatrix type="saturate" values="0"/><feComponentTransfer>'
            + '<feFuncR type="table" tableValues="0.10 0.98"/>'
            + '<feFuncG type="table" tableValues="0.055 0.78"/>'
            + '<feFuncB type="table" tableValues="0.018 0.32"/>'
            + '</feComponentTransfer></filter></defs>';
        (root === document ? document.body : root).append(svg);
    }
    function applyWatching() {
        const next = new Set();
        if (enabled && document.querySelector('.b-tophead__contwatch')) {
            for (const root of roots.keys()) {
                for (const card of root.querySelectorAll(CARD)) {
                    const id = titleID(card.querySelector('a[href]')?.getAttribute('href'));
                    if (!id || !savedTitles.has(id) || watched.has(id)) continue;
                    next.add(card);
                    ensureWatchingFilter(root);
                    card.classList.add('rc-watching');
                    let status = watchingCards.get(card);
                    if (!status) {
                        const label = document.createElement('span'); label.className = 'rc-watching-status';
                        label.id = 'rc-watching-status-' + revisionSource + '-' + ++statusSequence;
                        label.textContent = 'Смотрю'; card.append(label);
                        status = { label, links: new Set() }; watchingCards.set(card, status);
                    } else if (!card.contains(status.label)) card.append(status.label);
                    const links = new Set([...card.querySelectorAll('a[href]')]
                        .filter(link => titleID(link.getAttribute('href')) === id));
                    for (const link of status.links) if (!links.has(link)) describeWatching(link, status.label.id, false);
                    for (const link of links) describeWatching(link, status.label.id, true);
                    status.links = links;
                }
            }
        }
        for (const [card, status] of watchingCards) {
            if (next.has(card)) continue;
            card.classList.remove('rc-watching');
            for (const link of status.links) describeWatching(link, status.label.id, false);
            status.label.remove(); watchingCards.delete(card);
        }
    }
    function apply() {
        const next = new Set();
        if (enabled) {
            for (const root of roots.keys()) {
                for (const link of root.querySelectorAll('a[href]')) {
                    if (!watched.has(titleID(link.getAttribute('href')))) continue;
                    // Keep row cells together; the dedicated history tabs opt out of dimming in CSS.
                    const row = link.closest(ROW + ', ' + PART_ROW);
                    const target = row || link.closest(CARD) || link;
                    if (target) next.add(target);
                }
                for (const row of root.querySelectorAll(PART_ROW)) {
                    if (watched.has(titleID(actionHref(row)))) next.add(row);
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
        applyWatching();
        applyHistory();
        applyControls();
    }
    function readLiveList() {
        if (!isHistory()) return;
        const snapshot = RezkaWatchedSite.readList(document);
        if (!snapshot) return;
        const ids = snapshot.watched;
        const states = new Map();
        for (const row of document.querySelectorAll('#videosaves-list ' + ROW)) {
            const id = titleID(row.querySelector('.title a[href]')?.getAttribute('href'));
            if (id) states.set(id, ids.has(id));
        }
        let changed = false;
        if (!liveStates) { watched = ids; savedTitles = new Set(states.keys()); }
        else {
            // Apply local changes only: another history tab may display an older
            // list, but must not overwrite fresh marks received from the server.
            for (const [id, value] of states) {
                if (liveStates.get(id) === value) continue;
                savedTitles.add(id);
                if (value) watched.add(id); else watched.delete(id);
                changed = true;
            }
            for (const id of liveStates.keys()) if (!states.has(id)) {
                watched.delete(id); savedTitles.delete(id); changed = true;
            }
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
            attributeFilter: ['href', 'data-url', 'class'], attributeOldValue: true });
    }
    function containsContent(node, selector) {
        return node.nodeType === 1 && (node.matches(selector) || !!node.querySelector(selector));
    }
    function changesContent(record) {
        // Player clocks, filter suggestions and progress text do not change title
        // identity or watched state. Inspect the changed subtrees, not every card.
        for (const node of record.addedNodes) if (containsContent(node, CONTENT)) return true;
        for (const node of record.removedNodes) {
            // Restore controls/descriptions removed by a native rerender, without
            // scheduling a second full scan when we insert them ourselves.
            if (containsContent(node, CONTENT) || containsContent(node, REPAIR)) return true;
        }
        return false;
    }
    function registerRoot(root) {
        if (roots.has(root)) return;
        const observer = new MutationObserver(records => {
            if (records.some(record => {
                if (record.type === 'childList') return changesContent(record);
                if (record.attributeName !== 'class') return true;
                if (record.target.matches(PART_ROW)) {
                    return /(?:^|\s)current(?:\s|$)/.test(record.oldValue || '') !== record.target.classList.contains('current');
                }
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
            watched.clear(); savedTitles.clear(); liveStates = undefined; apply(); return;
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
            if (generation === current) {
                watched = state.watched; savedTitles = new Set(state.entries.keys()); apply();
            }
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
    if (typeof RezkaExclusions !== 'undefined') RezkaExclusions.subscribe(() => applyHistory());
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (Object.hasOwn(changes, SETTING)) {
            preferenceRevision++;
            initialized = true;
            setEnabled(changes[SETTING].newValue);
        }
        if (Object.hasOwn(changes, REVISION)
            && !String(changes[REVISION].newValue || '').startsWith(revisionSource + ':')) void refresh(true, true);
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
