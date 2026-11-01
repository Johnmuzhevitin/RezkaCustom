import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { nativeNavigation } from './helpers/fixtures.mjs';

const source = readFileSync(new URL('../extension/improvement.js', import.meta.url), 'utf8');
const start = source.indexOf('    function initNavbarLinks() {');
const end = source.indexOf('    function initPlayerExtraControls()', start);
assert.ok(start >= 0 && end > start, 'The shipped navbar initializer must be exercised');

function navbar(markup) {
    const dom = new JSDOM(markup.includes('<nav') ? markup : `<nav class="b-topnav">${markup}</nav>`, {
        url: 'https://rezka.fi/collections/', runScripts: 'outside-only'
    });
    let setting;
    dom.window.r4 = { settings: { createTumblerSetting(value) { setting = value; } } };
    dom.window.eval(source.slice(start, end) + '\ninitNavbarLinks();');
    return {
        document: dom.window.document,
        apply: value => setting.options.find(option => option.value === `r4-navbar-links-${value}`).end(),
        close: () => dom.window.close()
    };
}

test('active collection labels do not abort navbar initialization or later genre links', () => {
    const h = navbar(nativeNavigation({ activeCollections: true }));
    try {
        assert.doesNotThrow(() => h.apply('default'));
        assert.doesNotThrow(() => h.apply('popular'));
        assert.equal(h.document.querySelector('span').outerHTML,
            '<span class="b-topnav__item-link single active">Подборки</span>');
        for (const link of h.document.querySelectorAll('a')) {
            assert.equal(new URL(link.href).searchParams.get('filter'), 'popular');
        }
    } finally { h.close(); }
});

test('navbar filtering preserves advanced search and unrelated parameters and skips invalid links', () => {
    const h = navbar(`
        <a id="rc-search-entry" class="b-topnav__item-link" href="/search/?do=search&subaction=search#rc-search=1">Расширенный поиск</a>
        <a id="catalogue" class="b-topnav__item-link" href="/films/?genre=1&filter=soon#list">Фильмы</a>
        <a class="b-topnav__item-link">Без адреса</a>
        <a class="b-topnav__item-link" href="">Пустой адрес</a>
        <a class="b-topnav__item-link" href="#menu">Меню</a>
        <a class="b-topnav__item-link" href="javascript:void(0)">Действие</a>
        <a class="b-topnav__item-link" href="https://[invalid">Некорректный адрес</a>
        <a class="b-topnav__item-link" href="https://example.org/?keep=1">Внешняя ссылка</a>`);
    try {
        const untouched = [...h.document.querySelectorAll('a:not(#catalogue)')];
        const before = untouched.map(link => link.getAttribute('href'));
        assert.doesNotThrow(() => h.apply('popular'));
        assert.equal(h.document.querySelector('#catalogue').href, 'https://rezka.fi/films/?genre=1&filter=popular#list');
        assert.deepEqual(untouched.map(link => link.getAttribute('href')), before);
        h.apply('default');
        assert.equal(h.document.querySelector('#catalogue').href, 'https://rezka.fi/films/?genre=1#list');
        assert.deepEqual(untouched.map(link => link.getAttribute('href')), before);
    } finally { h.close(); }
});
