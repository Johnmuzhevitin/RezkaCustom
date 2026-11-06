import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { extractSettings } from '../tools/extract-settings.mjs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function adapter(reply = { ok: true, response: { status: 200, responseText: '{"ok":true}' } }) {
    const values = {};
    let sent;
    const chrome = {
        storage: { local: {
            async get(key) { return key === null ? { ...values } : Object.hasOwn(values, key) ? { [key]: values[key] } : {}; },
            async set(data) { Object.assign(values, data); },
            async remove(key) { delete values[key]; }
        } },
        runtime: {
            async sendMessage(message) { sent = message; return reply; },
            onMessage: { addListener() {} }
        }
    };
    const context = vm.createContext({ chrome });
    vm.runInContext(read('extension/gm-adapter.js') + '\nglobalThis.api = GM;', context);
    return { api: context.api, values, sent: () => sent };
}

test('settings preserve false, null and empty string; undefined deletes; keys are namespaced', async () => {
    const { api, values } = adapter();
    for (const value of [false, null, '', 0, ['ru', 'en']]) {
        await api.setValue('example', value);
        assert.deepEqual(await api.getValue('example', 'fallback'), value);
    }
    values.unrelated = 1;
    assert.deepEqual(Array.from(await api.listValues()), ['example']);
    await api.setValue('example', undefined);
    assert.equal(await api.getValue('example', 'fallback'), 'fallback');
    await api.setValue('example', true);
    await api.deleteValue('example');
    assert.equal(await api.getValue('example'), undefined);
});

test('network adapter serializes data only and preserves onload + promise result', async () => {
    const { api, sent } = adapter();
    let loaded;
    const result = await api.xmlHttpRequest({
        method: 'POST', url: 'https://rezka.fi/engine/ajax/quick_content.php',
        data: '{"id":42}', responseType: 'json', onload: value => { loaded = value; }
    });
    assert.equal(loaded, result);
    assert.equal(result.response.ok, true);
    assert.equal(sent().details.data, '{"id":42}');
    assert.equal('onload' in sent().details, false);
});

test('network failures call onerror; timeouts fall back to onerror', async () => {
    for (const timeout of [true, false]) {
        const { api } = adapter({ ok: false, error: 'unavailable', timeout });
        let called = false;
        await api.xmlHttpRequest({ url: 'https://rezka.fi/', onerror: response => {
            called = true;
            assert.equal(response.status, 0);
        } });
        assert.equal(called, true);
    }
});

test('network boundary rejects other pages, arbitrary services, credentials and misleading domains', () => {
    const context = vm.createContext({ URL });
    vm.runInContext(read('extension/network-policy.js') + '\nglobalThis.policy = RezkaNetwork;', context);
    const policy = context.policy;
    for (const site of ['https://rezka.fi/', 'https://hdrezka.ag/x', 'http://mirror-rezka.example/', 'https://kinopub.me/']) {
        assert.equal(policy.isSite(site), true);
        assert.equal(policy.allowed(new URL('/engine/ajax/quick_content.php', site).href, site), true);
        assert.equal(policy.allowed('https://www.imdb.com/title/tt1234567/', site), true);
        assert.equal(policy.allowed('https://api.opensubtitles.com/api/v1/subtitles', site), false);
    }
    for (const site of ['https://example.com/?rezka', 'https://rezka.local/', 'https://rezka.home/', 'file:///rezka']) {
        assert.equal(policy.isSite(site), false);
    }
    for (const target of ['https://evil.example/', 'https://imdb.com.evil.example/', 'http://api.opensubtitles.com/', 'https://user:pass@rezka.fi/', 'file:///etc/passwd']) {
        assert.equal(policy.allowed(target, 'https://rezka.fi/'), false);
    }
});

test('port retains supported feature initializers and settings without retired implementations', () => {
    const upstream = read('upstream/hdrezka-improvement-2.1.8.user.js');
    const port = read('extension/improvement.js');
    const added = new Set(['name: "player-max-quality"', 'label: "Всегда максимальное качество"',
        'name: "dim-watched"', 'label: "Различать статусы просмотра"',
        'name: "search-candidate-limit"', 'label: "Лимит проверки карточек"']);
    const retiredNames = new Set(['player-scale', 'player-triple-click', 'player-full-page', 'snap-scroll',
        'snap-scroll-onload', 'hide-info', 'more-hide', 'translators']);
    const removed = new Set(['initPlayerSubtitles', 'initPlayerScale', 'initHideInfo', 'initHideMore',
        'initHideTranslators', 'initSnapScroll'].map(name => `function ${name}(`));
    for (const config of extractSettings(upstream).filter(config => retiredNames.has(config.name))) {
        removed.add(`name: "${config.name}"`);
        removed.add(`label: "${config.label}"`);
    }
    for (const pattern of [/function init\w+\(/g, /name: ["`][^"`]+["`]/g, /label: "[^"\n]+"/g]) {
        assert.deepEqual(port.match(pattern).filter(item => !added.has(item)), upstream.match(pattern).filter(item => !removed.has(item)));
    }
    const schema = vm.runInNewContext(read('extension/settings-schema.js') + '; REZKA_SETTINGS;');
    assert.equal(schema.some(config => retiredNames.has(config.name)), false);
    assert.doesNotMatch(port, /r4-player-scale|r4-player-triple-click|r4-player-full-page-enabled|r4-snap-scroll|r4-hide-info|r4-more-hide|r4-translators-hide|r4-toggle-translators|controlsLarge|createControlLarge|state\.scale|state\.collapsed/);
    assert.equal(port.includes('executeLocation('), false);
    assert.equal(read('extension/vendor/r4-utils.js').includes('javascript:'), false);
    assert.equal(port.includes('script_homepage: null'), true);
});

test('shipped extension has no subtitle implementation, service key or player command', () => {
    for (const file of ['improvement.js', 'popup.js', 'popup.html', 'popup.css', 'background.js', 'network-policy.js', 'page-bridge.js', 'vendor/r4-images.js']) {
        assert.equal(/opensubtitles|r4-subtitles|["']subtitle["']|REZKA_SUBTITLES_KEY/i.test(read('extension/' + file)), false, file);
    }
    assert.equal(existsSync(new URL('../extension/service-config.js', import.meta.url)), false);
});

test('all manifest scripts parse; libraries are bundled and extension has no remote code entrypoint', () => {
    const manifest = JSON.parse(read('extension/manifest.json'));
    assert.equal(manifest.manifest_version, 3);
    for (const script of new Set(manifest.content_scripts.flatMap(entry => entry.js).concat(['background.js', 'network-policy.js', 'settings-schema.js', 'popup.js']))) {
        assert.ok(!/^https?:/.test(script));
        new vm.Script(read(`extension/${script}`), { filename: script });
    }
    assert.equal(manifest.content_scripts[0].world, 'MAIN');
    assert.equal(manifest.content_scripts[1].world, 'ISOLATED');
    assert.equal(manifest.action.default_popup, undefined);
    assert.equal(manifest.side_panel.default_path, 'popup.html');
    assert.ok(manifest.permissions.includes('sidePanel'));
});
