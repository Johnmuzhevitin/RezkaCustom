import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const origin = 'https://rezka.fi';
const tick = () => new Promise(resolve => setImmediate(resolve));
const state = { extra: [{ kind: 'rule', field: 'imdb', op: 'gte', value: 7 }] };
const url = id => origin + `/films/fiction/${id}-test.html`;
const listing = ids => '<div class="b-content__inline_items">' + ids.map(id => `<div class="b-content__inline_item"><div class="b-content__inline_item-link"><a href="${url(id)}">Title ${id}</a><div>2020, США</div></div></div>`).join('') + '</div>';
const detail = '<table><tr><td>Страна:</td><td>США</td></tr><tr><td>Жанр:</td><td><a href="/films/fiction/">Фантастика</a></td></tr></table><span class="imdb"><span>8</span></span>';
function environment(t) {
    const dom = new JSDOM('', { url: origin, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
    dom.window.eval(read('search-rules.js') + '\n' + read('search-core.js') + '\nwindow.api = RezkaSearch;');
    return { S: dom.window.api, w: dom.window };
}
function transport(ids) {
    const pending = new Map(), calls = []; let active = 0, peak = 0;
    return { pending, calls, get peak() { return peak; }, get active() { return active; },
        fetch: async (target, { signal } = {}) => {
            if (!target.endsWith('.html')) return listing(ids);
            const id = Number(target.match(/\/(\d+)-/)[1]); calls.push(id);
            active++; peak = Math.max(peak, active);
            try {
                return await new Promise((resolve, reject) => {
                    const abort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
                    pending.set(id, { resolve: () => { signal?.removeEventListener('abort', abort); resolve(detail); },
                        reject: () => { signal?.removeEventListener('abort', abort); reject(new Error('Offline')); } });
                    signal?.addEventListener('abort', abort, { once: true });
                    if (signal?.aborted) abort();
                });
            } finally { active--; pending.delete(id); }
        }
    };
}

test('cold metadata reads overlap with a bounded load and results retain catalogue order', async t => {
    const { S } = environment(t), io = transport([1, 2, 3, 4, 5, 6]);
    const search = new S.Search(state, origin, io.fetch), loading = search.load();
    await tick();
    assert.ok(io.active > 1, 'independent metadata requests must overlap');
    assert.ok(io.active <= 4);
    io.pending.get(4).resolve(); io.pending.get(3).resolve(); io.pending.get(2).resolve(); await tick();
    assert.equal(search.scanned, 0, 'later responses cannot reorder the results');
    io.pending.get(1).resolve(); await tick();
    for (const request of io.pending.values()) request.resolve();
    await loading;
    assert.deepEqual([...search.items].map(item => item.id), ['1', '2', '3', '4', '5', '6']);
    assert.ok(io.peak <= 4); assert.equal(search.scanned, 6);
});

test('stopping concurrent metadata aborts every read and leaves candidates resumable', async t => {
    const { S, w } = environment(t), io = transport([1, 2, 3, 4]);
    const controller = new w.AbortController(), search = new S.Search(state, origin, io.fetch);
    const loading = search.load({ signal: controller.signal }).catch(error => assert.equal(error.name, 'AbortError'));
    await tick(); controller.abort(); await loading; await tick();
    assert.equal(io.active, 0); assert.equal(search.scanned, 0); assert.equal(search.pending.length, 4);
    assert.equal(search.busy, false); assert.equal(S.cachedDetails(url(1)), undefined);
    const retry = search.load(); await tick();
    while (search.busy) { for (const request of io.pending.values()) request.resolve(); await tick(); }
    await retry; assert.equal(search.items.length, 4);
});

test('a failed metadata read preserves the committed prefix and retry has no duplicates', async t => {
    const { S } = environment(t), io = transport([1, 2, 3, 4]);
    const search = new S.Search(state, origin, io.fetch), loading = search.load();
    const rejected = assert.rejects(loading, /Offline/);
    await tick(); io.pending.get(1).resolve(); await tick();
    io.pending.get(2).reject(); await rejected; await tick();
    assert.equal(io.active, 0, 'failure cancels remaining speculative reads');
    assert.equal(search.scanned, 1); assert.equal(search.pending[0].id, '2');
    const retry = search.load(); await tick();
    while (search.busy) { for (const request of io.pending.values()) request.resolve(); await tick(); }
    await retry;
    assert.deepEqual([...search.items].map(item => item.id), ['1', '2', '3', '4']);
});

test('repeated 240-title searches reuse metadata and expiration still requires fresh reads', async t => {
    const { S, w } = environment(t), ids = Array.from({ length: 240 }, (_, i) => i + 1);
    let requests = 0, now = Date.now(); w.Date.now = () => now;
    const fetch = async target => { if (!target.endsWith('.html')) return listing(ids); requests++; return detail; };
    await new S.Search(state, origin, fetch).load(); assert.equal(requests, 240);
    await new S.Search(state, origin, fetch).load(); assert.equal(requests, 240, 'same-tab cache must cover a normal result batch');
    now += 31 * 60 * 1000;
    await new S.Search(state, origin, fetch).load(); assert.equal(requests, 480);
});

test('concurrent lookup deduplicates titles and never fetches beyond the 1000-candidate budget', async t => {
    const { S, w } = environment(t), ids = [1, 1, ...Array.from({ length: 1001 }, (_, i) => i + 2)], requested = [];
    w.GM = { getValue: async () => 1000 };
    const search = new S.Search(state, origin, async target => {
        if (!target.endsWith('.html')) return listing(ids);
        requested.push(Number(target.match(/\/(\d+)-/)[1])); return detail;
    });
    await search.load();
    assert.equal(search.scanned, 1000); assert.equal(search.items.length, 1000);
    assert.equal(requested.length, 1000); assert.equal(Math.max(...requested), 1000);
    assert.equal(search.pending[0].id, '1001');
    await search.load(); assert.equal(search.scanned, 1002); assert.equal(search.items.length, 1002);
});

test('the 1000-entry metadata cache stays bounded and survives module reload without losing fresh entries', t => {
    const first = environment(t), metadata = first.S.parseDetails(detail, url(1));
    for (let id = 1; id <= 1001; id++) first.S.rememberDetails(url(id), metadata);
    const keys = () => Object.keys(first.w.sessionStorage).filter(key => key.startsWith('rc-search:detail:v2:'));
    assert.equal(keys().length, 1000); assert.equal(first.S.cachedDetails(url(1)), undefined);
    first.S.rememberDetails(url(1001), metadata);
    assert.equal(keys().length, 1000, 'refreshing an existing entry must not evict another one');
    const second = environment(t);
    for (const key of Object.keys(first.w.sessionStorage)) second.w.sessionStorage.setItem(key, first.w.sessionStorage.getItem(key));
    assert.equal(second.S.cachedDetails(url(1)), undefined);
    assert.equal(second.S.cachedDetails(url(2)).ratings.imdb, 8);
    assert.equal(second.S.cachedDetails(url(1001)).ratings.imdb, 8);
});

test('late responses from a stopped load cannot populate results or the metadata cache', async t => {
    const { S, w } = environment(t), pending = [];
    const search = new S.Search(state, origin, async target => target.endsWith('.html')
        ? new Promise(resolve => pending.push(resolve)) : listing([1, 2, 3, 4]));
    const controller = new w.AbortController(), loading = search.load({ signal: controller.signal });
    await tick(); controller.abort(); for (const resolve of pending) resolve(detail);
    await loading; await tick();
    assert.equal(search.items.length, 0); assert.equal(search.scanned, 0);
    assert.equal(search.pending.length, 4); assert.equal(S.cachedDetails(url(1)), undefined);
});

test('temporary server pressure pauses then retries serially without losing candidates', async t => {
    const { S, w } = environment(t), waits = [], calls = []; let pressured = true;
    w.setTimeout = (fn, ms) => { if (ms !== 20000) { waits.push(ms); queueMicrotask(fn); } return 1; };
    w.clearTimeout = () => {};
    w.fetch = async target => {
        if (!target.endsWith('.html')) return { ok: true, text: async () => listing([1, 2, 3, 4, 5, 6]) };
        calls.push(target);
        if (pressured) { pressured = false; return { ok: false, status: 503, headers: { get: () => '7' } }; }
        return { ok: true, text: async () => detail };
    };
    const search = new S.Search(state, origin);
    await search.load();
    assert.deepEqual(waits, [7000], 'honor Retry-After instead of retrying immediately');
    assert.equal(search.concurrency, 1); assert.equal(search.scanned, 6);
    assert.deepEqual([...search.items].map(item => item.id), ['1', '2', '3', '4', '5', '6']);
    assert.ok(calls.length > 6);
});

test('persistent server pressure has bounded retries and Stop cancels the cooldown', async t => {
    const { S, w } = environment(t), waits = []; let calls = 0;
    w.setTimeout = (fn, ms) => { if (ms !== 20000) { waits.push(ms); queueMicrotask(fn); } return 1; };
    w.clearTimeout = () => {};
    w.fetch = async () => { calls++; return { ok: false, status: 503, headers: { get: () => null } }; };
    const search = new S.Search(state, origin);
    await assert.rejects(search.load(), /временно недоступен/);
    assert.equal(calls, 3); assert.deepEqual(waits, [5000, 10000]); assert.equal(search.scanned, 0);
    const controller = new w.AbortController();
    waits.length = 0; calls = 0;
    w.setTimeout = (fn, ms) => { if (ms !== 20000) { waits.push(ms); queueMicrotask(() => controller.abort()); } return 1; };
    await assert.rejects(search.load({ signal: controller.signal }), error => error.name === 'AbortError');
    assert.equal(calls, 1); assert.equal(search.busy, false);
});
