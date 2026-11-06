import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { fixturePage } from './helpers/fixtures.mjs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const origin = 'https://rezka.fi';
const card = (id, { title = 'Фильм ' + id, type = 'films', genre = 'fiction', year = 1999, country = 'США' } = {}) => `<div class="b-content__inline_item"><div class="b-content__inline_item-cover"><a href="/${type}/${genre}/${id}-title.html"><img src="https://images.example/${id}.jpg"></a></div><div class="b-content__inline_item-link"><a href="/${type}/${genre}/${id}-title.html">${title}</a><div>${year}, ${country}, Фантастика</div></div></div>`;
const listing = (cards, pager = '') => `<div class="b-content"><h1>Результаты поиска</h1><div class="b-content__inline_items">${cards}</div><div class="b-navigation">${pager}</div></div>`;
const details = (countries = 'США, Австралия', genres = '<a href="/films/fiction/">Фантастика</a>, <a href="/films/action/">Боевики</a>') => `<h1>Фильм</h1><table><tr><td>Страна:</td><td>${countries}</td></tr><tr><td>Жанр:</td><td>${genres}</td></tr></table>`;
function core(t, limit) {
    const dom = new JSDOM('', { url: origin, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    if (limit !== undefined) dom.window.GM = { getValue: async () => limit };
    dom.window.eval(read('extension/search-rules.js') + '\n' + read('extension/search-core.js') + '\nglobalThis.S = RezkaSearch;');
    return { S: dom.window.S, window: dom.window };
}

test('representative site cards preserve long titles, series status and metadata without rating text', t => {
    const { S } = core(t);
    const html = fixturePage({ activeCollections: true, withRating: true });
    assert.equal(html.includes('fixture:'), false, 'All shared fixture slots must be filled');
    const { items } = S.parseList(html, origin + '/collections/');
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'Тестовый сериал с длинным названием и продолжением на нескольких строках');
    assert.equal(items[0].type, 'series');
    assert.equal(items[0].episode, '1 сезон, 8 серия');
    assert.equal(items[0].info, '2025 - ..., США, Документальные');
    assert.equal(items[0].year, 2025);
    assert.equal(items[1].type, 'films');
    assert.equal(items[1].country, 'Россия');
    assert.equal(items[1].episode, '');
});

test('search state round trips Cyrillic and cannot choose arbitrary types or sorting', t => {
    const { S } = core(t);
    const state = S.normalize({ q: '  Матрица  ', country: 'Корея Южная', type: 'films', genre: 'fiction', from: '1990', to: '2025', sort: 'popular' });
    assert.deepEqual(S.readState(S.pageURL(state, origin)), state);
    assert.equal(new URL(S.pageURL(state, origin)).searchParams.get('do'), 'search');
    assert.equal(new URL(S.pageURL(state, origin)).searchParams.get('subaction'), 'search');
    assert.equal(new URL(S.pageURL(state, origin)).searchParams.has('genre'), false);
    assert.equal(new URLSearchParams(new URL(S.pageURL(state, origin)).hash.slice(1)).get('genre'), 'fiction');
    assert.equal(S.normalize({ country: 'сша' }).country, 'США');
    assert.equal(S.normalize({ type: '__proto__', genre: '../logout', sort: 'rating', from: '2020x' }).type, '');
    assert.equal(S.normalize({ from: '2020x' }).from, '');
    assert.equal(S.normalize({ sort: 'rating' }).sort, 'last');
});

test('native request planning retains filters and does not pretend name search supports catalogue sorting', t => {
    const { S } = core(t);
    const query = new URL(S.plan({ q: 'Матрица', country: 'США', sort: 'popular' }, origin).url);
    assert.equal(query.pathname, '/search/'); assert.equal(query.searchParams.get('do'), 'search');
    assert.equal(query.searchParams.get('q'), 'Матрица'); assert.equal(query.searchParams.has('filter'), false);
    const country = S.plan({ country: 'Австралия', type: 'films', genre: 'action', sort: 'popular' }, origin);
    assert.equal(new URL(country.url).searchParams.get('genre'), '1'); assert.equal(country.covered.country, true); assert.equal(country.covered.genre, false);
    const genre = S.plan({ type: 'series', genre: 'fiction' }, origin);
    assert.equal(new URL(genre.url).pathname, '/series/fiction/'); assert.equal(genre.covered.genre, true);
    assert.equal(new URL(S.plan({ type: 'films', from: '1999', to: '1999' }, origin).url).pathname, '/year/1999/');
});

test('parser ignores sliders, rejects executable URLs, and keeps query/filter state in paging', t => {
    const { S } = core(t);
    const html = `<div class="b-newest_slider">${card(99)}</div>` + listing(card(1), '<a href="/films/page/2/">2</a><a href="https://evil.example/films/page/2/">2</a>');
    const parsed = S.parseList(html, origin + '/films/?filter=popular');
    assert.equal(parsed.items.length, 1); assert.equal(parsed.items[0].id, '1');
    assert.equal(parsed.next, origin + '/films/page/2/?filter=popular');
    const searchURL = origin + '/search/?do=search&subaction=search&q=abc&page=2';
    const page = S.parseList(listing(card(2), '<a href="?page=1">1</a><a href="?page=3">3</a>'), searchURL);
    assert.equal(new URL(page.next).searchParams.get('page'), '3');
    assert.equal(new URL(page.next).searchParams.get('q'), 'abc');
    assert.equal(S.safeURL('javascript:alert(1)', origin), ''); assert.equal(S.safeURL('', origin), '');
    assert.equal(S.cardURL(origin + '/logout.html', origin), '');
    assert.throws(() => S.parseList('<h1>Вход на HDrezka</h1>', origin), /не вернул каталог/);
});

test('secondary countries and genres are matched from detail metadata without excluding co-productions', t => {
    const { S } = core(t);
    const item = S.parseList(listing(card(1)), origin).items[0];
    const state = S.normalize({ q: 'Матрица', country: 'Австралия', genre: 'action', from: '1998', to: '2001' });
    assert.equal(S.needsDetails(item, state, {}), true);
    assert.equal(S.matches(item, state, {}, S.parseDetails(details(), item.url)), true);
    assert.equal(S.matches(item, state, {}, S.parseDetails(details('США'), item.url)), false);
    assert.equal(S.matches(item, S.normalize({ from: '2000' }), {}, null), false);
    assert.throws(() => S.parseDetails('<h1>Вход</h1>', item.url), /Не удалось прочитать/);
});

test('progressive search continues past a page with no matches, deduplicates and stops only at actual end', async t => {
    const { S } = core(t); const calls = [];
    const search = new S.Search({ q: 'фильм', from: '2020' }, origin, async url => {
        calls.push(url);
        return new URL(url).searchParams.get('page') === '2' ? listing(card(1) + card(2, { year: 2023 })) : listing(card(1), '<a href="?page=2">2</a>');
    });
    await search.load(); assert.equal(search.items.length, 1); assert.equal(search.items[0].id, '2');
    assert.equal(search.done, true); assert.equal(search.pages, 2); assert.equal(search.scanned, 2); assert.equal(calls.length, 2);
});

test('finding 24 matches does not pause before the candidate budget or catalogue end', async t => {
    const { S } = core(t);
    const search = new S.Search({}, origin, async () => listing(Array.from({ length: 25 }, (_, i) => card(i + 1)).join('')));
    await search.load();
    assert.equal(search.scanned, 25, 'All candidates must be checked without an early match-count pause');
    assert.equal(search.items.length, 25); assert.equal(search.done, true);
});

test('a selective batch scans 1000 candidates across pages and resumes with buffered matches', async t => {
    const { S } = core(t, 1000); let requests = 0;
    const get = async url => {
        requests++;
        const page = Number(new URL(url).searchParams.get('page') || 1);
        const cards = Array.from({ length: 24 }, (_, index) => {
            const id = (page - 1) * 24 + index + 1;
            return card(id, { year: id > 1000 ? 2023 : 1999 });
        }).join('');
        return listing(cards, page < 42 ? `<a href="?page=${page + 1}">${page + 1}</a>` : '');
    };
    const search = new S.Search({ q: 'фильм', from: '2020' }, origin, get);
    await search.load();
    assert.equal(search.scanned, 1000); assert.equal(search.pages, 42);
    assert.equal(search.items.length, 0); assert.equal(search.pending.length, 8); assert.equal(search.done, false);
    const restored = new S.Search(search.state, origin, get);
    assert.equal(restored.restore(JSON.parse(JSON.stringify(search.snapshot()))), true);
    await restored.load();
    assert.equal(restored.scanned, 1008); assert.equal(restored.items.length, 8);
    assert.equal(restored.items[0].id, '1001'); assert.equal(restored.done, true); assert.equal(requests, 42);
});

test('productive pagination keeps checking 1000 candidates even beyond 50 pages', async t => {
    const { S } = core(t, 1000);
    const search = new S.Search({ q: 'фильм' }, origin, async url => {
        const page = Number(new URL(url).searchParams.get('page') || 1);
        const cards = Array.from({ length: 10 }, (_, index) => card((page - 1) * 10 + index + 1)).join('');
        return listing(cards, `<a href="?page=${page + 1}">${page + 1}</a>`);
    });
    await search.load();
    assert.equal(search.scanned, 1000); assert.equal(search.items.length, 1000);
    assert.equal(search.pages, 100); assert.equal(search.done, false);
    assert.equal(search.pauseReason, 'budget');
    await search.load();
    assert.equal(search.scanned, 2000); assert.equal(search.items.length, 2000);
    assert.equal(new Set(search.items.map(item => item.id)).size, 2000);
});

test('50 consecutive duplicate-only pages pause with a reason and leave continuation available', async t => {
    const { S } = core(t);
    const search = new S.Search({ q: 'фильм', from: '2020' }, origin, async url => {
        const page = Number(new URL(url).searchParams.get('page') || 1);
        return page === 52 ? listing(card(2, { year: 2023 }))
            : listing(card(1), `<a href="?page=${page + 1}">${page + 1}</a>`);
    });
    await search.load();
    assert.equal(search.pages, 51); assert.equal(search.scanned, 1); assert.equal(search.done, false);
    assert.equal(search.pauseReason, 'stalled');
    await search.load();
    assert.equal(search.pages, 52); assert.equal(search.scanned, 2); assert.equal(search.done, true);
    assert.equal(search.pauseReason, '');
    assert.equal(search.items[0].id, '2');
});

test('batch boundaries preserve unprocessed candidates and restore after navigating to a title', async t => {
    const { S } = core(t, 1000); let requests = 0;
    const get = async () => { requests++; return listing(Array.from({ length: 1006 }, (_, i) => card(i + 1)).join('')); };
    const search = new S.Search({}, origin, get); await search.load();
    assert.equal(search.items.length, 1000); assert.equal(search.pending.length, 6); assert.equal(search.done, false);
    assert.equal(search.pauseReason, 'budget');
    const restored = new S.Search({}, origin, get); assert.equal(restored.restore(JSON.parse(JSON.stringify(search.snapshot()))), true);
    assert.equal(restored.pauseReason, 'budget');
    await restored.load(); assert.equal(restored.items.length, 1006); assert.equal(restored.done, true); assert.equal(requests, 1);
    assert.equal(restored.pauseReason, '');
    const bad = search.snapshot(); bad.next = origin + '/logout/'; assert.equal(new S.Search({}, origin).restore(bad), false);
});

test('new candidates reset the consecutive empty-page guard', async t => {
    const { S } = core(t);
    const search = new S.Search({ q: 'фильм' }, origin, async url => {
        const number = Number(new URL(url).searchParams.get('page') || 1);
        return listing(number % 26 === 0 ? card(number) : '', number < 104 ? `<a href="?page=${number + 1}">${number + 1}</a>` : '');
    });
    await search.load();
    assert.equal(search.pages, 104); assert.equal(search.scanned, 4);
    assert.equal(search.done, true); assert.equal(search.pauseReason, '');
});

function bufferedSearch(S, count) {
    const search = new S.Search({}, origin, async () => { throw new Error('Unexpected catalogue request'); });
    const item = S.parseList(listing(card(1)), origin).items[0];
    search.pending = Array.from({ length: count }, (_, i) => ({ ...item, id: String(i + 1), url: `${origin}/films/fiction/${i + 1}-title.html` }));
    search.next = null;
    return search;
}

test('the default batch checks exactly 10000 candidates and restores the remainder', async t => {
    const { S } = core(t);
    const search = bufferedSearch(S, 10003);
    await search.load();
    assert.equal(search.scanned, 10000); assert.equal(search.items.length, 10000);
    assert.equal(search.pending.length, 3); assert.equal(search.pauseReason, 'budget');
    const restored = new S.Search({}, origin);
    assert.equal(restored.restore(JSON.parse(JSON.stringify(search.snapshot()))), true);
    assert.equal(restored.batchLimit, 10000);
    await restored.load();
    assert.equal(restored.scanned, 10003); assert.equal(restored.done, true);
    assert.equal(new Set(restored.items.map(item => item.id)).size, 10003);
});

test('saved limits apply on continuation without moving the current batch boundary', async t => {
    const { S, window } = core(t);
    let value = 1000, reads = 0;
    window.GM = { async getValue(name, fallback) {
        assert.equal(name, 'search-candidate-limit'); assert.equal(fallback, 10000);
        reads++; return value;
    } };
    const search = bufferedSearch(S, 6001);
    await search.load({ progress() { value = 5000; } });
    assert.equal(search.scanned, 1000); assert.equal(search.batchLimit, 1000); assert.equal(reads, 1);
    await search.load();
    assert.equal(search.scanned, 6000); assert.equal(search.batchLimit, 5000); assert.equal(reads, 2);
    assert.equal(search.pending[0].id, '6001'); assert.equal(search.pauseReason, 'budget');
    const legacy = search.snapshot(); delete legacy.batchLimit;
    const restored = new S.Search({}, origin);
    assert.equal(restored.restore(legacy), true); assert.equal(restored.batchLimit, 1000);
    await restored.load();
    assert.equal(restored.scanned, 6001); assert.equal(restored.done, true);
});

test('all panel limits and the default agree with search; invalid stored values use the default', async t => {
    const { S, window } = core(t);
    window.eval(read('extension/settings-schema.js') + '\nglobalThis.limitConfig = REZKA_SETTINGS.find(config => config.name === "search-candidate-limit");');
    const config = window.limitConfig;
    assert.equal(config.options[config.defaultIndex].value, 10000);
    for (const value of [...config.options.map(option => option.value), undefined, null, -1, 0, 1.5, '5000', 999999]) {
        window.GM = { getValue: async () => value };
        const search = bufferedSearch(S, 1);
        await search.load();
        const expected = config.options.some(option => option.value === value) ? value : 10000;
        assert.equal(search.batchLimit, expected, String(value));
        assert.equal(search.done, true);
    }
});

test('stopping while the saved limit loads makes no requests and leaves continuation available', async t => {
    const { S, window } = core(t);
    let resolve;
    window.GM = { getValue: () => new Promise(done => { resolve = done; }) };
    const search = bufferedSearch(S, 2), controller = new window.AbortController();
    const loading = search.load({ signal: controller.signal });
    assert.equal(search.busy, true);
    controller.abort(); resolve(10000); await loading;
    assert.equal(search.scanned, 0); assert.equal(search.pending.length, 2); assert.equal(search.busy, false);
    window.GM = { getValue: async () => 1000 };
    await search.load(); assert.equal(search.done, true);
});

test('failed detail reads can be retried without silently skipping a candidate', async t => {
    const { S } = core(t); let fail = true;
    const search = new S.Search({ q: 'Матрица', country: 'Австралия' }, origin, async url => {
        if (url.includes('/search/')) return listing(card(1));
        if (fail) throw new Error('offline'); return details();
    });
    await assert.rejects(search.load(), /offline/); assert.equal(search.pending.length, 1); assert.equal(search.scanned, 0);
    fail = false; await search.load(); assert.equal(search.items.length, 1); assert.equal(search.done, true);
    assert.equal(search.items[0].additional, 'Австралия');
});

test('rating search follows same-origin title redirects and continues past the redirected candidate', async t => {
    const { S, window } = core(t), requests = [], options = [];
    const server = createServer((request, response) => {
        requests.push(request.url);
        if (request.url === '/?filter=last') {
            response.end(listing([1, 2, 3, 4, 5].map(id => card(id)).join('')));
        } else if (request.url === '/films/fiction/4-title.html') {
            response.writeHead(302, { Location: '/films/fiction/4-title-latest.html' });
            response.end();
        } else {
            const id = Number(request.url.match(/\/(\d+)-/)?.[1]);
            const rating = { 1: 7.2, 2: 8.4, 4: 7.5, 5: 6.1 }[id];
            response.end(details() + (rating ? `<span class="b-post__info_rates imdb"><span>${rating}</span><i>(195)</i></span>` : ''));
        }
    });
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    window.AbortController = AbortController;
    window.fetch = async (url, init) => {
        options.push(init);
        try { return await fetch(url, init); }
        catch (error) { throw new window.TypeError(error.message); }
    };
    const search = new S.Search({ extra: [{ kind: 'rule', field: 'imdb', op: 'gte', value: 7 }] },
        `http://127.0.0.1:${server.address().port}`);
    await assert.doesNotReject(search.load(), 'A title redirect must not report a connection error and stop the search');
    assert.equal(search.scanned, 5); assert.equal(search.unknown, 1); assert.equal(search.done, true);
    assert.deepEqual(Array.from(search.items, item => item.id), ['1', '2', '4']);
    assert.ok(requests.includes('/films/fiction/4-title-latest.html'));
    assert.equal(requests.at(-1), '/films/fiction/5-title.html');
    // Native Node fetch follows HTTP redirects; Chrome enforces this origin boundary.
    assert.ok(options.every(init => init.mode === 'same-origin' && init.credentials === 'same-origin'));
});

test('cancelling a response prevents stale results and leaves paging resumable', async t => {
    const { S, window } = core(t); let resolve;
    const controller = new window.AbortController();
    const search = new S.Search({}, origin, () => new Promise(done => { resolve = done; }));
    const loading = search.load({ signal: controller.signal }); controller.abort(); resolve(listing(card(1))); await loading;
    assert.equal(search.items.length, 0); assert.equal(search.pages, 0); assert.equal(search.busy, false); assert.equal(search.done, false);
});

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function page(t, fetcher, nativeGenres = '', url = origin + '/search/?do=search&subaction=search&q=Матрица#rc-search=1') {
    const dom = new JSDOM('<html><head><title>Native search</title><meta name="viewport" content="width=640"></head><body class="b-theme__template__night"><ul id="topnav-menu"></ul><div class="b-content"><h1>Original</h1>' + nativeGenres + '</div></body></html>', {
        url, runScripts: 'outside-only', pretendToBeVisual: true
    });
    t.after(() => dom.window.close());
    const w = dom.window; const urls = [];
    // Focus/continuation fixtures explicitly select the smallest supported batch.
    w.GM = { getValue: async () => 1000 };
    w.scrollTo = () => {};
    w.fetch = async url => { urls.push(url); return { ok: true, text: async () => fetcher ? fetcher(url) : listing(card(1, { title: '&lt;script&gt;alert(1)&lt;/script&gt;' })) }; };
    w.eval(['network-policy.js', 'search-rules.js', 'search-core.js', 'search-store.js', 'search-editor.js', 'search-style.js', 'search-page.js'].map(file => read('extension/' + file)).join('\n'));
    await tick(); await tick();
    const root = w.document.querySelector('#rc-search-root')?.shadowRoot;
    return { w, root, $: selector => root.querySelector(selector), urls };
}

test('page isolates cards, preserves theme, disables unavailable sorting, and safely renders remote text', async t => {
    const { w, $, root } = await page(t);
    assert.equal(w.document.querySelector('#rc-search-entry').textContent, 'Расширенный поиск');
    assert.equal(w.document.querySelector('#rc-search-root').dataset.theme, 'dark');
    assert.equal($('#sort').disabled, true); assert.equal(root.querySelectorAll('.card').length, 1);
    assert.equal(root.querySelector('script'), null); assert.match($('.card h3').textContent, /<script>/);
    assert.equal($('#more').hidden, true); assert.match($('#status').textContent, /Поиск завершён/);
    w.document.body.classList.remove('b-theme__template__night'); await tick();
    assert.equal(w.document.querySelector('#rc-search-root').dataset.theme, 'light');
});

test('native search entry mounts once and Back/Forward restores the native page and viewport', async t => {
    const { w, urls } = await page(t, undefined, '', origin + '/search/?do=search&subaction=search');
    const viewport = w.document.querySelector('meta[name="viewport"]');
    const entry = w.document.querySelector('#rc-search-entry');
    assert.equal(w.document.querySelector('#rc-search-root'), null);
    entry.click(); await tick(); await tick();
    const host = w.document.querySelector('#rc-search-root');
    assert.ok(host); assert.equal(host.hidden, false); assert.equal(urls.length, 1);
    assert.equal(viewport.content, 'width=device-width, initial-scale=1');
    assert.equal(entry.getAttribute('aria-current'), 'page');
    const travel = async direction => {
        const navigated = new Promise(resolve => w.addEventListener('popstate', resolve, { once: true }));
        w.history[direction](); await navigated; await tick();
    };
    await travel('back');
    assert.equal(host.hidden, true); assert.equal(w.document.body.classList.contains('rc-search-page'), false);
    assert.equal(viewport.content, 'width=640'); assert.equal(w.document.title, 'Native search');
    assert.equal(entry.hasAttribute('aria-current'), false);
    await travel('forward');
    assert.equal(host.hidden, false); assert.equal(w.document.querySelectorAll('#rc-search-root').length, 1);
    assert.equal(viewport.content, 'width=device-width, initial-scale=1'); assert.equal(urls.length, 1);
    entry.click(); w.dispatchEvent(new w.HashChangeEvent('hashchange')); await tick();
    assert.equal(w.document.querySelectorAll('#rc-search-root').length, 1); assert.equal(urls.length, 1);
});

const batch = start => Array.from({ length: 24 }, (_, i) => card(start + i, { year: 2023 })).join('');
// Reach the real candidate budget while keeping the rendered focus fixture small.
const candidateBatch = () => batch(1) + Array.from({ length: 976 }, (_, i) => card(100 + i)).join('');
const selectiveURL = origin + '/search/?do=search&subaction=search&q=Матрица#rc-search=1&from=2020';
for (const moveFocus of [false, true]) test(`loading more preserves focus while busy and ${moveFocus ? 'respects a new focus destination' : 'focuses the first new result'}`, async t => {
    let finish; let requests = 0;
    const { $, root } = await page(t, () => ++requests === 1
        ? listing(candidateBatch(), '<a href="?page=2">2</a>')
        : new Promise(resolve => { finish = resolve; }), '', selectiveURL);
    assert.equal(requests, 1); assert.match($('#status').textContent, /Проверены очередные 1\s000 позиций/);
    const more = $('#more'); more.focus(); more.click(); more.click(); await tick();
    assert.equal(requests, 2); assert.equal(more.hidden, false);
    assert.equal(more.getAttribute('aria-disabled'), 'true'); assert.equal(root.activeElement, more);
    if (moveFocus) $('#query').focus();
    finish(listing(batch(25))); await tick(); await tick();
    assert.equal(root.querySelectorAll('.card').length, 48); assert.equal(more.hidden, true);
    assert.equal(root.activeElement, moveFocus ? $('#query') : $('#cards').children[24].querySelector('a'));
});

for (const moveFocus of [false, true]) test(`top loading controls share busy state and ${moveFocus ? 'respect moved focus' : 'keep completion focus above results'}`, async t => {
    let finish, requests = 0;
    const { $, root } = await page(t, () => ++requests === 1
        ? listing(candidateBatch(), '<a href="?page=2">2</a>')
        : new Promise(resolve => { finish = resolve; }), '', selectiveURL);
    const more = $('#more-top'); more.focus(); more.click(); $('#more').click(); more.click(); await tick();
    assert.equal(requests, 2); assert.equal(root.activeElement, more);
    for (const suffix of ['', '-top']) {
        assert.equal($('#more' + suffix).getAttribute('aria-disabled'), 'true');
        assert.equal($('#stop' + suffix).hidden, false);
    }
    if (moveFocus) $('#query').focus();
    finish(listing(batch(25))); await tick(); await tick();
    assert.equal(root.querySelectorAll('.card').length, 48);
    assert.equal($('#more-top').hidden, true); assert.equal($('#stop-top').hidden, true);
    assert.equal(root.activeElement, moveFocus ? $('#query') : $('#status'));
});

test('top retry and stop preserve local keyboard focus and both controls reflect the outcome', async t => {
    let requests = 0, finish;
    const { $, root } = await page(t, () => {
        requests++;
        if (requests === 1) return listing(candidateBatch(), '<a href="?page=2">2</a>');
        if (requests === 2) throw new Error('Temporary outage');
        return new Promise(resolve => { finish = resolve; });
    }, '', selectiveURL);
    const more = $('#more-top'); more.focus(); more.click(); await tick(); await tick();
    assert.equal($('#error').hidden, false); assert.equal(root.activeElement, more);
    for (const suffix of ['', '-top']) assert.equal($('#more' + suffix).textContent, 'Повторить загрузку');
    more.click(); await tick(); $('#stop-top').focus(); $('#stop-top').click();
    finish(listing(batch(25))); await tick(); await tick();
    assert.equal(root.querySelectorAll('.card').length, 24); assert.equal(root.activeElement, more);
    for (const suffix of ['', '-top']) {
        assert.equal($('#more' + suffix).textContent, 'Продолжить поиск');
        assert.equal($('#more' + suffix).getAttribute('aria-disabled'), 'false');
        assert.equal($('#stop' + suffix).hidden, true);
    }
});

test('loading errors retain retry focus and cancelling returns focus to continue', async t => {
    let requests = 0, finish;
    const { $, root } = await page(t, () => {
        requests++;
        if (requests === 1) return listing(candidateBatch(), '<a href="?page=2">2</a>');
        if (requests === 2) throw new Error('Temporary outage');
        return new Promise(resolve => { finish = resolve; });
    }, '', selectiveURL);
    const more = $('#more'); more.focus(); more.click(); await tick(); await tick();
    assert.equal($('#error').hidden, false); assert.equal(root.activeElement, more);
    assert.equal(more.textContent, 'Повторить загрузку'); assert.equal(more.getAttribute('aria-disabled'), 'false');
    more.click(); await tick(); $('#stop').focus(); $('#stop').click();
    finish(listing(batch(25))); await tick(); await tick();
    assert.equal(root.querySelectorAll('.card').length, 24); assert.equal(root.activeElement, more);
    assert.equal(more.hidden, false); assert.equal(more.textContent, 'Продолжить поиск');
    assert.equal($('#stop').hidden, true);
    more.click(); await tick(); finish(listing(batch(25))); await tick(); await tick();
    assert.equal(root.querySelectorAll('.card').length, 48);
    assert.equal(root.activeElement, $('#cards').children[24].querySelector('a'));
});

test('the last buffered batch moves focus before hiding its load control', async t => {
    const { $, root, urls } = await page(t, () => listing(candidateBatch() + batch(25)), '', selectiveURL);
    assert.equal(root.querySelectorAll('.card').length, 24);
    $('#more').focus(); $('#more').click(); await tick();
    assert.equal(urls.length, 1); assert.equal(root.querySelectorAll('.card').length, 48);
    assert.equal($('#more').hidden, true);
    assert.equal(root.activeElement, $('#cards').children[24].querySelector('a'));
});

test('the page renders more than 24 matches automatically and explains a stalled catalogue', async t => {
    const { $, root } = await page(t, () => listing(batch(1) + batch(25)));
    assert.equal(root.querySelectorAll('.card').length, 48);
    assert.equal($('#more').hidden, true); assert.match($('#status').textContent, /Поиск завершён/);
    assert.doesNotMatch($('#status').textContent, /Это ещё не вся выдача/);
    const stalled = await page(t, url => {
        const number = Number(new URL(url).searchParams.get('page') || 1);
        return listing(card(1), `<a href="?page=${number + 1}">${number + 1}</a>`);
    });
    assert.match(stalled.$('#status').textContent, /50 страниц подряд без новых позиций/);
    assert.equal(stalled.$('#more').hidden, false);
});

test('form applies filters, reset retains the title, and popstate restores earlier results', async t => {
    const { w, $, root } = await page(t, url => url.includes('.html') ? details() : listing(card(1)));
    $('#country').value = 'Австралия'; $('#genre').value = 'action';
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); await tick();
    const filtered = w.location.href;
    assert.equal(new URLSearchParams(new URL(filtered).hash.slice(1)).get('country'), 'Австралия'); assert.equal(root.querySelectorAll('.card').length, 1);
    $('#reset').click(); await tick(); await tick();
    assert.equal(new URL(w.location.href).searchParams.get('q'), 'Матрица'); assert.equal($('#sort').disabled, true);
    assert.equal($('#query').value, 'Матрица'); assert.equal($('#country').value, ''); assert.equal($('#genre').value, '');
    w.history.replaceState(null, '', filtered); w.dispatchEvent(new w.PopStateEvent('popstate')); await tick();
    assert.equal($('#country').value, 'Австралия'); assert.equal($('#genre').value, 'action'); assert.equal(root.querySelectorAll('.card').length, 1);
    assert.equal($('#genre-display').value, 'Боевики'); assert.equal($('#type-display').value, 'Все типы');
});

