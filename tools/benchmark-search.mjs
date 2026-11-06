// Deterministic network-latency model; no browser, external requests or user data.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const args = process.argv.slice(2), sourceIndex = args.indexOf('--source');
const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
const source = sourceIndex >= 0 ? readFileSync(args[sourceIndex + 1], 'utf8') : read('search-core.js');
const dom = new JSDOM('', { url: 'https://rezka.fi', runScripts: 'outside-only' });
const detail = '<table><tr><td>Страна:</td><td>США</td></tr><tr><td>Жанр:</td><td><a href="/films/fiction/">Фантастика</a></td></tr></table><span class="imdb"><span>8</span></span>';
let modeledTime = 0;
dom.window.performance.now = () => modeledTime;
try {
    dom.window.eval(read('search-rules.js') + '\n' + source + '\nwindow.SearchAPI = RezkaSearch;');
    const S = dom.window.SearchAPI;
    async function run(count, rating = true, offset = 0) {
        const pending = []; let requests = 0, peak = 0, waves = 0, done = false, error;
        const cards = Array.from({ length: count }, (_, i) => `<div class="b-content__inline_item"><div class="b-content__inline_item-link"><a href="/films/fiction/${offset + i + 1}-test.html">Title ${i + 1}</a><div>2020, США</div></div></div>`).join('');
        const search = new S.Search(rating ? { extra: [{ kind: 'rule', field: 'imdb', op: 'gte', value: 7 }] } : {}, 'https://rezka.fi', async url => {
            if (!url.endsWith('.html')) return '<div class="b-content__inline_items">' + cards + '</div>';
            requests++;
            return new Promise(resolve => { pending.push(resolve); peak = Math.max(peak, pending.length); });
        });
        const loading = search.load().then(() => { done = true; }, value => { error = value; done = true; });
        while (!done) {
            await new Promise(resolve => setImmediate(resolve));
            if (pending.length) { waves++; modeledTime += 100; for (const resolve of pending.splice(0)) resolve(detail); }
        }
        await loading; if (error) throw error;
        assert.equal(search.scanned, count); assert.equal(search.items.length, count);
        return { candidates: count, detailRequests: requests, peakRequests: peak, networkWaves: waves, modeledNetworkMsAt100ms: waves * 100 };
    }
    const results = {
        basic: await run(24, false), cold: await run(24), warm: await run(24),
        largeCold: await run(240, true, 1000), largeRepeat: await run(240, true, 1000),
        adaptiveCold: await run(1000, true, 2000), adaptiveRepeat: await run(1000, true, 2000)
    };
    console.log(JSON.stringify(results, null, 2));
    if (args.includes('--check')) {
        assert.ok(results.cold.networkWaves <= 8, '24 independent metadata reads must not wait for 24 serial round trips');
        assert.equal(results.largeRepeat.detailRequests, 0, 'Repeating a 240-candidate query within the TTL must reuse its metadata');
        assert.equal(results.adaptiveCold.peakRequests, 32, 'A sustained cold workload with scalable throughput must reach the upper bound');
        assert.ok(results.adaptiveCold.networkWaves <= 80, 'Adaptive concurrency must reduce the 250 fixed-four waves for 1000 titles');
        assert.equal(results.adaptiveRepeat.detailRequests, 0);
    }
} finally { dom.window.close(); }
