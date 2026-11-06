import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
const origin = 'https://rezka.fi';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const rule = (field, op, value) => ({ kind: 'rule', field, op, ...(Array.isArray(value) ? { values: value } : value === undefined ? {} : { value }) });
const group = (children, mode = 'all', not = false) => ({ kind: 'group', mode, not, children });
const card = (id = 1, type = 'films', genre = 'fiction') => `<div class="b-content__inline_item"><div class="b-content__inline_item-link"><a href="/${type}/${genre}/${id}-test.html">Тест ${id}</a><div>2020, США, Фантастика</div></div></div>`;
const list = (cards = card(), next = '') => `<h1>Поиск</h1><div class="b-content__inline_items">${cards}</div><div class="b-navigation">${next}</div>`;
const detail = ({ imdb = '7.5', kp = '8,1', votes = '10\u00a0500', voice = 'Студия А', director = false } = {}) => `
    <h1>Тест</h1><table><tr><td>Страна:</td><td>США, Франция</td></tr>
    <tr><td>Жанр:</td><td><a href="/films/fiction/">Фантастика</a><a href="/films/action/">Боевики</a></td></tr>
    <tr><td>Дата выхода:</td><td>1 января 2020 года</td></tr></table>
    ${imdb === null ? '' : `<span class="b-post__info_rates imdb">IMDb: <span class="bold">${imdb}</span> <i>(${votes})</i></span>`}
    ${kp === null ? '' : `<span class="b-post__info_rates kp">Кинопоиск: <span>${kp}</span> <i>(3 000)</i></span>`}
    <div class="b-post__rating"><span itemprop="rating"><span class="num">9.37</span></span><span class="votes"><span itemprop="votes">14732</span></span></div>
    <ul id="translators-list"><li class="b-translator__item" data-translator_id="80" title="${voice}">${voice}</li>
    ${director ? `<li class="b-translator__item" data-translator_id="80" title="${voice} (реж. версия)">${voice} (реж. версия)</li>` : ''}
    <li class="b-translator__item" data-translator_id="56">Дубляж</li><li class="b-translator__item" data-translator_id="238">Оригинал (+субтитры)</li></ul>`;
function environment(t, { url = origin + '/search/?do=search&subaction=search#rc-search=1', fetcher = () => list(), mount = false, saved = {} } = {}) {
    const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, [], 'No uncaught UI errors'));
    const dom = new JSDOM('<html><head></head><body><ul id="topnav-menu"></ul><div class="b-content"><h1>Поиск</h1></div></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
    t.after(() => dom.window.close());
    const w = dom.window, calls = [], data = { ...saved }, storageListeners = [];
    w.scrollTo = () => {};
    w.chrome = { storage: { local: {
        get: async () => ({ ...data }), set: async values => Object.assign(data, values), remove: async key => { delete data[key]; }
    }, onChanged: { addListener(fn) { storageListeners.push(fn); } } } };
    w.fetch = async url => { calls.push(url); return { ok: true, text: async () => fetcher(url) }; };
    const modules = ['search-rules.js', 'search-core.js', 'search-store.js'];
    if (mount) modules.push('search-editor.js', 'search-style.js', 'network-policy.js', 'search-page.js');
    w.eval(modules.map(read).join('\n') + '\nglobalThis.api = { R: RezkaSearchRules, S: RezkaSearch, Store: RezkaSearchStore };');
    const root = w.document.querySelector('#rc-search-root')?.shadowRoot;
    return { ...w.api, w, calls, data, root, $: selector => root.querySelector(selector),
        storageChanged: changes => storageListeners.forEach(fn => fn(changes, 'local')) };
}
const change = (w, control, value) => { control.value = value; control.dispatchEvent(new w.Event('change', { bubbles: true })); };
const input = (w, control, value) => { control.value = value; control.dispatchEvent(new w.Event('input', { bubbles: true })); };
const clickText = (root, text) => { const button = [...root.querySelectorAll('button')].find(node => node.textContent === text); assert.ok(button, text); button.click(); return button; };

test('restored presets appear in open search without changing drafts or starting a search; late reads cannot undo them', async t => {
    const { w, $, calls, data, S, storageChanged } = environment(t, { mount: true });
    await tick(); await tick();
    input(w, $('#query'), 'Черновик названия'); input(w, $('#country'), 'Канада');
    const requests = calls.length;
    const key = 'rc-search:preset:v2:restored';
    const record = name => ({ version: 2, id: 'restored', name, state: S.normalize({ type: 'films', country: 'США', from: '2000' }) });
    data[key] = record('Из копии');
    storageChanged({ [key]: { newValue: data[key] } });
    await tick();
    assert.equal($('#preset-select').options.length, 2);
    assert.equal($('#preset-select').options[1].textContent, 'Из копии');
    assert.equal($('#preset-select').value, '');
    assert.equal($('#query').value, 'Черновик названия'); assert.equal($('#country').value, 'Канада');
    assert.equal(calls.length, requests);
    change(w, $('#preset-select'), 'restored');
    assert.equal($('#query').value, 'Черновик названия'); assert.equal($('#country').value, 'США');
    assert.equal(calls.length, requests);
    let firstRead; let count = 0;
    w.chrome.storage.local.get = () => ++count === 1 ? new Promise(resolve => { firstRead = resolve; })
        : Promise.resolve({ [key]: record('Последняя копия') });
    storageChanged({ [key]: { newValue: record('Старая копия') } });
    storageChanged({ [key]: { newValue: record('Последняя копия') } });
    await tick(); firstRead({ [key]: record('Старая копия') }); await tick();
    assert.equal($('#preset-select').options[1].textContent, 'Последняя копия');
    assert.equal($('#preset-select').value, 'restored');
    assert.equal($('#query').value, 'Черновик названия');
    assert.equal(calls.length, requests);
});

