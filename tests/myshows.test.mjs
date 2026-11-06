import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL('../extension/' + file, import.meta.url), 'utf8');
const pure = vm.createContext({ URL, Set, Date, btoa });
vm.runInContext(read('myshows-core.js') + '\nglobalThis.M = RezkaMyShows;', pure);
const { M } = pure;
const copy = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
    for (let i = 0; i < 250; i++) { if (predicate()) return; await tick(); }
    throw new Error('Expected state was not reached');
}
const episode = { rezkaId: 123, title: 'Example show', originalTitle: 'Example', season: 1, number: 2, imdb: 'tt1234567', year: 2020 };
const source = M.sourceFor('00000000-0000-4000-8000-000000000001');
function entry(overrides = {}) {
    return { id: 'test-entry', source, key: '123:1:2', account: 'testuser', episode, duration: 1000, progress: 90,
        ranges: [[0, 900]], status: 'queued', createdAt: 1, updatedAt: 1, events: [], ...overrides };
}

test('coverage is a union: replay, overlap and repeated batches cannot fill skipped footage', () => {
    assert.equal(M.percent([[0, 200], [100, 250], [800, 1000], [0, 200]], 1000), 45);
    assert.equal(M.percent([[0, 200], [201, 202], [204, 300]], 1000), 29.7);
    assert.equal(M.percent([[-50, 100], [900, 5000], [NaN, 50]], 1000), 20);
});

test('elapsed playback rejects seek-to-end, pauses, source/episode changes and sleeping tabs', () => {
    const before = { key: 'a', source: 'video-1', time: 100, wall: 10000, rate: 1, playing: true };
    const after = { ...before, time: 101, wall: 11000 };
    assert.deepEqual(copy(M.interval(before, after)), [100, 101]);
    for (const changed of [{ time: 999 }, { seeking: true }, { key: 'b' }, { source: 'video-2' }, { wall: 90000 }]) {
        assert.equal(M.interval(before, { ...after, ...changed }), null);
    }
    assert.equal(M.interval({ ...before, playing: false }, after), null);
    assert.deepEqual(copy(M.interval({ ...before, rate: 2 }, { ...after, rate: 2, time: 102 })), [100, 102]);
});

test('episode identities reject invalid numbers and never accept arbitrary ID fields', () => {
    assert.equal(M.validMedia({ ...episode, number: -1 }), null);
    assert.equal(M.validMedia({ ...episode, season: NaN }), null);
    const sanitized = M.validMedia({ ...episode, imdb: 'https://attacker.test', myshow: 55, token: 'secret' });
    assert.equal(sanitized.imdb, '');
    assert.equal(sanitized.myshow, undefined);
    assert.equal(sanitized.token, undefined);
});

// Service-worker integration harness: real module and message boundaries, fake remote service/IDB.
async function worker({ rows = [entry()], enabled = true, account = 'testuser', remoteAccount = account,
    response = { status: 200, data: { action: 'scrobble', match: 'exact', objectType: 'episode', objectId: 987, id: 1 } },
    reconcile = { ok: true, episodeId: 987, approved: true }, watched = true, values: existing, playerEpisode = episode,
    tabStatus = 'complete', fastPageWait = false, playerPlayback = null } = {}) {
    const values = existing || { [M.key]: { ...M.initial(), account, enabled, connection: 'connected', entries: rows } };
    const messages = [], calls = [], tabs = new Map();
    let listener, onAlarm, tabCounter = 0, credential = { account, token: 'synthetic-token-for-tests' };
    const indexedDB = {
        open() {
            const request = {};
            queueMicrotask(() => {
                request.result = { close() {}, transaction() {
                    const tx = { objectStore() { return {
                        get() { const result = { result: credential }; queueMicrotask(() => tx.oncomplete()); return result; },
                        put(value) { credential = value; const result = {}; queueMicrotask(() => tx.oncomplete()); return result; },
                        delete() { credential = null; const result = {}; queueMicrotask(() => tx.oncomplete()); return result; }
                    }; } };
                    return tx;
                } };
                request.onsuccess();
            });
            return request;
        }
    };
    const chrome = {
        runtime: { id: 'extension-id', getURL: file => 'chrome-extension://extension-id/' + file, onMessage: { addListener(fn) { listener = fn; } } },
        storage: { local: {
            async get(key) { return copy(key ? { [key]: values[key] } : values); },
            async set(update) { Object.assign(values, copy(update)); }
        } },
        alarms: { async create() {}, onAlarm: { addListener(fn) { onAlarm = fn; } } },
        tabs: {
            async create(options) { const tab = { id: ++tabCounter, status: tabStatus, ...options }; tabs.set(tab.id, tab); return tab; },
            async get(id) { if (!tabs.has(id)) throw new Error('closed'); return tabs.get(id); },
            async remove(id) { tabs.delete(id); },
            async reload() {},
            async update(id, updates) { Object.assign(tabs.get(id), updates); },
            async sendMessage(id, message) {
                messages.push(copy(message));
                if (message.type === 'myshows:player-current') return { episode: typeof playerEpisode === 'function' ? playerEpisode() : playerEpisode,
                    playback: typeof playerPlayback === 'function' ? playerPlayback() : playerPlayback, build: 'test-build' };
                if (message.type === 'myshows:site-account') return { ok: true, account: remoteAccount };
                if (message.type === 'myshows:site-connect') return { ok: true, account: remoteAccount, token: 'synthetic-connected-token' };
                if (message.type === 'myshows:site-reconcile') return typeof reconcile === 'function' ? reconcile(message) : reconcile;
                if (message.type === 'myshows:site-verify') return { ok: true, watched };
                throw new Error('Unexpected site message');
            }
        }
    };
    const context = vm.createContext({ chrome, indexedDB, URL, Date, Set, Map, Promise, crypto: webcrypto, AbortController, btoa,
        setTimeout: fastPageWait ? (fn, ms) => ms === 300 ? queueMicrotask(fn) : setTimeout(fn, ms) : setTimeout,
        clearTimeout, rulesReady: Promise.resolve(), REZKA_BUILD: { version: 'test', id: 'test-build' },
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.endsWith('/check')) return { status: 200, ok: true };
            if (typeof response === 'function') return response(url, options);
            return { status: response.status, ok: response.status < 300, json: async () => response.data };
        }
    });
    vm.runInContext(read('network-policy.js') + '\n' + read('myshows-core.js') + '\n' + read('myshows-worker.js'), context);
    await until(() => !!onAlarm);
    for (let i = 0; i < 20; i++) await tick();
    const send = (message, sender = { id: 'extension-id', url: chrome.runtime.getURL('popup.html') }) => new Promise(resolve => {
        const result = listener(message, sender, resolve);
        if (result !== true) resolve({ ok: false });
    });
    return { values, get state() { return values[M.key]; }, messages, calls, tabs, send, alarm: () => onAlarm({ name: 'rezka-myshows-sync' }) };
}

test('threshold configuration accepts every whole percentage from 1 to 100 and persists across restart', async () => {
    const w = await worker({ enabled: false, rows: [] });
    for (let threshold = 1; threshold <= 100; threshold++) {
        assert.equal((await w.send({ type: 'myshows:configure', threshold })).ok, true);
        assert.equal(w.state.threshold, threshold);
    }
    for (const threshold of [0, -1, 101, 37.5, NaN, Infinity, '37', null, true]) {
        await w.send({ type: 'myshows:configure', threshold });
        assert.equal(w.state.threshold, 100);
    }
    await w.send({ type: 'myshows:configure', threshold: 37 });
    const restarted = await worker({ values: w.values });
    assert.equal(restarted.state.threshold, 37);
    assert.equal(restarted.calls.length, 0);
});

test('custom threshold queues only eligible watching entries at or above the selected percentage', async () => {
    const w = await worker({ enabled: false, rows: [
        entry({ id: 'below', status: 'watching', progress: 36.9 }),
        entry({ id: 'equal', status: 'watching', progress: 37 }),
        entry({ id: 'above', status: 'watching', progress: 38 }),
        entry({ id: 'other', status: 'watching', progress: 90, account: 'another' }),
        entry({ id: 'done', status: 'done' }), entry({ id: 'cancelled', status: 'cancelled' })
    ] });
    await w.send({ type: 'myshows:configure', threshold: 37 });
    assert.deepEqual(w.state.entries.map(e => e.status), ['watching', 'queued', 'queued', 'watching', 'done', 'cancelled']);
    assert.deepEqual(w.state.entries.filter(e => e.status === 'queued').map(e => e.threshold), [37, 37]);
    assert.equal(w.calls.length, 0, 'changing the threshold must not enable automatic marks');
});

test('exact matches submit once, confirm only their own record, verify watched state and persist history', async () => {
    const w = await worker();
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.calls.length, 1);
    assert.equal(w.calls[0].url, 'https://myshows.me/scrobble/stop');
    assert.equal(w.calls[0].options.redirect, 'error');
    assert.equal(w.calls[0].options.credentials, 'omit');
    const command = w.messages.find(m => m.type === 'myshows:site-reconcile');
    assert.equal(command.source, source);
    assert.equal(command.episodeId, 987);
    assert.equal(command.allowApprove, true);
    assert.deepEqual(w.state.entries[0].events.map(e => e.status), ['sending', 'confirming', 'checking', 'done']);
    assert.equal(JSON.stringify(w.values).includes('token'), false);
    w.alarm(); await tick(); assert.equal(w.calls.length, 1);
    assert.equal(w.tabs.size, 0);
});

