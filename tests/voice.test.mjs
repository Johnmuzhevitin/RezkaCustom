import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = name => readFileSync(new URL(`../extension/${name}`, import.meta.url), 'utf8');
const episodes = '<ul class="b-simple_episodes__list" id="simple-episodes-list-1"><li class="b-simple_episode__item" data-season_id="1" data-episode_id="1">Серия 1</li></ul><ul class="b-simple_episodes__list" id="simple-episodes-list-2"><li class="b-simple_episode__item" data-season_id="2" data-episode_id="1">Серия 1</li><li class="b-simple_episode__item active" data-id="42" data-season_id="2" data-episode_id="4">Серия 4</li></ul>';
const seasons = '<li class="b-simple_season__item" data-tab_id="1">Сезон 1</li><li class="b-simple_season__item active" data-tab_id="2">Сезон 2</li>';
function harness(t, options = {}) {
    const dom = new JSDOM(`<div class="b-translators__block"><div class="b-translators__title">Выбрать озвучку</div><ul id="translators-list"><li class="b-translator__item active" data-translator_id="19">AniLibria</li><li class="b-translator__item" data-translator_id="1">LostFilm</li><li class="b-translator__item" data-translator_id="359">Студия UA<img title="Украинский"></li></ul></div><div id="player"><ul id="simple-seasons-tabs">${seasons}</ul><div id="simple-episodes-tabs">${episodes}</div><div id="oframecdnplayer"></div></div>`, { url: 'https://rezka.fi/series/42-test.html', runScripts: 'outside-only', pretendToBeVisual: true });
    t.after(() => dom.window.close());
    const w = dom.window, doc = w.document, calls = [], apiCalls = [], storage = {};
    const state = { time: 410, playing: options.playing ?? false, started: true, duration: 1700, muted: false };
    w.URL = URL; w.URLSearchParams = URLSearchParams; w.AbortController = AbortController;
    w.CDNPlayer = { api(method, value) {
        apiCalls.push([method, value]);
        if (method === 'seek') state.time = value;
        if (method === 'play') state.playing = true;
        if (method === 'pause') state.playing = false;
        if (method === 'mute') state.muted = true;
        if (method === 'unmute') state.muted = false;
        return state[method];
    } };
    w.dle_root = '/';
    w.fetch = async (url, init) => {
        const params = Object.fromEntries(init.body); calls.push(params);
        if (options.fetch) return options.fetch(params, state, doc);
        return { ok: true, json: async () => ({ success: true, premium_content: 0, seasons, episodes, url: '[720p]https://media.example/test.mp4' }) };
    };
    const originalAjax = () => { throw new Error('A native network call escaped the prevalidated transaction'); };
    const originalBuild = () => { state.time = 0; state.playing = false; };
    w.sof = { ajax: originalAjax, tv: { buildCDNPlayer: originalBuild } };
    doc.getElementById('translators-list').addEventListener('click', event => {
        const target = event.target.closest('.b-translator__item');
        if (!target || target.classList.contains('active')) return;
        doc.querySelector('.b-translator__item.active').classList.remove('active'); target.classList.add('active');
        const series = !!doc.getElementById('simple-episodes-tabs');
        w.sof.ajax('/ajax/get_cdn_series/', { id: '42', translator_id: target.dataset.translator_id, action: series ? 'get_episodes' : 'get_movie' }, response => {
            if (series) {
                doc.getElementById('simple-seasons-tabs').innerHTML = response.seasons;
                doc.getElementById('simple-episodes-tabs').innerHTML = response.episodes;
                const first = doc.querySelector('.b-simple_episode__item');
                state.nativeSeason = first.dataset.season_id; state.nativeEpisode = first.dataset.episode_id;
            }
            w.sof.tv.buildCDNPlayer();
        });
    });
    w.eval(read('voice-switch.js') + '\nwindow.voice = RezkaVoiceSwitch;');
    const listeners = [];
    w.chrome = { storage: { local: {
        get: async () => ({ ...storage }),
        set: async values => { Object.assign(storage, values); for (const fn of listeners) fn(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {newValue: value}])), 'local'); }
    }, onChanged: { addListener: fn => listeners.push(fn) } } };
    w.eval('var RezkaNetwork = { isSite: () => true };');
    w.HTMLElement.prototype.showPopover = function() { this.removeAttribute('popover'); this.dataset.open = 'true'; };
    w.HTMLElement.prototype.hidePopover = function() { this.setAttribute('popover', 'manual'); delete this.dataset.open; };
    return { w, doc, state, calls, apiCalls, storage, originalAjax, originalBuild, loadUI: () => w.eval(read('voice-menu.js')) };
}

test('a missing episode leaves selection, playback and the native handler untouched', async t => {
    const h = harness(t, { fetch: async () => ({ ok: true, json: async () => ({ success: true, episodes: episodes.slice(0, episodes.indexOf('<ul', 1)), seasons }) }) });
    await assert.rejects(h.w.voice.choose('1:0:0:0'), /missing-episode/);
    assert.equal(h.calls.length, 1);
    assert.equal(h.doc.querySelector('.b-translator__item.active').dataset.translator_id, '19');
    assert.equal(h.state.time, 410); assert.equal(h.state.playing, false);
    assert.equal(h.w.sof.ajax, h.originalAjax);
    assert.equal(h.apiCalls.some(([method]) => ['play', 'pause', 'seek'].includes(method)), false);
});

