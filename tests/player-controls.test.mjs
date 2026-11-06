import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/improvement.js', import.meta.url), 'utf8');
const start = source.indexOf('    function initPlayerExtraControls() {');
const end = source.indexOf('    function initAutoPlayNext() {', start);
assert.ok(start >= 0 && end > start);

test('retired auto expansion and click zones leave manual player controls functional', t => {
    const dom = new JSDOM('<div class="b-post__title"><h1>Example</h1></div><div id="oframecdnplayer"></div><ul class="b-simple_episodes__list"></ul>', {
        url: 'https://rezka.fi/series/example.html', runScripts: 'outside-only'
    });
    t.after(() => dom.window.close());
    const { window } = dom, { document } = window;
    let next = 0, fits = 0;
    const player = {
        elements: { oframecdnplayer: document.getElementById('oframecdnplayer') },
        state: { fullscreen: false, expanded: false },
        next() { next++; }, prev() {}, startadjusting() {}, stopadjusting() {},
        fit() { fits++; }, season() { return 1; }, episode() { return 2; }
    };
    window.GM = { addStyle() {} };
    window.r4 = { player, images: {},
        settings: { afterStart(callback) { callback(); }, createTumblerSetting() {} },
        utils: { fromHTML(html) { const holder = document.createElement('template'); holder.innerHTML = html; return holder.content.firstElementChild; } }
    };
    window.eval(source.slice(start, end) + '\ninitPlayerExtraControls();');
    window.dispatchEvent(new window.MessageEvent('message', { data: { event: 'init' } }));
    assert.equal(document.querySelectorAll('[class*="r4-player-control-large-"]').length, 0);
    document.querySelector('.r4-player-control-next').click();
    assert.equal(next, 1);
    document.body.classList.add('r4-player-full-page-enabled'); // Even an old class cannot trigger the retired effect.
    window.dispatchEvent(new window.MessageEvent('message', { data: { event: 'play' } }));
    assert.equal(player.state.expanded, false);
    const expand = document.querySelector('.r4-player-control-expand');
    expand.click();
    assert.equal(player.state.expanded, true);
    assert.equal(document.body.classList.contains('r4-player-full-page'), true);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Escape' }));
    assert.equal(player.state.expanded, false);
    assert.equal(document.body.classList.contains('r4-player-full-page'), false);
    assert.equal(fits, 1);
    window.dispatchEvent(new window.MessageEvent('message', { data: { event: 'play' } }));
    assert.equal(player.state.expanded, false);
});
