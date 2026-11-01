/* Read-only, allowlisted diagnostics. Credentials are never opened by this module. */
const RezkaDiagnostics = (() => {
    const statuses = ['watching', 'queued', 'sending', 'confirming', 'checking', 'attention', 'done', 'cancelled'];
    const codes = new Set(['login', 'account', 'token', 'auth', 'identity', 'match', 'manual', 'missing', 'duplicate',
        'progress', 'layout', 'page', 'pending', 'unwatched', 'network', 'rejected', 'validation', 'source', 'paused', 'legacy_rejected']);
    const choice = (value, allowed, fallback = 'unknown') => allowed.includes(value) ? value : fallback;
    const number = (value, max) => Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value * 100) / 100 : null;
    const build = value => value && typeof value.id === 'string' && typeof value.version === 'string'
        && /^[a-f0-9]{64}$/.test(value.id) && /^\d+\.\d+\.\d+$/.test(value.version)
        ? { version: value.version, id: value.id } : null;
    const code = value => codes.has(value) ? value : 'unknown';
    async function bounded(promise) {
        let timer;
        try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve(null), 3000); })]); }
        catch { return null; }
        finally { clearTimeout(timer); }
    }
    async function collect(input) {
        const state = (await chrome.storage.local.get(RezkaMyShows.key))[RezkaMyShows.key] || RezkaMyShows.initial();
        const entries = Array.isArray(state.entries) && typeof state.account === 'string' && state.account
            ? state.entries.filter(entry => entry && entry.account === state.account) : [];
        const counts = Object.fromEntries([...statuses, 'unknown'].map(status => [status, 0]));
        const errorCounts = {};
        for (const entry of entries) {
            counts[choice(entry.status, statuses)]++;
            const value = entry.code || entry.lastError?.code;
            if (value) { const key = code(value); errorCounts[key] = (errorCounts[key] || 0) + 1; }
        }
        const tab = Number.isInteger(input.tabId) ? await bounded(chrome.tabs.get(input.tabId)) : null;
        const supported = !!tab && RezkaNetwork.isSite(tab.url);
        const [page, player] = supported ? await Promise.all([
            bounded(chrome.tabs.sendMessage(tab.id, { type: 'rezka:diagnostic-page' }, { frameId: 0 })),
            bounded(chrome.tabs.sendMessage(tab.id, { type: 'myshows:player-current' }, { frameId: 0 }))
        ]) : [null, null];
        // A navigation/account change during collection makes the snapshot unavailable.
        const latestTab = supported ? await bounded(chrome.tabs.get(tab.id)) : null;
        const latestState = (await chrome.storage.local.get(RezkaMyShows.key))[RezkaMyShows.key] || RezkaMyShows.initial();
        const stable = supported && latestTab?.url === tab.url && latestState.account === state.account
            && latestState.enabled === state.enabled && latestState.connection === state.connection;
        const episode = stable ? RezkaMyShows.validMedia(player?.episode) : null;
        const matchingEpisode = episode && episode.rezkaId === Number(new URL(tab.url).pathname.match(/\/(\d+)-[^/]+\.html$/)?.[1]);
        const key = matchingEpisode ? RezkaMyShows.mediaKey(episode) : null;
        const entry = key ? entries.find(entry => entry.key === key) : null;
        const telemetry = player?.playback;
        const playback = stable && player?.build === REZKA_BUILD.id && state.enabled && state.connection === 'connected'
            && (!entry || entry.status === 'watching') && key && telemetry?.account === state.account && telemetry.key === key
            && Number.isInteger(telemetry.seconds) && telemetry.seconds >= 0 && telemetry.seconds <= RezkaMyShows.positionDelay
            && ['playing', 'paused', 'buffering', 'seeking'].includes(telemetry.state)
            ? { seconds: telemetry.seconds, requiredSeconds: RezkaMyShows.positionDelay, state: telemetry.state } : null;
        const builds = { help: build(input.helpBuild), panel: build(input.panelBuild), worker: build(REZKA_BUILD), page: stable ? build(page?.build) : null };
        const comparison = value => !value ? 'unavailable' : value.id === REZKA_BUILD.id ? 'match' : 'mismatch';
        return {
            schema: 1, collectedAt: new Date().toISOString(), builds,
            buildChecks: { help: comparison(builds.help), panel: comparison(builds.panel), page: comparison(builds.page) },
            page: { state: !tab ? 'not_selected_or_closed' : !supported ? 'unsupported' : !stable ? 'changed_during_collection'
                : page?.connected ? 'responding' : 'unavailable',
                settingErrorCount: stable ? number(page?.errorCount, 10000) : null,
                pendingReloadCount: stable ? number(page?.pendingReloadCount, 10000) : null },
            myshows: { connection: choice(state.connection, ['connected', 'connecting', 'disconnected', 'error']),
                enabled: state.enabled === true, threshold: number(state.threshold, 100), counts, errorCounts,
                current: key ? { status: entry ? choice(entry.status, statuses) : 'not_recorded',
                    progress: number(entry?.progress, 100), watchedProgress: number(entry?.watchedProgress, 100),
                    confirmedPositionSeconds: number(entry?.confirmedPosition, 43200), confirmation: playback,
                    errorCode: entry?.code || entry?.lastError?.code ? code(entry.code || entry.lastError.code) : null } : null }
        };
    }
    return { collect };
})();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rezka:diagnostics') return;
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('help.html')) { respond({ ok: false }); return; }
    RezkaDiagnostics.collect(message).then(report => respond({ ok: true, report }), () => respond({ ok: false }));
    return true;
});
