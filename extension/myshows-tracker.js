(() => {
    'use strict';
    if (window !== window.top || !RezkaNetwork.isSite(location.href)) return;
    const M = RezkaMyShows;
    let config = { enabled: false, account: '' }, previous = null, flushing = false, stopped = false;
    let video = null, lastFlush = 0, generation = 0, lastKey = '', lastSource = '', waitingSource = null;
    const pending = new Map(), finished = new Set();
    const text = selector => document.querySelector(selector)?.textContent.trim() || '';
    function identity() {
        const active = document.querySelector('.b-simple_episode__item.active');
        const id = Number(location.pathname.match(/\/(\d+)-[^/]+\.html$/)?.[1]);
        if (!active || Number(active.dataset.id) !== id) return null;
        let imdb = '';
        for (const link of document.querySelectorAll('.b-post__info a, .b-post__rating a')) {
            try {
                let url = new URL(link.href, location.href);
                if (url.origin === location.origin && url.pathname.startsWith('/help/')) {
                    url = new URL(decodeURIComponent(atob(url.pathname.split('/')[2])));
                }
                if (url.protocol === 'https:' && /(^|\.)imdb\.com$/.test(url.hostname)) imdb = url.pathname.match(/^\/title\/(tt\d+)\/?$/)?.[1] || imdb;
            } catch { /* An unrelated or malformed external link is not an identifier. */ }
        }
        const yearLink = document.querySelector('.b-post__info a[href*="/year/"]');
        return M.validEpisode({ rezkaId: id, season: Number(active.dataset.season_id), number: Number(active.dataset.episode_id),
            title: text('.b-post__title h1') || text('h1'), originalTitle: text('.b-post__origtitle').split(' / ')[0],
            imdb, year: Number(yearLink?.textContent.match(/\d{4}/)?.[0]) });
    }
    async function flush() {
        if (flushing || !pending.size || stopped) return;
        flushing = true;
        try {
            for (const [key, batch] of [...pending]) {
                pending.delete(key);
                try {
                    const reply = await chrome.runtime.sendMessage({ type: 'myshows:progress', account: batch.account,
                        episode: batch.episode, duration: batch.duration, ranges: batch.ranges });
                    if (!reply?.ok) throw new Error('save');
                    if (reply.tracking === false) { finished.add(key); pending.delete(key); }
                } catch {
                    const newer = pending.get(key);
                    if (newer && Math.abs(newer.duration - batch.duration) < 5) newer.ranges = M.mergeRanges([...batch.ranges, ...newer.ranges], newer.duration);
                    else if (!newer) pending.set(key, batch);
                    break;
                }
            }
        } finally { flushing = false; lastFlush = performance.now(); }
    }
    function reset() { previous = null; generation++; }
    function sample() {
        if (stopped || !config.enabled || !config.account) { previous = null; return; }
        const currentVideo = document.querySelector('#cdnplayer video, #player video, video');
        if (video !== currentVideo) {
            video = currentVideo; reset();
            if (video) {
                for (const event of ['seeking', 'emptied', 'loadstart']) video.addEventListener(event, reset);
                for (const event of ['pause', 'ended']) video.addEventListener(event, () => { sample(); flush(); });
            }
        }
        const episode = identity();
        if (!video || !episode || !Number.isFinite(video.duration) || video.duration < 60 || video.duration > 43200) { previous = null; return; }
        const key = M.episodeKey(episode);
        if (key !== lastKey) {
            waitingSource = lastKey && video.currentSrc === lastSource ? lastSource : null;
            previous = null; lastKey = key;
        }
        lastSource = video.currentSrc;
        if (waitingSource !== null) {
            if (video.currentSrc === waitingSource) { previous = null; return; }
            waitingSource = null;
        }
        const batchKey = config.account + ':' + key;
        if (finished.has(batchKey)) { previous = null; return; }
        const current = { key: key + ':' + generation, source: video.currentSrc, time: video.currentTime, wall: performance.now(),
            rate: video.playbackRate, playing: !video.paused && !video.seeking && video.readyState >= 2, seeking: video.seeking };
        const range = M.interval(previous, current);
        previous = current;
        if (range) {
            let batch = pending.get(batchKey);
            if (!batch) { batch = { account: config.account, episode, duration: video.duration, ranges: [] }; pending.set(batchKey, batch); }
            if (Math.abs(batch.duration - video.duration) > 5) batch.ranges = [];
            batch.duration = video.duration;
            batch.ranges = M.mergeRanges([...batch.ranges, range], video.duration);
        }
        if (performance.now() - lastFlush >= 10000) flush();
    }
    function configure(state) {
        const next = { enabled: !!state?.enabled && state?.connection === 'connected', account: state?.account || '' };
        if (next.account !== config.account || next.enabled !== config.enabled) { flush(); reset(); }
        config = next;
    }
    // A manual mark may be requested before playback starts or while tracking is paused.
    // Only the worker can read this snapshot; it rechecks the selected episode on submit.
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (message?.type !== 'myshows:player-current' || sender.id !== chrome.runtime.id || sender.tab) return;
        respond({ episode: identity(), build: REZKA_BUILD.id });
    });
    chrome.storage.local.get(M.key).then(values => configure(values[M.key])).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[M.key]) configure(changes[M.key].newValue); });
    // Episode changes can precede a new media source. Discard the boundary sample.
    new MutationObserver(records => {
        if (records.some(r => r.target instanceof Element && (r.target.matches('.b-simple_episode__item, .b-simple_season__item') || r.target.closest('#simple-episodes-tabs')))) reset();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    const timer = setInterval(() => { try { sample(); } catch { stopped = !chrome.runtime?.id; if (stopped) clearInterval(timer); } }, 1000);
    document.addEventListener('visibilitychange', () => { sample(); flush(); });
    window.addEventListener('pagehide', () => { sample(); flush(); });
})();
