// One local record per title: independent writes from different tabs never replace the list.
const RezkaExclusions = (() => {
    const prefix = 'rc-excluded:v1:';
    const records = new Map(), listeners = new Set(), changed = new Map();
    let loading, loaded = false;
    const validID = id => typeof id === 'string' && /^[1-9]\d{0,15}$/.test(id);
    function accept(key, value) {
        const id = key.slice(prefix.length);
        if (!validID(id)) return;
        if (value?.version === 1 && value.id === id && typeof value.title === 'string') {
            records.set(id, { version: 1, id, title: value.title.trim().slice(0, 300) || 'Без названия' });
        } else records.delete(id);
    }
    function emit() { for (const listener of listeners) listener(); }
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        let relevant = false;
        for (const [key, change] of Object.entries(changes)) {
            if (!key.startsWith(prefix)) continue;
            if (!loaded) changed.set(key, change.newValue);
            accept(key, change.newValue); relevant = true;
        }
        if (relevant && loaded) emit();
    });
    function ready() {
        if (loaded) return Promise.resolve();
        if (!loading) loading = chrome.storage.local.get(null).then(data => {
            records.clear();
            for (const [key, value] of Object.entries(data)) if (key.startsWith(prefix)) accept(key, value);
            // Storage changes received during the read win over its older snapshot.
            for (const [key, value] of changed) accept(key, value);
            changed.clear(); loaded = true; emit();
        }).catch(cause => {
            loading = undefined;
            throw new Error('Не удалось прочитать исключения. Обновите страницу или откройте настройки заново.', { cause });
        });
        return loading;
    }
    async function add(id, title) {
        if (!validID(id) || typeof title !== 'string') throw new Error('Не удалось определить фильм или сериал.');
        await ready();
        const record = { version: 1, id, title: title.trim().slice(0, 300) || 'Без названия' };
        try { await chrome.storage.local.set({ [prefix + id]: record }); }
        catch (cause) { throw new Error('Не удалось сохранить исключение. Карточка остаётся на сайте. Попробуйте ещё раз.', { cause }); }
    }
    async function remove(id) {
        if (!validID(id)) throw new Error('Не удалось определить исключение.');
        try { await chrome.storage.local.remove(prefix + id); }
        catch (cause) { throw new Error('Не удалось вернуть карточку. Попробуйте ещё раз.', { cause }); }
    }
    return { ready, add, remove, has: id => records.has(String(id)),
        list: () => [...records.values()].map(record => ({ ...record })).sort((a, b) => a.title.localeCompare(b.title, 'ru')),
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
})();
