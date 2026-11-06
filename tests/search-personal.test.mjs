import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
const origin = 'https://rezka.fi';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = () => new Promise(resolve => setTimeout(resolve, 180));
const rule = (field, op, values) => ({ kind: 'rule', field, op, values });
const group = (children, mode = 'all', not = false) => ({ kind: 'group', children, mode, not });
const url = id => `${origin}/films/drama/${id}-title.html`;
const listing = ids => '<div class="b-content__inline_items">' + ids.map(id => `<div class="b-content__inline_item"><div class="b-content__inline_item-link"><a href="${url(id)}">Title ${id}</a><div>2020, США, Драмы</div></div></div>`).join('') + '</div>';
const details = (actors = []) => '<table><tr><td>Страна:</td><td>Мальта</td></tr><tr><td>Жанр:</td><td><a href="/films/drama/">Драмы</a></td></tr>'
    + '<tr><td>Режиссер:</td><td><a href="/person/99-director/">Director Only</a></td></tr><tr><td>В переводе:</td><td>Студия Тест</td></tr></table>'
    + actors.map(name => `<span itemprop="actor"><a href="/person/1-test/"><span itemprop="name">${name}</span></a></span>`).join(', ');
const history = () => '<div id="videosaves-list">' + [1, 2].map(id => `<div class="b-videosaves__list_item ${id === 2 ? 'watched-row' : ''}"><div class="title"><a href="${url(id)}">Title ${id}</a></div><a class="view" data-id="${id}"></a></div>`).join('') + '</div>';
function storage(initial = {}) {
    const data = { ...initial }, listeners = [];
    return { data, chrome: { storage: { local: {
        get: async key => key ? { [key]: data[key] } : { ...data },
        async set(values) { Object.assign(data, values); for (const fn of listeners) fn(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), 'local'); },
        async remove(key) { delete data[key]; for (const fn of listeners) fn({ [key]: {} }, 'local'); }
    }, onChanged: { addListener: fn => listeners.push(fn) } } } };
}
function harness(t, { bus = storage(), signedIn = true, mount = false, state, fetcher, markup = '' } = {}) {
    const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
    const hash = state ? '#rc-search=1&v=2&rules=' + encodeURIComponent(JSON.stringify({ extra: state.extra || [], advanced: state.advanced || null })) : '#rc-search=1';
    const dom = new JSDOM('<html><head></head><body>' + (signedIn ? '<a class="b-tophead__contwatch" href="/continue/">Continue</a>' : '')
        + markup + '<ul id="topnav-menu"></ul><div class="b-content"><h1>Search</h1></div></body></html>', {
        url: origin + '/search/' + hash, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole
    });
    t.after(() => { dom.window.close(); assert.deepEqual(errors, []); });
    const w = dom.window, calls = [];
    w.chrome = bus.chrome; w.scrollTo = () => {};
    w.fetch = async (target, options) => {
        calls.push(target);
        const html = fetcher ? await fetcher(target, options) : target.includes('/continue/') ? history() : listing([1, 2, 3, 4]);
        return { ok: true, text: async () => html };
    };
    const modules = ['network-policy.js', 'search-rules.js', 'search-core.js', 'search-store.js', 'search-editor.js', 'search-style.js', 'watched-site.js', 'exclusions.js'];
    if (mount) modules.push('watched.js', 'exclusions-site.js', 'search-page.js');
    w.eval(modules.map(read).join('\n') + '\nwindow.api = { S: RezkaSearch, R: RezkaSearchRules, Store: RezkaSearchStore, Ex: RezkaExclusions };');
    const root = w.document.querySelector('#rc-search-root')?.shadowRoot;
    return { ...w.api, w, calls, bus, root, $: selector => root.querySelector(selector) };
}
const ids = search => Array.from(search.items, item => item.id);
const change = (w, node, value) => { node.value = value; node.dispatchEvent(new w.Event('change', { bubbles: true })); };

