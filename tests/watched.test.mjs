import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL('../extension/' + file, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
const url = id => `/films/fiction/${id}-example-2026.html`;
const card = id => `<div class="b-content__inline_item" data-id="${id}"><a href="${url(id)}"><img alt=""></a><div class="b-content__inline_item-link"><a href="${url(id)}">Title ${id}</a></div></div>`;
const row = (id, watched = true) => `<div id="save-${id}" class="b-videosaves__list_item ${watched ? 'watched-row' : ''}"><div class="date">01-11-2026</div><div class="title"><a href="${url(id)}">Title ${id}</a></div><div class="info">Studio</div><div class="controls"><a class="view ${watched ? 'watched' : ''}" data-id="${100 + Number(id)}" href="javascript:void(0)"></a></div></div>`;
const history = (rows = row(1) + row(2, false), pagination = '') => `<div id="videosaves-list">${rows}</div>${pagination}`;

async function harness(t, { markup = card(1) + card(2), path = '/', enabled, fetcher,
    signedIn = true, get, echoWrites = false } = {}) {
    const dom = new JSDOM(`<html><head></head><body>${signedIn ? '<a class="b-tophead__contwatch" href="/continue/">Continue</a>' : ''}${markup}</body></html>`, {
        url: 'https://rezka.fi' + path, runScripts: 'outside-only'
    });
    t.after(() => dom.window.close());
    const w = dom.window, calls = [], writes = [];
    let changed;
    w.chrome = { storage: { local: {
        get: get || (async () => ({ 'r4:dim-watched': enabled })),
        async set(value) {
            writes.push(value);
            if (echoWrites) queueMicrotask(() => changed(Object.fromEntries(
                Object.entries(value).map(([key, newValue]) => [key, { newValue }])
            ), 'local'));
        }
    }, onChanged: { addListener(fn) { changed = fn; } } } };
    w.fetch = async (target, options) => {
        calls.push({ target, options });
        const result = fetcher ? await fetcher(target, options) : history();
        return { ok: true, text: async () => result };
    };
    w.eval(read('network-policy.js') + '\n' + read('search-style.js') + '\n' + read('watched-site.js') + '\n' + read('watched.js') + '\nwindow.watchedFeature = RezkaWatched;');
    await tick(); await tick();
    return { w, doc: w.document, calls, writes,
        change: value => changed({ 'r4:dim-watched': { newValue: value } }, 'local'),
        invalidate: () => changed({ 'ui:watched-revision': { newValue: 'changed' } }, 'local') };
}

test('only explicit watched marks dim cards, duplicate appearances, sidebar links and detail headings', async t => {
    const h = await harness(t, { path: url(1), markup: card(1) + card(2) + card(1)
        + `<li class="b-seriesupdate__block_list_item"><a href="${url(1)}">Update</a></li>`
        + `<a id="mirror" href="https://rezka.ag${url(1)}?x=1">Mirror</a>`
        + `<a id="external" href="https://example.com${url(1)}">External</a>`
        + '<div class="b-post__title"><h1>Film</h1></div><div id="cdnplayer">Player</div>' });
    assert.equal(h.doc.querySelectorAll('.b-content__inline_item.rc-watched').length, 2);
    assert.equal(h.doc.querySelectorAll('.b-content__inline_item .rc-watched').length, 0, 'no compounded opacity');
    assert.ok(h.doc.querySelector('li.rc-watched'));
    assert.ok(h.doc.querySelector('#mirror.rc-watched'));
    assert.ok(h.doc.querySelector('.b-post__title.rc-watched'));
    assert.equal(h.doc.querySelector('#external.rc-watched, #cdnplayer.rc-watched'), null);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].target, 'https://rezka.fi/continue/');
    assert.equal(h.calls[0].options.credentials, 'same-origin');
    assert.equal(h.calls[0].options.redirect, 'error');
    assert.deepEqual(h.writes, [], 'viewing history is not persisted');
});