test('removing applied chips preserves changed fields and uncommitted invalid controls', async t => {
    const { w, $, root, S } = environment(t, { mount: true,
        url: origin + '/search/#rc-search=1&country=США&genre=fiction&from=2000&to=2020' });
    await tick(); await tick();
    input(w, $('#query'), 'Матрица'); input(w, $('#country'), 'Канада'); input(w, $('#from'), '2010');
    $('#add-filter').click(); change(w, $('#add-filter-choice'), 'voice');
    const voice = $('#extra-filters input'); input(w, voice, 'Студия Б');
    root.querySelector('[aria-label="Убрать фильтр: США"]').click(); await tick();
    assert.equal($('#query').value, 'Матрица'); assert.equal($('#country').value, 'Канада');
    assert.equal($('#from').value, '2010'); assert.equal($('#extra-filters input'), voice); assert.equal(voice.value, 'Студия Б');
    assert.equal(S.readState(w.location.href).q, ''); assert.equal(S.readState(w.location.href).country, '');
    assert.equal(S.readState(w.location.href).from, '2000'); assert.equal($('#draft-note').hidden, false);
    root.querySelector('[aria-label="Убрать фильтр: Фантастика"]').click(); await tick();
    assert.equal($('#genre').value, ''); assert.equal($('#from').value, '2010'); assert.equal(voice.value, 'Студия Б');
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
    const applied = S.readState(w.location.href);
    assert.equal(applied.q, 'Матрица'); assert.equal(applied.country, 'Канада'); assert.equal(applied.from, '2010');
    assert.deepEqual([...applied.extra[0].values], ['Студия Б']); assert.equal($('#draft-note').hidden, true);
});

test('removing an applied extra retains neighbouring DOM drafts and correct removal indices', async t => {
    const extras = [rule('imdb', 'gte', 7), rule('kp', 'gte', 8), rule('voice', 'any', ['Студия А'])];
    const { w, $, root, S } = environment(t, { mount: true,
        url: origin + '/search/#rc-search=1&v=2&rules=' + encodeURIComponent(JSON.stringify({ extra: extras, advanced: null })) });
    await tick(); await tick();
    const kp = root.querySelector('[aria-label="Рейтинг Кинопоиск: Значение"]'); input(w, kp, '');
    const voice = root.querySelector('[aria-label="Значения: Озвучка"]'); input(w, voice, 'Студия Б');
    root.querySelector('[aria-label="Убрать фильтр: Рейтинг IMDb ≥ 7"]').click(); await tick();
    assert.equal(root.querySelector('[aria-label="Рейтинг Кинопоиск: Значение"]'), kp); assert.equal(kp.value, '');
    assert.equal(root.querySelector('[aria-label="Значения: Озвучка"]'), voice); assert.equal(voice.value, 'Студия Б');
    assert.equal(kp.closest('[data-path]').dataset.path, 'extra.0'); assert.equal(voice.closest('[data-path]').dataset.path, 'extra.1');
    assert.equal(S.readState(w.location.href).extra.length, 2);
    root.querySelector('[aria-label="Убрать фильтр: Рейтинг Кинопоиск ≥ 8"]').click(); await tick();
    assert.equal(kp.isConnected, true, 'A changed invalid draft is retained even after its applied version is removed');
    root.querySelector('[aria-label="Удалить условие: Рейтинг Кинопоиск"]').click();
    assert.equal(root.querySelectorAll('.compact-condition').length, 1);
    assert.match($('#extra-filters').textContent, /Студия Б/);
});

test('removing applied complex conditions leaves base and extra drafts unapplied', async t => {
    const advanced = group([rule('imdb', 'gte', 7)]);
    const { w, $, root, S } = environment(t, { mount: true,
        url: origin + '/search/#rc-search=1&v=2&rules=' + encodeURIComponent(JSON.stringify({ extra: [], advanced })) });
    await tick(); await tick();
    input(w, $('#query'), 'Матрица'); $('#add-filter').click(); change(w, $('#add-filter-choice'), 'kp');
    const invalid = $('#extra-filters input');
    clickText($('#advanced-summary'), 'Убрать'); await tick();
    assert.equal(S.readState(w.location.href).advanced, null); assert.equal(S.readState(w.location.href).q, '');
    assert.equal($('#query').value, 'Матрица'); assert.equal($('#extra-filters input'), invalid);
    assert.equal($('#draft-note').hidden, false); assert.equal(root.activeElement, $('#advanced-filter'));
});

test('sorting waits for explicit apply when other fields or extra values are drafts', async t => {
    const { w, $, calls, S } = environment(t, { mount: true }); await tick(); await tick();
    assert.equal($('#sort-pending').hidden, true);
    const count = calls.length; input(w, $('#country'), 'США'); change(w, $('#sort'), 'popular');
    assert.equal(calls.length, count); assert.equal(S.readState(w.location.href).sort, 'last');
    assert.equal($('#sort').value, 'popular'); assert.equal($('#draft-note').hidden, false);
    assert.equal($('#sort-pending').hidden, false); assert.match($('#sort-pending').textContent, /Применится вместе с фильтрами/);
    assert.equal($('#sort-display').getAttribute('aria-describedby'), 'sort-pending');
    change(w, $('#sort'), 'last'); assert.equal($('#sort-pending').hidden, true);
    assert.equal($('#sort-display').hasAttribute('aria-describedby'), false);
    change(w, $('#sort'), 'popular');
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); await tick();
    assert.equal(S.readState(w.location.href).sort, 'popular'); assert.equal(S.readState(w.location.href).country, 'США');
    assert.equal($('#sort-pending').hidden, true);
    $('#add-filter').click(); change(w, $('#add-filter-choice'), 'voice');
    const voice = $('#extra-filters input'); input(w, voice, 'Студия Б'); const before = calls.length;
    change(w, $('#sort'), 'watching');
    assert.equal(calls.length, before); assert.equal(voice.value, 'Студия Б'); assert.equal($('#extra-filters input'), voice);
    assert.equal($('#sort-pending').hidden, false);
    input(w, $('#query'), 'Матрица');
    assert.equal($('#sort-pending').hidden, true); assert.equal($('#sort-display').getAttribute('aria-describedby'), 'sort-note');
    input(w, $('#query'), ''); assert.equal($('#sort-pending').hidden, false);
    $('#reset').click(); await tick();
    assert.equal($('#sort-pending').hidden, true); assert.equal($('#sort-display').hasAttribute('aria-describedby'), false);
});

