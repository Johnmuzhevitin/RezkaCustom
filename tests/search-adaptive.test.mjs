import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const origin = 'https://rezka.fi';
const tick = () => new Promise(resolve => setImmediate(resolve));
const state = { extra: [{ kind: 'rule', field: 'imdb', op: 'gte', value: 7 }] };
const detail = '<table><tr><td>Страна:</td><td>США</td></tr><tr><td>Жанр:</td><td>Фантастика</td></tr></table><span class="imdb"><span>8</span></span>';
const url = id => `${origin}/films/fiction/${id}-test.html`;
const listing = ids => '<div class="b-content__inline_items">' + ids.map(id => `<div class="b-content__inline_item"><div class="b-content__inline_item-link"><a href="${url(id)}">Title ${id}</a><div>2020, США</div></div></div>`).join('') + '</div>';

function simulation(t, { count = 1000, latency = () => 500, pressure = () => false, cached = () => false, pageSize = count, hidden = false } = {}) {
    const dom = new JSDOM('', { url: origin, runScripts: 'outside-only' }), w = dom.window;
    t.after(() => w.close());
    let now = 0, timerID = 0, active = 0, peak = 0;
    const pending = [], timers = new Map(), waves = [], calls = [], waits = [];
    w.performance.now = () => now;
    if (hidden) Object.defineProperty(w.document, 'visibilityState', { value: 'hidden' });
    w.setTimeout = (fn, delay) => { const id = ++timerID; waits.push(delay); timers.set(id, { fn, due: now + delay }); return id; };
    w.clearTimeout = id => timers.delete(id);
    const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
    w.eval(read('search-rules.js') + '\n' + read('search-core.js') + '\nwindow.api = RezkaSearch;');
    const S = w.api;
    for (let id = 1; id <= count; id++) if (cached(id)) S.rememberDetails(url(id), S.parseDetails(detail, url(id)));
    const search = new S.Search(state, origin, async (target, { signal }) => {
        if (!target.endsWith('.html')) {
            const page = Number(new URL(target).searchParams.get('page') || 1), start = (page - 1) * pageSize + 1;
            return listing(Array.from({ length: Math.min(pageSize, count - start + 1) }, (_, i) => start + i))
                + (start + pageSize <= count ? `<div class="b-navigation"><a href="?page=${page + 1}">Next</a></div>` : '');
        }
        const id = Number(target.match(/\/(\d+)-/)[1]); calls.push(id);
        active++; peak = Math.max(peak, active);
        try {
            return await new Promise((resolve, reject) => {
                const entry = { id, cancelled: false };
                const abort = () => { entry.cancelled = true; reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })); };
                entry.finish = error => { signal.removeEventListener('abort', abort); error ? reject(error) : resolve(detail); };
                pending.push(entry); signal.addEventListener('abort', abort, { once: true });
            });
        } finally { active--; }
    });
    return { S, w, search, waves, calls, waits, get peak() { return peak; }, get now() { return now; },
        async run({ signal, onWave = () => {} } = {}) {
            let finished = false, failure;
            const loading = search.load({ signal }).catch(error => { failure = error; }).finally(() => { finished = true; });
            for (let steps = 0; !finished && steps < 2500; steps++) {
                await tick();
                const requests = pending.splice(0).filter(entry => !entry.cancelled);
                if (requests.length) {
                    const wave = { width: requests.length, limit: search.concurrency, at: now };
                    waves.push(wave); onWave(wave);
                    now += latency(wave, waves);
                    const error = pressure(wave, waves) ? Object.assign(new Error('Busy'), { status: 503, retryAfter: 7000 }) : null;
                    wave.pressure = !!error;
                    // Resolve out of order; committed results must still retain catalogue order.
                    for (const entry of requests.reverse()) if (!entry.cancelled) entry.finish(entry === requests.at(-1) ? error : null);
                } else if (timers.size) {
                    const [id, timer] = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
                    timers.delete(id); now = timer.due; timer.fn();
                }
            }
            assert.equal(finished, true, 'search must finish within a bounded simulation');
            await loading; if (failure) throw failure;
        }
    };
}