test('form rejects inverted years and pending old searches cannot replace a newer result set', async t => {
    let oldResolve; let calls = 0;
    const { w, $, root } = await page(t, async () => { if (++calls === 1) return new Promise(resolve => { oldResolve = resolve; }); return listing(card(2)); });
    $('#from').value = '2025'; $('#to').value = '2000';
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    assert.match($('#to').validationMessage, /не меньше/); assert.equal(calls, 1);
    $('#reset').click(); await tick(); await tick();
    oldResolve(listing(card(1))); await tick(); await tick();
    assert.equal(root.querySelectorAll('.card').length, 1); assert.equal($('.card h3').textContent, 'Фильм 2');
});

test('country suggestions filter text and keyboard selection does not submit the search', async t => {
    const { w, $, root, urls } = await page(t);
    const input = $('#country');
    const key = value => {
        const event = new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
        input.dispatchEvent(event); return event;
    };
    input.focus(); input.value = 'авст'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal(input.getAttribute('aria-expanded'), 'true');
    assert.deepEqual([...root.querySelectorAll('[role="option"]')].map(item => item.textContent), ['Австралия', 'Австрия']);
    key('ArrowDown'); key('ArrowDown');
    assert.equal(root.getElementById(input.getAttribute('aria-activedescendant')).textContent, 'Австрия');
    assert.equal(input.value, 'авст');
    const calls = urls.length;
    assert.equal(key('Enter').defaultPrevented, true);
    assert.equal(input.value, 'Австрия'); assert.equal($('#country-popup').hidden, true);
    assert.equal(root.activeElement, input); assert.equal(urls.length, calls);
    assert.equal($('#draft-note').hidden, false);
    $('#country-toggle').click(); key('ArrowDown'); key('Escape');
    assert.equal(input.value, 'Австрия'); assert.equal(input.hasAttribute('aria-activedescendant'), false);
    $('#country-toggle').click();
    root.querySelector('[role="option"]').click();
    assert.equal(input.value, ''); assert.equal($('#country-popup').hidden, true);
});

