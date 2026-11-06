import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/improvement.js', import.meta.url), 'utf8');
const playerStart = source.indexOf('    function initPlayer() {');
const css = source.slice(playerStart).match(/GM\.addStyle\(`([\s\S]*?)`\);/)?.[1];
assert.ok(css, 'Use the shipped player stylesheet');

// Minimal native PlayerJS structure observed in installed Chrome. These are CSS
// contracts, not a substitute for checking actual video rendering in Chrome.
test('video and poster cannot escape behind the black player background without scaling', t => {
    const dom = new JSDOM(`<!doctype html><style>${css}</style>
        <div id="player" style="position: relative; background: black;">
            <div id="cdnplayer" style="position: relative;">
                <pjsdiv id="oframecdnplayer" style="position: absolute; background: black;">
                    <iframe id="pjsfrrscdnplayer" style="position: absolute;"></iframe>
                    <pjsdiv id="video-layer" style="position: absolute; width: 100%; height: 100%;"><video></video></pjsdiv>
                    <pjsdiv id="poster-layer" style="position: absolute; width: 100%; height: 100%;"></pjsdiv>
                </pjsdiv>
            </div>
        </div>`);
    t.after(() => dom.window.close());
    const { document, getComputedStyle } = dom.window;
    const root = document.getElementById('oframecdnplayer');
    const rootStyle = getComputedStyle(root);
    const containsNegativeLayers = rootStyle.isolation === 'isolate'
        || (rootStyle.zIndex !== '' && rootStyle.zIndex !== 'auto')
        || (rootStyle.transform !== '' && rootStyle.transform !== 'none');
    for (const playing of [false, true]) {
        document.body.classList.toggle('r4-playing', playing);
        for (const id of ['video-layer', 'poster-layer', 'pjsfrrscdnplayer']) {
            const layer = getComputedStyle(document.getElementById(id));
            assert.ok(Number(layer.zIndex) >= 0 || containsNegativeLayers,
                `${id} must not paint behind its opaque player background (playing=${playing})`);
        }
    }
});