test('late catalogue content and shadow-root search results share the watched state', async t => {
    const h = await harness(t);
    const host = h.doc.createElement('section'); h.doc.body.append(host);
    const root = host.attachShadow({ mode: 'open' }); h.w.watchedFeature.registerRoot(root);
    root.innerHTML = `<article class="card"><a href="${url(1)}">Watched</a></article><article class="card"><a href="${url(2)}">Unwatched</a></article>`;
    h.doc.body.insertAdjacentHTML('beforeend', card(1));
    await settle();
    assert.equal(root.querySelectorAll('.rc-watched').length, 1);
    assert.ok(root.querySelector('article.rc-watched'));
    assert.equal(h.doc.querySelectorAll('.b-content__inline_item.rc-watched').length, 2);
    h.change(false);
    assert.equal(root.querySelector('.rc-watched'), null);
    assert.equal(h.doc.querySelector('.rc-watched'), null);
    h.change(true); await tick(); await tick();
    assert.ok(root.querySelector('.rc-watched'));
});

test('watched shows are recognized alongside films, series, cartoons and anime', async t => {
    const showURL = '/show/humor/52829-koncerty-2022.html';
    const h = await harness(t, { markup: `<div class="b-content__inline_item"><a href="${showURL}">Show</a></div>`,
        fetcher: () => history(`<div class="b-videosaves__list_item watched-row"><div class="title"><a href="${showURL}">Show</a></div></div>`) });
    assert.ok(h.doc.querySelector('.b-content__inline_item.rc-watched'));
    h.change(false);
    assert.equal(h.doc.querySelector('.rc-watched'), null);
});

test('the dimming switch leaves card actions available; signed-out pages do not request history', async t => {
    const h = await harness(t, { enabled: false });
    assert.equal(h.calls.length, 1);
    assert.equal(h.doc.querySelector('.rc-watched'), null);
    assert.equal(h.doc.querySelector('.rc-watch-toggle').getAttribute('aria-pressed'), 'true');
    const guest = await harness(t, { signedIn: false });
    assert.equal(guest.calls.length, 0);
    assert.equal(guest.doc.querySelector('.rc-watched, .rc-watch-toggle'), null);
});

test('native watched/unwatched changes update all appearances and notify other tabs without touching controls', async t => {
    const h = await harness(t, { path: '/continue/', markup: history() + card(1) + card(2) });
    assert.equal(h.calls.length, 0, 'the complete live history needs no duplicate request');
    assert.ok(h.doc.querySelector('#save-1.rc-watched'), 'retain the explicit watched state on the row');
    assert.equal(h.doc.querySelector('#save-1 .rc-watched'), null, 'no compounded dimming');
    assert.equal(h.doc.querySelector('.controls.rc-watched'), null);
    h.doc.querySelector('#save-1').classList.remove('watched-row');
    h.doc.querySelector('#save-1 .view').classList.remove('watched');
    h.doc.querySelector('#save-2').classList.add('watched-row');
    h.doc.querySelector('#save-2 .view').classList.add('watched');
    await settle();
    assert.equal(h.doc.querySelector('#save-1.rc-watched'), null);
    assert.ok(h.doc.querySelector('#save-2.rc-watched'));
    assert.ok(h.doc.querySelector('[data-id="2"].rc-watched'));
    assert.equal(h.writes.length, 1);
    assert.deepEqual(Object.keys(h.writes[0]), ['ui:watched-revision']);
});

test('history starts with watching, keeps the native header and filters only explicit account marks', async t => {
    const h = await harness(t, { path: '/continue/', markup: history(
        '<div class="b-videosaves__list_item"><div class="th title">Название</div></div>'
        + row(1) + row(2, false).replace('Title 2', 'Title 2 (проект завершен)')) + card(1) });
    const list = h.doc.querySelector('#videosaves-list');
    const tabs = [...h.doc.querySelectorAll('[role="tab"]')];
    const visible = () => [...list.querySelectorAll('[id]:not(.rc-history-hidden)')].map(el => el.id);
    const control = h.doc.querySelector('#save-1 .view');
    let nativeClicks = 0;
    control.addEventListener('click', () => nativeClicks++);
    assert.deepEqual(tabs.map(el => el.textContent), ['Смотрю', 'Завершено']);
    assert.equal(list.previousElementSibling.getAttribute('role'), 'tablist');
    assert.deepEqual(visible(), ['save-2']);
    assert.equal(list.firstElementChild.className, 'b-videosaves__list_item');
    assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
    tabs[1].click();
    assert.deepEqual(visible(), ['save-1']);
    assert.equal(h.w.getComputedStyle(h.doc.querySelector('#save-1')).opacity, '1', 'completed history stays readable without hover');
    assert.equal(h.w.getComputedStyle(h.doc.querySelector('#save-1')).filter, 'none');
    assert.equal(h.w.getComputedStyle(h.doc.querySelector('.b-content__inline_item > a')).opacity, '0.1', 'the same title outside the history list remains dimmed');
    assert.equal(list.getAttribute('aria-labelledby'), tabs[1].id);
    control.click();
    assert.equal(nativeClicks, 1, 'filtering preserves original nodes and handlers');
    tabs[0].click();
    assert.deepEqual(visible(), ['save-2']);
    assert.equal(h.calls.length, 0);
    assert.deepEqual(h.writes, [], 'switching tabs never changes account marks');
});

