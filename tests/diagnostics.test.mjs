import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
const build = { id: 'a'.repeat(64), version: '0.6.6' };
const episode = { rezkaId: 123, season: 1, number: 1, title: 'PRIVATE_TITLE', imdb: 'tt1234567' };
const entry = { account: 'PRIVATE_ACCOUNT', key: '123:1:1', episode, status: 'watching', progress: 42,
    watchedProgress: 12, confirmedPosition: 50, code: 'network', reason: 'PRIVATE_REASON', token: 'PRIVATE_TOKEN',
    events: [{ reason: 'PRIVATE_HISTORY' }], url: 'https://rezka.fi/PRIVATE_URL' };

function worker({ playerBuild = build.id, failPage = false, changed = false, changedAccount = false, enabled = true, playbackAccount = entry.account, movie = false, status = 'watching' } = {}) {
    const currentEpisode = movie ? { kind: 'movie', rezkaId: 123, title: 'PRIVATE_MOVIE', imdb: 'tt1234567' } : episode;
    const currentKey = movie ? 'movie:123' : entry.key;
    const currentEntry = { ...entry, episode: currentEpisode, key: currentKey, status };
    const listeners = [], messages = [];
    let tabReads = 0, stateReads = 0;
    const chrome = {
        runtime: { id: 'fixture', getURL: path => 'chrome-extension://fixture/' + path,
            onMessage: { addListener: listener => listeners.push(listener) } },
        storage: { local: { get: async () => ({ 'myshows:state': { account: ++stateReads > 1 && changedAccount ? 'another' : entry.account, connection: 'connected', enabled, threshold: 90,
            entries: [currentEntry, { ...entry, account: 'FOREIGN_ACCOUNT', code: 'auth' }, { ...entry, key: '123:1:2', status: 'attention', code: 'PRIVATE_CODE' }] } }) } },
        tabs: {
            get: async id => ({ id, url: ++tabReads > 1 && changed ? 'https://example.com/' : 'https://rezka.fi/series/123-fixture.html' }),
            sendMessage: async (id, message) => {
                messages.push(message.type);
                if (failPage) throw new Error('PRIVATE_ERROR');
                return message.type === 'rezka:diagnostic-page' ? { connected: true, build, errorCount: 1, pendingReloadCount: 2 }
                    : { episode: currentEpisode, build: playerBuild, playback: { account: playbackAccount, key: currentKey, seconds: 12, state: 'paused' } };
            }
        }
    };
    const context = vm.createContext({ chrome, REZKA_BUILD: build, URL, setTimeout, clearTimeout, Date });
    vm.runInContext(read('network-policy.js') + '\n' + read('myshows-core.js') + '\n' + read('diagnostics-worker.js'), context);
    const send = (input = {}, sender = { id: 'fixture', url: chrome.runtime.getURL('help.html') }) => new Promise(resolve => {
        listeners[0]({ type: 'rezka:diagnostics', tabId: 1, helpBuild: build, panelBuild: build, ...input }, sender, resolve);
    });
    return { send, messages };
}

test('diagnostic report exports only allowlisted fields and current-account aggregates', async () => {
    const w = worker(), { ok, report } = await w.send();
    assert.equal(ok, true);
    const json = JSON.stringify(report);
    assert.doesNotMatch(json, /PRIVATE_|FOREIGN_|tt1234567|https:|123:1:1|fixture-token/);
    assert.equal(report.buildChecks.panel, 'match');
    assert.equal(report.myshows.counts.watching, 1);
    assert.equal(report.myshows.counts.attention, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(report.myshows.errorCounts)), { network: 1, unknown: 1 });
    assert.equal(report.myshows.current.progress, 42);
    assert.equal(report.myshows.current.confirmation.seconds, 12);
    assert.equal(report.page.settingErrorCount, 1);
    assert.deepEqual(w.messages.sort(), ['myshows:player-current', 'rezka:diagnostic-page']);
});