test('actors use the cast, never directors; any/all/none and negated groups retain unknown data', t => {
    const { S, R } = harness(t), item = S.parseList(listing([1]), origin).items[0];
    const cast = S.parseDetails(details(['Актёр Один', 'Актёр Два']), url(1));
    assert.deepEqual([...cast.actors], ['Актёр Один', 'Актёр Два']);
    for (const [op, values, expected] of [['any', ['актёр один'], true], ['all', ['Актёр Один', 'Актёр Два'], true],
        ['all', ['Актёр Один', 'Другой'], false], ['none', ['Актёр Один'], false], ['none', ['Director Only'], true]]) {
        const state = S.normalize({ extra: [rule('actor', op, values)] });
        assert.equal(S.matches(item, state, {}, cast), expected);
    }
    const unknown = S.parseDetails(details(), url(1));
    for (const not of [false, true]) assert.equal(R.evaluate(group([rule('actor', 'none', ['Актёр Один'])], 'all', not), S.facts(item, {}, {}, unknown)), null);
});

test('actor searches refresh legacy metadata and reuse the new cast cache', async t => {
    const { S } = harness(t); let reads = 0;
    const old = S.parseDetails(details(), url(1)); delete old.actors; delete old.actorsComplete;
    S.rememberDetails(url(1), old);
    const state = { extra: [rule('actor', 'any', ['Актёр Один'])] };
    const fetcher = async target => { if (target.endsWith('.html')) { reads++; return details(['Актёр Один']); } return listing([1]); };
    for (let i = 0; i < 2; i++) { const search = new S.Search(state, origin, fetcher); await search.load(); assert.deepEqual(ids(search), ['1']); }
    assert.equal(reads, 1);
});

test('personal statuses distinguish watching, completed, unwatched and independent exclusions', async t => {
    const bus = storage({ 'rc-excluded:v1:3': { version: 1, id: '3', title: 'Title 3' } });
    const { S, R, calls } = harness(t, { bus });
    for (const [values, expected] of [[['watching'], ['1']], [['completed'], ['2']], [['excluded'], ['3']], [['unwatched'], ['3', '4']], [['watching', 'completed'], ['1', '2']]]) {
        const search = new S.Search({ extra: [rule('status', 'any', values)] }, origin);
        await search.load(); assert.deepEqual(ids(search), expected); assert.equal(search.unknown, 0);
        assert.equal(search.restore(search.snapshot()), false);
    }
    assert.equal(calls.some(target => target.endsWith('.html')), false, 'personal filters do not fetch per-title metadata');
    assert.throws(() => R.validate(rule('status', 'any', ['made-up'])), /Неизвестный статус/);
    const advanced = group([rule('status', 'any', ['watching']), rule('status', 'none', ['completed'])], 'any', true);
    assert.equal(S.readState(S.pageURL({ advanced }, origin)).advanced.not, true);
});

test('signed-out exclusions work while account filters fail explicitly and can retry', async t => {
    const h = harness(t, { signedIn: false });
    const excluded = new h.S.Search({ extra: [rule('status', 'none', ['excluded'])] }, origin);
    await excluded.load(); assert.deepEqual(ids(excluded), ['1', '2', '3', '4']);
    const search = new h.S.Search({ extra: [rule('status', 'any', ['watching'])] }, origin);
    const before = h.calls.length;
    await assert.rejects(search.load(), /войдите/); assert.equal(h.calls.length, before); assert.equal(search.busy, false);
    h.w.document.body.insertAdjacentHTML('afterbegin', '<a class="b-tophead__contwatch">Continue</a>');
    await search.load(); assert.deepEqual(ids(search), ['1']);
});

test('history failures keep candidates unprocessed; Stop during a history read commits nothing', async t => {
    let fail = true, finish;
    const h = harness(t, { fetcher: async target => {
        if (target.includes('/continue/')) { if (fail) throw new Error('Offline'); return new Promise(resolve => { finish = resolve; }); }
        return listing([1]);
    } });
    const search = new h.S.Search({ extra: [rule('status', 'none', ['completed'])] }, origin);
    await assert.rejects(search.load(), /историю просмотров/); assert.equal(search.scanned, 0); assert.equal(search.done, false);
    fail = false; const controller = new h.w.AbortController(); const task = search.load({ signal: controller.signal });
    await tick(); controller.abort(); finish(history()); await task;
    assert.equal(search.scanned, 0); assert.equal(search.personal, null);
});