test('history tabs support keyboard navigation, empty states and disabling dimming', async t => {
    const h = await harness(t, { path: '/continue/page/2/', markup: history(row(1)), enabled: false });
    const tabs = [...h.doc.querySelectorAll('[role="tab"]')];
    const empty = h.doc.querySelector('.rc-history-empty');
    const key = value => h.doc.activeElement.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: value, bubbles: true }));
    assert.equal(empty.hidden, false);
    assert.equal(empty.textContent, 'Нет незавершённых просмотров.');
    assert.equal(h.doc.querySelector('.rc-watched'), null);
    tabs[0].focus(); key('ArrowRight');
    assert.equal(h.doc.activeElement, tabs[1]);
    assert.deepEqual(tabs.map(el => el.tabIndex), [-1, 0]);
    assert.equal(h.doc.querySelector('#save-1').classList.contains('rc-history-hidden'), false);
    assert.equal(empty.hidden, true);
    key('Home'); assert.equal(h.doc.activeElement, tabs[0]);
    key('End'); assert.equal(h.doc.activeElement, tabs[1]);
    key('ArrowLeft'); assert.equal(h.doc.activeElement, tabs[0]);
    h.change(true);
    assert.ok(h.doc.querySelector('#save-1.rc-watched.rc-history-hidden'));
    assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
    assert.equal(h.calls.length, 0);
});

test('native mark changes move records between tabs and keep focus outside hidden rows', async t => {
    const h = await harness(t, { path: '/continue/', markup: history(row(1, false)) });
    const record = h.doc.querySelector('#save-1'), control = record.querySelector('.view');
    const watching = h.doc.querySelector('#rc-history-watching');
    const completed = h.doc.querySelector('#rc-history-completed');
    control.focus(); record.classList.add('watched-row'); control.classList.add('watched');
    await settle();
    assert.equal(h.doc.activeElement, watching);
    assert.ok(record.classList.contains('rc-history-hidden'));
    completed.click(); control.focus();
    record.classList.remove('watched-row'); control.classList.remove('watched');
    await settle();
    assert.equal(h.doc.activeElement, completed);
    assert.equal(record.classList.contains('rc-watched'), false, 'rc-watched must not mask the native class change');
    assert.ok(record.classList.contains('rc-history-hidden'));
    assert.equal(h.doc.querySelector('.rc-history-empty').textContent, 'Пока нет завершённых просмотров.');
    h.doc.querySelector('#videosaves-list').insertAdjacentHTML('beforeend', row(2));
    await settle();
    assert.equal(h.doc.querySelector('#save-2').classList.contains('rc-history-hidden'), false);
    assert.equal(h.doc.querySelector('.rc-history-empty').hidden, true);
});

test('replacing the native history list retains the selected tab without duplicate navigation', async t => {
    const h = await harness(t, { path: '/continue/', markup: history() });
    h.doc.querySelector('#rc-history-completed').click();
    h.doc.querySelector('#videosaves-list').outerHTML = history(row(3) + row(4, false));
    await settle(); await settle();
    assert.equal(h.doc.querySelectorAll('.rc-history-tabs').length, 1);
    assert.equal(h.doc.querySelectorAll('.rc-history-empty').length, 1);
    assert.equal(h.doc.querySelector('#rc-history-completed').getAttribute('aria-selected'), 'true');
    assert.equal(h.doc.querySelector('#save-3').classList.contains('rc-history-hidden'), false);
    assert.equal(h.doc.querySelector('#save-4').classList.contains('rc-history-hidden'), true);
});

test('a late response cannot restore dimming after disabling; enabling reads fresh marks', async t => {
    let finish;
    const h = await harness(t, { fetcher: () => new Promise(resolve => { finish = resolve; }) });
    h.change(false); finish(history()); await tick(); await tick();
    assert.equal(h.doc.querySelector('.rc-watched'), null);
    assert.equal(h.calls[0].options.signal.aborted, true);
    h.change(true); finish(history(row(2))); await tick(); await tick();
    assert.ok(h.doc.querySelector('[data-id="2"].rc-watched'));
    assert.equal(h.doc.querySelector('[data-id="1"].rc-watched'), null);
});