test('title draft explains future ordering without changing the applied search', async t => {
    const { w, $, calls, S } = environment(t, { mount: true, url: origin + '/search/#rc-search=1&sort=popular' });
    await tick(); await tick();
    const before = w.location.href, count = calls.length, cards = $('#cards').innerHTML;
    input(w, $('#query'), 'Матрица');
    assert.equal($('#sort').disabled, true); assert.equal($('#sort-note').hidden, false);
    assert.match($('#sort-note').textContent, /После поиска по названию.*порядок HDrezka/);
    assert.match($('#sort-note').textContent, /результаты предыдущего поиска/);
    assert.equal($('#sort-display').getAttribute('aria-describedby'), 'sort-note');
    assert.equal(w.location.href, before); assert.equal(calls.length, count); assert.equal($('#cards').innerHTML, cards);
    input(w, $('#query'), '');
    assert.equal($('#sort-note').hidden, true); assert.equal($('#sort').disabled, false);
    assert.equal($('#sort-display').value, S.SORTS.popular);
    input(w, $('#query'), 'Матрица');
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); await tick();
    assert.equal(S.readState(w.location.href).q, 'Матрица');
    assert.equal($('#sort-note').textContent, 'При поиске по названию сохраняется порядок результатов HDrezka.');
    input(w, $('#query'), 'Другой фильм'); assert.match($('#sort-note').textContent, /После поиска/);
    input(w, $('#query'), '  Матрица  '); assert.doesNotMatch($('#sort-note').textContent, /После поиска/);
    input(w, $('#query'), 'Другой фильм'); $('#reset').click(); await tick();
    assert.equal(S.readState(w.location.href).q, 'Другой фильм'); assert.doesNotMatch($('#sort-note').textContent, /После поиска/);
});

test('both complex-editor entry points validate common fields before opening and preserve drafts', async t => {
    const advanced = group([rule('imdb', 'gte', 7)]);
    const { w, $, root, calls, S } = environment(t, { mount: true,
        url: origin + '/search/#rc-search=1&v=2&rules=' + encodeURIComponent(JSON.stringify({ extra: [], advanced })),
        fetcher: url => url.includes('.html') ? detail() : list() });
    await tick(); await tick();
    input(w, $('#query'), 'Матрица');
    $('#add-filter').click(); change(w, $('#add-filter-choice'), 'voice');
    const voice = $('#extra-filters input'); input(w, voice, 'Студия Б');
    const before = w.location.href, count = calls.length, dialog = $('#conditions-dialog');
    const cases = [
        { from: '2000', to: '1990', field: 'to', message: /не меньше/ },
        { from: '1889', field: 'from' },
        { to: String(new Date().getFullYear() + 6), field: 'to' },
        { from: '2000.5', field: 'from' },
        { country: 'США123', field: 'country', message: /Введите название страны/ }
    ];
    for (const values of cases) {
        for (const field of ['from', 'to', 'country']) input(w, $('#' + field), values[field] || '');
        for (const opener of [$('#advanced-filter'), [...$('#advanced-summary').querySelectorAll('button')].find(node => node.textContent === 'Изменить')]) {
            opener.focus(); opener.click();
            assert.equal(dialog.open, false); assert.equal(root.activeElement, $('#' + values.field));
            assert.equal($('#' + values.field).validity.valid, false);
            if (values.message) assert.match($('#' + values.field).validationMessage, values.message);
            assert.equal(w.location.href, before); assert.equal(calls.length, count);
            assert.equal($('#query').value, 'Матрица'); assert.equal($('#extra-filters input'), voice); assert.equal(voice.value, 'Студия Б');
        }
        $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
        assert.equal(w.location.href, before); assert.equal(calls.length, count);
    }
    input(w, $('#country'), 'США'); input(w, $('#from'), '2000'); input(w, $('#to'), '2020');
    $('#advanced-filter').click();
    assert.equal(dialog.open, true); assert.equal(dialog.querySelector('input[type="number"]').value, '7');
    clickText(dialog, '+ Условие');
    input(w, [...dialog.querySelectorAll('input[type="number"]')].at(-1), '8');
    clickText(dialog, 'Применить'); await tick(); await tick();
    assert.equal(dialog.open, false); assert.equal(root.activeElement, $('#advanced-filter'));
    const applied = S.readState(w.location.href);
    assert.equal(applied.from, '2000'); assert.equal(applied.to, '2020'); assert.equal(applied.q, 'Матрица');
    assert.deepEqual([...applied.extra[0].values], ['Студия Б']);
    assert.deepEqual(applied.advanced.children.map(node => node.value), w.Array.of(7, 8));
});