test('a title without IMDb reaches MyShows matching instead of the identity dead end', async t => {
    for (const kind of ['episode', 'movie']) await t.test(kind, async () => {
        const media = M.validMedia({ ...episode, originalTitle: '', imdb: '', ...(kind === 'movie'
            ? { kind, season: undefined, number: undefined } : {}) });
        const idField = kind === 'movie' ? 'movieId' : 'episodeId';
        const w = await worker({ rows: [entry({ episode: media, key: M.mediaKey(media) })],
            response: { status: 200, data: { action: 'scrobble', match: 'exact', objectType: kind, objectId: 987 } },
            reconcile: { ok: false, code: 'manual' } });
        await until(() => w.state.entries[0].status === 'attention');
        assert.equal(w.calls.length, 1, w.state.entries[0].reason);
        const body = JSON.parse(w.calls[0].options.body);
        assert.deepEqual(body[kind === 'movie' ? 'movie' : 'show'], { title: media.title, year: media.year, ids: {} });
        assert.deepEqual(body.episode, kind === 'movie' ? undefined : { season: media.season, number: media.number });
        assert.equal(w.state.entries[0].code, 'manual');
        assert.equal(w.state.entries[0].exact, false);
        assert.equal(w.state.entries[0][idField], undefined, 'a title-only guess must not pin the user to a wrong match');
        assert.equal(w.messages.find(m => m.type === 'myshows:site-reconcile').allowApprove, false);
        await w.send({ type: 'myshows:retry', id: 'test-entry' });
        await until(() => w.state.entries[0].status === 'attention');
        assert.equal(w.calls.length, 1, 'pending native confirmation must not send a duplicate');

        const restarted = await worker({ values: w.values, reconcile: { ok: true, [idField]: 654, approved: true } });
        await restarted.send({ type: 'myshows:retry', id: 'test-entry' });
        await until(() => restarted.state.entries[0].status === 'done');
        assert.equal(restarted.calls.length, 0);
        assert.equal(restarted.state.entries[0][idField], 654, 'accept the corrected native match after manual confirmation');
        assert.equal(restarted.messages.find(m => m.type === 'myshows:site-reconcile').allowApprove, false);
        assert.ok(restarted.messages.some(m => m.type === 'myshows:site-verify' && m[idField] === 654));
    });
});

test('retry recovers a saved missing-IMDb error while automatic marks stay paused', async () => {
    const old = entry({ episode: { ...episode, imdb: '' }, status: 'attention', code: 'identity', manualAt: 1,
        reason: 'На странице нет идентификатора IMDb. Автоматическое сопоставление недоступно.' });
    const w = await worker({ enabled: false, rows: [old], reconcile: { ok: false, code: 'manual' } });
    assert.equal(w.calls.length, 0);
    await w.send({ type: 'myshows:retry', id: old.id });
    await until(() => w.state.entries[0].code === 'manual');
    assert.equal(w.calls.length, 1);
    assert.equal(w.state.enabled, false);
    assert.equal(w.state.entries[0].id, old.id);
    assert.equal(w.state.entries[0].source, old.source);
    assert.equal(JSON.parse(w.calls[0].options.body).progress, 100);
});

test('title matching requires a release year when IMDb is missing', async () => {
    const w = await worker({ rows: [entry({ episode: { ...episode, imdb: '', year: undefined } })] });
    await until(() => w.state.entries[0].status === 'attention');
    assert.equal(w.state.entries[0].code, 'identity');
    assert.match(w.state.entries[0].reason, /название и год/);
    assert.equal(w.state.entries[0].submittedAt, undefined);
    assert.equal(w.calls.length, 0);
});

test('unreadable POST response reconciles without approving an unverified match or resubmitting', async () => {
    const w = await worker({ response: () => { throw new Error('socket lost after commit'); }, reconcile: { ok: false, code: 'manual' } });
    await until(() => w.state.entries[0].status === 'attention');
    assert.equal(w.calls.length, 1);
    assert.equal(w.messages.find(m => m.type === 'myshows:site-reconcile').allowApprove, false);
    await w.send({ type: 'myshows:retry', id: 'test-entry' });
    await until(() => w.state.entries[0].status === 'attention');
    assert.equal(w.calls.length, 1);
});

test('restart after saving intent reads the remote journal and never issues a second POST', async () => {
    const w = await worker({ rows: [entry({ status: 'sending', submittedAt: 1 })] });
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.calls.length, 0);
    assert.equal(w.messages.find(m => m.type === 'myshows:site-reconcile').allowApprove, false);
});

test('ambiguous matches require native mapping; approved history alone is not reported as watched', async () => {
    const w = await worker({ response: { status: 200, data: { action: 'scrobble', match: 'fuzzy', objectType: 'episode', objectId: 999 } }, watched: false });
    await until(() => w.state.entries[0].code === 'unwatched');
    assert.equal(w.state.entries[0].status, 'checking');
    assert.equal(w.messages.find(m => m.type === 'myshows:site-reconcile').allowApprove, false);
    assert.ok(w.state.entries[0].nextAt > Date.now());
});

test('different browser account pauses before any write and retains its queue', async () => {
    const w = await worker({ remoteAccount: 'someoneelse' });
    await until(() => w.state.enabled === false);
    assert.equal(w.calls.length, 0);
    assert.equal(w.state.entries[0].status, 'attention');
    assert.equal(w.state.entries[0].code, 'account');
});

test('rate limits are retried with backoff; revoked tokens pause until reconnect', async () => {
    for (const status of [429, 401]) {
        const w = await worker({ response: { status } });
        await until(() => w.state.entries[0].nextAt > Date.now());
        assert.equal(w.state.entries[0].submittedAt, undefined);
        assert.equal(w.state.entries[0].status, 'queued');
        w.alarm(); await tick(); assert.equal(w.calls.length, 1);
        if (status === 401) { assert.equal(w.state.enabled, false); assert.equal(w.state.connection, 'error'); }
    }
});

test('generated source fits the verified API length and does not hit sourceApp:len', async () => {
    const w = await worker({ rows: [], enabled: false, response: async (url, options) => {
        const body = JSON.parse(options.body);
        // Captured production response for the 51-character source from versions 0.6.0/0.6.1.
        if (body.source_app.length > 29) return { status: 400, ok: false, json: async () => ({ error: 'validation failed: map[sourceApp:len]' }) };
        return { status: 200, ok: true, json: async () => ({ action: 'scrobble', match: 'exact', objectType: 'episode', objectId: 987, id: 1 }) };
    } });
    w.tabs.set(99, { id: 99, active: true, status: 'complete', url: 'https://rezka.fi/series/test/123-example.html' });
    await w.send({ type: 'myshows:force', tabId: 99, key: '123:1:2', account: 'testuser' });
    await until(() => ['done', 'attention'].includes(w.state.entries[0]?.status));
    assert.equal(w.state.entries[0].status, 'done');
    assert.ok(JSON.parse(w.calls[0].options.body).source_app.length <= 29);
});

test('definite validation rejection stays retryable and never searches history for a nonexistent record', async () => {
    let accepted = false;
    const w = await worker({ response: async () => ({ status: accepted ? 200 : 400, ok: accepted, json: async () => accepted
        ? { action: 'scrobble', match: 'exact', objectType: 'episode', objectId: 987, id: 1 }
        : { error: 'validation failed: map[sourceApp:len]' } }) });
    await until(() => w.state.entries[0].status === 'attention');
    assert.equal(w.state.entries[0].submittedAt, undefined);
    assert.equal(w.state.entries[0].lastError?.httpStatus, 400);
    assert.equal(w.state.entries[0].lastError?.field, 'source_app');
    accepted = true;
    await w.send({ type: 'myshows:retry', id: 'test-entry' });
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.calls.length, 2);
    assert.equal(w.messages.filter(m => m.type === 'myshows:site-reconcile').length, 1);
});

test('ready content scripts can synchronize while unrelated page resources keep the tab loading', async () => {
    const w = await worker({ tabStatus: 'loading', fastPageWait: true });
    await until(() => w.state.entries[0].status === 'done' || w.state.entries[0].code === 'page');
    assert.equal(w.state.entries[0].status, 'done');
});

test('legacy validation failures recover once; cancelled and uncertain submissions are not re-sent', async () => {
    const legacySource = 'Rezka Custom · 00000000-0000-4000-8000-000000000001';
    const rejectedEvent = { status: 'attention', reason: 'MyShows отклонил запись. Проверьте доступность скробблинга в аккаунте.', at: 2 };
    const rows = [
        entry({ source: legacySource, status: 'checking', submittedAt: 1, manualAt: 1, nextAt: Date.now() + 9999999, events: [rejectedEvent] }),
        entry({ id: 'cancelled', source: legacySource, status: 'cancelled', submittedAt: 1, manualAt: 1, events: [rejectedEvent] }),
        entry({ id: 'uncertain', source: legacySource, status: 'attention', submittedAt: 1, events: [{ status: 'checking', reason: 'Ответ MyShows не получен.', at: 2 }] })
    ];
    const w = await worker({ rows });
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.calls.length, 1);
    assert.ok(w.state.entries[0].source.length <= 29);
    assert.equal(w.state.entries[1].status, 'cancelled');
    assert.equal(w.state.entries[2].status, 'attention');
    assert.equal(w.state.entries[2].source, legacySource);
    assert.equal(w.state.entries[2].submittedAt, 1);
    const restart = await worker({ values: w.values });
    assert.equal(restart.calls.length, 0);
});

test('compact sources preserve the complete UUID and remain distinct for its final bits', () => {
    const first = M.sourceFor('00000000-0000-4000-8000-000000000001');
    const second = M.sourceFor('00000000-0000-4000-8000-000000000002');
    assert.notEqual(first, second);
    assert.equal(first.length, 28);
    const bytes = Buffer.from(first.slice(6), 'base64url');
    assert.equal(bytes.toString('hex'), '00000000000040008000000000000001');
});

