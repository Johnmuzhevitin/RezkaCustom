// Synchronizes the existing feature callbacks with the extension popup.
const RezkaSettings = {
    registerCountry(config) {
        if (config.submenu !== 'Фильтр по стране' || config.name.startsWith('hide-countries')) return;
        chrome.storage.local.set({ ['ui:country:' + config.name]: {
            name: config.name, label: config.label, group: config.submenu, defaultIndex: 0,
            options: config.options.map(option => ({ text: option.text,
                ...(option.value === undefined ? { unset: true } : { value: option.value }), reload: !!option.reload }))
        } }).catch(() => {});
    },
    attach({ configs, applied, initialization, setBodyClass, afterStart, afterEnd }) {
        const pendingReload = new Set();
        const errors = new Set();
        const installedEffects = new Set();
        const queues = new Map();
        const serialize = config => ({
            name: config.name, label: config.label, group: config.submenu,
            defaultIndex: Math.max(0, config.options.findIndex(option => option.default)),
            options: config.options.map(option => ({ text: option.text,
                ...(option.value === undefined ? { unset: true } : { value: option.value }), reload: !!option.reload }))
        });
        function run(callback, lifecycle, name) {
            if (!callback) return;
            lifecycle(() => {
                try { Promise.resolve(callback()).catch(() => errors.add(name)); }
                catch { errors.add(name); }
            });
        }
        async function apply(name) {
            const config = configs.get(name);
            if (!config) return;
            await initialization.get(name);
            const value = await GM.getValue(name);
            const option = config.options.find(option => option.value === value)
                || config.options.find(option => option.default) || config.options[0];
            if (applied.get(name) === option) { pendingReload.delete(name); return; }
            // Preserve playback: reload-only reversals wait for an explicit click.
            if (option.reload) { pendingReload.add(name); return; }
            pendingReload.delete(name);
            errors.delete(name);
            const previous = applied.get(name);
            applied.set(name, option);
            afterStart(() => setBodyClass(config, option));
            // Upstream installs handlers on activation. Installing them twice
            // would double keyboard actions; classes already gate their effects.
            const once = ['hotkeys', 'font', 'snap-scroll'].includes(name);
            if (once && previous && previous !== config.options[0]) installedEffects.add(name);
            if (!once || !installedEffects.has(name)) {
                run(option.start, afterStart, name);
                run(option.end, afterEnd, name);
                if (once && option !== config.options[0]) installedEffects.add(name);
            }
        }
        function enqueue(name) {
            const queue = (queues.get(name) || Promise.resolve()).then(() => apply(name));
            queues.set(name, queue.catch(() => errors.add(name)));
            return queues.get(name);
        }
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            for (const key of Object.keys(changes)) if (key.startsWith('r4:')) enqueue(key.slice(3));
        });
        chrome.runtime.onMessage.addListener((message, sender, respond) => {
            if (message?.type !== 'rezka:settings-state') return;
            (async () => {
                await Promise.all(initialization.values());
                // Read persisted values too, closing the storage-event/message race.
                await Promise.all([...configs.keys()].map(enqueue));
                respond({ connected: true, pendingReload: [...pendingReload], errors: [...errors],
                    settings: [...configs.values()].map(serialize) });
            })().catch(() => respond({ connected: false }));
            return true;
        });
        return {};
    }
};
