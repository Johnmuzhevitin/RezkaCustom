import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const origin = 'https://rezka.fi';
const card = (id, extra = '') => `<div class="b-content__inline_item" data-id="${id}"><div class="b-content__inline_item-cover"><a href="/films/drama/${id}-test.html"><img src="/poster.jpg" alt="Фильм ${id}"><span class="info">1 сезон, 8 серия</span></a></div><div class="b-content__inline_item-link"><a href="/films/drama/${id}-test.html">Фильм ${id}</a><div>2025, США, Драмы</div></div>${extra}</div>`;
const collection = id => `<div class="b-content__collections_item" data-url="/collections/${id}-test/"><img class="cover" src="/poster.jpg"><div class="num">7</div><div class="title-layer"><a class="title" href="/collections/${id}-test/">Подборка ${id}</a></div></div>`;
const pager = next => `<div class="b-navigation"><span>1</span>${next ? `<a href="${next}">2</a>` : ''}</div>`;
const list = (cards = card(1), next = '/films/page/2/', { sibling = false, collections = false, id = '' } = {}) =>
    `<div class="b-content"><div ${id ? `id="${id}"` : ''} class="${collections ? 'b-content__collections_list' : 'b-content__inline_items'}">${cards}${sibling ? '' : pager(next)}</div>${sibling ? pager(next) : ''}</div>`;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(t, { html = list(), url = origin + '/films/', respond = () => list(card(2), null) } = {}) {
    const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { window } = dom, calls = [];
    window.fetch = async (href, options) => {
        calls.push({ href, options });
        const result = await respond(href, options);
        return typeof result === 'string' ? { ok: true, text: async () => result } : result;
    };
    window.eval(['network-policy.js', 'search-rules.js', 'search-core.js', 'catalogue-pages.js'].map(name => read('extension/' + name)).join('\n'));
    const doc = window.document;
    return { window, doc, calls, button: () => doc.querySelector('.rc-catalogue-pages button'),
        ids: () => [...doc.querySelectorAll('.b-content__inline_item')].map(item => item.getAttribute('data-id')),
        async click() { doc.querySelector('.rc-catalogue-pages button').click(); await tick(); } };
}

test('native pages append in order, retain existing nodes, announce completion and preserve the URL', async t => {
    const app = setup(t, { respond: href => href.includes('/2/') ? list(card(2), '/films/page/3/') : list(card(3), null) });
    const first = app.doc.querySelector('.b-content__inline_item');
    assert.equal(app.doc.querySelector('.b-navigation').hidden, true);
    await app.click();
    assert.deepEqual(app.ids(), ['1', '2']);
    assert.equal(app.doc.querySelector('.b-content__inline_item'), first);
    assert.equal(app.button().textContent, 'Показать ещё');
    await app.click();
    assert.deepEqual(app.ids(), ['1', '2', '3']);
    assert.equal(app.button().textContent, 'Всё загружено');
    assert.match(app.doc.querySelector('[role=status]').textContent, /Больше карточек нет/);
    await app.click();
    assert.equal(app.calls.length, 2);
    assert.equal(app.window.location.href, origin + '/films/');
});

test('catalogue routes preserve filter/query values omitted by the native pager', async t => {
    for (const route of ['/films/', '/series/', '/cartoons/', '/animation/', '/new/', '/announce/', '/year/2025/', '/country/США/', '/collections/42-test/']) {
        const app = setup(t, { url: origin + route + '?filter=popular&genre=2', html: list(card(1), route + 'page/2/'), respond: () => list(card(2), null) });
        await app.click();
        const requested = new URL(app.calls[0].href);
        assert.equal(decodeURI(requested.pathname), route + 'page/2/');
        assert.equal(requested.searchParams.get('filter'), 'popular');
        assert.equal(requested.searchParams.get('genre'), '2');
        assert.equal(app.calls[0].options.credentials, 'same-origin');
        assert.equal(app.calls[0].options.redirect, 'error');
    }
});

test('query pagination continues from the page opened directly and ignores earlier pages', async t => {
    const app = setup(t, { url: origin + '/search/?q=Тест&do=search&page=4', html: list(card(1), '?page=5', { sibling: true }), respond: () => list(card(2), null, { sibling: true }) });
    await app.click();
    assert.equal(new URL(app.calls[0].href).searchParams.get('page'), '5');
    assert.equal(new URL(app.calls[0].href).searchParams.get('q'), 'Тест');
    assert.deepEqual(app.ids(), ['1', '2']);
});

test('collection cards retain native markup and linked posters', async t => {
    const app = setup(t, { url: origin + '/collections/', html: list(collection(1), '/collections/page/2/', { collections: true }), respond: () => list(collection(2), null, { collections: true }) });
    await app.click();
    assert.equal(app.doc.querySelectorAll('.b-content__collections_item').length, 2);
    const added = app.doc.querySelectorAll('.b-content__collections_item')[1];
    assert.equal(added.querySelector('img').parentElement.href, origin + '/collections/2-test/');
    assert.equal(added.querySelector('.num').textContent, '7');
});