test('filter reset keeps the current title while clearing scalar, extra and complex restrictions', async t => {
    const criteria = { extra: [rule('imdb', 'gte', 7)], advanced: group([rule('year', 'gte', 2000)]) };
    const { w, $, root, S, calls } = environment(t, { mount: true,
        url: origin + '/search/?q=Матрица#rc-search=1&type=films&country=США&from=2000&sort=popular&v=2&rules='
            + encodeURIComponent(JSON.stringify(criteria)), fetcher: url => url.includes('.html') ? detail() : list() });
    await tick(); await tick();
    input(w, $('#query'), 'Интерстеллар'); input(w, $('#to'), '1900');
    input(w, $('#extra-filters input'), '');
    $('#reset').click(); await tick(); await tick();
    assert.equal($('#query').value, 'Интерстеллар'); assert.equal(root.activeElement, $('#query'));
    const state = S.readState(w.location.href);
    assert.equal(state.q, 'Интерстеллар'); assert.equal(state.type, ''); assert.equal(state.country, '');
    assert.equal(state.from, ''); assert.equal(state.to, ''); assert.equal(state.extra.length, 0); assert.equal(state.advanced, null);
    assert.equal($('#extra-filters').children.length, 0); assert.equal($('#advanced-summary').hidden, true);
    assert.equal($('#draft-note').hidden, true); assert.equal($('#sort').disabled, true);
    assert.equal(new URL(calls.at(-1)).searchParams.get('q'), 'Интерстеллар');
});

test('complex conditions show the current title scope without adding it to saved filter sets', async t => {
    const { w, $, root } = environment(t, { mount: true, url: origin + '/search/?q=Матрица#rc-search=1' });
    await tick(); await tick(); $('#advanced-filter').click();
    assert.equal($('.conditions-scope').textContent, 'Поиск по названию: Матрица');
    assert.equal($('#conditions-dialog').getAttribute('aria-describedby'), $('.conditions-scope').id);
    assert.equal($('.conditions-filters').textContent, 'Общие фильтры не заданы.');
    clickText($('#conditions-dialog'), 'Отмена'); input(w, $('#query'), '<b>Новое название</b>');
    $('#advanced-filter').click();
    assert.equal($('.conditions-scope').textContent, 'Поиск по названию: <b>Новое название</b>');
    assert.equal($('.conditions-scope').children.length, 0);
    clickText($('#conditions-dialog'), 'Отмена'); clickText($('#preset-controls'), 'Сохранить набор фильтров');
    assert.doesNotMatch(root.querySelector('.preset-summary').textContent, /Новое название/);
    clickText(root.querySelector('.preset-dialog'), 'Отмена'); input(w, $('#query'), '   ');
    $('#advanced-filter').click(); assert.equal($('.conditions-scope').textContent, 'По всему каталогу');
});

test('common summaries stay plain while saved nested logic remains complete', async t => {
    const advanced = group([rule('imdb', 'gte', 7), rule('kp', 'gte', 8)], 'any', true);
    const { $, root } = environment(t, { mount: true,
        url: origin + '/search/#rc-search=1&type=films&genre=thriller&country=США&from=2020&to=2025&v=2&rules='
            + encodeURIComponent(JSON.stringify({ extra: [], advanced })) });
    await tick(); await tick(); $('#advanced-filter').click();
    assert.equal($('.conditions-filters').textContent, 'Общие фильтры: Фильмы · Триллеры · США · 2020–2025');
    clickText($('#conditions-dialog'), 'Отмена'); clickText($('#preset-controls'), 'Сохранить набор фильтров');
    assert.match(root.querySelector('.preset-summary').textContent, /Фильмы · Триллеры · США · 2020–2025/);
    assert.match(root.querySelector('.preset-summary').textContent, /Сложные условия: Исключить: \(Рейтинг IMDb ≥ 7 ИЛИ Рейтинг Кинопоиск ≥ 8\)/);
});

test('nested groups have distinct contextual names through collapse, validation and removal', async t => {
    const { $, root } = environment(t, { mount: true }); await tick(); await tick();
    $('#advanced-filter').click(); const dialog = $('#conditions-dialog');
    clickText(dialog, '+ Группа'); let nested = dialog.querySelector('[role="group"][aria-label="Группа 1"]');
    clickText(nested, '+ Группа'); clickText(dialog.querySelector('.conditions-body > .condition-group > .group-content > .group-actions'), '+ Группа');
    const groups = [...dialog.querySelectorAll('.condition-group')];
    assert.deepEqual(groups.map(node => node.getAttribute('aria-label')), ['Основная группа', 'Группа 1', 'Группа 1.1', 'Группа 2']);
    for (const node of groups) {
        const name = node.getAttribute('aria-label'), header = node.querySelector('.group-header');
        for (const control of header.querySelectorAll('select, input, button')) assert.ok(control.getAttribute('aria-label').includes(name));
    }
    nested = dialog.querySelector('[aria-label="Группа 1.1"]'); clickText(nested, 'Свернуть');
    assert.ok(dialog.querySelector('[aria-label="Развернуть: Группа 1.1"]'));
    clickText(dialog, 'Применить');
    assert.ok(dialog.querySelector('[aria-label="Свернуть: Группа 1.1"]'));
    assert.equal(root.activeElement.getAttribute('aria-label'), 'Добавить условие: Группа 1.1');
    clickText(dialog.querySelector('[aria-label="Группа 1"]'), 'Удалить группу');
    assert.deepEqual([...dialog.querySelectorAll('.condition-group')].map(node => node.getAttribute('aria-label')), ['Основная группа', 'Группа 1']);
});

