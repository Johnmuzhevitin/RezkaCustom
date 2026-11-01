import vm from 'node:vm';

// Collect declarations from the pinned source at build time. No network, timers,
// lifecycle callbacks, or feature effects run in this capture environment.
export function extractSettings(source) {
    const configs = [];
    const element = { addEventListener() {}, querySelector() { return element; } };
    const settings = {
        afterStart() {}, afterEnd() {}, addElementSetting() {},
        createTumblerSetting(config) { configs.push(config); }
    };
    const context = {
        GM: { info: { script: { version: '2.1.8' } }, addStyle() {} },
        R4Settings: () => settings,
        R4Utils: () => ({ fromHTML: () => element }), R4Fonts: () => ({}), R4Images: () => ({}),
        window: { addEventListener() {} }, document: { addEventListener() {} },
        MutationObserver: class { observe() {} }, setInterval() {}, console
    };
    vm.runInNewContext(source, context, { timeout: 1000 });
    return configs.map(config => ({
        name: config.name, label: config.label, group: config.submenu,
        defaultIndex: Math.max(0, config.options.findIndex(option => option.default === true)),
        options: config.options.map(option => {
            const value = option.value ?? option.class;
            return { text: option.text, ...(value === undefined ? { unset: true } : { value }), reload: option.reload === true };
        })
    }));
}
