import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/improvement.js', import.meta.url), 'utf8');
const start = source.indexOf('    function initContentSizeTumbler() {');
const end = source.indexOf('    function initPlayerNoMargin() {', start);
assert.ok(start >= 0 && end > start);

function contentSize(t, head = '') {
    const dom = new JSDOM(`<!doctype html><head>${head}</head><body><div class="b-wrapper"></div></body>`, {
        url: 'https://rezka.fi/series/drama/42-test.html', runScripts: 'outside-only'
    });
    t.after(() => dom.window.close());
    const { window } = dom, callbacks = [], settings = [];
    window.GM = { addStyle() {} };
    window.r4 = { player: { fit() {} }, settings: {
        afterStart(callback) { callbacks.push(callback); },
        createTumblerSetting(setting) { settings.push(setting); }
    } };
    window.eval(source.slice(start, end) + '\ninitContentSizeTumbler();');
    return { document: window.document, settings, start: () => callbacks.forEach(callback => callback()) };
}

test('content-size initialization tolerates a missing viewport without creating a forced layout', t => {
    const app = contentSize(t);
    assert.doesNotThrow(app.start, 'The real settings callback must not call setAttribute on a missing viewport');
    assert.equal(app.document.querySelector('meta[name=viewport]'), null);
    assert.equal(app.settings.find(setting => setting.name === 'content-size').options.length, 6);
});

test('content-size initialization retains the existing viewport behavior when the tag is present', t => {
    const app = contentSize(t, '<meta name="viewport" content="width=device-width, initial-scale=1">');
    app.start(); app.start();
    assert.equal(app.document.querySelectorAll('meta[name=viewport]').length, 1);
    assert.equal(app.document.querySelector('meta[name=viewport]').content, 'width=640');
});

test('a viewport removed before settings start cannot break content-size initialization', t => {
    const app = contentSize(t, '<meta name="viewport" content="width=device-width">');
    app.document.querySelector('meta').remove();
    assert.doesNotThrow(app.start);
});