test('nested alternatives and exclusions use three-valued logic including absent ratings', t => {
    const { R } = environment(t);
    const a = group([rule('imdb', 'gte', 7), rule('voice', 'any', ['A'])]);
    const b = group([rule('kp', 'gte', 8), rule('voice', 'any', ['B'])]);
    const tree = R.validate(group([group([a, b], 'any'), group([rule('genre', 'any', ['horror'])], 'all', true)]));
    const facts = { imdb: 7.2, kp: null, voice: { values: ['A'], complete: true }, genre: { values: ['comedy'], complete: true } };
    assert.equal(R.evaluate(tree, facts), true);
    assert.equal(R.evaluate(tree, { ...facts, genre: { values: ['horror'], complete: true } }), false);
    assert.equal(R.evaluate(group([rule('imdb', 'gte', 7)], 'all', true), { imdb: null }), null);
    assert.equal(R.evaluate(group([rule('imdb', 'gte', 7), rule('kp', 'gte', 8)], 'any'), { imdb: null, kp: 9 }), true);
    assert.equal(R.evaluate(rule('imdb', 'missing'), { imdb: null }), true);
    assert.equal(R.evaluate(rule('imdb', 'missing'), {}), null);
    assert.equal(R.evaluate(rule('imdbVotes', 'eq', 0), { imdbVotes: 0 }), true);
});

test('numeric boundaries, full-set requirements and exclusions do not guess missing facts', t => {
    const { R } = environment(t);
    const range = { ...rule('imdb', 'between', 7), to: 8 };
    for (const value of [7, 7.5, 8]) assert.equal(R.evaluate(range, { imdb: value }), true);
    assert.equal(R.evaluate(range, { imdb: 8.01 }), false);
    assert.equal(R.evaluate(rule('genre', 'none', ['action']), { genre: { values: ['fiction'], complete: false } }), null);
    assert.equal(R.evaluate(rule('voice', 'all', ['A', 'B']), { voice: { values: ['A'], complete: true } }), false);
    assert.equal(R.evaluate(rule('voice', 'any', ['a', 'B']), { voice: { values: [' A '], complete: true } }), true);
    assert.throws(() => R.validate(group([group([])])), /Добавьте условие/);
    assert.throws(() => R.validate(rule('imdb', 'gte', '7')), /Введите значение/);
    assert.throws(() => R.validate(rule('imdb', 'gte', 11)), /Введите значение/);
    assert.throws(() => R.validate({ ...range, to: 6 }), /Верхняя граница/);
    assert.throws(() => R.validate(rule('__proto__', 'gte', 1)), /Неизвестное поле/);
    assert.throws(() => R.validate(group(Array.from({ length: 201 }, () => rule('imdb', 'gte', 7)))), /Слишком много/);
});

test('detail metadata preserves all three sources, vote spacing, translation versions and explicit kinds', t => {
    const { S } = environment(t);
    const data = S.parseDetails(detail({ director: true }), origin + '/films/fiction/1-test.html');
    assert.equal(data.ratings.imdb, 7.5); assert.equal(data.ratings.imdbVotes, 10500);
    assert.equal(data.ratings.kp, 8.1); assert.equal(data.ratings.rezka, 9.37); assert.equal(data.ratings.rezkaVotes, 14732);
    assert.equal(data.voices[0].id, data.voices[1].id); assert.notEqual(data.voices[0].name, data.voices[1].name);
    assert.deepEqual([...data.kinds], ['dub', 'original', 'subtitles']); assert.equal(data.kindsComplete, false);
    assert.equal(S.parseDetails(detail({ imdb: null }), origin).ratings.imdb, null);
    const solo = detail().replace(/<ul id="translators-list">[\s\S]*?<\/ul>/, '').replace('</table>', '<tr><td>В переводе:</td><td>Оригинал (+субтитры)</td></tr></table>');
    assert.equal(S.parseDetails(solo, origin).voices[0].name, 'Оригинал (+субтитры)');
    const translated = detail().replace('</ul>', '<li class="b-translator__item" data-translator_id="80" data-director="1">Студия А<img title="Украинский"></li></ul>');
    assert.equal(S.parseDetails(translated, origin).voices.at(-1).name, 'Студия А (реж. версия) (Украинский)');
});

test('new URLs round-trip rules and reject malformed or unsupported expressions rather than dropping them', t => {
    const { S } = environment(t);
    const state = S.normalize({ q: 'Матрица', type: 'films', country: 'США', extra: [rule('imdb', 'gte', 7)], advanced: group([rule('voice', 'any', ['Студия А', 'Гоблин (реж. версия)'])]) });
    assert.equal(JSON.stringify(S.readState(S.pageURL(state, origin))), JSON.stringify(state));
    const url = new URL(S.pageURL(state, origin)); assert.equal(url.searchParams.has('rules'), false);
    assert.equal(S.readState(origin + '/search/#rc-search=1&type=films').type, 'films');
    for (const hash of ['v=2&rules=broken', 'v=9', 'v=2&rules=%7B%7D', 'extra=bad', 'v=2&rules=' + encodeURIComponent(JSON.stringify({ extra: [], advanced: group([rule('unknown', 'eq', 1)]) }))]) {
        assert.throws(() => S.readState(origin + '/search/#rc-search=1&' + hash));
    }
});

test('source planning never narrows alternative branches; details are skipped when a known branch suffices', async t => {
    const { S } = environment(t);
    const tree = group([rule('type', 'any', ['films']), rule('imdb', 'gte', 9)], 'any');
    const requests = [];
    const search = new S.Search({ advanced: tree }, origin, async url => { requests.push(url); return list(); });
    assert.equal(new URL(search.source.url).pathname, '/');
    await search.load(); assert.equal(search.items.length, 1); assert.equal(requests.length, 1);
});

test('country source proof only establishes that country, and secondary alternatives fetch full metadata', async t => {
    const { S } = environment(t);
    const requests = [];
    const search = new S.Search({ country: 'США', advanced: group([rule('country', 'any', ['Франция'])]) }, origin, async url => {
        requests.push(url); return url.includes('.html') ? detail() : list();
    });
    await search.load(); assert.equal(requests.length, 2); assert.equal(search.items.length, 1);
});

