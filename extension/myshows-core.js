/* Pure helpers shared by the worker, player observer and offline checks. */
const RezkaMyShows = (() => {
    const key = 'myshows:state';
    const historyUrl = 'https://myshows.me/profile/watch-history/';
    const terminal = new Set(['done', 'cancelled']);
    const active = new Set(['queued', 'sending', 'confirming', 'checking']);
    function initial() {
        return { version: 1, enabled: false, threshold: 90, account: '', connection: 'disconnected', message: '', entries: [] };
    }
    function mergeRanges(ranges, duration) {
        const sorted = ranges.filter(r => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[1] > r[0])
            .map(([a, b]) => [Math.max(0, a), Math.min(duration, b)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
        const result = [];
        for (const range of sorted) {
            const last = result.at(-1);
            // Do not bridge unwatched gaps, even after many seeks/replays.
            if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
            else result.push(range.slice());
        }
        return result;
    }
    function percent(ranges, duration) {
        if (!Number.isFinite(duration) || duration <= 0) return 0;
        return Math.min(100, mergeRanges(ranges, duration).reduce((sum, [a, b]) => sum + b - a, 0) / duration * 100);
    }
    function interval(previous, current) {
        if (!previous || previous.key !== current.key || previous.source !== current.source || !previous.playing || current.seeking) return null;
        const seconds = (current.wall - previous.wall) / 1000;
        const delta = current.time - previous.time;
        if (seconds <= 0 || seconds > 15 || delta <= 0 || delta > seconds * Math.max(previous.rate, current.rate) + .35) return null;
        return [previous.time, current.time];
    }
    function validEpisode(input) {
        if (!input || !Number.isSafeInteger(input.rezkaId) || input.rezkaId <= 0
            || !Number.isInteger(input.season) || input.season < 0 || input.season > 999
            || !Number.isInteger(input.number) || input.number < 1 || input.number > 9999
            || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 300) return null;
        return { rezkaId: input.rezkaId, season: input.season, number: input.number, title: input.title.trim(),
            originalTitle: typeof input.originalTitle === 'string' ? input.originalTitle.trim().slice(0, 300) : '',
            imdb: /^tt\d{5,12}$/.test(input.imdb) ? input.imdb : '',
            year: Number.isInteger(input.year) && input.year >= 1900 && input.year <= 2200 ? input.year : undefined };
    }
    function episodeKey(ep) { return `${ep.rezkaId}:${ep.season}:${ep.number}`; }
    function sourceFor(id) {
        if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) throw new Error('Invalid entry identifier');
        // Keep every UUID bit, but fit inside the 29-character length already accepted by MyShows.
        const bytes = id.replaceAll('-', '').match(/../g).map(value => parseInt(value, 16));
        return 'Rezka-' + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    }
    function label(ep) { return `S${String(ep.season).padStart(2, '0')}E${String(ep.number).padStart(2, '0')}`; }
    function canForce(entry) {
        return !entry || (!entry.submittedAt && !entry.manualPending && ['watching', 'queued', 'attention', 'cancelled'].includes(entry.status));
    }
    function canCancel(entry) { return !!entry && ['watching', 'queued', 'sending', 'confirming', 'checking', 'attention'].includes(entry.status); }
    function canResume(entry) { return entry?.status === 'cancelled' && !entry.submittedAt; }
    function payload(entry, version) {
        const show = { title: entry.episode.originalTitle || entry.episode.title, ids: { imdb: entry.episode.imdb } };
        if (entry.episode.year) show.year = entry.episode.year;
        return { progress: entry.manualAt ? 100 : Math.min(100, Math.ceil(entry.progress * 10) / 10), source_app: entry.source,
            app_version: version, show, episode: { season: entry.episode.season, number: entry.episode.number } };
    }
    function transition(entry, status, reason = '', now = Date.now()) {
        if (entry.status !== status || entry.reason !== reason) {
            entry.events = [...(entry.events || []), { status, reason, at: now }].slice(-30);
        }
        entry.status = status; entry.reason = reason; entry.updatedAt = now;
        return entry;
    }
    return { key, historyUrl, terminal, active, initial, mergeRanges, percent, interval, validEpisode, episodeKey, sourceFor, label, canForce, canCancel, canResume, payload, transition };
})();
