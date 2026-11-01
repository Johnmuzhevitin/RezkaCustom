import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL('../extension/' + file, import.meta.url), 'utf8');
const path = '/films/fiction/42-example-2026.html';
const history = (entries = []) => '<div id="videosaves-list">' + entries.map(entry =>
    `<div class="b-videosaves__list_item ${entry.watched ? 'watched-row' : ''}"><div class="title"><a href="${path}">Title</a></div><a class="view" data-id="${entry.saveID}"></a></div>`).join('') + '</div>';

function harness(t, handler) {
    const dom = new JSDOM('', { url: 'https://rezka.fi', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const calls = [], w = dom.window;
    w.fetch = async (url, options) => {
        calls.push({ url, options });
        assert.equal(new URL(url).origin, 'https://rezka.fi');
        assert.equal(options.credentials, 'same-origin');
        assert.equal(options.redirect, 'error');
        return { ok: true, text: async () => handler(url, options) };
    };
    w.eval(read('network-policy.js') + '\n' + read('watched-site.js') + '\nwindow.site = RezkaWatchedSite;');
    return { w, api: w.site, calls };
}

test('new movie and series marks create a native save, then mark it using its returned history ID', async t => {
    for (const kind of ['Movies', 'Series']) {
        let entries = [], payload;
        const h = harness(t, (url, options) => {
            if (url.endsWith('/continue/')) return history(entries);
            if (url.endsWith('.html')) return `<input id="post_id" value="42"><script>sof.tv.initCDN${kind}Events(42, 111, ${kind === 'Series' ? '3, 8' : 'false, true'}, false); window.untrustedRan = true;</script>`;
            if (url.endsWith('/ajax/send_save/')) {
                payload = Object.fromEntries(new URLSearchParams(options.body));
                entries = [{ saveID: '987', watched: false }];
                return '{"success":true}';
            }
            assert.equal(options.body, 'id=987');
            entries[0].watched = true;
            return '{"success":true}';
        });
        const result = await h.api.setWatched('https://rezka.ag' + path, true);
        assert.ok(result.has('42'));
        assert.equal(h.w.untrustedRan, undefined, 'fetched scripts must never run');
        assert.deepEqual(payload, { post_id: '42', translator_id: '111', season: kind === 'Series' ? '3' : '0',
            episode: kind === 'Series' ? '8' : '0', current_time: '0', duration: '0' });
    }
});

test('existing saves preserve progress; explicit desired state avoids stale-card toggle inversions', async t => {
    const entries = [{ saveID: '987', watched: true }, { saveID: '988', watched: true }];
    const h = harness(t, (url, options) => {
        if (url.endsWith('/continue/')) return history(entries);
        assert.ok(url.endsWith('/engine/ajax/cdn_saves_view.php'));
        entries.find(entry => entry.saveID === new URLSearchParams(options.body).get('id')).watched = false;
        return '{"success":true}';
    });
    await h.api.setWatched(path, true);
    assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 0, 'already watched stays watched');
    assert.equal(h.calls.length, 1, 'a fresh history read already confirms an unchanged mark');
    const result = await h.api.setWatched(path, false);
    assert.equal(result.has('42'), false);
    assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 2, 'all saves of the same title are unmarked');
    assert.ok(h.calls.every(c => !c.url.includes('send_save')));
});

test('an ambiguous POST is reconciled without a second toggle', async t => {
    const entries = [{ saveID: '987', watched: false }];
    const h = harness(t, (url, options) => {
        if (!options.method) return history(entries);
        entries[0].watched = true;
        throw new Error('Connection lost after commit');
    });
    assert.ok((await h.api.setWatched(path, true)).has('42'));
    assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1);
    assert.equal(h.calls.length, 3, 'the reconciliation read is already the confirmation');
});

test('new-title metadata overlaps the fresh history read without creating a save from stale hints', async t => {
    for (const appeared of [false, true]) {
        let entries = [], holdHistory = false, releaseHistory;
        const h = harness(t, async (url, options) => {
            if (url.endsWith('/continue/')) {
                if (holdHistory) {
                    holdHistory = false;
                    await new Promise(resolve => { releaseHistory = resolve; });
                }
                return history(entries);
            }
            if (url.endsWith('.html')) {
                if (appeared) throw new Error('Unused metadata is unavailable');
                return '<input id="post_id" value="42"><script>sof.tv.initCDNMoviesEvents(42,111,false,true,false);</script>';
            }
            if (url.endsWith('/ajax/send_save/')) entries = [{ saveID: '987', watched: false }];
            else entries[0].watched = true;
            return '{"success":true}';
        });
        await h.api.load();
        if (appeared) entries = [{ saveID: '987', watched: true }];
        holdHistory = true;
        const action = h.api.setWatched(path, true);
        await new Promise(resolve => setTimeout(resolve, 0));
        const prepared = h.calls.some(call => call.url.endsWith('.html'));
        const prematurePosts = h.calls.filter(call => call.options.method === 'POST').length;
        releaseHistory();
        assert.ok((await action).has('42'));
        assert.equal(prepared, true, 'metadata starts before the history request finishes');
        assert.equal(prematurePosts, 0, 'fresh history remains required before any account write');
        assert.equal(h.calls.filter(call => call.url.includes('send_save')).length, appeared ? 0 : 1);
    }
});

test('missing login history and mismatched title metadata fail before any account mutation', async t => {
    for (const scenario of ['login', 'wrong-title', 'no-player', 'zero-part']) {
        const h = harness(t, url => url.endsWith('/continue/')
            ? scenario === 'login' ? '<form>Sign in</form>' : history()
            : `<input id="post_id" value="${scenario === 'wrong-title' ? '99' : '42'}"><script>${scenario === 'no-player' ? '' : scenario === 'zero-part' ? 'sof.tv.initCDNSeriesEvents(42,111,0,0,false)' : 'sof.tv.initCDNMoviesEvents(99,111,false,true,false)'}</script>`);
        await assert.rejects(h.api.setWatched(path, true));
        assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 0);
    }
});

test('unsafe URLs and invalid action types are rejected before fetching', async t => {
    const h = harness(t, () => history());
    for (const url of ['https://evil.test' + path, 'javascript:alert(1)', '/logout/', 'https://a:b@rezka.fi' + path]) {
        await assert.rejects(h.api.setWatched(url, true));
    }
    await assert.rejects(h.api.setWatched(path, 'true'));
    assert.equal(h.calls.length, 0);
});

test('server rejection or a false success never becomes a confirmed mark', async t => {
    for (const response of ['{"success":false}', '{"success":true}']) {
        const h = harness(t, (url, options) => options.method ? response : history([{ saveID: '987', watched: false }]));
        await assert.rejects(h.api.setWatched(path, true));
        assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1);
    }
});

test('browser locks serialize account updates across extension tabs', async t => {
    const h = harness(t, () => history([{ saveID: '987', watched: true }]));
    let locked = false;
    h.w.navigator.locks = { async request(name, update) {
        assert.equal(name, 'rezka-custom:watched:42'); locked = true;
        return update();
    } };
    await h.api.setWatched(path, true);
    assert.equal(locked, true);
});
