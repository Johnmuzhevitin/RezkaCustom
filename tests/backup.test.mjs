import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL('../extension/' + file, import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const sender = { id: 'backup-test', url: 'chrome-extension://backup-test/popup.html' };
const preset = (id = 'one', name = 'Любимое') => ({ version: 2, id, name, state: {
    version: 2, type: 'films', genre: '', from: '2000', to: '', country: 'США', sort: 'popular',
    extra: [{ kind: 'rule', field: 'imdb', op: 'gte', value: 7 }], advanced: null
} });
const backup = (sections = { settings: { 'player-max-quality': false }, voiceFavorites: ['12'], searchPresets: [preset()] }) => ({
    format: 'rezka-custom-backup', version: 1, exportedAt: '2026-11-04T10:00:00.000Z', extensionVersion: '0.10.0', sections
});

function worker(stored = {}, { set, get } = {}) {
    const values = clone(stored), writes = [], listeners = [], reads = [];
    const chrome = {
        runtime: { id: sender.id, getURL: path => `chrome-extension://${sender.id}/${path}`,
            onMessage: { addListener(fn) { listeners.push(fn); } } },
        storage: { local: {
            async get(keys) { reads.push(keys); if (get) await get(keys); return clone(values); },
            async set(updates) { if (set) await set(updates); writes.push(clone(updates)); Object.assign(values, clone(updates)); },
            async remove(key) { delete values[key]; }
        } },
        sidePanel: { async setPanelBehavior() {} },
        declarativeNetRequest: { async updateDynamicRules() {} }
    };
    const context = vm.createContext({ chrome, console, URL, TextEncoder, AbortController, Headers, setTimeout, clearTimeout });
    context.importScripts = (...files) => {
        for (const file of files) {
            // These independent workers have their own contract suites; no accounts or credentials in this fixture.
            if (['myshows-core.js', 'myshows-worker.js', 'diagnostics-worker.js'].includes(file)) continue;
            vm.runInContext(read(file), context, { filename: file });
        }
    };
    vm.runInContext(read('background.js') + '\nglobalThis.backupAPI = RezkaBackup;', context);
    const send = (message, from = sender) => {
        let handled = false;
        return new Promise(resolve => {
            for (const listen of listeners) if (listen(message, from, resolve) === true) handled = true;
            if (!handled) resolve(undefined);
        });
    };
    const request = (action, payload = {}, from) => send({ type: 'rezka:backup', action, ...payload }, from);
    return { values, writes, reads, request, send, api: context.backupAPI };
}

test('export round-trips active settings including defaults and false, favorites and complex filters only', async () => {
    const set = preset();
    set.secret = 'nested-token'; set.state.q = 'Not a saved filter'; set.state.secret = 'nested-state-token';
    const { request, values, writes, api } = worker({
        'r4:player-max-quality': false, 'r4:font': 'r4-font-averta-cy',
        'rezka:voice-favorite:12': true, 'rezka:voice-favorite:13': false,
        'rc-search:preset:v2:one': set,
        'myshows:state': { token: 'do-not-export', account: 'private-account', entries: ['history'] },
        'r4:token': 'legacy-secret', 'r4:player-scale': 'retired', 'r4:hide-countries-mode': 'legacy',
        'ui:country:example': { name: 'Country' }, 'ui:last-section': 'myshows', 'cache': 'private-cache'
    });
    const result = await request('export');
    assert.equal(result.ok, true, result.error);
    assert.match(result.filename, /^rezka-custom-\d{4}-\d{2}-\d{2}\.json$/);
    assert.doesNotMatch(result.text, /do-not-export|private-account|nested-token|nested-state-token|private-cache|Not a saved filter|player-scale|hide-countries|ui:last-section/);
    const parsed = clone(api.parse(result.text));
    assert.equal(Object.keys(parsed.sections.settings).length, 18);
    assert.equal(parsed.sections.settings['search-candidate-limit'], 10000);
    assert.equal(parsed.sections.settings['player-max-quality'], false);
    assert.equal(parsed.sections.settings['content-size'], 'r4-content-size-default');
    assert.equal(parsed.sections.settings.font, 'r4-font-averta-cy');
    assert.deepEqual(parsed.sections.voiceFavorites, ['12']);
    assert.deepEqual(parsed.sections.searchPresets, [preset()]);
    assert.deepEqual(writes, []);
    assert.equal(values['myshows:state'].token, 'do-not-export');
    assert.equal(Object.keys(clone(api.parse('\uFEFF' + result.text)).sections).length, 3);
});

test('the worker saves allowed search limits and backups restore the chosen value', async () => {
    const w = worker();
    assert.equal((await w.send({ type: 'rezka:save-setting', name: 'search-candidate-limit', index: 4 })).ok, true);
    assert.equal(w.values['r4:search-candidate-limit'], 50000);
    const exported = await w.request('export');
    const restored = worker();
    assert.equal((await restored.request('import', { text: exported.text, sections: ['settings'] })).ok, true);
    assert.equal(restored.values['r4:search-candidate-limit'], 50000);
    assert.equal((await w.send({ type: 'rezka:save-setting', name: 'search-candidate-limit', index: 5 })).ok, false);
    assert.equal(w.values['r4:search-candidate-limit'], 50000);
});

test('selective restore adds favorites, updates the same saved sets and preserves all other data', async () => {
    const original = { 'r4:player-max-quality': true, 'rezka:voice-favorite:99': true,
        'rc-search:preset:v2:one': preset('one', 'Старая версия'), 'rc-search:preset:v2:two': preset('two', 'Другой набор'),
        'myshows:state': { enabled: true, token: 'private', entries: [1, 2] }, 'ui:last-section': 'player' };
    const w = worker(original), text = JSON.stringify(backup());
    assert.equal((await w.request('preview', { text })).ok, true);
    assert.deepEqual(w.writes, []);
    const first = await w.request('import', { text, sections: ['voiceFavorites', 'searchPresets'] });
    assert.equal(first.ok, true, first.error);
    assert.equal(w.writes.length, 1);
    assert.equal(w.values['r4:player-max-quality'], true);
    assert.equal(w.values['rezka:voice-favorite:12'], true);
    assert.equal(w.values['rezka:voice-favorite:99'], true);
    assert.deepEqual(w.values['rc-search:preset:v2:one'], preset());
    assert.deepEqual(w.values['rc-search:preset:v2:two'], original['rc-search:preset:v2:two']);
    assert.deepEqual(w.values['myshows:state'], original['myshows:state']);
    assert.equal(w.values['ui:last-section'], 'player');
    const beforeRepeat = clone(w.values);
    await w.request('import', { text, sections: ['voiceFavorites', 'searchPresets'] });
    assert.deepEqual(w.values, beforeRepeat, 'Repeated imports do not duplicate records');
    await w.request('import', { text, sections: ['settings'] });
    assert.equal(w.values['r4:player-max-quality'], false);
});

test('invalid or unsupported files and selections never write, including invalid unselected sections', async () => {
    const cases = [
        'not JSON', 'null', JSON.stringify({ ...backup(), format: 'other' }), JSON.stringify({ ...backup(), version: 2 }),
        JSON.stringify({ ...backup(), exportedAt: 'not-a-date' }), JSON.stringify({ ...backup(), extensionVersion: '<script>' }),
        JSON.stringify(backup({ settings: { 'player-max-quality': 'true' } })),
        JSON.stringify(backup({ settings: { token: 'credential' } })),
        JSON.stringify(backup({ settings: { 'player-scale': 2 } })),
        JSON.stringify(backup({ myshows: { token: 'credential' } })),
        JSON.stringify(backup({ settings: { 'player-max-quality': true }, voiceFavorites: ['bad-id'] })),
        JSON.stringify(backup({ voiceFavorites: ['12', '12'] })), JSON.stringify(backup({ voiceFavorites: [12] })),
        JSON.stringify(backup({ voiceFavorites: ['1'.repeat(21)] })),
        JSON.stringify(backup({ searchPresets: [preset(), preset()] })),
        JSON.stringify(backup({ searchPresets: [{ ...preset(), state: { ...preset().state, extra: [{ kind: 'rule', field: 'token', op: 'any', values: ['x'] }] } }] })),
        JSON.stringify(backup({ searchPresets: [{ ...preset(), state: { ...preset().state, from: '1700' } }] })),
        JSON.stringify(backup({ searchPresets: [{ ...preset(), state: { ...preset().state, country: {} } }] })),
        JSON.stringify(backup({ searchPresets: [{ ...preset(), state: { ...preset().state, country: 'x'.repeat(81) } }] })),
        JSON.stringify(backup({ searchPresets: [{ ...preset(), id: '__proto__', state: { ...preset().state, extra: 'bad' } }] })),
        JSON.stringify(backup({ settings: JSON.parse('{"__proto__":{"polluted":true}}') })),
        ' '.repeat(2 * 1024 * 1024 + 1), 'я'.repeat(1024 * 1024 + 1)
    ];
    const w = worker({ sentinel: 'unchanged' });
    for (const text of cases) {
        const result = await w.request('import', { text, sections: ['settings'] });
        assert.equal(result.ok, false, text.slice(0, 100));
        assert.ok(result.error);
    }
    for (const sections of [[], ['settings', 'settings'], ['myshows'], ['__proto__'], 'settings', ['searchPresets']]) {
        assert.equal((await w.request('import', { text: JSON.stringify(backup({ settings: {} })), sections })).ok, false);
    }
    assert.deepEqual(w.writes, []);
    assert.deepEqual(w.values, { sentinel: 'unchanged' });
    assert.equal({}.polluted, undefined);
});

test('backup reads/writes are restricted to the actual same-extension panel', async () => {
    const w = worker();
    for (const from of [{ id: 'other', url: sender.url }, { id: sender.id, url: 'https://rezka.fi/' },
        { id: sender.id, url: 'chrome-extension://backup-test/help.html' }]) {
        for (const action of ['export', 'preview', 'import']) assert.equal(await w.request(action, { text: JSON.stringify(backup()), sections: ['settings'] }, from), undefined);
    }
    assert.deepEqual(w.writes, []);
    assert.deepEqual(w.reads, []);
});

test('import, normal settings saves and export share a queue; failures do not poison later writes', async () => {
    const gate = deferred(); let calls = 0;
    const w = worker({}, { async set() { if (++calls === 1) { await gate.promise; throw new Error('Storage quota'); } } });
    const first = w.request('import', { text: JSON.stringify(backup()), sections: ['settings'] });
    const save = w.send({ type: 'rezka:save-setting', name: 'player-max-quality', index: 0 });
    const exported = w.request('export');
    await tick();
    assert.equal(calls, 1); assert.equal(w.reads.length, 0);
    gate.resolve();
    assert.equal((await first).ok, false);
    assert.equal((await save).ok, true);
    assert.equal(JSON.parse((await exported).text).sections.settings['player-max-quality'], false);
    assert.equal(w.writes.length, 1);
});

test('export reports invalid presets and storage failures instead of silently dropping data', async () => {
    const invalid = worker({ 'rc-search:preset:v2:wrong': preset() });
    assert.equal((await invalid.request('export')).ok, false);
    const failed = worker({}, { async get() { throw new Error('private platform error'); } });
    const result = await failed.request('export');
    assert.equal(result.ok, false); assert.doesNotMatch(result.error, /private platform/);
});

async function panel(t, { stored = {}, send } = {}) {
    const w = worker(stored);
    const dom = new JSDOM(read('popup.html'), { url: sender.url, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { window } = dom, messages = [], downloads = [], blobs = [];
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    window.Blob = Blob;
    window.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:test-copy'; };
    window.URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, filename: this.download }); };
    window.chrome = { runtime: { async sendMessage(message) { messages.push(message); return send ? send(message, w) : w.send(message); } } };
    window.eval(read('backup-panel.js'));
    const $ = selector => window.document.querySelector(selector);
    const choose = async (text, name = 'backup.json') => {
        Object.defineProperty($('#backup-file'), 'files', { configurable: true, value: [{ name, size: new TextEncoder().encode(text).byteLength, text: async () => text }] });
        $('#backup-file').dispatchEvent(new window.Event('change'));
        await tick(); await tick();
    };
    $('#backup-button').click();
    return { ...w, window, $, messages, downloads, blobs, choose };
}