test('metadata is reused in the tab and a cancelled or failed request can be retried', async t => {
    const { S, w } = environment(t); let details = 0, fail = true;
    const fetcher = async url => {
        if (!url.includes('.html')) return list();
        details++; if (fail) throw new Error('Offline'); return detail();
    };
    const state = { extra: [rule('imdb', 'gte', 7)] }, first = new S.Search(state, origin, fetcher);
    await assert.rejects(first.load(), /Offline/); assert.equal(first.pending.length, 1);
    fail = false; await first.load(); assert.equal(first.items.length, 1);
    await new S.Search(state, origin, fetcher).load(); assert.equal(details, 2);
    assert.ok(w.sessionStorage.getItem('rc-search:voices:v2').includes('Студия А'));
    const missing = new S.Search({ extra: [rule('kp', 'gte', 9)] }, origin, fetcher); await missing.load(); assert.equal(missing.items.length, 0);
});

test('unknown scores remain outside results even under exclusion and are reported separately', async t => {
    const { S } = environment(t);
    const search = new S.Search({ advanced: group([rule('imdb', 'gte', 7)], 'all', true) }, origin,
        async url => url.includes('.html') ? detail({ imdb: null }) : list());
    await search.load(); assert.equal(search.items.length, 0); assert.equal(search.unknown, 1); assert.equal(search.done, true);
});

test('missing ratings count as checked candidates and do not interrupt matching results', async t => {
    const { S } = environment(t);
    const search = new S.Search({ extra: [rule('imdb', 'gte', 7)] }, origin, async url => {
        if (!url.includes('.html')) return list(Array.from({ length: 30 }, (_, i) => card(i + 1)).join(''));
        const id = Number(new URL(url).pathname.match(/\/(\d+)-/)[1]);
        return detail({ imdb: id % 6 === 0 ? null : '8.0' });
    });
    await search.load();
    assert.equal(search.scanned, 30); assert.equal(search.unknown, 5);
    assert.equal(search.items.length, 25); assert.equal(search.done, true);
});

test('presets use independent keys, omit the title query, and report corrupted records', async t => {
    const { S, Store, data } = environment(t);
    const state = S.normalize({ q: 'Матрица', extra: [rule('imdb', 'gte', 7)] });
    await Promise.all([Store.save('На вечер', state, 'one'), Store.save('На выходные', state, 'two')]);
    assert.equal(Object.keys(data).length, 2); assert.equal(Object.hasOwn(data['rc-search:preset:v2:one'].state, 'q'), false);
    await Store.save('Новое название', state, 'one'); assert.equal(data['rc-search:preset:v2:two'].name, 'На выходные');
    data['rc-search:preset:v2:bad'] = { name: 'Старый', version: 99 };
    assert.ok((await Store.list()).find(record => record.id === 'bad').error);
    await Store.remove('one'); assert.ok(data['rc-search:preset:v2:two']); assert.equal(data['rc-search:preset:v2:one'], undefined);
});

test('the editor applies nested groups, cancels drafts, validates empty groups and returns focus', async t => {
    const { w, $, root, calls } = environment(t, { mount: true, fetcher: url => url.includes('.html') ? detail() : list() }); await tick(); await tick();
    const opener = $('#advanced-filter'); opener.focus(); opener.click();
    const dialog = $('#conditions-dialog'); assert.equal(dialog.open, true);
    clickText(dialog, '+ Условие'); input(w, dialog.querySelector('input[type="number"]'), '7');
    clickText(dialog, 'Применить'); await tick(); await tick();
    assert.equal(dialog.open, false); assert.equal(root.activeElement, opener); assert.equal(root.querySelectorAll('.card').length, 1);
    assert.match($('#advanced-summary').textContent, /IMDb ≥ 7/); assert.ok(new URL(w.location.href).hash.includes('rules='));
    const before = w.location.href, requestCount = calls.length;
    opener.click(); input(w, dialog.querySelector('input[type="number"]'), '9'); clickText(dialog, 'Отмена');
    assert.equal(w.location.href, before); assert.equal(calls.length, requestCount);
    opener.click(); assert.equal(dialog.querySelector('input[type="number"]').value, '7');
    clickText(dialog, '+ Группа'); clickText(dialog, 'Применить'); assert.equal(dialog.open, true); assert.match(dialog.querySelector('.condition-error').textContent, /Добавьте условие/);
    dialog.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); assert.equal(dialog.open, false);
});

test('compact multiselect commits typed voices on apply and permits several alternatives', async t => {
    const { w, $, root } = environment(t, { mount: true, fetcher: url => url.includes('.html') ? detail() : list() }); await tick(); await tick();
    $('#add-filter').click(); change(w, $('#add-filter-choice'), 'voice');
    const text = $('#extra-filters input'); input(w, text, 'Студия А'); text.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    input(w, text, 'Студия Б'); $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); await tick();
    const state = w.api.S.readState(w.location.href); assert.deepEqual([...state.extra[0].values], ['Студия А', 'Студия Б']);
    assert.equal(root.querySelectorAll('.card').length, 1); assert.match($('.card-fact').textContent, /Студия А/);
});

test('selecting a preset fills filters without starting a search or changing the typed title', async t => {
    const saved = { 'rc-search:preset:v2:test': { version: 2, id: 'test', name: 'На вечер', state: { version: 2, type: 'films', extra: [rule('imdb', 'gte', 7)], advanced: null } } };
    const { w, $, calls } = environment(t, { mount: true, saved }); await tick(); await tick();
    input(w, $('#query'), 'Новый фильм'); const count = calls.length;
    change(w, $('#preset-select'), 'test');
    assert.equal($('#query').value, 'Новый фильм'); assert.equal($('#type').value, 'films'); assert.equal(calls.length, count);
    assert.equal($('#draft-note').hidden, false); assert.equal($('#extra-filters input[type="number"]').value, '7');
});