test('a stale history tab accepts remote changes without undoing them on an unrelated DOM update', async t => {
    const h = await harness(t, { path: '/continue/', markup: history() + card(1) + card(2),
        fetcher: () => history(row(1, false) + row(2)) });
    h.invalidate(); await tick(); await tick();
    assert.equal(h.doc.querySelector('[data-id="1"].rc-watched'), null);
    assert.ok(h.doc.querySelector('[data-id="2"].rc-watched'));
    h.doc.body.insertAdjacentHTML('beforeend', card(2)); await settle();
    assert.equal(h.doc.querySelector('[data-id="1"].rc-watched'), null);
    assert.equal(h.doc.querySelectorAll('[data-id="2"].rc-watched').length, 2);
    assert.equal(h.doc.querySelector('#save-1').classList.contains('rc-history-hidden'), false);
    assert.equal(h.doc.querySelector('#save-2').classList.contains('rc-history-hidden'), true);
});

test('an invalidation during loading is not lost and a failed refresh preserves confirmed marks', async t => {
    let finish, fail = false;
    const h = await harness(t, { fetcher: () => fail ? Promise.reject(new Error('offline')) : new Promise(resolve => { finish = resolve; }) });
    h.invalidate(); finish(history(row(1))); await tick(); await tick();
    assert.equal(h.calls.length, 2);
    finish(history(row(2))); await tick(); await tick();
    assert.ok(h.doc.querySelector('[data-id="2"].rc-watched'));
    assert.equal(h.doc.querySelector('[data-id="1"].rc-watched'), null);
    fail = true; h.invalidate(); await tick(); await tick();
    assert.ok(h.doc.querySelector('[data-id="2"].rc-watched'));
});

test('history pagination stays on the current origin and combines all watched pages', async t => {
    const h = await harness(t, { fetcher: target => target.includes('page/2') ? history(row(2)) : history(row(1),
        '<div class="b-navigation"><a href="/continue/page/2/">2</a><a href="https://example.com/continue/">External</a><a href="/logout/">Not history</a></div>') });
    assert.equal(h.calls.length, 2);
    assert.equal(h.doc.querySelectorAll('.b-content__inline_item.rc-watched').length, 2);
});

test('a live preference change wins over a delayed initial storage read', async t => {
    let finish;
    const h = await harness(t, { get: () => new Promise(resolve => { finish = resolve; }) });
    h.change(false); finish({ 'r4:dim-watched': true }); await tick(); await tick();
    assert.equal(h.calls.length, 1, 'card actions still read their state with dimming disabled');
    assert.equal(h.doc.querySelector('.rc-watched'), null);
});

test('compact controls are independent buttons and stay single on dynamic and shadow cards', async t => {
    const h = await harness(t);
    const host = h.doc.createElement('div'); h.doc.body.append(host);
    const root = host.attachShadow({ mode: 'open' }); h.w.watchedFeature.registerRoot(root);
    root.innerHTML = `<article class="card"><a class="card-link" href="${url(1)}"><div class="poster"></div><h3>Title</h3></a></article>`;
    h.doc.body.insertAdjacentHTML('beforeend', card(1));
    await settle(); await settle();
    assert.equal(h.doc.querySelectorAll('.rc-watch-toggle').length, 3);
    assert.equal(root.querySelectorAll('.rc-watch-toggle').length, 1);
    assert.equal(root.querySelector('a button'), null);
    assert.equal(root.querySelector('button').getAttribute('aria-pressed'), 'true');
    assert.match(root.querySelector('button').getAttribute('aria-label'), /снять отметку/);
    h.change(false); await tick();
    assert.equal(root.querySelectorAll('.rc-watch-toggle').length, 1);
    assert.equal(root.querySelector('.rc-watched'), null);
});