test('new cards are sanitized while episode strips, favorite inputs and labels survive', async t => {
    const unsafe = `<script>window.bad = true</script><style>body{display:none}</style><iframe src="/bad"></iframe><img src="x" onerror="bad()"><a href="javascript:bad()">Bad</a><div onclick="bad()" style="display:none">Text</div><input type="checkbox" id="label-favorite-2" value="2"><label for="label-favorite-2"></label>`;
    const app = setup(t, { respond: () => list(card(2, unsafe), null) });
    await app.click();
    const added = app.doc.querySelectorAll('.b-content__inline_item')[1];
    assert.equal(added.querySelector('script, style, iframe, [onerror], [onclick], [style], [href^="javascript:"]'), null);
    assert.equal(added.querySelector('.info').textContent, '1 сезон, 8 серия');
    assert.equal(added.querySelector('input').type, 'checkbox');
    assert.equal(added.querySelector('label').htmlFor, 'label-favorite-2');
    assert.equal(added.querySelector('img').src, origin + '/poster.jpg');
});

test('failures retain existing cards and retry the same next page', async t => {
    for (const failure of [{ ok: false }, '<h1>Войдите</h1>', list(card(1), '/films/page/3/')]) {
        let attempt = 0;
        const app = setup(t, { respond: () => ++attempt === 1 ? failure : list(card(2), null) });
        await app.click();
        assert.equal(app.button().textContent, 'Повторить загрузку');
        assert.deepEqual(app.ids(), ['1']);
        await app.click();
        assert.deepEqual(app.ids(), ['1', '2']);
        assert.equal(app.calls[0].href, app.calls[1].href);
        assert.equal(app.doc.querySelector('.rc-pages-error'), null);
    }
});

test('overlapping pages append each title once and still advance', async t => {
    const app = setup(t, { respond: () => list(card(1) + card(2) + card(2), '/films/page/3/') });
    await app.click();
    assert.deepEqual(app.ids(), ['1', '2']);
    assert.equal(app.button().textContent, 'Показать ещё');
});

test('double clicks use one request and keep the loading control focusable', async t => {
    let finish;
    const app = setup(t, { respond: () => new Promise(resolve => { finish = resolve; }) });
    app.button().focus(); app.button().click(); app.button().click();
    assert.equal(app.calls.length, 1);
    assert.equal(app.button().getAttribute('aria-busy'), 'true');
    assert.equal(app.doc.activeElement, app.button());
    finish(list(card(2), null)); await tick();
    assert.deepEqual(app.ids(), ['1', '2']);
    assert.equal(app.doc.activeElement.closest('.b-content__inline_item').dataset.id, '2');
});

test('appended batch event lets the existing enhancements process only new cards', async t => {
    const app = setup(t);
    let newIDs;
    app.doc.addEventListener('rezka:cards-added', event => {
        newIDs = [...event.target.querySelectorAll('[data-rc-page-added]')].map(card => card.dataset.id);
        for (const card of event.target.querySelectorAll('[data-rc-page-added]')) card.classList.add('enhanced');
    });
    await app.click();
    assert.deepEqual(newIDs, ['2']);
    assert.equal(app.doc.querySelector('[data-rc-page-added]'), null);
    assert.equal(app.doc.querySelector('.enhanced').dataset.id, '2');
});

test('multiple lists use their own identity when matching a fetched page', async t => {
    const app = setup(t, { html: list(card(10), null) + list(card(1), '/films/page/2/'), respond: () => list(card(20), null) + list(card(2), null) });
    await app.click();
    assert.deepEqual(app.ids(), ['10', '1', '2']);
});

test('native list replacement discards pending responses and attaches the new pager', async t => {
    let finish;
    const app = setup(t, { respond: () => new Promise(resolve => { finish = resolve; }) });
    app.button().click();
    app.doc.body.innerHTML = list(card(10), '/films/page/2/');
    await tick();
    assert.equal(app.calls[0].options.signal.aborted, true);
    finish(list(card(2), null)); await tick();
    assert.deepEqual(app.ids(), ['10']);
    assert.equal(app.doc.querySelectorAll('.rc-catalogue-pages').length, 1);
});

test('page changes during a request cannot append to the previous listing', async t => {
    let finish;
    const app = setup(t, { respond: () => new Promise(resolve => { finish = resolve; }) });
    app.button().click(); app.window.history.pushState({}, '', '?filter=popular');
    finish(list(card(2), null)); await tick();
    assert.deepEqual(app.ids(), ['1']);
});

test('external, unrelated and unsafe pagination targets never trigger requests', t => {
    for (const next of ['https://example.org/films/page/2/', '/series/page/2/', 'javascript:bad()', 'https://user:pass@rezka.fi/films/page/2/', '/films/page/9/']) {
        const app = setup(t, { html: list(card(1), next) });
        assert.equal(app.button(), null);
        assert.equal(app.calls.length, 0);
    }
});

test('non-card pagination is left alone, and a directly opened last page has no load button', t => {
    const app = setup(t, { html: list(card(1), null) + '<div id="comments">' + pager('/films/page/2/') + '</div>' });
    assert.equal(app.button(), null);
    assert.equal(app.doc.querySelector('.b-content .b-navigation').hidden, true);
    assert.equal(app.doc.querySelector('#comments .b-navigation').hidden, false);
});

test('catalogue module and styles are shipped in the native top-frame content script', () => {
    const manifest = JSON.parse(read('extension/manifest.json'));
    const script = manifest.content_scripts.find(script => script.js.includes('catalogue-pages.js'));
    assert.equal(script.all_frames, false);
    assert.ok(script.js.indexOf('search-core.js') < script.js.indexOf('catalogue-pages.js'));
    assert.ok(script.css.includes('catalogue-pages.css'));
});