test('cancellation during a POST survives late success, rejection and rate limiting without confirmation', async () => {
    for (const status of [200, 400, 429]) {
        let finish;
        const w = await worker({ response: () => new Promise(resolve => { finish = resolve; }) });
        assert.equal(w.state.entries[0].status, 'sending');
        await w.send({ type: 'myshows:cancel', id: 'test-entry' });
        assert.equal(w.state.entries[0].status, 'cancelled');
        finish({ status, json: async () => ({ action: 'scrobble', match: 'exact', objectType: 'episode', objectId: 987, id: 1 }) });
        for (let i = 0; i < 20; i++) await tick();
        assert.equal(w.tabs.size, 0);
        assert.equal(w.state.entries[0].status, 'cancelled');
        assert.equal(w.messages.some(m => m.type === 'myshows:site-reconcile'), false);
        w.alarm(); await tick(); assert.equal(w.calls.length, 1);
    }
});

test('cancelling a pending history check closes its tab and ignores the late result', async () => {
    let finish;
    const w = await worker({ rows: [entry({ status: 'checking', submittedAt: 1 })], reconcile: () => new Promise(resolve => { finish = resolve; }) });
    await w.send({ type: 'myshows:cancel', id: 'test-entry' });
    assert.equal(w.state.entries[0].status, 'cancelled');
    assert.equal(w.tabs.size, 0);
    finish({ ok: true, approved: true, episodeId: 987 });
    for (let i = 0; i < 20; i++) await tick();
    assert.equal(w.state.entries[0].status, 'cancelled');
    assert.equal(w.messages.some(m => m.type === 'myshows:site-verify'), false);
    assert.equal(w.calls.length, 0);
});

test('resuming a cancelled unsent manual episode restores measured tracking without forcing a mark', async () => {
    const w = await worker({ enabled: false, rows: [entry({ status: 'cancelled', progress: 10, ranges: [[0, 100]], manualAt: 1, threshold: 100 })] });
    const result = await w.send({ type: 'myshows:resume', id: 'test-entry', account: 'testuser' });
    assert.equal(result.ok, true);
    assert.equal(w.state.entries[0].status, 'watching');
    assert.equal(w.state.entries[0].manualAt, undefined);
    assert.equal(w.state.entries[0].manualPending, false);
    assert.equal(w.state.entries[0].progress, 10);
    assert.deepEqual(w.state.entries[0].ranges, [[0, 100]]);
    assert.equal(w.state.enabled, false);
    assert.equal(w.calls.length, 0);
    const uncertain = await worker({ enabled: false, rows: [entry({ status: 'cancelled', submittedAt: 1 })] });
    assert.equal((await uncertain.send({ type: 'myshows:resume', id: 'test-entry', account: 'testuser' })).ok, false);
    assert.equal(uncertain.state.entries[0].status, 'cancelled');
});

test('progress validates sender, binds URL to episode and deduplicates across tabs and restarts', async () => {
    const w = await worker({ rows: [], enabled: false });
    w.state.enabled = true;
    const message = { type: 'myshows:progress', episode, account: 'testuser', duration: 1000, ranges: [[0, 500]] };
    const sender = { id: 'extension-id', tab: { id: 10 }, frameId: 0, url: 'https://rezka.fi/series/test/123-example.html' };
    assert.equal((await w.send(message, { ...sender, url: 'https://attacker.test/' })).ok, false);
    assert.equal((await w.send(message, { ...sender, frameId: 1 })).ok, false);
    assert.equal((await w.send({ ...message, episode: { ...episode, rezkaId: 124 } }, sender)).ok, false);
    await w.send(message, sender); await w.send(message, { ...sender, tab: { id: 11 } });
    assert.equal(w.state.entries.length, 1); assert.equal(w.state.entries[0].progress, 50);
    await w.send({ ...message, account: 'another' }, sender); assert.equal(w.state.entries.length, 1);
    await w.send({ ...message, ranges: [[500, 900]] }, sender);
    await until(() => w.state.entries[0].status === 'done');
    await w.send(message, sender); assert.equal(w.state.entries.length, 1); assert.equal(w.calls.length, 1);
    const restarted = await worker({ values: w.values });
    await restarted.send(message, sender); assert.equal(restarted.calls.length, 0);
});

test('disabled and cancelled episodes do not write; changing a cut discards incompatible coverage', async () => {
    const w = await worker({ rows: [entry({ status: 'cancelled' })], enabled: false });
    assert.equal(w.calls.length, 0);
    const sender = { id: 'extension-id', tab: { id: 10 }, frameId: 0, url: 'https://rezka.fi/series/test/123-example.html' };
    const message = { type: 'myshows:progress', episode, account: 'testuser', duration: 1000, ranges: [[0, 950]] };
    await w.send(message, sender); assert.equal(w.state.entries[0].status, 'cancelled');
    w.state.entries = [entry({ status: 'watching', ranges: [[0, 500]], progress: 50 })]; w.state.enabled = true;
    await w.send({ ...message, duration: 1500, ranges: [[700, 800]] }, sender);
    assert.equal(Math.round(w.state.entries[0].progress), 7); assert.equal(w.calls.length, 0);
});

test('confirmed positions survive rewind and restart without fabricating played ranges, and reset for a different cut', async () => {
    const w = await worker({ rows: [] });
    const sender = { id: 'extension-id', tab: { id: 10 }, frameId: 0, url: 'https://rezka.fi/series/test/123-example.html' };
    const message = { type: 'myshows:progress', episode, account: 'testuser', duration: 1000, ranges: [[670, 700]], confirmedPosition: 700 };
    assert.equal((await w.send(message, sender)).ok, true);
    assert.equal(w.state.entries[0].progress, 70);
    assert.equal(w.state.entries[0].watchedProgress, 3);
    assert.deepEqual(w.state.entries[0].ranges, [[670, 700]]);
    const restarted = await worker({ values: w.values });
    await restarted.send({ ...message, ranges: [[100, 130]], confirmedPosition: 130 }, sender);
    assert.equal(restarted.state.entries[0].progress, 70);
    assert.equal(restarted.state.entries[0].watchedProgress, 6);
    await restarted.send({ ...message, duration: 1500, ranges: [[130, 140]], confirmedPosition: 0 }, sender);
    assert.equal(restarted.state.entries[0].confirmedPosition, 0);
    assert.ok(restarted.state.entries[0].progress < 1);
    for (const confirmedPosition of [-1, NaN, 1001, '700', 800]) {
        assert.equal((await restarted.send({ ...message, confirmedPosition }, sender)).ok, false);
    }
    assert.equal(restarted.calls.length, 0);
});

test('manual mark bypasses threshold while preserving actual progress and keeping automatic sync paused', async () => {
    const auto = entry({ id: 'other', key: '123:1:3', episode: { ...episode, number: 3 } });
    const w = await worker({ enabled: false, rows: [entry({ status: 'watching', progress: 12, ranges: [[0, 120]] }), auto] });
    const request = { type: 'myshows:force', id: 'test-entry', account: 'testuser' };
    const results = await Promise.all([w.send(request), w.send(request)]);
    assert.ok(results.every(result => result.ok));
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(JSON.parse(w.calls[0].options.body).progress, 100);
    assert.equal(w.state.entries[0].progress, 12);
    assert.ok(w.state.entries[0].manualAt);
    assert.equal(w.state.enabled, false);
    assert.equal(w.state.entries[1].status, 'queued');
    assert.equal(w.calls.length, 1);
    assert.match(w.state.entries[0].events[0].reason, /ручная отметка/);
    await w.send(request); w.alarm(); await tick(); assert.equal(w.calls.length, 1);
});

test('manual mark can add the selected episode before video starts, without fabricating played ranges', async () => {
    const w = await worker({ rows: [], enabled: false });
    w.tabs.set(99, { id: 99, active: true, status: 'complete', url: 'https://rezka.fi/series/test/123-example.html' });
    const current = await w.send({ type: 'myshows:current', tabId: 99 });
    assert.equal(current.current.key, '123:1:2');
    const reply = await w.send({ type: 'myshows:force', tabId: 99, key: current.current.key, account: 'testuser', episode: { ...episode, number: 55 } });
    assert.equal(reply.ok, true);
    await until(() => w.state.entries[0]?.status === 'done');
    assert.equal(w.state.entries[0].episode.number, 2);
    assert.equal(w.state.entries[0].origin, 'manual');
    assert.equal(w.state.entries[0].progress, 0);
    assert.deepEqual(w.state.entries[0].ranges, []);
    assert.equal(w.tabs.has(99), true);
});

test('force rejects stale episodes, inactive tabs, foreign accounts and page-origin commands', async () => {
    let currentEpisode = episode;
    const w = await worker({ enabled: false, rows: [], playerEpisode: () => currentEpisode });
    const tab = { id: 99, active: true, status: 'complete', url: 'https://rezka.fi/series/test/123-example.html' };
    w.tabs.set(99, tab);
    const request = { type: 'myshows:force', tabId: 99, key: '123:1:2', account: 'testuser' };
    await w.send({ type: 'myshows:current', tabId: 99 });
    currentEpisode = { ...episode, number: 3 };
    assert.equal((await w.send(request)).ok, false);
    currentEpisode = episode; tab.active = false;
    assert.equal((await w.send(request)).ok, false);
    tab.active = true;
    assert.equal((await w.send({ ...request, account: 'other' })).ok, false);
    assert.equal((await w.send(request, { id: 'extension-id', tab: { id: 99 }, frameId: 0, url: tab.url })).ok, false);
    w.state.entries = [entry({ status: 'watching', account: 'other' })];
    assert.equal((await w.send({ type: 'myshows:force', id: 'test-entry', account: 'testuser' })).ok, false);
    assert.equal(w.calls.length, 0);
});

test('manual request resumes cancelled unsent episodes but cannot resend uncertain accepted writes', async () => {
    const w = await worker({ enabled: false, rows: [entry({ status: 'cancelled', progress: 10 })] });
    await w.send({ type: 'myshows:force', id: 'test-entry', account: 'testuser' });
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.calls.length, 1);
    const uncertain = await worker({ enabled: false, rows: [entry({ status: 'attention', submittedAt: 1, exact: false })] });
    await uncertain.send({ type: 'myshows:force', id: 'test-entry', account: 'testuser' });
    assert.equal(uncertain.state.entries[0].status, 'attention');
    assert.equal(uncertain.calls.length, 0);
});

