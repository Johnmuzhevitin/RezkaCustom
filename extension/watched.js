// Read the site's own watched marks; never infer them from visits or playback.
const RezkaWatched = (() => {
    const noop = { registerRoot() {} };
    if (window.top !== window || !RezkaNetwork.isSite(location.href)) return noop;
    const SETTING = 'r4:dim-watched';
    const REVISION = 'ui:watched-revision';
    const ROW = '.b-videosaves__list_item';
    const CARD = '.b-content__inline_item, .b-seriesupdate__block_list_item, .card';
    const roots = new Map();
    let enabled = false, initialized = false, preferenceRevision = 0;
    let watched = new Set(), marked = new Set(), liveStates;
    let scanTimer, request, refreshAgain = false, generation = 0, lastRefresh = 0;

    function titleID(href) {
        if (!href) return null;
        try {
            const url = new URL(href, location.origin);
            if (!RezkaNetwork.isSite(url.href) || url.username || url.password) return null;
            return url.pathname.match(/^\/(?:films|series|cartoons|animation|show)\/[^/]+\/(\d+)-[^/]+\.html$/)?.[1] || null;
        } catch { return null; }
    }
    function readList(doc) {
        const list = doc.querySelector('#videosaves-list');
        if (!list) return null; // Login/error pages must not replace a known list.
        const ids = new Set();
        for (const row of list.querySelectorAll(ROW)) {
            if (!row.classList.contains('watched-row') && !row.querySelector('.view.watched')) continue;
            const id = titleID(row.querySelector('.title a[href]')?.getAttribute('href'));
            if (id) ids.add(id);
        }
        return ids;
    }
    function apply() {
        const next = new Set();
        if (enabled) {
            for (const root of roots.keys()) {
                for (const link of root.querySelectorAll('a[href]')) {
                    if (!watched.has(titleID(link.getAttribute('href')))) continue;
                    // Leave history controls usable, including "mark unwatched".
                    const row = link.closest(ROW);
                    const target = row ? link.closest('.title') : link.closest(CARD) || link;
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
    }
    function readLiveList() {
        if (location.pathname !== '/continue/') return;
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
        if (changed) chrome.storage.local.set({ [REVISION]: Date.now() + ':' + Math.random() }).catch(() => {});
    }
    function schedule() {
        if (!enabled || scanTimer) return;
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
                    && /\bwatched(?:-row)?\b/.test(record.oldValue || '') !==
                        /\bwatched(?:-row)?\b/.test(record.target.className);
            })) schedule();
        });
        roots.set(root, observer);
        if (enabled) { observe(root, observer); schedule(); }
    }
    async function refresh(force = false, remote = false) {
        if (!enabled) return;
        if (request) { if (force) refreshAgain = true; return; }
        if (!force && Date.now() - lastRefresh < 60000) return;
        if (!document.querySelector('.b-tophead__contwatch')) {
            watched.clear(); apply(); return;
        }
        // The live history page is authoritative after its own successful AJAX changes.
        if (!remote && location.pathname === '/continue/' && document.querySelector('#videosaves-list')) {
            readLiveList(); apply(); return;
        }
        lastRefresh = Date.now();
        const current = generation, controller = new AbortController();
        request = controller;
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const pending = [new URL('/continue/', location.origin).href], visited = new Set(), ids = new Set();
            while (pending.length) {
                const url = pending.shift();
                if (visited.has(url)) continue;
                if (visited.size >= 100) throw new Error('Watched list pagination limit');
                visited.add(url);
                const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store',
                    redirect: 'error', signal: controller.signal });
                if (!response.ok) throw new Error('Watched list unavailable');
                const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                const pageIDs = readList(doc);
                if (!pageIDs) throw new Error('Watched list missing');
                for (const id of pageIDs) ids.add(id);
                for (const link of doc.querySelectorAll('.b-navigation a[href]')) {
                    const next = new URL(link.getAttribute('href'), url);
                    if (next.origin !== location.origin || !/^\/continue\/(?:page\/\d+\/)?$/.test(next.pathname)) continue;
                    next.hash = '';
                    if (!visited.has(next.href)) pending.push(next.href);
                }
            }
            if (enabled && generation === current) { watched = ids; apply(); }
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
            if (enabled) observe(root, observer);
        }
        if (enabled) { readLiveList(); apply(); void refresh(true); }
        else { watched.clear(); liveStates = undefined; apply(); }
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
    }).catch(() => { if (!initialized) setEnabled(true); });
    window.addEventListener('focus', () => void refresh());
    window.addEventListener('pageshow', () => void refresh());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void refresh();
    });
    return { registerRoot };
})();
