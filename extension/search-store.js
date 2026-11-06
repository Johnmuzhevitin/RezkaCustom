// Presets are independent extension records; result/detail caches remain tab-local.
const RezkaSearchStore = (() => {
    const prefix = 'rc-search:preset:v2:';
    const storage = () => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) throw new Error('Сохранение наборов недоступно. Проверьте подключение расширения.');
        return chrome.storage.local;
    };
    async function access(action, message) {
        try { return await action(storage()); }
        catch (cause) { throw new Error(message, { cause }); }
    }
    function validate(record) {
        if (!record || record.version !== 2 || typeof record.id !== 'string' || !/^[\w-]{1,80}$/.test(record.id)
            || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 80 || !record.state || record.state.version !== 2) {
            throw new Error('Набор повреждён или создан в неподдерживаемой версии.');
        }
        const { q, ...state } = RezkaSearch.normalize(record.state);
        for (const key of ['type', 'genre', 'from', 'to', 'sort']) {
            if (record.state[key] && record.state[key] !== state[key]) throw new Error('В наборе указано недопустимое значение фильтра.');
        }
        if (state.from && state.to && +state.from > +state.to) throw new Error('Год «До» должен быть не меньше года «От».');
        return { version: 2, id: record.id, name: record.name.trim(), state };
    }
    async function list() {
        const data = await access(store => store.get(null), 'Не удалось прочитать сохранённые наборы. Проверьте подключение расширения и обновите страницу.');
        return Object.entries(data).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => {
            try {
                const record = validate(value);
                if (key !== prefix + record.id) throw new Error('Идентификатор набора повреждён.');
                return record;
            } catch (error) { return { id: key.slice(prefix.length), name: typeof value?.name === 'string' ? value.name.slice(0, 80) : 'Повреждённый набор', error: error.message }; }
        }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    async function save(name, state, id = crypto.randomUUID()) {
        const record = validate({ version: 2, id, name, state });
        await access(store => store.set({ [prefix + record.id]: record }), 'Не удалось сохранить набор. Проверьте подключение расширения и повторите попытку.');
        return record;
    }
    async function remove(id) {
        if (typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id)) throw new Error('Некорректный идентификатор набора.');
        await access(store => store.remove(prefix + id), 'Не удалось удалить набор. Повторите попытку.');
    }
    function voices() {
        return RezkaSearch.suggestions('voice');
    }
    return { list, save, remove, voices, validate };
})();