test('panel previews counts without writing, imports only chosen sections and returns focus', async t => {
    const p = await panel(t, { stored: { 'r4:player-max-quality': true } });
    const { $, choose, window } = p;
    assert.equal($('#backup-dialog').open, true);
    assert.equal(window.document.activeElement, $('#backup-export'));
    await choose(JSON.stringify(backup()), '<img src=x onerror=alert(1)>.json');
    assert.equal($('#backup-preview').hidden, false);
    assert.equal($('#backup-filename').textContent, '<img src=x onerror=alert(1)>.json');
    assert.equal($('#backup-preview img'), null);
    assert.equal(window.document.activeElement, $('[data-backup-section="settings"]'));
    assert.deepEqual([...window.document.querySelectorAll('.backup-choice output')].map(node => node.textContent), ['1', '1', '1']);
    assert.deepEqual(p.writes, []);
    $('[data-backup-section="settings"]').click();
    $('[data-backup-section="searchPresets"]').click();
    let restored = 0;
    window.document.addEventListener('rezka:backup-restored', () => restored++);
    $('#backup-restore').click(); await tick();
    assert.equal(p.values['r4:player-max-quality'], true);
    assert.deepEqual(p.writes, [{ 'rezka:voice-favorite:12': true }]);
    assert.equal(restored, 1);
    assert.match($('#backup-status').textContent, /восстановлены/);
    assert.equal(window.document.activeElement, $('#backup-close'));
    $('#backup-close').click();
    assert.equal(window.document.activeElement, $('#backup-button'));
    assert.equal($('#backup-dialog').open, false);
});