test('diagnostics recognize locally reset records without live confirmation telemetry', async () => {
    const { report } = await worker({ status: 'reset' }).send();
    assert.equal(report.myshows.counts.reset, 1);
    assert.equal(report.myshows.counts.unknown, 0);
    assert.equal(report.myshows.current.status, 'reset');
    assert.equal(report.myshows.current.confirmation, null);
});

test('diagnostics reject website, foreign-extension and panel callers without reading data', async () => {
    const w = worker();
    for (const sender of [{ id: 'other', url: 'chrome-extension://fixture/help.html' },
        { id: 'fixture', url: 'https://rezka.fi/' }, { id: 'fixture', url: 'chrome-extension://fixture/popup.html' }]) {
        assert.equal((await w.send({}, sender)).ok, false);
    }
    assert.equal(w.messages.length, 0);
});

test('missing panel and page, navigation and invalid playback remain explicitly unavailable', async () => {
    const missing = (await worker({ failPage: true }).send({ panelBuild: undefined })).report;
    assert.equal(missing.builds.panel, null); assert.equal(missing.builds.page, null);
    assert.equal(missing.page.state, 'unavailable'); assert.equal(missing.myshows.current, null);
    const changed = (await worker({ changed: true }).send()).report;
    assert.equal(changed.page.state, 'changed_during_collection'); assert.equal(changed.myshows.current, null);
    assert.equal((await worker({ changedAccount: true }).send()).report.myshows.current, null);
    for (const config of [{ enabled: false }, { playerBuild: 'old' }, { playbackAccount: 'other' }]) {
        assert.equal((await worker(config).send()).report.myshows.current.confirmation, null);
    }
    const noPage = worker();
    assert.equal((await noPage.send({ tabId: null })).report.page.state, 'not_selected_or_closed');
    assert.equal(noPage.messages.length, 0);
    assert.equal((await worker().send({ panelBuild: { id: 'b'.repeat(64), version: '0.6.5' } })).report.buildChecks.panel, 'mismatch');
});

test('help view previews, invalidates and copies diagnostics, with manual-copy fallback', async t => {
    const dom = new JSDOM(read('help.html'), { url: 'chrome-extension://fixture/help.html', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { window } = dom, $ = selector => window.document.querySelector(selector);
    let copied, denied = false;
    window.chrome = { windows: { getCurrent: async () => ({ id: 1 }) }, extension: { getViews: () => [] },
        tabs: { query: async () => [{ id: 1, url: 'https://rezka.fi/series/123-fixture.html', title: 'Private title shown only in selector' }] },
        runtime: { sendMessage: async () => ({ ok: true, report: { schema: 1, myshows: { enabled: false } } }) } };
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async value => { if (denied) throw new Error('denied'); copied = value; } } });
    window.eval('const REZKA_BUILD = ' + JSON.stringify(build) + ';\n' + read('network-policy.js') + '\n' + read('help.js'));
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    await tick();
    $('#diagnostics-collect').click(); await tick();
    assert.equal($('#diagnostics-report').hidden, false);
    $('#diagnostics-copy').click(); await tick();
    assert.equal(copied, $('#diagnostics-report').value);
    denied = true; $('#diagnostics-copy').click(); await tick();
    assert.match($('#diagnostics-status').textContent, /Ctrl\+C/);
    assert.equal(window.document.activeElement, $('#diagnostics-report'));
    $('#diagnostics-tab').value = ''; $('#diagnostics-tab').dispatchEvent(new window.Event('change'));
    assert.equal($('#diagnostics-copy').disabled, true); assert.equal($('#diagnostics-report').value, '');
});


test('movie diagnostics retain progress and confirmation without exposing movie identity', async () => {
    const { report } = await worker({ movie: true }).send();
    assert.equal(report.myshows.current.progress, 42);
    assert.equal(report.myshows.current.confirmation.seconds, 12);
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_|FOREIGN_|movie:123|tt1234567/);
});