test('adaptive search reaches 32 with useful throughput, preserves order and never reads past its budget', async t => {
    const io = simulation(t, { count: 1002 });
    io.w.GM = { getValue: async () => 1000 };
    await io.run();
    assert.equal(io.peak, 32);
    assert.deepEqual([...new Set(io.waves.map(w => w.width))].filter(width => [4, 8, 16, 32].includes(width)), [4, 8, 16, 32]);
    assert.equal(io.search.scanned, 1000); assert.equal(io.calls.length, 1000); assert.equal(Math.max(...io.calls), 1000);
    assert.deepEqual(Array.from(io.search.items, item => Number(item.id)), Array.from({ length: 1000 }, (_, i) => i + 1));
    assert.equal(io.search.pending[0].id, '1001'); assert.equal(io.search.pauseReason, 'budget');
    await io.run(); assert.equal(io.search.scanned, 1002);
});

test('higher concurrency without a throughput gain falls back instead of escalating to 32', async t => {
    const io = simulation(t, { count: 400, latency: wave => wave.width * 100 }); await io.run();
    const widths = io.waves.map(w => w.width), trial = widths.indexOf(8);
    assert.ok(trial > 0); assert.equal(io.peak, 8);
    assert.ok(widths.slice(trial + 1).includes(4), 'saturated throughput must restore the better lower limit');
    assert.equal(io.search.items.length, 400);
});

test('a measured slowdown reduces an already accepted concurrency level', async t => {
    const io = simulation(t, { count: 600, latency: (wave, waves) => waves.filter(w => w.width === 32).length > 4 ? 4000 : 500 });
    await io.run();
    const widths = io.waves.map(w => w.width), last32 = widths.lastIndexOf(32);
    assert.ok(last32 > 0); assert.ok(widths.slice(last32 + 1).some(width => width <= 16));
    assert.equal(io.search.items.length, 600);
});

test('server pressure respects cooldown then cautiously regains parallelism with no lost or duplicate results', async t => {
    let failed = false;
    const io = simulation(t, { count: 500, pressure: wave => !failed && wave.width === 16 && (failed = true) });
    await io.run();
    const index = io.waves.findIndex(w => w.pressure), recovery = io.waves.slice(index + 1);
    assert.ok(index > 0); assert.deepEqual(io.waits, [7000]);
    assert.equal(recovery[0].width, 1);
    assert.ok(recovery.find(w => w.width > 1).at - recovery[0].at >= 15000, 'settle after cooldown before probing again');
    assert.ok(recovery.some(w => w.width >= 8));
    assert.deepEqual(Array.from(io.search.items, item => Number(item.id)), Array.from({ length: 500 }, (_, i) => i + 1));
});

test('cached candidates do not manufacture a throughput gain and short catalogue pages do not force a slowdown', async t => {
    const warm = simulation(t, { count: 120, cached: id => id % 4 !== 0 }); await warm.run();
    assert.equal(warm.calls.length, 30); assert.equal(warm.peak, 1);
    assert.equal(warm.search.concurrency, 4, 'sparse network reads do not justify a wider probe');
    const paged = simulation(t, { count: 800, pageSize: 45 }); await paged.run();
    assert.equal(paged.peak, 32); assert.equal(paged.search.concurrency, 32);
    assert.equal(paged.search.scanned, 800);
});

test('Stop aborts a 32-request probe and continuation preserves every candidate', async t => {
    const io = simulation(t, { count: 300 }), controller = new io.w.AbortController();
    await io.run({ signal: controller.signal, onWave: wave => { if (wave.width === 32) controller.abort(); } });
    assert.equal(io.peak, 32); assert.ok(io.search.scanned < 300); assert.equal(io.search.busy, false);
    const committed = io.search.scanned;
    assert.equal(io.S.cachedDetails(url(committed + 1)), undefined);
    const nextWave = io.waves.length;
    await io.run();
    assert.equal(io.waves[nextWave].width, 16, 'continuation must discard an unverified wider probe');
    assert.deepEqual(Array.from(io.search.items, item => Number(item.id)), Array.from({ length: 300 }, (_, i) => i + 1));
});

test('recurrent pressure after successful ramp-up still has bounded retries and leaves manual continuation', async t => {
    let pressure = true;
    const io = simulation(t, { count: 400, pressure: wave => pressure && wave.width >= 16 });
    await assert.rejects(io.run(), /Busy/);
    assert.deepEqual(io.waits, [7000, 10000]); assert.equal(io.search.concurrency, 1);
    assert.equal(io.search.busy, false); assert.ok(io.search.pending.length > 0);
    pressure = false; await io.run();
    assert.deepEqual(Array.from(io.search.items, item => Number(item.id)), Array.from({ length: 400 }, (_, i) => i + 1));
});

test('background-tab timing does not drive concurrency calibration', async t => {
    const io = simulation(t, { count: 100, hidden: true }); await io.run();
    assert.equal(io.peak, 4); assert.equal(io.search.concurrency, 4);
});
