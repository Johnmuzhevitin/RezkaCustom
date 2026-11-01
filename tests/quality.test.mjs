import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// No browser, real streams or clock delays: exercise the shipped page bridge.
function playerHarness() {
    const window = new EventTarget(), document = new EventTarget();
    const intervals = new Map(), timeouts = new Map();
    let sequence = 0;
    const location = new URL('https://rezka.fi/series/test.html');
    const context = vm.createContext({ window, document, location, CustomEvent,
        setInterval(fn) { intervals.set(++sequence, fn); return sequence; },
        clearInterval(id) { intervals.delete(id); },
        setTimeout(fn) { timeouts.set(++sequence, fn); return sequence; },
        clearTimeout(id) { timeouts.delete(id); }
    });
    vm.runInContext(read('extension/player-quality.js') + '\n' + read('extension/page-bridge.js'), context);
    function request(method, value) {
        let response;
        document.addEventListener('rezka-custom:player-response', event => { response = JSON.parse(event.detail); }, { once: true });
        document.dispatchEvent(new CustomEvent('rezka-custom:player-request', { detail: JSON.stringify({ id: 'test', method, value }) }));
        return response;
    }
    function event(name, source = window, origin = location.origin) {
        window.dispatchEvent(Object.assign(new Event('message'), { source, origin, data: { event: name } }));
    }
    function flush() {
        const tasks = [...timeouts.values()]; timeouts.clear(); tasks.forEach(fn => fn());
    }
    function install(labels, current = '360p', mode = 'normal') {
        const calls = [];
        const state = { labels, current, mode, reads: 0 };
        context.CDNPlayer = { api(method, value) {
            if (state.mode === 'throw') throw new Error('Player replacing source');
            if (method === 'qualities') { state.reads++; return state.labels; }
            if (method === 'quality' && value === undefined) return state.current;
            if (method === 'quality') {
                calls.push(value);
                if (state.mode !== 'deferred') state.current = (typeof state.labels === 'string' ? state.labels.split(',') : state.labels)[value];
                event('quality');
            }
        } };
        return { state, calls };
    }
    return { install, event, flush, request, intervals, timeouts,
        poll: () => [...intervals.values()].forEach(fn => fn()), enable: value => request('max-quality', value) };
}

test('highest quality is ranked by resolution then Ultra, independent of list order', () => {
    const examples = [
        ['720p,2160p,1080p Ultra,1440p,1080p', 1],
        [['1080p Ultra', '720p', '1440p'], 2],
        [['1080p', '480p', '1080p Ultra', '720p'], 2],
        [['720p', '1080p', '480p'], 1],
        [['360p', '480p', '720p'], 2],
        [['240p', '144p'], 0],
        [['4K', 'Full HD Ultra', '2K'], 0],
        [['Full HD', 'Full HD Ultra', 'HD'], 1],
        [['1080p Ultra', '2K'], 1],
        [['4K', '8K', '1440p'], 1],
        [['1080p 1000kbps', '1080p 2mbps'], 1],
        [['1920x1080', '3840×2160'], 1]
    ];
    for (const [labels, index] of examples) {
        const h = playerHarness(), { calls } = h.install(labels, 'Auto');
        assert.equal(h.enable(true).result, true);
        assert.deepEqual(calls, [index], JSON.stringify(labels));
        h.flush(); h.poll();
        assert.deepEqual(calls, [index], 'Already at maximum: no playback restart');
    }
});

test('quality indices retain Auto, separators, unavailable premium entries and unknown labels', () => {
    const h = playerHarness();
    const { calls } = h.install(['Auto', '<<<4K', 'Unknown', '720p',
        '<span>1080p&nbsp;Ultra</span>',
        '<span class="pjs-prem-quality">2160p<img src="/prem-icon.svg"></span>']);
    h.enable(true);
    assert.deepEqual(calls, [4]);
});

test('missing, empty and unrecognized lists do not select a guessed quality', () => {
    for (const labels of [undefined, null, '', [], {}, ['Auto', 'High', '<<<2160p'], ['2160p Premium']]) {
        const h = playerHarness(), { calls } = h.install(labels);
        h.enable(true); h.poll(); h.flush();
        assert.deepEqual(calls, [], String(labels));
    }
});

test('late player initialization, delayed qualities and transient API errors recover', () => {
    const h = playerHarness();
    h.enable(true); h.poll();
    const { state, calls } = h.install([], undefined, 'throw');
    h.poll();
    state.mode = 'normal'; h.poll();
    state.labels = ['480p', '1080p']; state.current = undefined; h.poll();
    assert.deepEqual(calls, []);
    state.current = '480p'; h.event('inited'); h.flush();
    assert.deepEqual(calls, [1]);
});