test('card actions wait for confirmation, prevent duplicate clicks and update every copy', async t => {
    let value = false, finish;
    const h = await harness(t, { markup: card(2) + card(2), fetcher: async (target, options) => {
        if (options.method === 'POST') {
            assert.equal(target, 'https://rezka.fi/engine/ajax/cdn_saves_view.php');
            assert.equal(options.body, 'id=102', 'native save ID, not title ID');
            await new Promise(resolve => { finish = resolve; });
            value = !value;
            return '{"success":true}';
        }
        return history(row(2, value));
    } });
    const buttons = h.doc.querySelectorAll('.rc-watch-toggle');
    buttons[0].click(); buttons[1].click(); await tick(); await tick();
    assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1);
    assert.equal(buttons[0].getAttribute('aria-busy'), 'true');
    assert.equal(h.doc.querySelector('.rc-watched'), null, 'no false success before server confirmation');
    finish(); await settle();
    assert.equal(h.doc.querySelectorAll('.rc-watched').length, 2);
    assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
    assert.equal(buttons[0].getAttribute('aria-busy'), 'false');
    assert.ok(h.writes.some(item => Object.hasOwn(item, 'ui:watched-revision')));
    buttons[1].click(); await tick(); await tick(); finish(); await settle();
    assert.equal(h.doc.querySelector('.rc-watched'), null);
    assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
});

test('successful card actions reuse confirmed history instead of refreshing on their own notification', async t => {
    let marked = false;
    const h = await harness(t, { markup: card(2), echoWrites: true, fetcher: (target, options) => {
        if (options.method === 'POST') { marked = true; return '{"success":true}'; }
        return history(row(2, marked));
    } });
    const initial = h.calls.length;
    h.doc.querySelector('.rc-watch-toggle').click();
    await settle(); await settle();
    assert.equal(h.doc.querySelector('.rc-watch-toggle').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(h.calls.slice(initial).map(call => call.options.method || 'GET'), ['GET', 'POST', 'GET']);
    h.invalidate(); await tick(); await tick();
    assert.equal(h.calls.length - initial, 4, 'a foreign revision still refreshes the history');
});

test('a foreign revision received while saving is reconciled after the confirmed write', async t => {
    let marked = false, finish;
    const h = await harness(t, { markup: card(2), echoWrites: true, fetcher: async (target, options) => {
        if (options.method === 'POST') {
            await new Promise(resolve => { finish = resolve; });
            marked = true; return '{"success":true}';
        }
        return history(row(2, marked));
    } });
    const initial = h.calls.length;
    h.doc.querySelector('.rc-watch-toggle').click();
    await tick(); await tick();
    h.invalidate(); finish();
    await settle(); await settle();
    assert.equal(h.doc.querySelector('.rc-watch-toggle').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(h.calls.slice(initial).map(call => call.options.method || 'GET'), ['GET', 'POST', 'GET', 'GET']);
});

test('a multipart film with native season zero can be marked from its catalogue card', async t => {
    let saved = false, marked = false;
    const h = await harness(t, { markup: card(42), echoWrites: true, fetcher: (target, options) => {
        if (target.endsWith('/continue/')) return history(saved ? row(42, marked) : '');
        if (target.endsWith('.html')) return '<input id="post_id" value="42"><script>sof.tv.initCDNSeriesEvents(42, 110, 0, 1, false);</script>';
        if (target.endsWith('/ajax/send_save/')) {
            assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)), {
                post_id: '42', translator_id: '110', season: '0', episode: '1', current_time: '0', duration: '0'
            });
            saved = true;
            return '{"success":true}';
        }
        assert.ok(target.endsWith('/engine/ajax/cdn_saves_view.php'));
        assert.equal(options.body, 'id=142');
        marked = true;
        return '{"success":true}';
    } });
    const initial = h.calls.length;
    h.doc.querySelector('.rc-watch-toggle').click();
    await settle();
    assert.equal(h.doc.querySelector('#rc-watched-notice').textContent, 'Отмечено как просмотренное');
    assert.equal(h.doc.querySelector('.rc-watch-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(h.doc.querySelector('.rc-watched-error'), null);
    assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 2, 'one save creation and one watched toggle');
    assert.equal(h.calls.length - initial, 6, 'no redundant history reads after a new-title mark');
});

test('a failed write leaves confirmed marks intact and shows a retryable error', async t => {
    const h = await harness(t, { fetcher: (target, options) => {
        if (options.method === 'POST') throw new Error('offline');
        return history();
    } });
    const button = h.doc.querySelector('[data-id="2"] .rc-watch-toggle');
    button.click(); await settle();
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    assert.ok(h.doc.querySelector('[data-id="1"].rc-watched'));
    assert.match(h.doc.querySelector('#rc-watched-notice.rc-watched-error').textContent, /Не удалось сохранить отметку/);
});
