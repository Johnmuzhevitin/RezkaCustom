// MAIN-world adapter. Validate the requested episode before invoking Rezka's native handler.
// PlayerJS commands: https://playerjs.com/docs/en=apicommands
const RezkaVoiceSwitch = (() => {
    'use strict';
    const numeric = value => /^\d+$/.test(String(value ?? '')) ? String(value) : '';
    const variants = ['camrip', 'ads', 'director'];
    let busy = false;
    const error = code => Object.assign(new Error(code), { code });
    const api = (method, value) => {
        if (typeof CDNPlayer === 'undefined' || typeof CDNPlayer.api !== 'function') throw error('not-ready');
        return CDNPlayer.api(method, value);
    };
    function key(node) {
        return [numeric(node?.dataset.translator_id), ...variants.map(name => numeric(node?.dataset[name]) || '0')].join(':');
    }
    function context() {
        const selected = document.querySelector('#translators-list .b-translator__item.active');
        const episode = document.querySelector('.b-simple_episode__item.active');
        const initialization = [...document.scripts].find(script => /initCDN(?:Series|Movies)Events\(/.test(script.textContent));
        const id = numeric(episode?.dataset.id) || initialization?.textContent.match(/initCDN(?:Series|Movies)Events\(\s*(\d+)/)?.[1];
        const series = !!document.querySelector('#simple-episodes-tabs');
        const season = numeric(episode?.dataset.season_id), number = numeric(episode?.dataset.episode_id);
        if (!id || !selected || (series && (!season || !number))) throw error('not-ready');
        return { id, series, season, number, selected, signature: [id, key(selected), season, number].join('/') };
    }
    function playback() {
        const time = Number(api('time'));
        const playing = api('playing');
        if (!Number.isFinite(time) || time < 0 || typeof playing !== 'boolean') throw error('not-ready');
        return { time, playing, started: api('started') === true };
    }
    async function request(params) {
        const root = typeof dle_root === 'string' ? new URL(dle_root, location.href) : new URL('/', location.href);
        if (root.origin !== location.origin || !/^https?:$/.test(root.protocol)) throw error('unsupported');
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(new URL('ajax/get_cdn_series/', root), {
                method: 'POST', credentials: 'same-origin', signal: controller.signal,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
                body: new URLSearchParams({ ...params, favs: document.querySelector('#ctrl_favs')?.value || '' })
            });
            if (!response.ok) throw error('network');
            const data = await response.json();
            if (!data || data.success !== true) throw error('unavailable');
            if (Number(data.premium_content) === 1) throw error('restricted');
            return data;
        } catch (cause) { throw cause.code ? cause : error('network'); }
        finally { clearTimeout(timer); }
    }
    // Reconstruct only the season/episode controls, never insert arbitrary response HTML.
    function episodeMarkup(data, current, selectedFirst = false) {
        if (typeof data.episodes !== 'string') throw error('unsupported');
        const parsed = new DOMParser().parseFromString(data.episodes, 'text/html');
        const entries = [...parsed.querySelectorAll('li.b-simple_episode__item')].filter(node =>
            numeric(node.dataset.season_id) && numeric(node.dataset.episode_id));
        if (!entries.some(node => node.dataset.season_id === current.season && node.dataset.episode_id === current.number)) throw error('missing-episode');
        const seasonDoc = new DOMParser().parseFromString(String(data.seasons || ''), 'text/html');
        const groups = new Map();
        for (const item of entries) {
            const season = item.dataset.season_id, number = item.dataset.episode_id;
            if (!groups.has(season)) groups.set(season, []);
            if (groups.get(season).some(node => node.dataset.episode_id === number)) throw error('unsupported');
            const node = document.createElement('li');
            node.className = 'b-simple_episode__item';
            node.dataset.id = current.id; node.dataset.season_id = season; node.dataset.episode_id = number;
            node.textContent = item.textContent.trim();
            if (season === current.season && number === current.number) node.classList.add('active');
            groups.get(season).push(node);
        }
        const seasons = document.createElement('div'), episodes = document.createElement('div');
        let order = [...groups.keys()];
        if (selectedFirst) order = [current.season, ...order.filter(value => value !== current.season)];
        for (const season of order) {
            const tab = document.createElement('li');
            tab.className = 'b-simple_season__item'; tab.dataset.tab_id = season;
            tab.textContent = [...seasonDoc.querySelectorAll('.b-simple_season__item')].find(node => node.dataset.tab_id === season)?.textContent.trim() || `Сезон ${season}`;
            if (season === current.season) tab.classList.add('active');
            seasons.append(tab);
            const list = document.createElement('ul');
            list.id = `simple-episodes-list-${season}`; list.className = 'b-simple_episodes__list';
            list.style.display = season === current.season ? 'block' : 'none';
            let nodes = groups.get(season);
            if (selectedFirst && season === current.season) nodes = [...nodes.filter(node => node.classList.contains('active')), ...nodes.filter(node => !node.classList.contains('active'))];
            list.append(...nodes); episodes.append(list);
        }
        return { seasons: seasons.innerHTML, episodes: episodes.innerHTML };
    }
    function media() {
        return document.querySelector('#oframecdnplayer video, #cdnplayer video')
            || document.querySelector('#pjsfrrscdnplayer')?.contentDocument?.querySelector('video');
    }
    async function restore(saved) {
        if (!saved.started && saved.time === 0 && !saved.playing) { api('pause'); return; }
        // Starting silently allows metadata/seek to complete even when the old stream was paused.
        const muted = api('muted') === true;
        if (!saved.playing && !muted) api('mute');
        try {
            api('play');
            const startedAt = Date.now();
            let lastSeek = 0;
            while (Date.now() - startedAt < 10000) {
                const video = media();
                const duration = Number(api('duration'));
                if (video?.error) throw error('playback');
                if ((!video || video.readyState >= 1) && Number.isFinite(duration) && duration > 0) {
                    const target = Math.min(saved.time, Math.max(0, duration - 0.25));
                    if (Date.now() - lastSeek > 700) { api('seek', target); lastSeek = Date.now(); }
                    if (Math.abs(Number(api('time')) - target) < 1.5 && (!video || !video.seeking)) {
                        if (!saved.playing) api('pause');
                        return;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            throw error('playback');
        } finally { if (!saved.playing) api('pause'); if (!saved.playing && !muted) api('unmute'); }
    }
    function commit(target, current, data, markup) {
        if (typeof sof === 'undefined' || typeof sof.ajax !== 'function' || typeof sof.tv?.buildCDNPlayer !== 'function') throw error('unsupported');
        const originalAjax = sof.ajax, originalBuild = sof.tv.buildCDNPlayer;
        let intercepted = false, built = false;
        // Native handlers own private translator/episode state and future next-episode/autosave actions.
        // Supply one prevalidated response synchronously. No global hook survives this click.
        sof.ajax = function(url, params, callback, ...rest) {
            if (!intercepted && String(params?.id) === current.id && String(params?.translator_id) === target.dataset.translator_id
                && params.action === (current.series ? 'get_episodes' : 'get_movie')) {
                intercepted = true;
                if (current.series) { params.season = current.season; params.episode = current.number; }
                callback({ ...data, ...(markup || {}) });
                return;
            }
            return originalAjax.call(this, url, params, callback, ...rest);
        };
        sof.tv.buildCDNPlayer = function(...args) { built = true; return originalBuild.apply(this, args); };
        try { target.click(); }
        finally { sof.ajax = originalAjax; sof.tv.buildCDNPlayer = originalBuild; }
        if (!intercepted || !built) throw error('unsupported');
        if (current.series) {
            const ordered = episodeMarkup(data, current);
            document.querySelector('#simple-seasons-tabs').innerHTML = ordered.seasons;
            document.querySelector('#simple-episodes-tabs').innerHTML = ordered.episodes;
        }
        const after = context();
        if (key(after.selected) !== key(target) || after.season !== current.season || after.number !== current.number) throw error('unsupported');
    }
    async function choose(targetKey) {
        if (busy) throw error('busy');
        const current = context();
        const target = [...document.querySelectorAll('#translators-list li.b-translator__item')].find(node => key(node) === targetKey);
        if (!target || target.classList.contains('disabled')) throw error('unavailable');
        if (target === current.selected) return { ok: true };
        if (typeof sof === 'undefined' || typeof sof.ajax !== 'function') throw error('not-ready');
        playback();
        busy = true;
        let committed = false;
        try {
            const params = { id: current.id, translator_id: target.dataset.translator_id };
            let data, markup;
            if (current.series) {
                data = await request({ ...params, season: current.season, episode: current.number, action: 'get_episodes' });
                markup = episodeMarkup(data, current, true);
                const stream = await request({ ...params, season: current.season, episode: current.number, action: 'get_stream' });
                data = { ...data, ...stream, episodes: data.episodes, seasons: data.seasons };
            } else {
                for (const name of variants) params[`is_${name}`] = numeric(target.dataset[name]) || '0';
                data = await request({ ...params, action: 'get_movie' });
            }
            if (typeof data.url !== 'string' || !data.url.trim()) throw error('unavailable');
            if (context().signature !== current.signature || !target.isConnected) throw error('context-changed');
            const saved = playback();
            committed = true;
            commit(target, current, data, markup);
            await restore(saved);
            return { ok: true };
        } catch (cause) {
            // Preflight failures leave playback and native selection untouched. A post-commit failure
            // must not claim that the old stream is still playing.
            throw error(committed && cause.code !== 'playback' ? 'switch-failed' : cause.code || 'network');
        } finally { busy = false; }
    }
    return { choose, key, context, episodeMarkup };
})();

if (window === window.top && !/\.(home|local)$/.test(location.hostname)
    && (location.hostname.includes('rezka') || ['rezkify.com', 'rezkery.com', 'kinopub.me'].includes(location.hostname))) {
    document.addEventListener('rezka-custom:voice-request', event => {
        let message;
        try { message = JSON.parse(event.detail); } catch { return; }
        if (!message || typeof message.id !== 'string' || message.id.length > 100 || typeof message.key !== 'string' || !/^\d+(?::\d+){3}$/.test(message.key)) return;
        RezkaVoiceSwitch.choose(message.key).then(
            result => document.dispatchEvent(new CustomEvent('rezka-custom:voice-response', { detail: JSON.stringify({ id: message.id, ...result }) })),
            cause => document.dispatchEvent(new CustomEvent('rezka-custom:voice-response', { detail: JSON.stringify({ id: message.id, ok: false, code: cause.code || 'unavailable' }) }))
        );
    });
}
