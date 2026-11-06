// Versioned, allowlisted backups. Never serialize the extension storage wholesale.
const RezkaBackup = (() => {
    const maxBytes = 2 * 1024 * 1024;
    const sectionNames = ['settings', 'voiceFavorites', 'searchPresets'];
    // Only active panel controls; retired and hidden legacy settings stay local.
    const settingNames = ['content-size', 'font', 'styles', 'dim-watched', 'imdb', 'navbar-links', 'search-candidate-limit',
        'theme-color-black', 'player-max-quality', 'player-no-margin', 'player-top-bar',
        'player-extra-controls', 'auto-play-next', 'player-cover', 'hotkeys', 'hide-ads',
        'hide-player-ads', 'comments-hide'];
    const configs = new Map(REZKA_SETTINGS.filter(config => settingNames.includes(config.name)).map(config => [config.name, config]));
    const voicePrefix = 'rezka:voice-favorite:';
    const presetPrefix = 'rc-search:preset:v2:';
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const fail = message => { throw new Error(message); };
    const size = text => new TextEncoder().encode(text).byteLength;
    function boundedText(text) {
        if (typeof text !== 'string' || text.length > maxBytes || size(text) > maxBytes) {
            fail('Файл слишком большой. Максимальный размер копии — 2 МБ.');
        }
        return text;
    }
    function settings(values) {
        if (!object(values)) fail('Повреждён раздел настроек.');
        const result = {};
        for (const [name, value] of Object.entries(values)) {
            const config = configs.get(name);
            if (!config) fail('В копии есть неизвестная настройка. Возможно, нужно обновить расширение.');
            if (!config.options.some(option => !option.unset && option.value === value)) fail('В копии есть недопустимое значение настройки.');
            result[name] = value;
        }
        return result;
    }
    function favorites(values) {
        if (!Array.isArray(values) || values.length > 1000
            || values.some(id => typeof id !== 'string' || !/^\d{1,20}$/.test(id))) fail('Повреждён список избранных озвучек.');
        if (new Set(values).size !== values.length) fail('В списке избранных озвучек есть повторы.');
        return [...values];
    }
    function presets(values) {
        if (!Array.isArray(values) || values.length > 500) fail('Повреждён список наборов фильтров или превышен лимит в 500 наборов.');
        const ids = new Set();
        return values.map(value => {
            let record;
            try {
                if (!object(value?.state)) throw new Error();
                for (const key of ['type', 'genre', 'from', 'to', 'country', 'sort']) {
                    if (value.state[key] !== undefined && typeof value.state[key] !== 'string') throw new Error();
                }
                if ((value.state.country?.length || 0) > 80) throw new Error();
                record = RezkaSearchStore.validate(value);
            } catch { fail('Один из наборов фильтров повреждён или не поддерживается этой версией.'); }
            if (ids.has(record.id)) fail('В копии повторяется один и тот же набор фильтров.');
            ids.add(record.id);
            return record;
        });
    }
    function validate(value) {
        if (!object(value) || value.format !== 'rezka-custom-backup') fail('Это не резервная копия Rezka Custom. Выберите файл, созданный расширением.');
        if (value.version !== 1) fail('Версия резервной копии не поддерживается. Обновите расширение и попробуйте снова.');
        if (typeof value.exportedAt !== 'string' || value.exportedAt.length > 40 || !Number.isFinite(Date.parse(value.exportedAt))
            || typeof value.extensionVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.extensionVersion)) fail('Повреждены сведения о резервной копии.');
        if (!object(value.sections) || !Object.keys(value.sections).length
            || Object.keys(value.sections).some(name => !sectionNames.includes(name))) fail('В копии есть неизвестные или повреждённые разделы.');
        const sections = {};
        const validators = { settings, voiceFavorites: favorites, searchPresets: presets };
        for (const name of sectionNames) if (Object.hasOwn(value.sections, name)) sections[name] = validators[name](value.sections[name]);
        return { format: 'rezka-custom-backup', version: 1, exportedAt: new Date(value.exportedAt).toISOString(),
            extensionVersion: value.extensionVersion, sections };
    }
    function parse(text) {
        boundedText(text);
        let value;
        try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
        catch { fail('Не удалось прочитать JSON. Выберите неповреждённый файл резервной копии.'); }
        return validate(value);
    }
    function snapshot(storage, version, now = new Date()) {
        const values = {};
        for (const [name, config] of configs) {
            const key = 'r4:' + name;
            values[name] = Object.hasOwn(storage, key) ? storage[key] : config.options[config.defaultIndex].value;
        }
        const voices = [], sets = [];
        for (const [key, value] of Object.entries(storage)) {
            if (key.startsWith(voicePrefix) && value === true) voices.push(key.slice(voicePrefix.length));
            if (key.startsWith(presetPrefix)) {
                if (key !== presetPrefix + value?.id) fail('Один из сохранённых наборов повреждён. Удалите его в расширенном поиске и повторите экспорт.');
                sets.push(value);
            }
        }
        return validate({ format: 'rezka-custom-backup', version: 1, exportedAt: now.toISOString(), extensionVersion: version,
            sections: { settings: values, voiceFavorites: voices.sort(), searchPresets: presets(sets).sort((a, b) => a.id.localeCompare(b.id)) } });
    }
    function summary(backup) {
        const counts = {};
        for (const [name, values] of Object.entries(backup.sections)) counts[name] = Object.keys(values).length;
        return { exportedAt: backup.exportedAt, extensionVersion: backup.extensionVersion, counts };
    }
    function plan(backup, selected) {
        if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length
            || selected.some(name => !sectionNames.includes(name) || !Object.hasOwn(backup.sections, name))) fail('Выберите разделы для восстановления.');
        const updates = {};
        if (selected.includes('settings')) for (const [name, value] of Object.entries(backup.sections.settings)) updates['r4:' + name] = value;
        if (selected.includes('voiceFavorites')) for (const id of backup.sections.voiceFavorites) updates[voicePrefix + id] = true;
        if (selected.includes('searchPresets')) for (const record of backup.sections.searchPresets) updates[presetPrefix + record.id] = record;
        if (!Object.keys(updates).length) fail('В выбранных разделах нет данных для восстановления.');
        return updates;
    }
    return { maxBytes, settingNames, boundedText, parse, snapshot, summary, plan };
})();