test('panel downloads an actual JSON blob with defaults and handles unavailable/empty sections', async t => {
    const p = await panel(t);
    p.$('#backup-export').click(); await tick();
    assert.equal(p.downloads.length, 1);
    const exported = JSON.parse(await p.blobs[0].text());
    assert.equal(Object.keys(exported.sections.settings).length, 18);
    assert.equal(exported.format, 'rezka-custom-backup');
    await p.choose(JSON.stringify(backup({ voiceFavorites: [], searchPresets: [preset()] })));
    assert.equal(p.$('[data-backup-section="settings"]').disabled, true);
    assert.equal(p.$('[data-backup-section="voiceFavorites"]').disabled, true);
    p.$('[data-backup-section="searchPresets"]').click();
    assert.equal(p.$('#backup-restore').disabled, true);
    await p.choose(JSON.stringify(backup({ voiceFavorites: [] })));
    assert.equal(p.$('#backup-restore').disabled, true);
    assert.match(p.$('#backup-status').textContent, /нет данных/);
});

test('invalid file invalidates the old preview and empty selection cannot write', async t => {
    const p = await panel(t);
    await p.choose(JSON.stringify(backup()));
    await p.choose('invalid');
    assert.equal(p.$('#backup-preview').hidden, true);
    assert.equal(p.$('#backup-restore').disabled, true);
    assert.equal(p.$('#backup-status').dataset.error, 'true');
    p.$('#backup-restore').click();
    assert.deepEqual(p.writes, []);
    await p.choose(' '.repeat(2 * 1024 * 1024 + 1));
    assert.match(p.$('#backup-status').textContent, /2 МБ/);
});