test('episodes and translations recalculate maximum, including lower maxima and rebuilt players', () => {
    const h = playerHarness(), { state, calls } = h.install(['360p', '1080p', '2160p']);
    h.enable(true);
    state.labels = ['360p', '720p']; state.current = '360p';
    h.event('new'); h.flush();
    state.labels = ['1080p Ultra', '480p', '720p']; state.current = '720p';
    h.event('new'); h.flush();
    // Same list and starting quality on the next episode, before a polling tick.
    state.current = '720p'; h.event('new'); h.flush();
    assert.deepEqual(calls, [2, 1, 0, 0]);
    const replacement = h.install(['1440p', '720p'], '720p');
    h.poll();
    assert.deepEqual(replacement.calls, [0]);
});

test('quality feedback and slow or ignored setters cannot cause repeated switching', () => {
    const h = playerHarness(), { state, calls } = h.install(['720p', '1080p'], '720p', 'deferred');
    h.enable(true);
    for (let index = 0; index < 10; index++) { h.event('quality'); h.flush(); h.poll(); }
    assert.deepEqual(calls, [1]);
    state.current = '1080p'; h.event('quality'); h.flush();
    state.current = '720p'; h.event('quality'); h.flush();
    assert.deepEqual(calls, [1, 1]);
});

test('numeric current index and already selected best quality do not trigger a switch', () => {
    for (const current of [0, '1080p Ultra']) {
        const h = playerHarness(), { calls } = h.install(['1080p Ultra', '720p'], current);
        h.enable(true); h.poll();
        assert.deepEqual(calls, []);
    }
});

test('live disable cancels scheduled work; repeated enable adds no extra polling', () => {
    const h = playerHarness(), { state, calls } = h.install(['360p', '720p']);
    h.enable(false); h.poll();
    assert.deepEqual(calls, []);
    h.enable(true); h.enable(true);
    assert.equal(h.intervals.size, 1);
    state.current = '360p'; h.event('quality');
    h.enable(false); h.flush(); h.poll(); h.event('new'); h.flush();
    assert.equal(h.intervals.size, 0);
    assert.equal(h.timeouts.size, 0);
    assert.deepEqual(calls, [1]);
    h.enable(true);
    assert.deepEqual(calls, [1, 1]);
});

test('bridge validates the boolean setting and ignores events from unrelated windows', () => {
    const h = playerHarness(), { state } = h.install(['720p']);
    assert.match(h.enable('true').error, /настройка/);
    assert.equal(h.intervals.size, 0);
    assert.match(h.request('eval', 'anything').error, /Неизвестная/);
    h.enable(true); h.flush();
    const reads = state.reads;
    h.event('new', {}, 'https://rezka.fi'); h.flush();
    h.event('new', undefined, 'https://other.example'); h.flush();
    assert.equal(state.reads, reads);
});

test('generated setting defaults on and propagates persisted/live choices through the real settings engine', async t => {
    for (const stored of [undefined, false]) {
        const dom = new JSDOM(read('tests/browser/fixture.html'), { url: 'https://rezka.fi/series/test.html', runScripts: 'outside-only' });
        t.after(() => dom.window.close());
        const { window } = dom, values = {}, storageListeners = [];
        if (stored !== undefined) values['r4:player-max-quality'] = stored;
        window.console = { debug() {}, warn() {}, error() {}, log() {} };
        window.chrome = {
            runtime: { getManifest: () => ({ version: 'test' }), onMessage: { addListener() {} }, sendMessage: async () => ({ ok: false }) },
            storage: {
                onChanged: { addListener(fn) { storageListeners.push(fn); } },
                local: {
                    get: async key => key === null ? { ...values } : { [key]: values[key] },
                    set: async items => Object.assign(values, items), remove: async key => { delete values[key]; }
                }
            }
        };
        let current = '720p';
        const calls = [];
        window.CDNPlayer = { api(method, value) {
            if (method === 'qualities') return '720p,1080p Ultra';
            if (method === 'quality' && value === undefined) return current;
            if (method === 'quality') { calls.push(value); current = value === 1 ? '1080p Ultra' : '720p'; }
        } };
        const manifest = JSON.parse(read('extension/manifest.json'));
        window.eval(manifest.content_scripts.flatMap(entry => entry.js).map(file => read('extension/' + file)).join('\n'));
        await new Promise(resolve => setTimeout(resolve, 25));
        assert.deepEqual(calls, stored === false ? [] : [1]);
        values['r4:player-max-quality'] = false;
        storageListeners.forEach(fn => fn({ 'r4:player-max-quality': { newValue: false } }, 'local'));
        await new Promise(resolve => setTimeout(resolve, 0));
        current = '720p';
        values['r4:player-max-quality'] = true;
        storageListeners.forEach(fn => fn({ 'r4:player-max-quality': { newValue: true } }, 'local'));
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.deepEqual(calls, stored === false ? [1] : [1, 1]);
        dom.window.close();
    }
});
