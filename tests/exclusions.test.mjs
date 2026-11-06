import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
const prefix = 'rc-excluded:v1:';
const url = id => `/films/drama/${id}-example.html`;
const card = id => `<div class="b-content__inline_item"><a href="${url(id)}"><img alt=""></a><div class="b-content__inline_item-link"><a href="${url(id)}">Title ${id}</a></div></div>`;
const record = id => ({ version: 1, id: String(id), title: 'Title ' + id });
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
const profileMarkup = readFileSync(new URL('./fixtures/profile-settings.html', import.meta.url), 'utf8');
function storage(initial = {}) {
    const data = { ...initial }, listeners = [], calls = [];
    const bus = { data, calls, fail: false, hold: undefined, read: undefined };
    function emit(changes) { for (const listener of listeners) listener(changes, 'local'); }
    bus.chrome = { storage: { onChanged: { addListener: listener => listeners.push(listener) }, local: {
        get: async key => bus.read ? bus.read(key) : key ? { [key]: data[key] } : { ...data },
        async set(values) {
            calls.push(['set', values]);
            if (bus.hold) await bus.hold;
            if (bus.fail) throw new Error('Storage unavailable');
            Object.assign(data, values);
            emit(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])));
        },
        async remove(key) {
            calls.push(['remove', key]);
            if (bus.fail) throw new Error('Storage unavailable');
            delete data[key]; emit({ [key]: {} });
        }
    } } };
    return bus;
}
function harness(t, { bus = storage(), markup = card(1) + card(2), origin = 'https://rezka.fi', path = '/', profile = false, search = false, fetcher } = {}) {
    const dom = new JSDOM(`<html><head></head><body>${markup}</body></html>`, { url: origin + path, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    t.after(() => w.close());
    w.chrome = bus.chrome;
    w.fetch = fetcher || (async () => ({ ok: true, text: async () => '<div id="videosaves-list"></div>' }));
    w.scrollTo = () => {};
    w.eval(read('network-policy.js') + '\n' + read('search-style.js') + '\n' + read('watched-site.js') + '\n' + read('exclusions.js')
        + '\n' + read('watched.js') + '\n' + read('exclusions-site.js')
        + '\n' + (profile ? read('exclusions-profile.js') : '')
        + '\n' + (search ? ['search-rules.js', 'search-core.js', 'search-store.js', 'search-editor.js', 'search-page.js'].map(read).join('\n') : '')
        + '\nwindow.store = RezkaExclusions; window.feature = RezkaExclusionsSite;');
    return { w, doc: w.document, bus, api: w.store, feature: w.feature };
}

test('a click persists exclusion, hides duplicates, propagates to mirrors and survives a new document', async t => {
    const bus = storage({ unrelated: 'keep' });
    const a = harness(t, { bus, markup: card(1) + card(1) + card(2) });
    const b = harness(t, { bus, origin: 'https://hdrezka.me' });
    await settle();
    a.doc.querySelector('.rc-exclude-toggle').click();
    await settle();
    assert.equal(a.doc.querySelectorAll('.b-content__inline_item.rc-excluded').length, 2);
    assert.equal(b.doc.querySelectorAll('.b-content__inline_item.rc-excluded').length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(bus.data[prefix + 1])), record(1));
    assert.equal(bus.data.unrelated, 'keep');
    const c = harness(t, { bus }); await settle();
    assert.ok(c.doc.querySelector('.b-content__inline_item.rc-excluded'));
    a.doc.querySelector('#rc-excluded-notice button').click(); await settle();
    for (const h of [a, b, c]) assert.equal(h.doc.querySelectorAll('.rc-excluded').length, 0);
});

test('exclusions cover rows, recommendations, standalone links and dynamic shadow results', async t => {
    const bus = storage({ [prefix + 1]: record(1) });
    const markup = card(1) + card(2) + ['b-seriesupdate__block_list_item', 'b-videosaves__list_item', 'b-newest_slider__item']
        .map(cls => `<div class="${cls}"><a href="${url(1)}">Title</a></div>`).join('')
        + `<div class="b-post__partcontent_item current"><div class="title">Current title</div></div><a id="plain" href="${url(1)}">Recommended</a>`;
    const h = harness(t, { bus, markup, path: url(1) });
    const host = h.doc.createElement('div'); h.doc.body.append(host);
    const root = host.attachShadow({ mode: 'open' }); h.feature.registerRoot(root);
    root.innerHTML = `<article class="card"><a class="card-link" href="${url(1)}"><h3>Search title</h3></a></article>`;
    await settle();
    assert.equal(h.doc.querySelectorAll('.rc-excluded').length, 6);
    assert.ok(root.querySelector('.card.rc-excluded'));
    h.doc.querySelector('.b-content__inline_item').outerHTML = card(1); await settle();
    assert.ok(h.doc.querySelector('.b-content__inline_item.rc-excluded'));
    // Native DOM reuse for another title must restore the element.
    for (const link of root.querySelectorAll('a')) link.href = url(2);
    await settle(); assert.equal(root.querySelector('.card').classList.contains('rc-excluded'), false);
    root.querySelector('.rc-exclude-toggle').remove(); await settle();
    assert.equal(root.querySelectorAll('.rc-exclude-toggle').length, 1);
});

test('concurrent additions retain both titles; failed and duplicate writes do not hide unsaved cards', async t => {
    const bus = storage(), a = harness(t, { bus }), b = harness(t, { bus });
    await settle();
    await Promise.all([a.api.add('1', 'First'), b.api.add('2', 'Second')]);
    assert.equal(a.api.list().length, 2); assert.equal(b.api.list().length, 2);
    await a.api.remove('1'); await a.api.remove('2');
    bus.fail = true;
    a.doc.querySelector('.rc-exclude-toggle').click(); await settle();
    assert.equal(a.doc.querySelectorAll('.rc-excluded').length, 0);
    assert.match(a.doc.querySelector('#rc-excluded-notice').textContent, /Не удалось сохранить/);
    bus.fail = false;
    let release; bus.hold = new Promise(resolve => { release = resolve; });
    const before = bus.calls.length, button = a.doc.querySelector('.rc-exclude-toggle');
    button.click(); button.click(); await settle();
    assert.equal(bus.calls.length - before, 1);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    release(); await settle(); assert.ok(a.api.has('1'));
});

test('changes during initial reads win, invalid records are ignored, and a failed read can retry', async t => {
    const bus = storage(); let finish;
    bus.read = () => new Promise(resolve => { finish = resolve; });
    const h = harness(t, { bus });
    await bus.chrome.storage.local.set({ [prefix + 1]: record(1) });
    finish({ [prefix + 2]: { version: 8, id: '2', title: 'Invalid' }, [prefix + 3]: record(9) });
    await settle(); assert.equal(h.api.has('1'), true); assert.equal(h.api.list().length, 1);
    const failedBus = storage(); failedBus.read = async () => { throw new Error('Unavailable'); };
    const other = harness(t, { bus: failedBus }); await settle();
    assert.match(other.doc.querySelector('#rc-excluded-notice').textContent, /прочитать исключения/);
    failedBus.read = undefined;
    await other.api.ready(); await other.api.add('2', 'Recovered');
    assert.equal(other.api.has('2'), true);
    await assert.rejects(other.api.add('__proto__', 'Bad'));
});

test('exclusions work signed out and do not fade the cross or navigate on click', async t => {
    const h = harness(t); await settle();
    assert.equal(h.doc.querySelector('.rc-watch-toggle'), null);
    const live = h.doc.querySelector('.rc-exclusion-status');
    assert.equal(live.closest('[hidden]'), null);
    assert.equal(live.getAttribute('role'), 'status');
    assert.equal(live.textContent, '');
    const button = h.doc.querySelector('.rc-exclude-toggle');
    assert.match(button.getAttribute('aria-label'), /Больше не показывать/);
    let navigation = false;
    button.parentElement.addEventListener('click', () => { navigation = true; });
    button.focus(); button.click(); await settle();
    assert.equal(navigation, false);
    assert.equal(h.doc.activeElement.textContent, 'Отменить');
    assert.equal(h.doc.querySelector('.rc-exclusion-status'), live);
    assert.match(live.textContent, /больше не появится/);
    assert.equal(h.w.getComputedStyle(button.parentElement).display, 'none');
    h.doc.querySelector('#rc-excluded-notice button:last-child').click();
    assert.equal(h.doc.querySelector('#rc-excluded-notice').hidden, true);
    assert.equal(h.doc.activeElement.closest('.b-content__inline_item').classList.contains('rc-excluded'), false);
});

test('profile restores a chosen title, keeps failures actionable, and treats names as text', async t => {
    const bus = storage({ [prefix + 1]: { ...record(1), title: '<img src=x onerror=bad()>' }, [prefix + 2]: record(2) });
    const site = harness(t, { bus }), panel = harness(t, { bus, markup: profileMarkup, profile: true, path: '/settings/#rc-exclusions=1' });
    await settle();
    assert.equal(panel.doc.querySelectorAll('#rc-exclusions-profile li').length, 2);
    assert.equal(panel.doc.querySelector('img'), null);
    const button = panel.doc.querySelector('[data-excluded-id="1"]'); button.focus();
    bus.fail = true; button.click(); await settle();
    assert.match(panel.doc.querySelector('.rc-exclusions-status').textContent, /Не удалось вернуть/);
    assert.equal(panel.api.has('1'), true);
    bus.fail = false; button.click(); await settle();
    assert.equal(panel.doc.activeElement.dataset.excludedId, '2');
    assert.equal(site.doc.querySelector('.b-content__inline_item').classList.contains('rc-excluded'), false);
    const input = panel.doc.querySelector('#rc-exclusions-query'); input.value = 'absent'; input.dispatchEvent(new panel.w.Event('input'));
    assert.match(panel.doc.querySelector('.rc-exclusions-empty').textContent, /ничего не найдено/);
});

test('player clock changes do not rescan exclusion buttons', async t => {
    const h = harness(t, { markup: card(1) + '<span id="clock"></span>' }); await settle();
    let writes = 0;
    const observer = new h.w.MutationObserver(records => { writes += records.length; });
    observer.observe(h.doc.querySelector('.rc-exclude-toggle'), { attributes: true });
    h.doc.querySelector('#clock').textContent = '01:23'; await settle();
    assert.equal(writes, 0); observer.disconnect();
});

test('activation keys on the cross and undo do not reach native player shortcuts', async t => {
    const h = harness(t); await settle();
    let playerActions = 0;
    h.doc.addEventListener('keydown', event => { if (event.code === 'Space') { playerActions++; event.preventDefault(); } });
    const activate = button => {
        button.focus();
        const key = new h.w.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
        button.dispatchEvent(key);
        assert.equal(key.defaultPrevented, false, 'retain native button activation');
        button.click();
    };
    activate(h.doc.querySelector('.rc-exclude-toggle')); await settle();
    activate(h.doc.querySelector('#rc-excluded-notice button')); await settle();
    assert.equal(playerActions, 0); assert.equal(h.api.has('1'), false);
});

test('advanced search counts visible matches and restores excluded results from the existing cache', async t => {
    const bus = storage({ [prefix + 1]: record(1), [prefix + 2]: record(2) });
    let requests = 0;
    const h = harness(t, { bus, markup: '<ul id="topnav-menu"></ul><div class="b-content"></div>', path: '/search/?q=Title#rc-search=1', search: true,
        fetcher: async () => { requests++; return { ok: true, text: async () => '<div class="b-content"><h1>Результаты поиска</h1><div class="b-content__inline_items">' + card(1) + card(2) + '</div></div>' }; } });
    await settle();
    const root = h.doc.querySelector('#rc-search-root').shadowRoot;
    assert.equal(root.querySelectorAll('.card.rc-excluded').length, 2);
    assert.equal(root.querySelector('#empty').hidden, false);
    assert.match(root.querySelector('#empty p').textContent, /Все найденные карточки исключены/);
    const before = requests;
    await h.api.remove('1'); await settle();
    assert.equal(root.querySelector('#results-heading').textContent, 'Найдено: 1');
    assert.equal(root.querySelector('#empty').hidden, true);
    assert.equal(root.querySelectorAll('.card:not(.rc-excluded)').length, 1);
    assert.equal(requests, before);
});

test('history empty state accounts for exclusions without deleting native saves', async t => {
    const markup = '<a class="b-tophead__contwatch">History</a><div id="videosaves-list"><div class="b-videosaves__list_item"><div class="title"><a href="' + url(1) + '">Title 1</a></div><a class="view" data-id="11"></a></div></div>';
    const h = harness(t, { markup, path: '/continue/' }); await settle();
    await h.api.add('1', 'Title 1'); await settle();
    assert.equal(h.doc.querySelector('.rc-history-empty').hidden, false);
    assert.ok(h.doc.querySelector('#videosaves-list .rc-excluded'));
    assert.equal(h.doc.querySelector('.view').dataset.id, '11');
    await h.api.remove('1'); await settle();
    assert.equal(h.doc.querySelector('.rc-history-empty').hidden, true);
    assert.equal(h.doc.querySelector('.rc-history-hidden'), null);
});

test('profile tab preserves native drafts, uses history navigation, and stays outside the native save form', async t => {
    const h = harness(t, { markup: profileMarkup, profile: true, path: '/user/42/personality/' }); await settle();
    const section = h.doc.querySelector('#rc-exclusions-profile'), tab = h.doc.querySelector('#rc-exclusions-tab');
    const native = h.doc.querySelector('#userinfo .b-content__inline'), input = native.querySelector('input');
    input.checked = false;
    let submits = 0;
    h.doc.querySelector('#userinfo').addEventListener('submit', event => { submits++; event.preventDefault(); });
    assert.equal(section.hidden, true);
    assert.equal(section.closest('form'), null);
    assert.equal(tab.parentElement.previousElementSibling.querySelector('a').getAttribute('href'), '/settings/personality/');
    tab.click();
    assert.equal(h.w.location.hash, '#rc-exclusions=1');
    assert.equal(section.hidden, false);
    assert.equal(h.w.getComputedStyle(native).display, 'none');
    assert.equal(h.doc.querySelectorAll('.b-tabs__main .active').length, 1);
    assert.equal(tab.getAttribute('aria-current'), 'page');
    h.doc.querySelector('#rc-exclusions-query').dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(submits, 0);
    const original = h.doc.querySelector('a[href="/settings/personality/"]'); original.click();
    assert.equal(section.hidden, true); assert.equal(input.checked, false);
    assert.equal(original.getAttribute('aria-current'), 'page');
    h.w.history.back(); await settle();
    assert.equal(section.hidden, false);
    h.w.history.forward(); await settle();
    assert.equal(section.hidden, true); assert.equal(input.checked, false);
    assert.equal(submits, 0); assert.deepEqual(h.bus.calls, []);
});

test('profile deep links open the exclusions tab, preserve existing records, and offer retry after read failure', async t => {
    const bus = storage({ [prefix + 1]: record(1) }); bus.read = async () => { throw new Error('Unavailable'); };
    const h = harness(t, { bus, markup: profileMarkup, profile: true, path: '/settings/personality/#rc-exclusions=1' });
    await settle();
    const section = h.doc.querySelector('#rc-exclusions-profile');
    assert.equal(section.hidden, false);
    const retry = [...section.querySelectorAll('button')].find(button => button.textContent === 'Повторить загрузку');
    assert.equal(retry.hidden, false);
    assert.match(section.querySelector('.rc-exclusions-status').textContent, /Не удалось прочитать/);
    bus.read = undefined; retry.focus(); retry.click(); await settle();
    assert.equal(retry.hidden, true); assert.equal(h.doc.activeElement.id, 'rc-exclusions-query');
    assert.equal(section.querySelectorAll('li').length, 1);
    assert.match(section.querySelector('.rc-exclusions-count').textContent, /1/);
    assert.deepEqual(bus.calls, []);
});

test('ordinary pages and public profile markup do not gain settings or another form', async t => {
    for (const markup of [card(1), '<div id="userinfo"><h1>Public profile</h1></div>']) {
        const h = harness(t, { markup, profile: true, path: '/user/42/' }); await settle();
        assert.equal(h.doc.querySelector('#rc-exclusions-tab'), null);
        assert.equal(h.doc.querySelector('#rc-exclusions-profile'), null);
    }
});