test('country suggestions preserve unlisted text and dismiss on outside focus, Tab and reset', async t => {
    const { w, $, root } = await page(t);
    const input = $('#country');
    input.focus(); input.value = 'Новая страна'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal(root.querySelectorAll('[role="option"]').length, 0);
    assert.equal($('#country-empty').hidden, false);
    input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.equal(input.hasAttribute('aria-activedescendant'), false);
    $('#from').focus();
    assert.equal($('#country-popup').hidden, true); assert.equal(input.value, 'Новая страна');
    $('#country-toggle').click();
    input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    assert.equal($('#country-popup').hidden, true); assert.equal(input.value, 'Новая страна');
    $('#country-toggle').click(); $('#reset').click();
    assert.equal(input.value, ''); assert.equal($('#country-popup').hidden, true);
});

test('shared type and genre pickers keep valid form values and only one popup open', async t => {
    const native = '<select class="select-category"><option value="/films/best/action/">Боевики</option><option value="/series/best/drama/">Драмы</option></select>';
    const { w, $, urls } = await page(t, undefined, native);
    $('#country-toggle').click(); $('#type-toggle').click();
    assert.equal($('#country-popup').hidden, true); assert.equal($('#type').hidden, true);
    const typeOptions = [...$('#type-options').children];
    typeOptions.find(item => item.textContent === 'Фильмы').click();
    assert.equal($('#type').value, 'films'); assert.equal($('#type-display').value, 'Фильмы');
    assert.equal($('#type-popup').hidden, true); assert.equal(urls.length, 1);
    const genre = $('#genre-display');
    genre.focus(); genre.value = 'боев'; genre.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.deepEqual([...$('#genre-options').children].map(item => item.textContent), ['Боевики']);
    genre.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    genre.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal($('#genre').value, 'action'); assert.equal(genre.value, 'Боевики'); assert.equal(urls.length, 1);
    genre.value = 'неттакогожанра'; genre.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal($('#genre-empty').hidden, false); assert.equal($('#genre').value, 'action');
    genre.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(genre.value, 'Боевики');
    $('#type-toggle').click();
    [...$('#type-options').children].find(item => item.textContent === 'Сериалы').click();
    assert.equal($('#genre').value, ''); assert.equal(genre.value, 'Любой жанр');
    $('#genre-toggle').click();
    assert.deepEqual([...$('#genre-options').children].map(item => item.textContent), ['Любой жанр', 'Драмы']);
    $('#reset').click();
    assert.equal($('#genre-popup').hidden, true); assert.equal($('#type-display').value, 'Все типы');
});