test('closing/reopening ignores stale preview replies and modal keys cannot reach panel shortcuts', async t => {
    const gate = deferred();
    const p = await panel(t, { async send(message, w) {
        if (message.action === 'preview') await gate.promise;
        return w.send(message);
    } });
    await p.choose(JSON.stringify(backup()));
    assert.equal(p.$('#backup-choose').disabled, true);
    let bubbled = false;
    p.window.document.addEventListener('keydown', () => { bubbled = true; });
    p.$('#backup-close').dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(bubbled, false);
    p.$('#backup-close').click(); p.$('#backup-button').click();
    gate.resolve(); await tick();
    assert.equal(p.$('#backup-preview').hidden, true);
    assert.equal(p.$('#backup-choose').disabled, false);
    assert.equal(p.$('#backup-status').textContent, '');
});

test('failed import keeps the validated selection for retry and does not claim success', async t => {
    let attempts = 0;
    const p = await panel(t, { async send(message, w) {
        if (message.action === 'import' && ++attempts === 1) return { ok: false, error: 'Не удалось сохранить копию.' };
        return w.send(message);
    } });
    await p.choose(JSON.stringify(backup()));
    p.$('#backup-restore').click(); await tick();
    assert.equal(p.$('#backup-status').dataset.error, 'true');
    assert.equal(p.$('#backup-preview').hidden, false);
    assert.equal(p.$('#backup-restore').disabled, false);
    assert.deepEqual(p.writes, []);
    p.$('#backup-restore').click(); await tick();
    assert.match(p.$('#backup-status').textContent, /восстановлены/);
    assert.equal(p.writes.length, 1);
});