test('pending manual marks survive restart with auto sync off and stop on account mismatch', async () => {
    const w = await worker({ enabled: false, rows: [entry({ manualAt: 1, manualPending: true, progress: 0 })] });
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.calls.length, 1);
    const mismatch = await worker({ enabled: false, remoteAccount: 'other', rows: [entry({ manualAt: 1, manualPending: true })] });
    await until(() => mismatch.state.entries[0].status === 'attention');
    assert.equal(mismatch.state.entries[0].manualPending, false);
    assert.equal(mismatch.calls.length, 0);
});

const profile = '<a class="SidebarMenuItem" href="/testuser"><span class="SidebarMenuItem__text">Профиль</span></a>';
function card({ own = true, approved = false, id = 987, number = 2 } = {}) {
    return `<div class="ScrobbleCard__info"><div class="ScrobbleCard__source">${own ? source : 'other-app'}</div>
        <div class="ScrobbleCard__title">Example · s01e0${number}</div><a href="/view/episode/${id}/#comments">Comments</a>
        <div class="ScrobbleCard__status--${approved ? 'approved' : 'pending'}"></div><div class="ScrobbleCard__progress-value">90%</div><button>Подтвердить</button></div>`;
}
function site(t, html, url = M.historyUrl) {
    const dom = new JSDOM(profile + html, { url, runScripts: 'outside-only' }); t.after(() => dom.window.close());
    let listener;
    dom.window.chrome = { runtime: { id: 'extension-id', onMessage: { addListener(fn) { listener = fn; } } } };
    dom.window.eval(read('myshows-site.js'));
    return { window: dom.window, send: (request, sender = { id: 'extension-id' }) => new Promise(resolve => {
        const result = listener(request, sender, resolve); if (result !== true) resolve({ ok: false });
    }) };
}
const reconcileRequest = { type: 'myshows:site-reconcile', account: 'testuser', source, episodeId: 987, season: 1, number: 2, threshold: 90, allowApprove: true };

test('site adapter only clicks the exact own pending card, and waits for approved state', async t => {
    const s = site(t, card({ own: false }) + card());
    let clicks = 0;
    s.window.document.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        clicks++; button.parentElement.querySelector('[class*="status--"]').className = 'ScrobbleCard__status--approved';
    }));
    assert.equal((await s.send(reconcileRequest)).approved, true);
    assert.equal(clicks, 1);
    assert.ok(s.window.document.querySelector('.ScrobbleCard__info .ScrobbleCard__status--pending'));
    assert.equal((await s.send(reconcileRequest)).approved, true); assert.equal(clicks, 1);
});

test('site adapter rejects wrong accounts, mismatched episodes, duplicate records and untrusted senders', async t => {
    for (const [html, request, code] of [[card(), { account: 'else' }, 'account'], [card({ id: 555 }), {}, 'match'], [card({ number: 3 }), {}, 'match'], [card() + card(), {}, 'duplicate'], [card(), { allowApprove: false }, 'manual']]) {
        const s = site(t, html); let clicks = 0; s.window.document.addEventListener('click', () => clicks++);
        assert.equal((await s.send({ ...reconcileRequest, ...request })).code, code); assert.equal(clicks, 0);
    }
    const s = site(t, card());
    assert.equal((await s.send(reconcileRequest, { id: 'extension-id', tab: { id: 1 } })).ok, false);
});

test('site adapter reads only the episode-page checkbox and never changes it during verification', async t => {
    const s = site(t, '<div class="EpisodeDetails__watch-label WatchCheckbox WatchCheckbox--checked"></div>', 'https://myshows.me/view/episode/987/');
    const result = await s.send({ type: 'myshows:site-verify', account: 'testuser', episodeId: 987 });
    assert.equal(result.watched, true);
    assert.equal((await s.send({ type: 'myshows:site-verify', account: 'testuser', episodeId: 988 })).ok, false);
});

test('connection reads an existing token, does not create or rotate credentials', async t => {
    const s = site(t, '<input name="token" value="synthetic-existing-token"><button>Пересоздать API токен</button>');
    let clicks = 0; s.window.document.addEventListener('click', () => clicks++);
    const result = await s.send({ type: 'myshows:site-connect' });
    assert.equal(result.account, 'testuser'); assert.equal(result.token, 'synthetic-existing-token'); assert.equal(clicks, 0);
});