test('sorting picker obeys title-search disabling and applies a choice once the form is current', async t => {
    const { w, $, urls } = await page(t);
    const sort = $('#sort-display');
    assert.equal(sort.disabled, true); assert.equal($('#sort-toggle').disabled, true);
    assert.equal(sort.value, 'Порядок HDrezka');
    $('#sort-toggle').click(); assert.equal($('#sort-popup').hidden, true);
    $('#query').value = ''; $('#query').dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal(sort.disabled, false); assert.equal($('#sort-toggle').disabled, false);
    assert.equal(sort.value, 'Последние поступления');
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); await tick();
    const key = value => sort.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    sort.focus(); key(' '); key('End'); key('Escape');
    assert.equal($('#sort').value, 'last'); assert.equal(urls.length, 2);
    key('п'); key('о'); key('п');
    assert.equal($('#sort-popup').hidden, false);
    key('Enter'); await tick(); await tick();
    assert.equal($('#sort').value, 'popular'); assert.equal(sort.value, 'Популярные');
    assert.equal($('#sort-popup').hidden, true); assert.equal(urls.length, 3);
    assert.equal(new URLSearchParams(w.location.hash.slice(1)).get('sort'), 'popular');
    assert.equal(new URL(urls.at(-1)).searchParams.get('filter'), 'popular');
});
