// Same-origin account operations matching the site's native history controls.
// Fetched title scripts are parsed for numeric metadata only, never executed.
const RezkaWatchedSite = (() => {
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
        if (!list) return null;
        const watched = new Set(), entries = new Map();
        for (const row of list.querySelectorAll('.b-videosaves__list_item')) {
            const id = titleID(row.querySelector('.title a[href]')?.getAttribute('href'));
            if (!id) continue;
            const view = row.querySelector('.view');
            const value = row.classList.contains('watched-row') || !!view?.classList.contains('watched');
            const saveID = view?.getAttribute('data-id');
            if (value) watched.add(id);
            if (!entries.has(id)) entries.set(id, []);
            entries.get(id).push({ saveID: /^\d+$/.test(saveID || '') ? saveID : null, watched: value });
        }
        return { watched, entries };
    }
    async function request(path, options = {}) {
        const url = new URL(path, location.origin);
        if (url.origin !== location.origin) throw new Error('Cross-origin history request');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url.href, { credentials: 'same-origin', cache: 'no-store',
                redirect: 'error', ...options, signal: options.signal || controller.signal });
            if (!response.ok) throw new Error('History request failed');
            return await response.text();
        } finally { clearTimeout(timeout); }
    }
    async function load(signal) {
        const pending = [new URL('/continue/', location.origin).href], visited = new Set();
        const result = { watched: new Set(), entries: new Map() };
        while (pending.length) {
            const url = pending.shift();
            if (visited.has(url)) continue;
            if (visited.size >= 100) throw new Error('Watched list pagination limit');
            visited.add(url);
            const doc = new DOMParser().parseFromString(await request(url, { signal }), 'text/html');
            const page = readList(doc);
            if (!page) throw new Error('Watched list missing');
            for (const id of page.watched) result.watched.add(id);
            for (const [id, entries] of page.entries) result.entries.set(id, [...(result.entries.get(id) || []), ...entries]);
            for (const link of doc.querySelectorAll('.b-navigation a[href]')) {
                const next = new URL(link.getAttribute('href'), url);
                if (next.origin !== location.origin || !/^\/continue\/(?:page\/\d+\/)?$/.test(next.pathname)) continue;
                next.hash = '';
                if (!visited.has(next.href)) pending.push(next.href);
            }
        }
        return result;
    }
    async function post(path, fields) {
        const result = JSON.parse(await request(path, { method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
            body: new URLSearchParams(fields).toString() }));
        if (result.success !== true) throw new Error('History update rejected');
    }
    async function createEntry(href, id) {
        // Use the current mirror even when the card links to another supported mirror.
        const path = new URL(href, location.origin).pathname;
        const doc = new DOMParser().parseFromString(await request(path), 'text/html');
        if (doc.querySelector('#post_id')?.value !== id) throw new Error('Title metadata missing');
        let fields;
        for (const script of doc.querySelectorAll('script:not([src])')) {
            const match = script.textContent.match(/sof\.tv\.initCDN(Movies|Series)Events\(\s*(\d+)\s*,\s*(\d+)\s*,/);
            if (!match || match[2] !== id || Number(match[3]) < 1) continue;
            const episode = match[1] === 'Series'
                ? script.textContent.slice(match.index + match[0].length).match(/^\s*(\d+)\s*,\s*(\d+)\s*,/) : null;
            if (match[1] === 'Series' && (!episode || Number(episode[1]) < 1 || Number(episode[2]) < 1)) continue;
            fields = { post_id: id, translator_id: match[3], season: episode?.[1] || '0',
                episode: episode?.[2] || '0', current_time: '0', duration: '0' };
            break;
        }
        if (!fields) throw new Error('Player metadata missing');
        // Only new entries use send_save: never overwrite an existing playback position.
        await post('/ajax/send_save/', fields);
    }
    async function setWatched(href, desired) {
        const id = titleID(href);
        if (!id || typeof desired !== 'boolean') throw new Error('Invalid watched action');
        const update = async () => {
            let state = await load();
            if (!state.entries.has(id) && desired) {
                let error;
                try { await createEntry(href, id); } catch (cause) { error = cause; }
                state = await load(); // Also reconcile an ambiguous/failed POST before retrying anything.
                if (!state.entries.has(id)) throw error || new Error('Saved title missing');
            }
            for (const entry of state.entries.get(id) || []) {
                if (entry.watched === desired) continue;
                if (!entry.saveID) throw new Error('Save ID missing');
                try { await post('/engine/ajax/cdn_saves_view.php', { id: entry.saveID }); }
                catch (error) {
                    const actual = await load();
                    const saved = actual.entries.get(id)?.find(item => item.saveID === entry.saveID);
                    if (saved?.watched !== desired) throw error;
                }
            }
            const confirmed = await load();
            if (confirmed.watched.has(id) !== desired) throw new Error('Watched state not confirmed');
            return confirmed.watched;
        };
        // The native endpoint toggles a save. Serialize our read/toggle/read sequence across tabs.
        return navigator.locks ? navigator.locks.request('rezka-custom:watched:' + id, update) : update();
    }
    return { titleID, readList, load, setWatched };
})();