test('a watched revision during history loading rejects the stale snapshot', async t => {
    let finish;
    const h = harness(t, { fetcher: target => target.includes('/continue/') ? new Promise(resolve => { finish = resolve; }) : listing([1]) });
    const search = new h.S.Search({ extra: [rule('status', 'any', ['watching'])] }, origin);
    const task = assert.rejects(search.load(), /изменились/);
    await tick(); await h.bus.chrome.storage.local.set({ 'ui:watched-revision': 'another-tab:1' }); finish(history()); await task;
    assert.equal(search.scanned, 0); assert.equal(search.personal, null);
});

test('live watched revisions refresh applied personal results while preserving typed drafts', async t => {
    let completed = false;
    const h = harness(t, { mount: true, state: { extra: [rule('status', 'any', ['watching'])] }, fetcher: target => target.includes('/continue/')
        ? completed ? history().replace('b-videosaves__list_item ', 'b-videosaves__list_item watched-row ') : history() : listing([1, 2]) });
    await settle(); assert.equal(h.$('#cards').children.length, 1);
    h.$('#query').value = 'Название в черновике'; h.$('#query').dispatchEvent(new h.w.Event('input', { bubbles: true }));
    completed = true; await h.bus.chrome.storage.local.set({ 'ui:watched-revision': 'another-tab:2' }); await settle();
    assert.equal(h.$('#cards').children.length, 0); assert.equal(h.$('#query').value, 'Название в черновике');
    assert.equal(h.S.readState(h.w.location.href).q, ''); assert.equal(h.$('#draft-note').hidden, false);
});

test('explicit excluded search reveals cards only in its own root and offers recovery', async t => {
    const bus = storage({ 'rc-excluded:v1:3': { version: 1, id: '3', title: 'Title 3' } });
    const h = harness(t, { bus, mount: true, markup: listing([3]), state: { extra: [rule('status', 'any', ['excluded'])] } });
    await settle();
    assert.equal(h.$('#results-heading').textContent, 'Найдено: 1');
    assert.equal(h.$('.card').classList.contains('rc-excluded'), false);
    assert.ok(h.w.document.querySelector('.b-content__inline_item.rc-excluded'));
    assert.match(h.$('.rc-exclude-toggle').getAttribute('aria-label'), /Вернуть в списки/);
    h.$('.rc-exclude-toggle').click(); await settle();
    assert.equal(h.$('#cards').children.length, 0); assert.equal(h.$('#empty').hidden, false);
    assert.equal(bus.data['rc-excluded:v1:3'], undefined);
    assert.equal(h.w.document.querySelectorAll('.b-content__inline_item.rc-excluded').length, 0);
});

test('nested exclusion intent obeys group negation and does not reveal unrelated excluded cards by default', t => {
    const { R } = harness(t), include = rule('status', 'any', ['excluded']), exclude = rule('status', 'none', ['excluded']);
    assert.equal(R.includesExcluded(group([include])), true);
    assert.equal(R.includesExcluded(group([include], 'all', true)), false);
    assert.equal(R.includesExcluded(group([exclude])), false);
    assert.equal(R.includesExcluded(group([exclude], 'all', true)), true);
    assert.equal(R.includesExcluded(group([rule('status', 'any', ['watching'])])), false);
});

test('actor and status controls apply and persist through named filter sets', async t => {
    const h = harness(t, { mount: true }); await settle();
    h.$('#add-filter').click(); change(h.w, h.$('#add-filter-choice'), 'actor');
    const actor = h.$('[aria-label="Значения: Актёры"]'); actor.value = 'Актёр Один';
    actor.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    change(h.w, h.$('[aria-label="Условие: Актёры"]'), 'none');
    h.$('#add-filter').click(); change(h.w, h.$('#add-filter-choice'), 'status');
    const status = h.$('[aria-label="Значения: Мой список"]'); status.focus();
    const option = [...h.root.querySelectorAll('.value-option')].find(node => node.textContent === 'Смотрю'); assert.ok(option); option.click();
    h.$('#search-form').dispatchEvent(new h.w.Event('submit', { cancelable: true })); await settle();
    const state = h.S.readState(h.w.location.href);
    assert.equal(state.extra[0].field, 'actor'); assert.equal(state.extra[0].op, 'none'); assert.equal(state.extra[1].values[0], 'watching');
    await h.Store.save('My filters', state, 'personal');
    assert.equal(JSON.stringify((await h.Store.list())[0].state.extra), JSON.stringify(state.extra));
});