async function tracker(t, send = async () => ({ ok: true }), { movie = false, category = movie ? 'films' : 'series', initializer = 'sof.tv.initCDNMoviesEvents(123, 1, false);' } = {}) {
    const url = `https://rezka.fi/${category}/test/123-example.html`;
    const imdb = Buffer.from(encodeURIComponent('https://www.imdb.com/title/tt1234567/')).toString('base64');
    const dom = new JSDOM(`<div class="b-post__title"><h1>Example show</h1></div><div class="b-post__origtitle">Example</div>
        <div class="b-post__info"><a href="/help/${imdb}/">IMDb</a><a href="/year/2020/">2020</a></div>
        ${movie ? `<script>${initializer}</script>` : '<div id="simple-episodes-tabs"><button class="b-simple_episode__item active" data-id="123" data-season_id="1" data-episode_id="2"></button></div>'}
        <div id="cdnplayer"><video></video></div>`, { url, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { window } = dom;
    const media = { currentTime: 0, duration: 1000, currentSrc: 'https://cdn.example/episode2.mp4', paused: false, seeking: false, readyState: 4, playbackRate: 1 };
    const video = window.document.querySelector('video');
    for (const name of Object.keys(media)) Object.defineProperty(video, name, { configurable: true, get: () => media[name] });
    let sample, wall = 0, configuration, runtimeListener;
    window.setInterval = fn => { sample = fn; return 1; };
    Object.defineProperty(window.performance, 'now', { value: () => wall });
    window.chrome = { runtime: { id: 'extension-id', sendMessage: send, onMessage: { addListener(fn) { runtimeListener = fn; } } }, storage: {
        local: { async get() { return { [M.key]: { enabled: true, connection: 'connected', account: 'testuser' } }; } },
        onChanged: { addListener(fn) { configuration = fn; } }
    } };
    window.eval('const REZKA_BUILD = { id: "test-build" };\n' + read('network-policy.js') + '\n' + read('myshows-core.js') + '\n' + read('myshows-tracker.js'));
    await tick();
    return { window, media, video, current(sender = { id: 'extension-id' }) { let reply; runtimeListener({ type: 'myshows:player-current' }, sender, value => { reply = value; }); return reply; },
        configure: state => configuration({ [M.key]: { newValue: state } }, 'local'),
        async sample(time, elapsed = 1000) { wall += elapsed; media.currentTime = time; sample(); await tick(); },
        async flush() { window.document.dispatchEvent(new window.Event('visibilitychange')); await tick(); } };
}

test('real tracker extracts IMDb and sends viewed intervals, excluding seek-to-end', async t => {
    const sent = [];
    const tr = await tracker(t, async value => { sent.push(copy(value)); return { ok: true }; });
    await tr.sample(0);
    for (let i = 1; i <= 10; i++) await tr.sample(i);
    await tr.sample(990); await tr.flush();
    assert.ok(sent.length);
    assert.equal(sent[0].episode.imdb, 'tt1234567');
    assert.equal(sent[0].episode.number, 2);
    assert.ok(M.percent(sent.flatMap(item => item.ranges), 1000) <= 1);
    assert.ok(sent.every(item => item.confirmedPosition === 0));
});

test('real tracker queues a series with no IMDb or original title for native MyShows matching', async t => {
    const w = await worker({ rows: [], reconcile: { ok: false, code: 'manual' } });
    const sender = { id: 'extension-id', tab: { id: 10 }, frameId: 0, url: 'https://rezka.fi/series/test/123-example.html' };
    const tr = await tracker(t, message => w.send(message, sender));
    tr.window.document.querySelector('.b-post__info a[href^="/help/"]').remove();
    tr.window.document.querySelector('.b-post__origtitle').remove();
    const selected = tr.window.document.querySelector('.b-simple_episode__item.active');
    selected.dataset.season_id = '4'; selected.dataset.episode_id = '11';
    await tr.sample(870);
    for (let i = 871; i <= 900; i++) await tr.sample(i);
    await until(() => w.state.entries[0]?.status === 'attention');
    assert.equal(w.state.entries[0].code, 'manual');
    assert.equal(w.calls.length, 1);
    const body = JSON.parse(w.calls[0].options.body);
    assert.deepEqual(body.show, { title: 'Example show', year: 2020, ids: {} });
    assert.deepEqual(body.episode, { season: 4, number: 11 });
    assert.equal(body.progress, 90);
});

test('a forward seek earns the current position after 30 playback seconds and uses the normal sync pipeline', async t => {
    const w = await worker({ rows: [] });
    const sender = { id: 'extension-id', tab: { id: 10 }, frameId: 0, url: 'https://rezka.fi/series/test/123-example.html' };
    const tr = await tracker(t, message => w.send(message, sender));
    await tr.sample(0);
    for (let i = 1; i <= 10; i++) await tr.sample(i);
    tr.video.dispatchEvent(new tr.window.Event('seeking'));
    await tr.sample(870);
    for (let i = 871; i <= 899; i++) await tr.sample(i);
    await tr.flush();
    assert.equal(w.calls.length, 0);
    assert.ok(w.state.entries[0].progress < 4);
    await tr.sample(900);
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.state.entries[0].progress, 90);
    assert.equal(w.state.entries[0].watchedProgress, 4);
    assert.equal(w.state.entries[0].confirmedPosition, 900);
    assert.equal(JSON.parse(w.calls[0].options.body).progress, 90);
    assert.equal(w.calls.length, 1);
    await tr.sample(901); await tr.flush();
    assert.equal(w.calls.length, 1);
});

test('resuming mid-episode uses real playback seconds at fast and slow speeds, not media seconds', async t => {
    for (const rate of [2, .5]) {
        const sent = [];
        const tr = await tracker(t, async message => { sent.push(copy(message)); return { ok: true }; });
        tr.media.playbackRate = rate;
        await tr.sample(600);
        for (let i = 1; i <= 29; i++) await tr.sample(600 + i * rate);
        await tr.flush();
        assert.ok(sent.every(item => item.confirmedPosition === 0));
        await tr.sample(600 + 30 * rate);
        assert.equal(sent.at(-1).confirmedPosition, 600 + 30 * rate);
    }
});

test('pauses and stalled playback do not advance the position-confirmation timer', async t => {
    const sent = [];
    const tr = await tracker(t, async message => { sent.push(copy(message)); return { ok: true }; });
    await tr.sample(600);
    for (let i = 601; i <= 615; i++) await tr.sample(i);
    tr.media.paused = true;
    await tr.sample(615, 0);
    for (let i = 0; i < 60; i++) await tr.sample(615);
    tr.media.paused = false;
    // A player can be unpaused while buffering. Only advancing media earns time.
    for (let i = 0; i < 60; i++) await tr.sample(615);
    for (let i = 616; i <= 629; i++) await tr.sample(i);
    await tr.flush();
    assert.ok(sent.every(item => item.confirmedPosition === 0));
    await tr.sample(630);
    assert.equal(sent.at(-1).confirmedPosition, 630);
});

test('each seek, source change and long sampling gap starts a new confirmation window', async t => {
    const sent = [];
    const tr = await tracker(t, async message => { sent.push(copy(message)); return { ok: true }; });
    let position = 100;
    await tr.sample(position);
    for (const boundary of ['forward', 'backward', 'source', 'gap']) {
        for (let i = 0; i < 20; i++) await tr.sample(++position);
        if (boundary === 'forward' || boundary === 'backward') {
            tr.video.dispatchEvent(new tr.window.Event('seeking'));
            position = boundary === 'forward' ? 500 : 100;
        } else if (boundary === 'source') tr.media.currentSrc = 'https://cdn.example/another-cut.mp4';
        await tr.sample(position, boundary === 'gap' ? 60000 : 1000);
    }
    for (let i = 0; i < 29; i++) await tr.sample(++position);
    await tr.flush();
    assert.ok(sent.every(item => item.confirmedPosition === 0));
    await tr.sample(++position);
    assert.equal(sent.at(-1).confirmedPosition, position);
});

test('failed saves preserve confirmed position and measured ranges until the worker recovers', async t => {
    let fail = true; const sent = [];
    const tr = await tracker(t, async message => {
        if (fail) throw new Error('worker unavailable');
        sent.push(copy(message)); return { ok: true };
    });
    await tr.sample(600);
    for (let i = 601; i <= 631; i++) await tr.sample(i);
    fail = false; await tr.flush();
    assert.equal(sent.at(-1).confirmedPosition, 631);
    assert.deepEqual(sent.at(-1).ranges, [[600, 631]]);
});

test('current episode snapshot works while paused and only responds to the extension worker', async t => {
    const tr = await tracker(t);
    tr.configure({ enabled: false, connection: 'connected', account: 'testuser' }); tr.media.paused = true;
    assert.equal(tr.current().episode.number, 2);
    assert.equal(tr.current().build, 'test-build');
    assert.equal(tr.current({ id: 'another' }), undefined);
    assert.equal(tr.current({ id: 'extension-id', tab: { id: 1 } }), undefined);
    tr.window.document.querySelector('.b-simple_episode__item').dataset.episode_id = '3';
    assert.equal(tr.current().episode.number, 3);
});

test('live confirmation snapshots report actual playback seconds and reject reset, stale and foreign contexts', async t => {
    const tr = await tracker(t);
    await tr.sample(600);
    for (let second = 1; second <= 12; second++) await tr.sample(600 + second);
    assert.deepEqual(copy(tr.current().playback), { account: 'testuser', key: '123:1:2', seconds: 12, state: 'playing' });
    tr.media.paused = true;
    await tr.sample(612, 0); await tr.sample(612);
    assert.equal(tr.current().playback.seconds, 12);
    assert.equal(tr.current().playback.state, 'paused');
    tr.media.paused = false; await tr.sample(612);
    assert.equal(tr.current().playback.state, 'buffering');
    tr.video.dispatchEvent(new tr.window.Event('seeking'));
    assert.equal(tr.current().playback, null);
    await tr.sample(800);
    assert.equal(tr.current().playback.seconds, 0);
    for (let second = 1; second <= 30; second++) await tr.sample(800 + second);
    assert.equal(tr.current().playback.seconds, 30);
    tr.media.currentSrc = 'https://cdn.example/replacement.mp4';
    assert.equal(tr.current().playback, null);
    tr.window.document.querySelector('.b-simple_episode__item').dataset.episode_id = '3';
    assert.equal(tr.current().playback, null);
    tr.configure({ enabled: false, connection: 'connected', account: 'testuser' });
    assert.equal(tr.current().playback, null);
});

test('worker relays bounded live confirmation only for the connected account and exact episode', async () => {
    let playback = { account: 'testuser', key: '123:1:2', seconds: 12, state: 'playing', privateField: 'omit' };
    const w = await worker({ rows: [], playerPlayback: () => playback });
    w.tabs.set(99, { id: 99, active: true, url: 'https://rezka.fi/series/test/123-example.html' });
    const current = async () => (await w.send({ type: 'myshows:current', tabId: 99 })).current;
    assert.deepEqual(copy((await current()).playback), { seconds: 12, state: 'playing' });
    for (const invalid of [{ account: 'foreign' }, { key: '123:1:3' }, { seconds: -1 }, { seconds: 31 }, { seconds: '12' }, { state: 'invented' }]) {
        playback = { account: 'testuser', key: '123:1:2', seconds: 12, state: 'playing', ...invalid };
        assert.equal((await current()).playback, null);
    }
    assert.equal(w.calls.length, 0);
});

test('resumed unsent episodes restart real tracker sampling without a page reload', async t => {
    let finished = true; const sent = [];
    const tr = await tracker(t, async value => { sent.push(copy(value)); return { ok: true, tracking: !finished }; });
    await tr.sample(600); await tr.sample(601); await tr.flush();
    const before = sent.length;
    await tr.sample(602); await tr.flush();
    assert.equal(sent.length, before);
    finished = false;
    tr.configure({ enabled: true, connection: 'connected', account: 'testuser', entries: [{ key: '123:1:2', account: 'testuser', status: 'watching' }] });
    await tr.sample(602); await tr.sample(603); await tr.flush();
    assert.equal(sent.length, before + 1);
    assert.deepEqual(sent.at(-1).ranges, [[602, 603]]);
    assert.equal(tr.current().playback.seconds, 1);
});

test('tracker never attributes the outgoing video to a newly selected episode', async t => {
    const sent = [];
    const tr = await tracker(t, async value => { sent.push(copy(value)); return { ok: true }; });
    await tr.sample(0);
    for (let i = 1; i <= 20; i++) await tr.sample(i);
    tr.window.document.querySelector('.b-simple_episode__item').dataset.episode_id = '3';
    await tr.sample(21); await tr.sample(22); await tr.sample(23);
    tr.media.currentSrc = 'https://cdn.example/episode3.mp4';
    await tr.sample(0); await tr.sample(1); await tr.flush();
    const third = sent.filter(item => item.episode.number === 3).flatMap(item => item.ranges);
    assert.deepEqual(third, [[0, 1]]);
    assert.ok(sent.some(item => item.episode.number === 2));
    for (let i = 2; i <= 29; i++) await tr.sample(i);
    await tr.flush();
    assert.ok(sent.filter(item => item.episode.number === 3).every(item => item.confirmedPosition === 0));
    await tr.sample(30);
    assert.equal(sent.at(-1).episode.number, 3);
    assert.equal(sent.at(-1).confirmedPosition, 30);
});

test('failed saves keep coverage from both episodes; turning off prevents new tracking', async t => {
    let fail = true; const sent = [];
    const tr = await tracker(t, async value => { if (fail) throw new Error('worker unavailable'); sent.push(copy(value)); return { ok: true }; });
    await tr.sample(0); await tr.sample(1); await tr.flush();
    tr.window.document.querySelector('.b-simple_episode__item').dataset.episode_id = '3';
    tr.media.currentSrc = 'https://cdn.example/episode3.mp4';
    await tr.sample(0); await tr.sample(1);
    fail = false; await tr.flush();
    assert.deepEqual(sent.map(item => item.episode.number), [2, 3]);
    tr.configure({ enabled: false, connection: 'connected', account: 'testuser' });
    await tr.sample(2); await tr.sample(3); await tr.flush();
    assert.equal(sent.length, 2);
});


const movie = { kind: 'movie', rezkaId: 123, title: 'Example movie', originalTitle: 'Original movie', imdb: 'tt1234567', year: 2020 };
const movieEntry = overrides => entry({ episode: movie, key: 'movie:123', ...overrides });
const movieRemote = { response: { status: 200, data: { action: 'scrobble', match: 'exact', objectType: 'movie', objectId: 456, id: 2 } },
    reconcile: { ok: true, movieId: 456, approved: true } };
const movieSender = { id: 'extension-id', tab: { id: 99 }, frameId: 0, url: 'https://rezka.fi/films/test/123-example.html' };

test('movie identity is explicit, sanitized and separate from legacy episode keys and payloads', () => {
    assert.deepEqual(copy(M.validMedia(movie)), movie);
    assert.equal(M.mediaKey(movie), 'movie:123');
    assert.equal(M.mediaKey(episode), '123:1:2');
    for (const input of [{ ...movie, kind: undefined }, { ...movie, season: 0 }, { ...movie, number: 0 },
        { ...movie, kind: 'show' }, { ...movie, rezkaId: -1 }]) assert.equal(M.validMedia(input), null);
    assert.equal(M.label(movie), 'Фильм');
    const body = copy(M.payload(movieEntry(), 'test'));
    assert.deepEqual(body.movie, { title: 'Original movie', ids: { imdb: 'tt1234567' }, year: 2020 });
    assert.equal(body.show, undefined); assert.equal(body.episode, undefined);
    assert.equal(M.watchUrl(movieEntry({ movieId: 456, episodeId: 987 })), 'https://myshows.me/movie/456/');
    assert.equal(M.watchUrl(movieEntry({ movieId: 'https://evil.test' })), M.historyUrl);
});

test('movie progress completes through the real tracker and worker only after 30 seconds following a seek', async t => {
    const w = await worker({ rows: [], ...movieRemote });
    const tr = await tracker(t, message => w.send(copy(message), movieSender), { movie: true });
    assert.equal(tr.current().episode.kind, 'movie');
    assert.equal(tr.current().episode.number, undefined);
    await tr.sample(0); await tr.sample(900); await tr.flush();
    assert.equal(w.calls.length, 0);
    for (let i = 1; i <= 29; i++) await tr.sample(900 + i);
    await tr.flush(); assert.equal(w.calls.length, 0);
    await tr.sample(930);
    await until(() => w.state.entries[0]?.status === 'done');
    const result = w.state.entries[0], body = JSON.parse(w.calls[0].options.body);
    assert.equal(result.movieId, 456); assert.equal(result.episodeId, undefined);
    assert.equal(result.key, 'movie:123'); assert.equal(result.progress, 93);
    assert.equal(body.movie.ids.imdb, 'tt1234567'); assert.equal(body.episode, undefined);
    assert.equal(w.messages.find(m => m.type === 'myshows:site-reconcile').kind, 'movie');
    assert.equal(w.messages.find(m => m.type === 'myshows:site-verify').movieId, 456);
    await tr.sample(931); await tr.flush(); w.alarm(); await tick();
    assert.equal(w.calls.length, 1);
    const restarted = await worker({ values: w.values, ...movieRemote });
    assert.equal(restarted.calls.length, 0);
});

test('movies require a matching native initializer; missing episode controls never imply a movie', async t => {
    for (const initializer of ['', 'sof.tv.initCDNMoviesEvents(999, 1, false);', 'sof.tv.initCDNSeriesEvents(123, 1, 1, 2);',
        'sof.tv.initCDNMoviesEvents(123, 1, false); sof.tv.initCDNSeriesEvents(123, 1, 1, 2);']) {
        const sent = [], tr = await tracker(t, async message => { sent.push(message); return { ok: true }; }, { movie: true, initializer });
        assert.equal(tr.current().episode, null);
        await tr.sample(0); await tr.sample(950); await tr.flush(); assert.equal(sent.length, 0);
    }
    for (const category of ['cartoons', 'animation']) {
        const tr = await tracker(t, undefined, { movie: true, category });
        assert.equal(tr.current().episode.kind, 'movie');
    }
    const series = await tracker(t);
    series.window.document.querySelector('.b-simple_episode__item').classList.remove('active');
    assert.equal(series.current().episode, null);
});

test('manual movies work before playback with auto marks paused and reject stale movie/episode selection', async () => {
    let selected = movie;
    const w = await worker({ rows: [], enabled: false, playerEpisode: () => selected, ...movieRemote });
    w.tabs.set(99, { id: 99, active: true, url: movieSender.url });
    const current = (await w.send({ type: 'myshows:current', tabId: 99 })).current;
    assert.equal(current.key, 'movie:123');
    selected = episode;
    assert.equal((await w.send({ type: 'myshows:force', tabId: 99, key: current.key, account: 'testuser' })).ok, false);
    assert.equal(w.calls.length, 0);
    selected = movie;
    assert.equal((await w.send({ type: 'myshows:force', tabId: 99, key: current.key, account: 'testuser' })).ok, true);
    await until(() => w.state.entries[0]?.status === 'done');
    assert.equal(w.state.enabled, false); assert.equal(w.state.entries[0].progress, 0);
    assert.equal(JSON.parse(w.calls[0].options.body).progress, 100);
    assert.equal(w.state.entries[0].origin, 'manual');
});

test('movie and episode journals cannot collide; movie progress merges across mirrors and restarts', async () => {
    const w = await worker({ rows: [entry({ status: 'done' })], ...movieRemote });
    const request = { type: 'myshows:progress', episode: movie, account: 'testuser', duration: 1000, ranges: [[0, 100]] };
    await w.send(request, movieSender);
    await w.send(request, { ...movieSender, tab: { id: 100 }, url: movieSender.url.replace('rezka.fi', 'hdrezka.me') });
    assert.equal(w.state.entries.length, 2); assert.equal(w.state.entries[1].progress, 10);
    const restarted = await worker({ values: w.values, ...movieRemote });
    await restarted.send({ ...request, ranges: [[100, 200]] }, movieSender);
    assert.equal(restarted.state.entries[1].progress, 20);
    assert.equal(restarted.state.entries[0].status, 'done');
    await restarted.send({ type: 'myshows:cancel', id: restarted.state.entries[1].id });
    await restarted.send({ ...request, ranges: [[0, 950]] }, movieSender);
    assert.equal(restarted.state.entries[1].status, 'cancelled'); assert.equal(restarted.calls.length, 0);
});

test('movies reject episode matches and require watched verification even for approved history', async () => {
    const wrong = await worker({ rows: [movieEntry()], reconcile: { ok: false, code: 'match' } });
    await until(() => wrong.state.entries[0].status === 'attention');
    assert.equal(wrong.state.entries[0].movieId, undefined);
    assert.equal(wrong.messages.find(m => m.type === 'myshows:site-reconcile').allowApprove, false);
    const pending = await worker({ rows: [movieEntry()], ...movieRemote, watched: false });
    await until(() => pending.state.entries[0].code === 'unwatched');
    assert.equal(pending.state.entries[0].status, 'checking');
    const lost = await worker({ rows: [movieEntry()], response: () => { throw new Error('lost'); }, reconcile: { ok: false, code: 'manual' } });
    await until(() => lost.state.entries[0].status === 'attention');
    await lost.send({ type: 'myshows:retry', id: 'test-entry' });
    await until(() => lost.state.entries[0].status === 'attention');
    assert.equal(lost.calls.length, 1);
    const restarted = await worker({ rows: [movieEntry({ submittedAt: 1, status: 'sending' })], ...movieRemote });
    await until(() => restarted.state.entries[0].status === 'done'); assert.equal(restarted.calls.length, 0);
    assert.equal(restarted.messages.find(m => m.type === 'myshows:site-reconcile').allowApprove, false);
});

const movieCard = ({ id = 456, approved = false } = {}) => `<div class="ScrobbleCard__info">
    <span class="ScrobbleCard__source">${source}</span><span class="ScrobbleCard__title">Example movie (2020)</span>
    <a href="/movie/${id}/">Movie</a><a href="/movie/${id}/#comments">Comments</a>
    <span class="ScrobbleCard__status--${approved ? 'approved' : 'pending'}"></span>
    <span class="ScrobbleCard__progress-value">90%</span><button>Подтвердить</button></div>`;
const movieRequest = { type: 'myshows:site-reconcile', kind: 'movie', account: 'testuser', source, movieId: 456, threshold: 90, allowApprove: true };
const nativeMovieCard = readFileSync(new URL('./fixtures/myshows-movie-history.html', import.meta.url), 'utf8').replace('{{source}}', source);

test('native movie history confirms the entity beside its source information', async t => {
    const s = site(t, nativeMovieCard); let clicks = 0;
    s.window.document.querySelector('.Button--primary').onclick = () => {
        clicks++; s.window.document.querySelector('.ScrobbleCard__status').className = 'ScrobbleCard__status--approved';
    };
    assert.deepEqual(copy(await s.send(movieRequest)), { ok: true, movieId: 456, approved: true });
    assert.equal(clicks, 1);
});

test('native movie history never borrows a match from another row or ambiguous entity', async t => {
    const other = nativeMovieCard.replace(source, M.sourceFor('00000000-0000-4000-8000-000000000002'));
    for (const html of [
        nativeMovieCard.replace('/movie/456/', '/movie/999/') + other,
        nativeMovieCard.replace('/movie/456/', '/view/episode/456/') + other,
        nativeMovieCard.replace('/movie/456/', 'https://other.test/movie/456/') + other,
        nativeMovieCard.replace('<div class="ScrobbleCard__info">', '<div class="ScrobbleCard__info"></div><div class="ScrobbleCard__info">'),
        nativeMovieCard.replace('<div class="ScrobbleCard__info">', '<a href="/movie/999/">Another movie</a><div class="ScrobbleCard__info">')
    ]) {
        const s = site(t, html); let clicks = 0;
        s.window.document.addEventListener('click', () => clicks++);
        assert.equal((await s.send(movieRequest)).code, 'match');
        assert.equal(clicks, 0);
    }
});

test('retrying a submitted native movie completes the existing record without another POST', async t => {
    const s = site(t, nativeMovieCard); let clicks = 0;
    let didReconcile;
    const reconciled = new Promise(resolve => { didReconcile = resolve; });
    s.window.document.querySelector('.Button--primary').onclick = () => {
        clicks++; s.window.document.querySelector('.ScrobbleCard__status').className = 'ScrobbleCard__status--approved';
    };
    const w = await worker({ enabled: false, rows: [movieEntry({ status: 'attention', submittedAt: 1, movieId: 456, exact: true,
        code: 'match', origin: 'manual', manualAt: 1, manualPending: false, progress: 0, ranges: [] })],
        reconcile: async message => { const result = await s.send(message); didReconcile(); return result; } });
    assert.equal((await w.send({ type: 'myshows:retry', id: 'test-entry' })).ok, true);
    await reconciled;
    await until(() => w.state.entries[0].status === 'done');
    assert.equal(w.calls.length, 0); assert.equal(clicks, 1);
    assert.equal(w.state.enabled, false);
    assert.equal(w.state.entries[0].movieId, 456); assert.equal(w.state.entries[0].progress, 0);
    assert.equal(w.messages.find(m => m.type === 'myshows:site-verify').movieId, 456);
});

test('retrying a submitted native movie without an exact API match still requires manual confirmation', async t => {
    const s = site(t, nativeMovieCard); let clicks = 0;
    s.window.document.addEventListener('click', () => clicks++);
    const w = await worker({ rows: [movieEntry({ status: 'attention', submittedAt: 1, movieId: 456, exact: false })],
        reconcile: message => s.send(message) });
    await w.send({ type: 'myshows:retry', id: 'test-entry' });
    await until(() => w.state.entries[0].status === 'attention');
    assert.equal(w.state.entries[0].code, 'manual');
    assert.equal(w.calls.length, 0); assert.equal(clicks, 0);
});

test('movie history confirmation requires its exact source, movie ID, type and threshold', async t => {
    const s = site(t, movieCard()); let clicks = 0;
    s.window.document.querySelector('button').onclick = () => {
        clicks++; s.window.document.querySelector('[class*="status--"]').className = 'ScrobbleCard__status--approved';
    };
    assert.equal((await s.send(movieRequest)).movieId, 456); assert.equal(clicks, 1);
    assert.equal((await s.send(movieRequest)).approved, true); assert.equal(clicks, 1);
    for (const [html, extra, code] of [[movieCard({ id: 999 }), {}, 'match'], [card(), {}, 'match'],
        [movieCard(), { allowApprove: false }, 'manual'], [movieCard(), { movieId: undefined }, 'manual'],
        [movieCard(), { threshold: 95 }, 'progress'], [movieCard() + movieCard(), {}, 'duplicate'],
        [movieCard(), { account: 'other' }, 'account'],
        [movieCard().replace('</div>', '<a href="/movie/999/">Other</a></div>'), {}, 'match']]) {
        const invalid = site(t, html); let writes = 0; invalid.window.document.addEventListener('click', () => writes++);
        assert.equal((await invalid.send({ ...movieRequest, ...extra })).code, code); assert.equal(writes, 0);
    }
    assert.equal((await site(t, movieCard({ approved: true })).send({ ...movieRequest, movieId: undefined, allowApprove: false })).approved, true);
});

test('movie verification reads the selected native status and never marks from an episode checkbox or a recommendation', async t => {
    for (const selected of ['Посмотрел', 'Буду', 'Не смотрел']) {
        const html = `<div class="MovieDetails"><div class="StatusBar__list">${['Посмотрел', 'Буду', 'Не смотрел'].map(label =>
            `<button class="StatusBar__option ${label === selected ? 'StatusBar__option--active' : ''}">${label}</button>`).join('')}</div></div>`;
        const s = site(t, html + '<div class="EpisodeDetails__watch-label WatchCheckbox WatchCheckbox--checked"></div>', 'https://myshows.me/movie/456/');
        let clicks = 0; s.window.document.addEventListener('click', () => clicks++);
        assert.equal((await s.send({ type: 'myshows:site-verify', account: 'testuser', kind: 'movie', movieId: 456 })).watched, selected === 'Посмотрел');
        assert.equal(clicks, 0);
        assert.equal((await s.send({ type: 'myshows:site-verify', account: 'testuser', kind: 'movie', movieId: 999 })).code, 'page');
    }
    const missing = site(t, '<button class="StatusBar__option StatusBar__option--active">Посмотрел</button>', 'https://myshows.me/movie/456/');
    assert.equal((await missing.send({ type: 'myshows:site-verify', account: 'testuser', kind: 'movie', movieId: 456 })).code, 'layout');
});


test('the shipped adapter is injected on MyShows movie detail pages', () => {
    const manifest = JSON.parse(read('manifest.json'));
    const adapter = manifest.content_scripts.find(script => script.js.includes('myshows-site.js'));
    assert.ok(adapter.matches.includes('https://myshows.me/movie/*'));
    assert.ok(adapter.matches.includes('https://myshows.me/view/episode/*'));
});

test('reset completed movies and episodes locally, then mark once again with a fresh source', async () => {
    for (const media of [episode, movie]) {
        const completed = entry({ episode: media, key: M.mediaKey(media), status: 'done', submittedAt: 1, completedAt: 2,
            movieId: M.isMovie(media) ? 456 : undefined, episodeId: M.isMovie(media) ? undefined : 987,
            exact: true, scrobbleId: 1, manualAt: 1, confirmedPosition: 950, watchedProgress: 90,
            events: [{ status: 'done', at: 2, reason: '' }] });
        const other = entry({ id: 'other', key: '999:1:1', status: 'done' });
        const w = await worker({ rows: [completed, other], ...(M.isMovie(media) ? movieRemote : {}) });
        // Removing a mark on MyShows cannot be inferred from the historical local success.
        await w.send({ type: 'myshows:force', id: completed.id, account: 'testuser' });
        assert.equal(w.calls.length, 0);
        const resets = await Promise.all([1, 2].map(() => w.send({ type: 'myshows:reset', id: completed.id, account: 'testuser' })));
        assert.deepEqual(resets.map(reply => reply.ok), [true, false]);
        const reset = w.state.entries.find(item => item.key === completed.key);
        assert.equal(reset.status, 'reset'); assert.equal(reset.progress, 0);
        assert.equal(reset.confirmedPosition, 0); assert.equal(reset.watchedProgress, 0);
        assert.deepEqual(reset.ranges, []);
        assert.notEqual(reset.id, completed.id); assert.notEqual(reset.source, completed.source);
        for (const field of ['submittedAt', 'completedAt', 'movieId', 'episodeId', 'scrobbleId', 'exact', 'manualAt']) assert.equal(reset[field], undefined);
        assert.equal(reset.events.some(event => event.status === 'done'), true);
        assert.equal(reset.events.at(-1).status, 'reset');
        assert.deepEqual(w.state.entries.find(item => item.id === 'other'), copy(other));
        assert.equal(w.calls.length, 0); assert.equal(w.tabs.size, 0);
        const sender = { ...movieSender, url: 'https://rezka.fi/' + (M.isMovie(media) ? 'films' : 'series') + '/test/123-example.html' };
        const late = await w.send({ type: 'myshows:progress', account: 'testuser', episode: media, duration: 1000,
            ranges: [[0, 1000]], confirmedPosition: 1000 }, sender);
        assert.equal(late.tracking, false);
        await w.send({ type: 'myshows:configure', threshold: 80 });
        w.alarm(); await tick(); assert.equal(w.calls.length, 0);
        assert.equal((await w.send({ type: 'myshows:reset', id: completed.id, account: 'testuser' })).ok, false);
        const restarted = await worker({ values: w.values, ...(M.isMovie(media) ? movieRemote : {}) });
        assert.equal(restarted.calls.length, 0);
        await restarted.send({ type: 'myshows:configure', enabled: false });
        await restarted.send({ type: 'myshows:force', id: reset.id, account: 'testuser' });
        await until(() => restarted.state.entries.find(item => item.id === reset.id)?.status === 'done');
        assert.equal(restarted.state.enabled, false);
        assert.equal(restarted.calls.length, 1);
        const payload = JSON.parse(restarted.calls[0].options.body);
        assert.equal(payload.source_app, reset.source); assert.equal(payload.progress, 100);
        assert.ok(M.isMovie(media) ? payload.movie : payload.episode);
        await restarted.send({ type: 'myshows:force', id: reset.id, account: 'testuser' });
        restarted.alarm(); await tick(); assert.equal(restarted.calls.length, 1);
    }
});

test('local reset rejects uncertain submissions, foreign accounts and non-panel callers', async () => {
    for (const status of ['watching', 'queued', 'sending', 'confirming', 'checking', 'attention', 'cancelled', 'reset']) {
        const w = await worker({ enabled: false, rows: [entry({ status, submittedAt: 1 })] });
        const before = copy(w.state.entries);
        assert.equal((await w.send({ type: 'myshows:reset', id: 'test-entry', account: 'testuser' })).ok, false);
        assert.deepEqual(w.state.entries, before); assert.equal(w.calls.length, 0);
    }
    const w = await worker({ rows: [entry({ status: 'done' }), entry({ id: 'foreign', status: 'done', account: 'other' })] });
    const request = { type: 'myshows:reset', id: 'test-entry', account: 'testuser' };
    const before = copy(w.state.entries);
    for (const extra of [{ account: 'other' }, { account: undefined }, { id: 'foreign' }, { id: 'missing' }]) {
        assert.equal((await w.send({ ...request, ...extra })).ok, false);
    }
    assert.equal((await w.send(request, movieSender)).ok, false);
    assert.equal((await w.send(request, { id: 'extension-id', url: 'https://example.test/' })).ok, false);
    assert.deepEqual(w.state.entries, before); assert.equal(w.calls.length, 0);
    await w.send({ type: 'myshows:disconnect' });
    assert.equal((await w.send(request)).ok, true, 'local recovery does not require network access or a connection');
    assert.equal(w.calls.length, 0);
});

test('removing unsent history persists without recreating cancelled requests; explicit marks start fresh', async () => {
    for (const media of [episode, movie]) {
        const cancelled = entry({ episode: media, key: M.mediaKey(media), status: 'cancelled', manualAt: 1 });
        const other = entry({ id: 'other', key: '999:1:1', status: 'done' });
        const options = { playerEpisode: media, ...(M.isMovie(media) ? movieRemote : {}) };
        const w = await worker({ rows: [cancelled, other], ...options });
        const request = { type: 'myshows:remove', id: cancelled.id, account: 'testuser' };
        const replies = await Promise.all([w.send(request), w.send(request)]);
        assert.deepEqual(replies.map(reply => reply.ok), [true, false]);
        assert.deepEqual(w.state.entries, [other]);
        assert.deepEqual(w.state.removed, [{ account: 'testuser', key: cancelled.key }]);
        assert.equal(w.calls.length, 0); assert.equal(w.tabs.size, 0);
        const sender = { ...movieSender, url: 'https://rezka.fi/' + (M.isMovie(media) ? 'films' : 'series') + '/test/123-example.html' };
        const late = { type: 'myshows:progress', account: 'testuser', episode: media, duration: 1000, ranges: [[0, 1000]], confirmedPosition: 1000 };
        assert.equal((await w.send(late, sender)).tracking, false);
        const restarted = await worker({ values: w.values, ...options });
        assert.equal((await restarted.send(late, sender)).tracking, false);
        await restarted.send({ type: 'myshows:configure', threshold: 1 }); restarted.alarm(); await tick();
        assert.deepEqual(restarted.state.entries, [other]); assert.equal(restarted.calls.length, 0);
        assert.equal(M.isRemoved({ ...restarted.state, account: 'someone-else' }, cancelled.key), false);
        restarted.tabs.set(99, { id: 99, active: true, url: sender.url });
        await restarted.send({ type: 'myshows:configure', enabled: false });
        assert.equal((await restarted.send({ type: 'myshows:force', tabId: 99, key: cancelled.key, account: 'testuser' })).ok, true);
        await until(() => restarted.state.entries.some(item => item.key === cancelled.key && item.status === 'done'));
        const replacement = restarted.state.entries.find(item => item.key === cancelled.key);
        assert.notEqual(replacement.id, cancelled.id); assert.notEqual(replacement.source, cancelled.source);
        assert.deepEqual(restarted.state.removed, []); assert.equal(restarted.calls.length, 1);
    }
});

test('history removal rejects successful, uncertain, active, foreign and non-panel requests but works offline', async () => {
    for (const extra of [
        ...['watching', 'queued', 'sending', 'confirming', 'checking', 'attention', 'done', 'reset'].map(status => ({ status })),
        { status: 'cancelled', submittedAt: 1 }, { status: 'cancelled', manualPending: true }
    ]) {
        const w = await worker({ enabled: false, rows: [entry(extra)] });
        const before = copy(w.state.entries);
        assert.equal((await w.send({ type: 'myshows:remove', id: 'test-entry', account: 'testuser' })).ok, false);
        assert.deepEqual(w.state.entries, before); assert.equal(w.state.removed, undefined); assert.equal(w.calls.length, 0);
    }
    const w = await worker({ rows: [entry({ status: 'cancelled' }), entry({ id: 'foreign', account: 'other', status: 'cancelled' })] });
    const request = { type: 'myshows:remove', id: 'test-entry', account: 'testuser' }, before = copy(w.state.entries);
    for (const extra of [{ account: 'other' }, { account: undefined }, { id: 'foreign' }, { id: 'missing' }]) {
        assert.equal((await w.send({ ...request, ...extra })).ok, false);
    }
    assert.equal((await w.send(request, movieSender)).ok, false);
    assert.equal((await w.send(request, { id: 'extension-id', url: 'https://example.test/' })).ok, false);
    assert.deepEqual(w.state.entries, before);
    await w.send({ type: 'myshows:disconnect' });
    assert.equal((await w.send(request)).ok, true);
    assert.deepEqual(w.state.entries, [before[1]]); assert.equal(w.calls.length, 0);
});

test('removing a cancelled in-flight submission stays blocked until explicit remote rejection', async () => {
    let finish;
    const w = await worker({ response: () => new Promise(resolve => { finish = resolve; }) });
    await w.send({ type: 'myshows:cancel', id: 'test-entry' });
    const request = { type: 'myshows:remove', id: 'test-entry', account: 'testuser' };
    assert.equal((await w.send(request)).ok, false);
    finish({ status: 400, json: async () => ({ error: 'validation failed: sourceApp:len' }) });
    for (let i = 0; i < 20; i++) await tick();
    assert.equal((await w.send(request)).ok, true);
    assert.deepEqual(w.state.entries, []); assert.equal(w.calls.length, 1);
});

test('restoring removed movies and episodes starts fresh tracking and rejects pre-restoration progress', async t => {
    for (const media of [episode, movie]) {
        const key = M.mediaKey(media), cancelled = entry({ episode: media, key, status: 'cancelled' });
        const sender = { ...movieSender, url: `https://rezka.fi/${M.isMovie(media) ? 'films' : 'series'}/test/123-example.html` };
        const w = await worker({ rows: [cancelled], playerEpisode: media, ...(M.isMovie(media) ? movieRemote : {}) });
        w.tabs.set(99, { id: 99, active: true, url: sender.url });
        const tr = await tracker(t, message => w.send(copy(message), sender), { movie: M.isMovie(media) });
        await w.send({ type: 'myshows:remove', id: cancelled.id, account: 'testuser' });
        await tr.sample(950); await tr.sample(951); await tr.flush();
        assert.deepEqual(w.state.entries, []);
        const restore = { type: 'myshows:restore', tabId: 99, key, account: 'testuser' };
        const replies = await Promise.all([w.send(restore), w.send(restore)]);
        assert.deepEqual(replies.map(reply => reply.ok), [true, false]);
        const fresh = w.state.entries[0];
        assert.equal(fresh.status, 'watching'); assert.equal(fresh.progress, 0);
        assert.deepEqual(fresh.ranges, []); assert.equal(fresh.confirmedPosition, 0);
        assert.notEqual(fresh.id, cancelled.id); assert.notEqual(fresh.source, cancelled.source);
        assert.ok(fresh.trackingEpoch); assert.equal(fresh.manualAt, undefined);
        assert.deepEqual(w.state.removed, []); assert.equal(w.calls.length, 0);
        const oldBatch = { type: 'myshows:progress', account: 'testuser', episode: media, duration: 1000, ranges: [[0, 1000]], confirmedPosition: 1000 };
        for (const batch of [oldBatch, { ...oldBatch, trackingEpoch: 'older-viewing' }]) {
            assert.equal((await w.send(batch, sender)).tracking, false);
        }
        assert.equal(w.state.entries[0].progress, 0);
        tr.configure(w.state);
        await tr.sample(950);
        for (let i = 1; i <= 29; i++) await tr.sample(950 + i);
        await tr.flush(); assert.equal(w.calls.length, 0);
        await tr.sample(980);
        await until(() => w.state.entries[0].status === 'done');
        assert.equal(w.calls.length, 1);
        const payload = JSON.parse(w.calls[0].options.body);
        assert.equal(payload.progress, 98); assert.equal(payload.source_app, fresh.source);
    }
});

test('restoration checks the selected media, account and panel origin and preserves global pause', async () => {
    const w = await worker({ rows: [entry({ status: 'cancelled' })], enabled: false });
    await w.send({ type: 'myshows:remove', id: 'test-entry', account: 'testuser' });
    w.state.removed.push({ account: 'other', key: '123:1:2' }, { account: 'testuser', key: 'movie:456' });
    w.tabs.set(99, { id: 99, active: true, url: 'https://rezka.fi/series/test/123-example.html' });
    const request = { type: 'myshows:restore', tabId: 99, key: '123:1:2', account: 'testuser' };
    const before = copy(w.state);
    for (const extra of [{ account: 'other' }, { account: undefined }, { key: 'movie:456' }, { tabId: 999 }]) {
        assert.equal((await w.send({ ...request, ...extra })).ok, false);
    }
    assert.equal((await w.send(request, movieSender)).ok, false);
    assert.equal((await w.send(request, { id: 'extension-id', url: 'https://example.test/' })).ok, false);
    w.tabs.get(99).active = false;
    assert.equal((await w.send(request)).ok, false);
    w.tabs.get(99).active = true;
    assert.deepEqual(w.state, before);
    const reply = await w.send(request);
    assert.equal(reply.ok, true); assert.match(reply.notice, /Включите автоматические отметки/);
    assert.equal(w.state.enabled, false); assert.equal(w.calls.length, 0);
    assert.deepEqual(w.state.removed, before.removed.slice(1));
    const restarted = await worker({ values: w.values });
    assert.equal(restarted.state.entries[0].status, 'watching');
    assert.equal(restarted.state.entries[0].progress, 0); assert.equal(restarted.calls.length, 0);
});

test('restored tracker discards old buffered progress and ignores delayed stop replies or save failures', async t => {
    for (const outcome of ['buffered', 'stopped', 'failed']) {
        let finish, reject; const sent = [];
        const tr = await tracker(t, message => {
            sent.push(copy(message));
            if (outcome !== 'buffered' && sent.length === 1) return new Promise((resolve, fail) => { finish = resolve; reject = fail; });
            return Promise.resolve({ ok: true });
        });
        await tr.sample(950); await tr.sample(951);
        if (outcome !== 'buffered') await tr.flush();
        tr.configure({ enabled: true, connection: 'connected', account: 'testuser', entries: [entry({ status: 'watching', trackingEpoch: 'new-viewing' })] });
        if (outcome === 'stopped') finish({ ok: true, tracking: false });
        if (outcome === 'failed') reject(new Error('old save failed'));
        await tick();
        await tr.sample(10); await tr.sample(11); await tr.flush();
        assert.equal(sent.at(-1).trackingEpoch, 'new-viewing');
        assert.deepEqual(sent.at(-1).ranges, [[10, 11]]);
        assert.equal(sent.at(-1).confirmedPosition, 0);
        assert.equal(tr.current().playback.seconds, 1);
    }
});