test('a malformed bookmarked expression does not silently start an unfiltered search', async t => {
    const { $, calls } = environment(t, { mount: true, url: origin + '/search/#rc-search=1&v=2&rules=broken' }); await tick();
    assert.equal(calls.length, 0); assert.equal($('#error').hidden, false); assert.equal($('#more').hidden, true);
    assert.equal($('#more-top').hidden, true); assert.equal($('#stop-top').hidden, true);
    $('#reset').click(); await tick(); await tick(); assert.equal(calls.length, 1); assert.equal($('#error').hidden, true);
});

test('adding a neighbouring rule preserves uncommitted voice text and a collapsed sibling group', async t => {
    const { w, $, S } = environment(t, { mount: true }); await tick(); await tick();
    $('#advanced-filter').click(); const dialog = $('#conditions-dialog');
    clickText(dialog.querySelector('.conditions-body > .condition-group > .group-content > .group-actions'), '+ Условие');
    change(w, dialog.querySelector('.condition-row select'), 'voice');
    input(w, dialog.querySelector('.value-input-row input'), 'Студия А');
    clickText(dialog, '+ Группа');
    assert.equal(dialog.querySelector('.value-chip').textContent, 'Студия А ×');
    const nested = dialog.querySelector('.condition-group .condition-group');
    clickText(nested, '+ Условие'); input(w, dialog.querySelector('.condition-group .condition-group input[type="number"]'), '7');
    clickText(dialog.querySelector('.condition-group .condition-group'), 'Свернуть');
    clickText(dialog.querySelector('.conditions-body > .condition-group > .group-content > .group-actions'), '+ Условие');
    assert.equal(dialog.querySelector('.condition-group .condition-group > .group-content').hidden, true);
    const rootRows = dialog.querySelectorAll('.conditions-body > .condition-group > .group-content > .group-children > .condition-row');
    input(w, rootRows[1].querySelector('input[type="number"]'), '6');
    clickText(dialog, 'Применить'); await tick();
    assert.equal(S.readState(w.location.href).advanced.children[0].values[0], 'Студия А');
});

test('modal keyboard focus stays inside, and dismissing value suggestions does not close the editor', async t => {
    const { w, $, root } = environment(t, { mount: true }); await tick(); await tick();
    $('#advanced-filter').click(); const dialog = $('#conditions-dialog');
    const first = dialog.querySelector('button'), last = dialog.querySelector('.dialog-actions .primary');
    first.focus(); first.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert.equal(root.activeElement, last);
    last.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); assert.equal(root.activeElement, first);
    clickText(dialog, '+ Условие'); change(w, dialog.querySelector('.condition-row select'), 'genre');
    const control = dialog.querySelector('.value-input-row input'); control.focus();
    control.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); assert.equal(dialog.open, true);
    control.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); assert.equal(dialog.open, false);
});

test('preset UI saves, renames, updates and deletes independently while preserving the title query', async t => {
    const { w, $, root, data } = environment(t, { mount: true }); await tick(); await tick();
    input(w, $('#query'), 'Нельзя сохранять в набор');
    change(w, $('#type'), 'series'); clickText($('#preset-controls'), 'Сохранить набор фильтров');
    assert.match(root.querySelector('.preset-summary').textContent, /Сериалы/);
    assert.doesNotMatch(root.querySelector('.preset-summary').textContent, /Нельзя сохранять/);
    assert.match($('#preset-scope').textContent, /Название фильма не сохраняется/);
    const modal = root.querySelector('.preset-dialog'); input(w, $('#preset-name'), 'Сериалы'); clickText(modal, 'Сохранить'); await tick(); await tick();
    let key = Object.keys(data)[0]; assert.equal(data[key].name, 'Сериалы'); assert.equal(data[key].state.type, 'series');
    assert.equal(Object.hasOwn(data[key].state, 'q'), false);
    clickText($('#preset-controls'), 'Переименовать'); input(w, $('#preset-name'), 'Для вечера'); clickText(modal, 'Сохранить'); await tick(); await tick();
    assert.equal(data[key].name, 'Для вечера');
    change(w, $('#type'), 'films'); clickText($('#preset-controls'), 'Обновить условия'); await tick(); await tick();
    assert.equal(data[key].state.type, 'films'); assert.equal($('#query').value, 'Нельзя сохранять в набор');
    clickText($('#preset-controls'), 'Удалить набор'); clickText(modal, 'Отмена'); assert.ok(data[key]);
    clickText($('#preset-controls'), 'Удалить набор'); clickText(modal, 'Удалить'); await tick(); await tick();
    assert.equal(Object.keys(data).length, 0); assert.equal($('#query').value, 'Нельзя сохранять в набор');
});

test('unreadable required ratings retry without caching a false absence; malformed cached details are ignored', async t => {
    const { S, w } = environment(t); let bad = true, requests = 0;
    const state = { extra: [rule('imdb', 'gte', 7)] };
    const search = new S.Search(state, origin, async url => {
        requests++; return url.includes('.html') ? detail({ imdb: bad ? 'changed markup' : '8.0' }) : list();
    });
    await assert.rejects(search.load(), /Не удалось прочитать нужный рейтинг/); assert.equal(search.pending.length, 1);
    bad = false; await search.load(); assert.equal(search.items.length, 1); assert.equal(requests, 3);
    const snapshot = JSON.parse(JSON.stringify(search.snapshot())); snapshot.items[0].details.voices = 'bad';
    assert.equal(new S.Search(state, origin).restore(snapshot), false);
    const other = origin + '/films/fiction/2-test.html';
    w.sessionStorage.setItem('rc-search:detail:v2:' + other, JSON.stringify({ at: Date.now(), data: { countries: [], genres: [] } }));
    assert.equal(S.cachedDetails(other), undefined);
});

