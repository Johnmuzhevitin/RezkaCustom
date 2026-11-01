import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { fixturePage } from './helpers/fixtures.mjs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const origin = 'https://rezka.fi';
const card = (id, { title = 'Фильм ' + id, type = 'films', genre = 'fiction', year = 1999, country = 'США' } = {}) => `<div class="b-content__inline_item"><div class="b-content__inline_item-cover"><a href="/${type}/${genre}/${id}-title.html"><img src="https://images.example/${id}.jpg"></a></div><div class="b-content__inline_item-link"><a href="/${type}/${genre}/${id}-title.html">${title}</a><div>${year}, ${country}, Фантастика</div></div></div>`;
const listing = (cards, pager = '') => `<div class="b-content"><h1>Результаты поиска</h1><div class="b-content__inline_items">${cards}</div><div class="b-navigation">${pager}</div></div>`;
const details = (countries = 'США, Австралия', genres = '<a href="/films/fiction/">Фантастика</a>, <a href="/films/action/">Боевики</a>') => `<h1>Фильм</h1><table><tr><td>Страна:</td><td>${countries}</td></tr><tr><td>Жанр:</td><td>${genres}</td></tr></table>`;
function core(t) {
    const dom = new JSDOM('', { url: origin, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    dom.window.eval(read('extension/search-core.js') + '\nglobalThis.S = RezkaSearch;');
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

test('batch boundaries preserve unprocessed candidates and restore after navigating to a title', async t => {
    const { S } = core(t); let requests = 0;
    const get = async () => { requests++; return listing(Array.from({ length: 30 }, (_, i) => card(i + 1)).join('')); };
    const search = new S.Search({}, origin, get); await search.load();
    assert.equal(search.items.length, 24); assert.equal(search.pending.length, 6); assert.equal(search.done, false);
    const restored = new S.Search({}, origin, get); assert.equal(restored.restore(JSON.parse(JSON.stringify(search.snapshot()))), true);
    await restored.load(); assert.equal(restored.items.length, 30); assert.equal(restored.done, true); assert.equal(requests, 1);
    const bad = search.snapshot(); bad.next = origin + '/logout/'; assert.equal(new S.Search({}, origin).restore(bad), false);
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
    w.scrollTo = () => {};
    w.fetch = async url => { urls.push(url); return { ok: true, text: async () => fetcher ? fetcher(url) : listing(card(1, { title: '&lt;script&gt;alert(1)&lt;/script&gt;' })) }; };
    w.eval(read('extension/network-policy.js') + '\n' + read('extension/search-core.js') + '\n' + read('extension/search-style.js') + '\n' + read('extension/search-page.js'));
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

const batch = start => Array.from({ length: 24 }, (_, i) => card(start + i)).join('');
for (const moveFocus of [false, true]) test(`loading more preserves focus while busy and ${moveFocus ? 'respects a new focus destination' : 'focuses the first new result'}`, async t => {
    let finish; let requests = 0;
    const { $, root } = await page(t, () => ++requests === 1
        ? listing(batch(1), '<a href="?page=2">2</a>')
        : new Promise(resolve => { finish = resolve; }));
    const more = $('#more'); more.focus(); more.click(); more.click(); await tick();
    assert.equal(requests, 2); assert.equal(more.hidden, false);
    assert.equal(more.getAttribute('aria-disabled'), 'true'); assert.equal(root.activeElement, more);
    if (moveFocus) $('#query').focus();
    finish(listing(batch(25))); await tick(); await tick();
    assert.equal(root.querySelectorAll('.card').length, 48); assert.equal(more.hidden, true);
    assert.equal(root.activeElement, moveFocus ? $('#query') : $('#cards').children[24].querySelector('a'));
});

test('loading errors retain retry focus and cancelling returns focus to continue', async t => {
    let requests = 0, finish;
    const { $, root } = await page(t, () => {
        requests++;
        if (requests === 1) return listing(batch(1), '<a href="?page=2">2</a>');
        if (requests === 2) throw new Error('Temporary outage');
        return new Promise(resolve => { finish = resolve; });
    });
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
    const { $, root, urls } = await page(t, () => listing(batch(1) + batch(25)));
    assert.equal(root.querySelectorAll('.card').length, 24);
    $('#more').focus(); $('#more').click(); await tick();
    assert.equal(urls.length, 1); assert.equal(root.querySelectorAll('.card').length, 48);
    assert.equal($('#more').hidden, true);
    assert.equal(root.activeElement, $('#cards').children[24].querySelector('a'));
});

test('form applies combined filters to the address, reset clears them, and popstate restores earlier results', async t => {
    const { w, $, root } = await page(t, url => url.includes('.html') ? details() : listing(card(1)));
    $('#country').value = 'Австралия'; $('#genre').value = 'action';
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); await tick();
    const filtered = w.location.href;
    assert.equal(new URLSearchParams(new URL(filtered).hash.slice(1)).get('country'), 'Австралия'); assert.equal(root.querySelectorAll('.card').length, 1);
    $('#reset').click(); await tick(); await tick();
    assert.equal(new URL(w.location.href).searchParams.has('q'), false); assert.equal($('#sort').disabled, false);
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

test('sorting picker obeys title-search disabling and applies an explicit choice exactly once', async t => {
    const { w, $, urls } = await page(t);
    const sort = $('#sort-display');
    assert.equal(sort.disabled, true); assert.equal($('#sort-toggle').disabled, true);
    $('#sort-toggle').click(); assert.equal($('#sort-popup').hidden, true);
    $('#query').value = ''; $('#query').dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal(sort.disabled, false); assert.equal($('#sort-toggle').disabled, false);
    const key = value => sort.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    sort.focus(); key(' '); key('End'); key('Escape');
    assert.equal($('#sort').value, 'last'); assert.equal(urls.length, 1);
    key('п'); key('о'); key('п');
    assert.equal($('#sort-popup').hidden, false);
    key('Enter'); await tick(); await tick();
    assert.equal($('#sort').value, 'popular'); assert.equal(sort.value, 'Популярные');
    assert.equal($('#sort-popup').hidden, true); assert.equal(urls.length, 2);
    assert.equal(new URLSearchParams(w.location.hash.slice(1)).get('sort'), 'popular');
    assert.equal(new URL(urls.at(-1)).searchParams.get('filter'), 'popular');
});