for (const playing of [true, false]) test(`switch retains the exact episode, position and ${playing ? 'playing' : 'paused'} state`, async t => {
    const h = harness(t, { playing }); h.state.muted = true;
    assert.equal((await h.w.voice.choose('1:0:0:0')).ok, true);
    assert.deepEqual(h.calls.map(p => p.action), ['get_episodes', 'get_stream']);
    assert.ok(h.calls.every(p => p.season === '2' && p.episode === '4'));
    assert.equal(h.state.nativeSeason, '2'); assert.equal(h.state.nativeEpisode, '4');
    assert.equal(h.state.time, 410); assert.equal(h.state.playing, playing); assert.equal(h.state.muted, true);
    assert.equal(h.doc.querySelector('.b-simple_episode__item').dataset.season_id, '1', 'restore natural episode order after the native commit');
    assert.equal(h.doc.querySelector('.b-simple_episode__item.active').dataset.episode_id, '4');
    assert.equal(h.w.sof.ajax, h.originalAjax); assert.equal(h.w.sof.tv.buildCDNPlayer, h.originalBuild);
});

test('late preflight responses cannot switch a different episode, concurrent requests are refused', async t => {
    let release;
    const h = harness(t, { fetch: () => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ success: true, seasons, episodes, url: 'stream' }) }); }) });
    const pending = h.w.voice.choose('1:0:0:0');
    await assert.rejects(h.w.voice.choose('359:0:0:0'), /busy/);
    h.doc.querySelector('.b-simple_episode__item.active').dataset.episode_id = '5';
    release(); await new Promise(resolve => setImmediate(resolve)); release();
    await assert.rejects(pending, /context-changed/);
    assert.equal(h.doc.querySelector('.b-translator__item.active').dataset.translator_id, '19');
});

test('network, premium and malformed responses do not change playback', async t => {
    for (const data of [{ success: false }, { success: true, premium_content: 1 }, { success: true, episodes: 42 }]) {
        const h = harness(t, { fetch: async () => ({ ok: true, json: async () => data }) });
        await assert.rejects(h.w.voice.choose('1:0:0:0'));
        assert.equal(h.state.time, 410); assert.equal(h.doc.querySelector('.b-translator__item.active').dataset.translator_id, '19');
    }
});

test('server episode markup is rebuilt as inert numeric controls', t => {
    const h = harness(t);
    const markup = h.w.voice.episodeMarkup({ episodes: episodes.replace('Серия 4', '<img src=x onerror="evil()">Серия 4<script>evil()</script>'), seasons }, h.w.voice.context());
    assert.doesNotMatch(markup.episodes, /<script|<img|onerror/);
});

test('movie variants retain their flags and an unstarted movie does not autoplay', async t => {
    const h = harness(t);
    h.doc.getElementById('simple-seasons-tabs').remove(); h.doc.getElementById('simple-episodes-tabs').remove();
    const initializer = h.doc.createElement('script'); initializer.textContent = 'sof.tv.initCDNMoviesEvents(42, 19);'; h.doc.body.append(initializer);
    h.doc.querySelector('[data-translator_id="1"]').dataset.director = '1';
    h.state.time = 0; h.state.started = false;
    await h.w.voice.choose('1:0:0:1');
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].action, 'get_movie'); assert.equal(h.calls[0].is_director, '1');
    assert.equal(h.state.playing, false); assert.equal(h.apiCalls.some(([name]) => name === 'play'), false);
});

test('menu search and favorites preserve playback, expose state and recover keyboard focus', async t => {
    const h = harness(t); h.loadUI(); await new Promise(resolve => setImmediate(resolve));
    h.doc.querySelector('.rc-voice-trigger').click();
    const search = h.doc.querySelector('input[type="search"]');
    assert.equal(h.doc.activeElement, search);
    search.value = 'lostfilm'; search.dispatchEvent(new h.w.Event('input'));
    assert.equal(h.doc.querySelectorAll('.rc-voice-row').length, 1);
    h.doc.querySelector('.rc-voice-star').click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.storage['rezka:voice-favorite:1'], true);
    assert.equal(h.doc.querySelector('.rc-voice-group-title').textContent, 'Избранные');
    assert.equal(h.doc.querySelector('.rc-voice-star').getAttribute('aria-pressed'), 'true');
    assert.equal(h.calls.length, 0); assert.equal(h.state.time, 410);
    search.value = 'нет такого'; search.dispatchEvent(new h.w.Event('input'));
    assert.match(h.doc.querySelector('.rc-voice-list').textContent, /Озвучки не найдены/);
    search.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(h.doc.querySelector('.rc-voice-trigger').getAttribute('aria-expanded'), 'false');
    assert.equal(h.doc.activeElement, h.doc.querySelector('.rc-voice-trigger'));
});

test('menu reports missing episode in place and retains its selected voice', async t => {
    const h = harness(t, { fetch: async () => ({ ok: true, json: async () => ({ success: true, episodes: '<ul></ul>', seasons }) }) });
    h.loadUI(); h.doc.querySelector('.rc-voice-trigger').click();
    [...h.doc.querySelectorAll('.rc-voice-choice')].find(node => node.textContent === 'LostFilm').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(h.doc.querySelector('.rc-voice-status').textContent, /нет текущей серии/);
    assert.equal(h.doc.querySelector('.rc-voice-trigger').getAttribute('aria-expanded'), 'true');
    assert.match(h.doc.querySelector('.rc-voice-choice[aria-current="true"]').textContent, /AniLibria/);
});
