import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { describeBuild, writeBuildInfo } from '../tools/build-info.mjs';
import { temporaryDirectory } from './helpers/temporary.mjs';

const root = fileURLToPath(new URL('../extension/', import.meta.url));
const read = name => readFile(join(root, name), 'utf8');
const buildFrom = source => vm.runInNewContext(source + '\nJSON.stringify(REZKA_BUILD)');

test('build identity is stable and detects shipped changes without relying on a version bump', async t => {
    const directory = await temporaryDirectory(t, 'rezka-build-');
    await writeFile(join(directory, 'manifest.json'), '{"version":"1.0.0"}');
    await writeFile(join(directory, 'feature.js'), 'const active = true;');
    const first = await writeBuildInfo(directory);
    assert.deepEqual(await writeBuildInfo(directory), first);
    await writeFile(join(directory, 'feature.js'), 'const active = false;');
    const next = await describeBuild(directory);
    assert.equal(next.version, first.version);
    assert.notEqual(next.id, first.id);
});

test('generated build identity matches the shipped files and all three contexts load it', async () => {
    const build = JSON.parse(buildFrom(await read('build-info.js')));
    assert.deepEqual(build, await describeBuild(root), 'Run npm run build after changing shipped files');
    const manifest = JSON.parse(await read('manifest.json'));
    assert.equal(manifest.content_scripts.find(entry => entry.js.includes('settings-controller.js')).js[0], 'build-info.js');
    const popup = await read('popup.html');
    assert.ok(popup.indexOf('src="build-info.js"') < popup.indexOf('src="popup.js"'));
    assert.match(await read('background.js'), /importScripts\("build-info\.js"/);
});

test('page settings report the build loaded in that page and its load time', async t => {
    const dom = new JSDOM('<html><body></body></html>', { url: 'https://rezka.fi/', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    let receive;
    dom.window.chrome = { runtime: { onMessage: { addListener(fn) { receive = fn; } } }, storage: { onChanged: { addListener() {} } } };
    dom.window.eval(await read('build-info.js') + '\n' + await read('settings-controller.js') + `
        RezkaSettings.attach({ configs: new Map(), applied: new Map(), initialization: new Map(),
            setBodyClass() {}, afterStart(fn) { fn(); }, afterEnd(fn) { fn(); } });`);
    const state = await new Promise(resolve => receive({ type: 'rezka:settings-state' }, {}, resolve));
    assert.equal(state.build.id, JSON.parse(buildFrom(await read('build-info.js'))).id);
    assert.equal(dom.window.document.documentElement.dataset.rezkaBuild, state.build.id);
    assert.ok(Number.isFinite(Date.parse(state.loadedAt)));
});

test('worker exposes its loaded build only to this extension settings panel', async () => {
    const listeners = [], context = vm.createContext({
        console, chrome: {
            runtime: { id: 'test', getURL: path => 'chrome-extension://test/' + path, onMessage: { addListener(fn) { listeners.push(fn); } } },
            sidePanel: { setPanelBehavior: async () => {} },
            declarativeNetRequest: { updateDynamicRules: async () => {} }
        }
    });
    context.importScripts = () => {};
    vm.runInContext(await read('build-info.js') + '\n' + await read('background.js'), context);
    const query = sender => {
        let reply;
        listeners.forEach(fn => fn({ type: 'rezka:build-info' }, sender, value => { reply = value; }));
        return reply;
    };
    assert.equal(query({ id: 'test', url: 'chrome-extension://test/popup.html' }).id, JSON.parse(buildFrom(await read('build-info.js'))).id);
    assert.equal(query({ id: 'other', url: 'chrome-extension://test/popup.html' }), undefined);
    assert.equal(query({ id: 'test', url: 'https://rezka.fi/' }), undefined);
});