test('compact validation targets the value, stays local and clears after correction or removal', async t => {
    const { w, $, root, calls } = environment(t, { mount: true }); await tick(); await tick();
    const before = w.location.href, count = calls.length;
    $('#add-filter').click(); change(w, $('#add-filter-choice'), 'imdb');
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    assert.equal(w.location.href, before); assert.equal(calls.length, count);
    assert.ok($('#extra-filters .invalid-condition'));
    const value = $('#extra-filters input'); assert.equal(root.activeElement, value);
    assert.equal(value.getAttribute('aria-invalid'), 'true');
    assert.match(root.getElementById(value.getAttribute('aria-describedby')).textContent, /от 0 до 10/);
    assert.equal($('#error').hidden, true);
    input(w, value, '11'); assert.ok($('#extra-filters .condition-error'));
    input(w, value, '7'); assert.equal($('#extra-filters .invalid-condition'), null);
    assert.equal(value.hasAttribute('aria-describedby'), false); assert.equal(value.hasAttribute('aria-invalid'), false);
    input(w, value, ''); $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    $('#extra-filters .remove-condition').click();
    assert.equal($('#extra-filters .condition-error'), null); assert.equal($('#error').hidden, true);
});

test('a failed preset save stays open with a recoverable Russian error and no success claim', async t => {
    const { w, $, root } = environment(t, { mount: true }); await tick(); await tick();
    w.chrome.storage.local.set = async () => { throw new Error('QUOTA_BYTES'); };
    clickText($('#preset-controls'), 'Сохранить набор фильтров'); input(w, $('#preset-name'), 'Набор');
    const modal = root.querySelector('.preset-dialog'); clickText(modal, 'Сохранить'); await tick(); await tick();
    assert.equal(modal.open, true); assert.match(modal.querySelector('[role="alert"]').textContent, /Не удалось сохранить/);
    assert.equal(modal.querySelector('.primary').disabled, false); assert.doesNotMatch($('#preset-notice').textContent, /Набор сохранён/);
});

test('modal validation focuses the bad range boundary and expands an empty collapsed group', async t => {
    const { w, $, root } = environment(t, { mount: true }); await tick(); await tick();
    $('#advanced-filter').click(); const dialog = $('#conditions-dialog');
    clickText(dialog, '+ Условие'); clickText(dialog, 'Применить');
    const firstValue = dialog.querySelector('input[type="number"]');
    assert.equal(root.activeElement, firstValue); assert.equal(firstValue.getAttribute('aria-invalid'), 'true');
    input(w, firstValue, '7'); assert.equal(dialog.querySelector('.condition-error'), null);
    change(w, dialog.querySelectorAll('.condition-row select')[1], 'between');
    const [from, to] = dialog.querySelectorAll('input[type="number"]'); input(w, to, '6'); clickText(dialog, 'Применить');
    assert.equal(root.activeElement, to); assert.equal(from.hasAttribute('aria-invalid'), false);
    assert.match(root.getElementById(to.getAttribute('aria-describedby')).textContent, /Верхняя граница/);
    input(w, to, '8'); assert.equal(dialog.querySelector('.condition-error'), null);
    clickText(dialog, '+ Группа'); const nested = dialog.querySelector('.condition-group .condition-group');
    clickText(nested, 'Свернуть'); clickText(dialog, 'Применить');
    assert.equal(nested.querySelector('.group-content').hidden, false);
    assert.equal(root.activeElement.textContent, '+ Условие');
    assert.match(nested.querySelector('.condition-error').textContent, /Добавьте условие/);
    root.activeElement.click();
    assert.equal(dialog.querySelector('.condition-group .condition-group > .group-content').hidden, false);
    assert.equal(dialog.querySelector('.condition-error'), null);
});

test('voice validation retains contextual help after a valid choice and points to the input', async t => {
    const { w, $, root } = environment(t, { mount: true }); await tick(); await tick();
    $('#add-filter').click(); change(w, $('#add-filter-choice'), 'voice');
    const voice = $('#extra-filters input'), helpId = voice.getAttribute('aria-describedby');
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    assert.equal(root.activeElement, voice); assert.equal(voice.getAttribute('aria-invalid'), 'true');
    assert.ok(voice.getAttribute('aria-describedby').split(' ').includes(helpId));
    input(w, voice, 'HDrezka Studio (Украинский)');
    voice.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal($('#extra-filters .condition-error'), null); assert.equal(voice.getAttribute('aria-describedby'), helpId);
    assert.equal(voice.hasAttribute('aria-invalid'), false); assert.match(root.getElementById(helpId).textContent, /не гарантирует.*во всех сериях/);
});

test('editing or deleting an invalid filter never dismisses an independent loading error', async t => {
    const { w, $, root } = environment(t, { mount: true, fetcher: () => { throw new Error('Проверочная ошибка загрузки'); } }); await tick(); await tick();
    const networkMessage = $('#error').textContent; assert.match(networkMessage, /Проверочная ошибка/);
    $('#add-filter').click(); change(w, $('#add-filter-choice'), 'imdb');
    $('#search-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    assert.equal(root.activeElement, $('#extra-filters input'));
    input(w, $('#extra-filters input'), '7'); $('#extra-filters .remove-condition').click();
    assert.equal($('#extra-filters .condition-error'), null);
    assert.equal($('#error').hidden, false); assert.equal($('#error').textContent, networkMessage);
});