test('native genre aliases, countries, actors and full voice names survive new tabs', async t => {
    const bus = storage(), a = harness(t, { bus });
    const doc = new a.w.DOMParser().parseFromString('<select class="select-category"><option value="/films/best/musical/">Мюзиклы</option><option value="/films/best/new-genre/">Новый жанр</option></select><a href="/country/Бутан/">Бутан</a>', 'text/html');
    a.S.learnOptions(doc, origin);
    a.S.parseDetails(details(['Актёр Один']), url(1));
    assert.match(a.S.GENRES.musical, /Музыкальные.*Мюзиклы/);
    assert.equal(a.S.GENRES['new-genre'], 'Новый жанр');
    await new Promise(resolve => setTimeout(resolve, 550));
    const b = harness(t, { bus, mount: true }); await settle();
    assert.ok(b.S.suggestions('country').includes('Бутан')); assert.ok(b.S.suggestions('country').includes('Литва'));
    assert.ok(b.S.suggestions('voice').includes('Студия Тест')); assert.ok(b.S.suggestions('actor').includes('Актёр Один'));
    assert.match(b.$('#genre').textContent, /Новый жанр/);
    b.$('#add-filter').click(); change(b.w, b.$('#add-filter-choice'), 'actor');
    b.$('[aria-label="Значения: Актёры"]').focus();
    assert.ok([...b.root.querySelectorAll('.value-option')].some(node => node.textContent === 'Актёр Один'));
    const saved = await b.Store.save('New genre', b.S.normalize({ genre: 'new-genre' }), 'new-genre');
    assert.equal(saved.state.genre, 'new-genre');
});

test('late suggestion updates preserve typed country and actor drafts', async t => {
    const h = harness(t, { mount: true }); await settle();
    h.$('#country').value = 'Страна в черновике'; h.$('#country').dispatchEvent(new h.w.Event('input', { bubbles: true }));
    h.$('#add-filter').click(); change(h.w, h.$('#add-filter-choice'), 'actor');
    const actor = h.$('[aria-label="Значения: Актёры"]'); actor.value = 'Черновик актёра';
    await h.bus.chrome.storage.local.set({ 'rc-search:options:v1': { version: 1, country: ['Новая страна'], actor: ['Другой актёр'], voice: [], genres: [] } });
    assert.equal(h.$('#country').value, 'Страна в черновике'); assert.equal(actor.value, 'Черновик актёра'); assert.equal(actor.isConnected, true);
});

test('TV shows and their genres participate in search without an invented native type id', async t => {
    const { S, R } = harness(t);
    const shows = listing([1]).replaceAll('/films/drama/', '/show/reality-shows/');
    assert.equal(S.parseList(shows, origin).items[0].type, 'show');
    assert.equal(R.validate(rule('type', 'any', ['show'])).values[0], 'show');
    const state = { type: 'show', country: 'США', genre: 'reality-shows' };
    const route = new URL(S.plan(state, origin).url); assert.equal(route.pathname, '/show/'); assert.equal(route.searchParams.has('genre'), false);
    const search = new S.Search(state, origin, async target => target.endsWith('.html')
        ? details().replace('Мальта', 'США').replaceAll('/films/drama/', '/show/reality-shows/') : shows);
    await search.load(); assert.deepEqual(ids(search), ['1']);
});

test('truncated voice text uses its full label without merging language or director variants', t => {
    const { S } = harness(t);
    const html = details().replace('Студия Тест', 'Дубляж')
        + '<li class="b-translator__item" data-translator_id="1" title="Полное название студии">Полное…</li>'
        + '<li class="b-translator__item" data-translator_id="1" data-director="1" title="Полное название студии">Полное…<img title="Украинский"></li>';
    const result = S.parseDetails(html, url(1));
    assert.deepEqual(Array.from(result.voices, voice => voice.name), ['Полное название студии', 'Полное название студии (реж. версия) (Украинский)']);
});
