import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const testBuild = { version: 'test', id: 'a'.repeat(64) };

// DOM behavior only. No browser process, page loads, layout emulation or real credentials.
async function menu(t, { section = 'view', stored = {}, save, tabState, workerBuild = testBuild, pendingReload = [], connected = true, myshows } = {}) {
    const dom = new JSDOM(read('extension/popup.html'), { url: 'https://popup.test/', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { window } = dom, values = { 'ui:last-section': section, ...stored }, messages = [];
    // Record intent only: jsdom cannot verify scrolling or viewport visibility.
    window.HTMLElement.prototype.scrollIntoView = function (options) { this.dataset.scrollRequest = options.block; };
    // Simulate only native visibility/events for DOM focus checks; top-layer layout and light dismiss need Chrome.
    const popoverState = (node, open) => {
        const event = new window.Event('beforetoggle'); Object.defineProperty(event, 'newState', { value: open ? 'open' : 'closed' });
        node.dispatchEvent(event); node.dataset.testPopoverOpen = String(open); node.style.display = open ? 'block' : 'none';
    };
    window.HTMLElement.prototype.showPopover = function () { popoverState(this, true); };
    window.HTMLElement.prototype.hidePopover = function () { popoverState(this, false); };
    const storageListeners = new Set();
    const storageChanged = (...args) => storageListeners.forEach(fn => fn(...args));
    const intervals = new Map(); let intervalId = 0;
    window.setInterval = fn => { intervals.set(++intervalId, fn); return intervalId; };
    window.clearInterval = id => intervals.delete(id);
    let activated, updated;
    let activeTab = { id: 1, windowId: 10, url: 'https://rezka.fi/' };
    const reloads = [];
    window.chrome = {
        storage: {
            local: {
                async get() { return { ...values }; },
                async set(items) { Object.assign(values, items); }
            },
            onChanged: { addListener(fn) { storageListeners.add(fn); }, removeListener(fn) { storageListeners.delete(fn); } }
        },
        tabs: {
            async query() { return [activeTab]; },
            async sendMessage(id) { return { build: testBuild, ...(tabState ? await tabState(id) : { connected, settings: [], pendingReload }) }; },
            async reload(id) { reloads.push(id); },
            onActivated: { addListener(fn) { activated = fn; } },
            onUpdated: { addListener(fn) { updated = fn; } }
        },
        runtime: {
            getManifest() { return { version: 'test' }; },
            async openOptionsPage() {},
            async sendMessage(message) {
                if (message.type === 'rezka:build-info') return workerBuild;
                if (message.type === 'myshows:state') return { ok: true, state: values['myshows:state'] };
                if (message.type === 'myshows:current') return myshows ? myshows(message) : { ok: true, current: null };
                messages.push(message);
                if (message.type.startsWith('myshows:') && myshows) return myshows(message);
                if (message.type === 'rezka:save-setting') {
                    if (save) return save(message);
                    const config = window.testSettings.find(item => item.name === message.name);
                    const value = config.options[message.index].value;
                    const key = 'r4:' + message.name;
                    if (value === undefined) delete values[key]; else values[key] = value;
                    storageChanged({ [key]: { newValue: value } }, 'local');
                    return { ok: true };
                }
                throw new Error('Unexpected message');
            }
        }
    };
    window.eval('const REZKA_BUILD = ' + JSON.stringify(testBuild) + ';\n' + read('extension/network-policy.js') + '\n' + read('extension/settings-schema.js') +
        '\nglobalThis.testSettings = REZKA_SETTINGS;\n' + read('extension/myshows-core.js') + '\n' + read('extension/myshows-panel.js') + '\n' + read('extension/popup.js'));
    await tick();
    const $ = selector => window.document.querySelector(selector);
    const search = query => { $('#search-input').value = query; $('#search-input').dispatchEvent(new window.Event('input')); };
    const activate = async tab => { activeTab = tab; activated({ tabId: tab.id, windowId: tab.windowId }); await tick(); };
    const update = async tab => { activeTab = tab; updated(tab.id, { status: 'complete', url: tab.url }, tab); await tick(); };
    const myshowsState = state => { values['myshows:state'] = structuredClone(state); storageChanged({ 'myshows:state': { newValue: values['myshows:state'] } }, 'local'); };
    const poll = async () => { await Promise.all([...intervals.values()].map(fn => fn())); await tick(); };
    return { window, $, values, messages, search, activate, update, reloads, myshowsState, poll };
}

for (const retiredSection of ['subs', 'filter']) test(`removed ${retiredSection} section falls back to appearance and search exposes only retained settings`, async t => {
    const country = { name: 'hide-russian', label: 'Россия (Russian)', options: [{ text: 'Выкл', value: false }, { text: 'Вкл', value: true }], defaultIndex: 0 };
    const { $, window, search, values, messages } = await menu(t, { section: retiredSection,
        stored: { 'r4:content-size': 'r4-content-size-ultrawide', 'ui:country:hide-russian': country },
        tabState: async () => ({ connected: true, settings: [country], pendingReload: [] }) });
    assert.equal(window.document.querySelectorAll('[role="tab"]').length, 4);
    assert.equal($('#tab-view').getAttribute('aria-selected'), 'true');
    assert.equal(values['r4:content-size'], 'r4-content-size-ultrawide');
    assert.equal(values['ui:last-section'], 'view');
    for (const query of ['субтитры', 'OpenSubtitles', 'аккаунт', 'пароль', 'страны', 'Россия', 'Действие фильтра']) {
        search(query);
        assert.ok($('.empty'));
        assert.equal($('.search-destination'), null);
    }
    search('реклама');
    await new Promise(resolve => setTimeout(resolve, 280));
    assert.match($('#search-status').textContent, /найдено: 2/);
    assert.equal($('#content').getAttribute('role'), 'region');
    assert.equal(window.document.querySelectorAll('[role="switch"]').length, 2);
    assert.deepEqual(messages, []);
});

test('MyShows journal separates queue, attention and history, filters accounts and renders titles as text', async t => {
    const make = (id, state, title, account = 'testuser') => ({ id, status: state, episode: { title, season: 1, number: 2 },
        account, progress: 50, createdAt: 1, updatedAt: 1, events: [] });
    const stored = { 'myshows:state': { enabled: true, connection: 'connected', account: 'testuser', threshold: 90,
        entries: [{ ...make('1', 'watching', 'Watching'), progress: 70, watchedProgress: 3, confirmedPosition: 700 }, make('2', 'attention', 'Needs attention'), make('3', 'done', '<img src=x>'), make('4', 'done', 'Other account', 'other')] } };
    const { $, window, search } = await menu(t, { section: 'myshows', stored });
    assert.match($('.myshows-account').textContent, /testuser/);
    assert.equal($('.myshows-entry h3').textContent, 'Watching');
    assert.match($('.myshows-entry').textContent, /Учтено 70%/);
    assert.match($('.myshows-entry').textContent, /По позиции плеера/);
    $('[data-filter="attention"]').click(); assert.equal($('.myshows-entry h3').textContent, 'Needs attention');
    $('[data-filter="history"]').click(); assert.equal($('.myshows-entry h3').textContent, '<img src=x>');
    assert.equal($('.myshows-entry img'), null);
    assert.equal(window.document.querySelectorAll('.myshows-entry').length, 1);
    search('unknown'); await tick(); assert.ok($('.myshows-empty'));
    $('#tab-view').click(); assert.ok($('[data-setting="styles"]'));
});

test('manual episode controls work with auto marks off and send the displayed episode identity', async t => {
    const episode = { rezkaId: 123, title: 'Example', season: 1, number: 2 };
    const stored = { 'myshows:state': { enabled: false, connection: 'connected', account: 'testuser', threshold: 90,
        entries: [{ id: 'entry', key: '123:1:2', status: 'watching', account: 'testuser', episode, progress: 5, createdAt: 1, updatedAt: 1, events: [] }] } };
    let finish;
    const { $, messages } = await menu(t, { section: 'myshows', stored, myshows: async message => {
        if (message.type === 'myshows:current') return { ok: true, current: { tabId: message.tabId, episode, key: '123:1:2' } };
        if (message.type === 'myshows:force') return new Promise(resolve => { finish = resolve; });
    } });
    await tick();
    assert.match($('.myshows-current .myshows-account').textContent, /Example · S01E02/);
    const current = $('.myshows-current button');
    assert.equal(current.disabled, false);
    current.click(); current.click();
    assert.equal(current.disabled, true);
    assert.deepEqual(messages.filter(m => m.type === 'myshows:force').map(m => ({ tabId: m.tabId, key: m.key, account: m.account })), [{ tabId: 1, key: '123:1:2', account: 'testuser' }]);
    finish({ ok: true, notice: 'Серия добавлена в очередь вручную.' }); await tick();
    assert.match($('.myshows-message').textContent, /вручную/);
    $('[data-myshows-action="entry-force"]').click();
    assert.equal(messages.at(-1).id, 'entry');
    finish({ ok: true }); await tick();
});

test('manual controls do not offer duplicate marks for completed or already submitted episodes', async t => {
    const episode = { rezkaId: 123, title: 'Example', season: 1, number: 2 };
    const stored = { 'myshows:state': { enabled: true, connection: 'connected', account: 'testuser', threshold: 90,
        entries: [{ id: 'entry', key: '123:1:2', status: 'done', account: 'testuser', episode, manualAt: 1, createdAt: 1, updatedAt: 1, events: [] }] } };
    const { $, messages } = await menu(t, { section: 'myshows', stored, myshows: async message => ({ ok: true, current: { tabId: message.tabId, episode, key: '123:1:2' } }) });
    await tick();
    assert.equal($('.myshows-current button').hidden, true);
    assert.equal($('.myshows-current .myshows-state').textContent, 'Отмечено в MyShows');
    assert.equal($('.myshows-progress-track').hidden, true, 'a completed mark without measured progress must not invent a percentage');
    $('[data-filter="history"]').click();
    assert.equal($('[data-myshows-action="entry-force"]').hidden, true);
    const infoButton = $('[data-myshows-info="entry"]');
    assert.equal(infoButton.getAttribute('aria-expanded'), 'false');
    assert.match(infoButton.title, /вручную/);
    assert.equal($('.myshows-entry details'), null);
    assert.equal($('.myshows-entry > .myshows-description:not([hidden])'), null);
    infoButton.click();
    assert.match($('.myshows-info').textContent, /Отметка проверена при последней синхронизации/);
    assert.match($('.myshows-info').textContent, /вручную/);
    assert.equal(messages.filter(m => m.type === 'myshows:force').length, 0);
});

test('cancelled current episodes show their actual state and can resume tracking only when unsent', async t => {
    const episode = { rezkaId: 123, title: 'Example', season: 1, number: 2 };
    for (const submittedAt of [undefined, 1]) {
        const stored = { 'myshows:state': { enabled: true, connection: 'connected', account: 'testuser', threshold: 90,
            entries: [{ id: 'entry', key: '123:1:2', status: 'cancelled', submittedAt, account: 'testuser', episode, progress: 10, createdAt: 1, events: [] }] } };
        const { $, messages } = await menu(t, { section: 'myshows', stored, myshows: async message => ({ ok: true, current: { tabId: message.tabId, episode, key: '123:1:2' } }) });
        await tick();
        assert.doesNotMatch($('.myshows-current').textContent, /Уже в синхронизации/);
        assert.match($('.myshows-current').textContent, /Отменено/);
        const resume = $('[data-myshows-current="resume"]');
        assert.equal(resume.hidden, !!submittedAt);
        if (!submittedAt) { resume.click(); await tick(); assert.equal(messages.at(-1).type, 'myshows:resume'); }
        $('[data-filter="history"]').click();
        assert.equal($('[data-myshows-action="entry-resume"]').hidden, !!submittedAt);
    }
});

const myshowsEpisode = { rezkaId: 123, title: 'Example', season: 1, number: 2 };
const myshowsEntry = (extra = {}) => ({ id: 'entry', key: '123:1:2', status: 'watching', account: 'testuser', episode: myshowsEpisode,
    progress: 70, watchedProgress: 3, confirmedPosition: 700, createdAt: 1, updatedAt: 1, events: [], ...extra });
const myshowsState = (entries = [myshowsEntry()], extra = {}) => ({ enabled: true, connection: 'connected', account: 'testuser', threshold: 90, message: '', entries, ...extra });
const currentMyshows = playback => ({ ok: true, current: { tabId: 1, key: '123:1:2', episode: myshowsEpisode, playback } });

test('threshold slider previews freely, survives progress updates and saves only the committed percentage', async t => {
    const initial = myshowsState();
    const saved = deferred();
    const { $, window, messages, myshowsState: setState } = await menu(t, {
        section: 'myshows', stored: { 'myshows:state': initial },
        myshows: message => message.type === 'myshows:configure' ? saved.promise : currentMyshows(null)
    });
    $('.myshows-settings').open = true;
    const slider = $('.myshows-settings input[type="range"]');
    const value = $('.myshows-threshold-value');
    assert.equal(slider.min, '1'); assert.equal(slider.max, '100'); assert.equal(slider.step, '1');
    assert.equal(slider.value, '90'); assert.equal(value.textContent, '90%');
    slider.focus();
    for (const percent of [1, 100, 37]) {
        slider.value = percent; slider.dispatchEvent(new window.Event('input'));
        assert.equal(value.textContent, `${percent}%`);
        assert.equal(slider.getAttribute('aria-valuetext'), `${percent}% просмотра`);
    }
    setState({ ...initial, entries: [myshowsEntry({ progress: 71 })] });
    assert.equal(slider.value, '37', 'background progress must not reset a drag');
    assert.equal(messages.filter(m => m.type === 'myshows:configure').length, 0);
    slider.dispatchEvent(new window.Event('change'));
    assert.deepEqual(messages.filter(m => m.type === 'myshows:configure').map(m => m.threshold), [37]);
    assert.equal(slider.disabled, true);
    assert.equal(value.textContent, '37%', 'keep the selected value visible while saving');
    setState({ ...initial, threshold: 37 }); saved.resolve({ ok: true }); await tick();
    assert.equal(slider.disabled, false);
    assert.equal(slider.value, '37');
    assert.equal(window.document.activeElement, slider);
    assert.match($('.myshows-current .myshows-progress').textContent, /порог 37%/);
    $('#tab-view').click(); $('#tab-myshows').click(); await tick();
    assert.equal($('.myshows-settings input[type="range"]').value, '37');
    assert.equal($('.myshows-threshold-value').textContent, '37%');
});

test('threshold slider restores the saved percentage and reports a failed save', async t => {
    const { $, window } = await menu(t, {
        section: 'myshows', stored: { 'myshows:state': myshowsState() },
        myshows: async message => message.type === 'myshows:configure'
            ? { ok: false, error: 'Не удалось сохранить порог.' } : currentMyshows(null)
    });
    const slider = $('.myshows-settings input[type="range"]');
    slider.value = '42'; slider.dispatchEvent(new window.Event('input')); slider.dispatchEvent(new window.Event('change'));
    await tick();
    assert.equal(slider.disabled, false);
    assert.equal(slider.value, '90');
    assert.equal($('.myshows-threshold-value').textContent, '90%');
    assert.equal(slider.getAttribute('aria-valuetext'), '90% просмотра');
    assert.match($('.myshows-message').textContent, /Не удалось сохранить порог/);
});

test('current episode keeps its percentage across journal filters; threshold and pause update immediately', async t => {
    const initial = myshowsState();
    const m = await menu(t, { section: 'myshows', stored: { 'myshows:state': initial }, myshows: async () => currentMyshows(null) });
    const { $, myshowsState: setState } = m;
    assert.match($('.myshows-current .myshows-progress').textContent, /Учтено 70% · порог 90%/);
    const meter = $('.myshows-progress-meter');
    assert.equal(meter.value, 70);
    assert.match(meter.getAttribute('aria-valuetext'), /Учтено 70% · порог 90%/);
    $('[data-filter="history"]').click();
    assert.match($('.myshows-current .myshows-progress').textContent, /70%/);
    assert.equal($('.myshows-entry'), null);
    $('[data-filter="queue"]').click();
    const row = $('.myshows-entry');
    setState({ ...initial, threshold: 95 });
    assert.equal($('.myshows-settings input[type="range"]').value, '95');
    assert.match(row.textContent, /порог 95%/);
    assert.equal($('.myshows-progress-track').style.getPropertyValue('--myshows-threshold'), '95%');
    assert.match(meter.getAttribute('aria-valuetext'), /порог 95%/);
    assert.doesNotMatch(row.textContent, /90%/);
    setState({ ...initial, threshold: 95, enabled: false });
    assert.match(row.textContent, /Учёт на паузе/);
    assert.doesNotMatch(row.textContent, /Отметим после/);
    assert.match($('.myshows-current .myshows-state').textContent, /паузе/);
    assert.equal($('.myshows-current button').disabled, false);
    assert.equal(meter.value, 70, 'pausing auto marks preserves credited progress');
    assert.match(meter.getAttribute('aria-valuetext'), /автоотметки на паузе/);
});

test('journal search spans all statuses in this account, preserves disclosure and restores the selected filter', async t => {
    const entries = [myshowsEntry(), myshowsEntry({ id: 'attention', status: 'attention' }), myshowsEntry({ id: 'done', status: 'done' }),
        myshowsEntry({ id: 'cancelled', status: 'cancelled' }), myshowsEntry({ id: 'foreign', account: 'another' })];
    const { $, window, search } = await menu(t, { section: 'myshows', stored: { 'myshows:state': myshowsState(entries) }, myshows: async () => currentMyshows(null) });
    const settings = $('.myshows-settings'); settings.open = true;
    $('[data-filter="history"]').click();
    search('Example');
    assert.equal(window.document.querySelectorAll('.myshows-entry').length, 4);
    assert.equal($('.myshows-filters').hidden, true);
    assert.equal($('.myshows-settings'), settings);
    assert.equal(settings.open, true);
    await new Promise(resolve => setTimeout(resolve, 280));
    assert.match($('#content').textContent, /найдено во всём журнале: 4/);
    search('');
    assert.equal($('.myshows-filters').hidden, false);
    assert.equal($('[data-filter="history"]').getAttribute('aria-pressed'), 'true');
    assert.equal(window.document.querySelectorAll('.myshows-entry').length, 2);
});

test('journal updates preserve icon and popover focus, and move focus predictably when a record leaves the filter', async t => {
    const initial = myshowsState([myshowsEntry({ episodeId: 987 })]);
    const { $, window, myshowsState: setState } = await menu(t, { section: 'myshows', stored: { 'myshows:state': initial } });
    const row = $('.myshows-entry'), infoButton = $('[data-myshows-info="entry"]'), info = $('.myshows-info');
    infoButton.focus();
    setState({ ...initial, entries: [{ ...initial.entries[0], progress: 71, updatedAt: 2 }] });
    assert.equal($('.myshows-entry'), row);
    assert.equal(window.document.activeElement, infoButton);
    infoButton.click();
    const close = info.querySelector('button');
    assert.equal(info.dataset.testPopoverOpen, 'true');
    assert.equal(window.document.activeElement, close);
    setState({ ...initial, entries: [{ ...initial.entries[0], progress: 72, updatedAt: 3 }] });
    assert.equal(info.dataset.testPopoverOpen, 'true');
    assert.equal(window.document.activeElement, close);
    close.click();
    assert.equal(infoButton.getAttribute('aria-expanded'), 'false');
    assert.equal(window.document.activeElement, infoButton);
    const anchor = row.querySelector('a'); anchor.focus();
    setState({ ...initial, entries: [{ ...initial.entries[0], progress: 72, updatedAt: 3 }] });
    assert.equal(window.document.activeElement, anchor);
    setState({ ...initial, entries: [{ ...initial.entries[0], status: 'done', updatedAt: 4 }] });
    assert.equal(window.document.activeElement, $('[data-filter="queue"]'));
    assert.ok([...window.document.querySelectorAll('[role="status"]')].some(node => /Example, S01E02: Отмечено в MyShows/.test(node.textContent)));
});

test('journal icon details stay read-only, follow the selected record and close when their account or filter disappears', async t => {
    const initial = myshowsState([
        myshowsEntry({ status: 'done', episodeId: 987, manualAt: 1, events: [{ at: 1, status: 'done', reason: '<img src=x>' }] }),
        myshowsEntry({ id: 'other', status: 'done', episode: { ...myshowsEpisode, title: '<img src=x>' }, episodeId: 988 })
    ]);
    const { $, window, messages, search, myshowsState: setState } = await menu(t, { section: 'myshows', stored: { 'myshows:state': initial } });
    $('[data-filter="history"]').click();
    const row = $('.myshows-entry'), first = $('[data-myshows-info="entry"]'), other = $('[data-myshows-info="other"]'), info = $('.myshows-info');
    assert.equal(row.querySelectorAll('.myshows-entry-icons > :not([hidden])').length, 3);
    assert.equal(row.querySelector('.myshows-actions').hidden, true);
    assert.equal(row.querySelector('.myshows-state').hidden, true);
    for (const control of row.querySelectorAll('.myshows-entry-icons > *')) {
        assert.ok(control.getAttribute('aria-label')); assert.ok(control.title);
        assert.equal(control.querySelector('svg').getAttribute('aria-hidden'), 'true');
    }
    assert.equal(first.getAttribute('aria-controls'), info.id);
    assert.match(first.getAttribute('aria-label'), /Отмечено в MyShows/);
    first.click();
    assert.match(info.textContent, /вручную/);
    assert.match(info.querySelector('ol').textContent, /<img src=x>/);
    other.click();
    assert.equal(first.getAttribute('aria-expanded'), 'false');
    assert.equal(other.getAttribute('aria-expanded'), 'true');
    assert.match(info.querySelector('h2').textContent, /<img src=x>/);
    assert.equal(info.querySelector('img'), null);
    assert.equal(info.querySelectorAll('ol li').length, 1, 'do not retain another entry’s events');
    info.hidePopover(); // Native Escape / light-dismiss notification.
    assert.equal(other.getAttribute('aria-expanded'), 'false');
    first.click(); first.click();
    assert.equal(info.dataset.testPopoverOpen, 'false');
    search('Example'); first.click();
    info.querySelector('button').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(info.dataset.testPopoverOpen, 'false');
    assert.equal($('#search-input').value, 'Example');
    assert.equal(window.document.activeElement, first);
    search('');
    first.click();
    search('missing');
    assert.equal(info.dataset.testPopoverOpen, 'false');
    assert.equal(window.document.activeElement, $('.myshows-journal-title[tabindex]'));
    search(''); $('[data-myshows-info="entry"]').click();
    setState({ ...initial, account: 'another' });
    assert.equal(info.dataset.testPopoverOpen, 'false');
    assert.equal(window.document.activeElement, $('[data-filter="history"]'));
    assert.equal(messages.length, 0, 'reading details never sends a mutation');
});

test('current episode exposes recovery in place and completion as a status instead of a disabled action', async t => {
    const initial = myshowsState([myshowsEntry({ status: 'attention', submittedAt: 1, reason: 'Повторите проверку результата.' })]);
    const { $, messages, myshowsState: setState } = await menu(t, { section: 'myshows', stored: { 'myshows:state': initial },
        myshows: async message => message.type === 'myshows:current' ? currentMyshows(null) : { ok: true } });
    assert.equal($('[data-myshows-current="retry"]').hidden, false);
    assert.equal($('[data-myshows-current="retry"]').disabled, false);
    assert.match($('.myshows-current .myshows-description').textContent, /Повторите проверку/);
    $('[data-myshows-current="retry"]').click(); await tick();
    assert.equal(messages.at(-1).type, 'myshows:retry');
    setState({ ...initial, entries: [{ ...initial.entries[0], status: 'done', reason: '', episodeId: 987 }] });
    assert.equal($('[data-myshows-current="retry"]').hidden, true);
    assert.equal($('.myshows-current button').hidden, true);
    assert.equal($('.myshows-current .myshows-state').textContent, 'Отмечено в MyShows');
    assert.equal($('.myshows-current a').href, 'https://myshows.me/view/episode/987/');
});

test('live confirmation uses reported seconds, pauses without counting, ignores old tab replies and never resets disclosures on search', async t => {
    let playback = { seconds: 12, state: 'playing' };
    let slow;
    const { $, window, poll, activate } = await menu(t, { section: 'myshows', stored: { 'myshows:state': myshowsState() },
        myshows: async message => {
            if (slow) return slow.promise;
            return message.tabId === 1 ? currentMyshows(playback) : { ok: true, current: null };
        } });
    assert.match($('.myshows-confirmation').textContent, /12 из 30 секунд/);
    const status = [...window.document.querySelectorAll('[role="status"]')].find(node => /Подтверждаем позицию/.test(node.textContent));
    const spoken = status.textContent;
    playback = { seconds: 13, state: 'playing' }; await poll();
    assert.match($('.myshows-confirmation').textContent, /13 из 30/);
    assert.equal(status.textContent, spoken);
    playback = { seconds: 13, state: 'paused' }; await poll();
    assert.match($('.myshows-confirmation').textContent, /13 из 30 секунд · пауза/);
    playback = { seconds: 13, state: 'buffering' }; await poll();
    assert.match($('.myshows-confirmation').textContent, /ждём воспроизведение/);
    playback = { seconds: 0, state: 'playing' }; await poll();
    assert.match($('.myshows-confirmation').textContent, /0 из 30/);
    playback = { seconds: 30, state: 'playing' }; await poll();
    assert.match($('.myshows-confirmation').textContent, /Позиция подтверждена/);
    slow = deferred(); const pending = poll();
    await activate({ id: 2, windowId: 10, url: 'https://rezka.fi/' });
    slow.resolve(currentMyshows({ seconds: 25, state: 'playing' })); await pending;
    slow = null; await poll();
    assert.equal($('.myshows-confirmation').hidden, true);
    assert.equal($('.myshows-current .myshows-account').hidden, true);
    assert.equal($('.myshows-progress-track').hidden, true, 'another tab must not show the previous episode progress');
});

test('late current replies cannot restore a countdown after an account change or automatic tracking restart', async t => {
    for (const change of ['account', 'restart']) {
        let pending = deferred();
        const initial = myshowsState();
        const { $, myshowsState: setState, poll } = await menu(t, { section: 'myshows', stored: { 'myshows:state': initial },
            myshows: async () => pending ? pending.promise : currentMyshows({ seconds: 0, state: 'playing' }) });
        // The initial current snapshot has not arrived; context invalidation must still apply.
        if (change === 'account') setState({ ...initial, account: 'another', entries: [] });
        else { setState({ ...initial, enabled: false }); setState(initial); }
        pending.resolve(currentMyshows({ seconds: 23, state: 'playing' })); await tick();
        assert.equal($('.myshows-confirmation').hidden, true);
        pending = null; await poll();
        assert.match($('.myshows-confirmation').textContent, /0 из 30 секунд/);
    }
});

test('empty search is announced; stale search announcements are cancelled on section navigation', async t => {
    const { $, search } = await menu(t);
    search('zzz-неизвестно');
    await new Promise(resolve => setTimeout(resolve, 280));
    assert.match($('#search-status').textContent, /ничего не найдено/);
    assert.equal($('#search-status').getAttribute('role'), 'status');
    assert.equal($('#content').querySelectorAll('h1').length, 1);
    search('реклама');
    $('#tab-player').click();
    await new Promise(resolve => setTimeout(resolve, 280));
    assert.equal($('#search-status').textContent, '');
});

test('search keyboard shortcut requires a modifier, works with Russian layout, and Escape restores focus', async t => {
    const { window, $, search } = await menu(t);
    $('#tab-view').focus();
    const slash = new window.KeyboardEvent('keydown', { key: '/', code: 'Slash', bubbles: true, cancelable: true });
    window.document.dispatchEvent(slash);
    assert.equal(slash.defaultPrevented, false);
    assert.equal(window.document.activeElement, $('#tab-view'));
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'а', code: 'KeyF', ctrlKey: true, bubbles: true, cancelable: true }));
    assert.equal(window.document.activeElement, $('#search-input'));
    search('неизвестно');
    $('.text-button').focus();
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal($('#search-input').value, '');
    assert.equal(window.document.activeElement, $('#search-input'));
});

test('switch label includes the whole row and description; saves and pending reloads have separate feedback', async t => {
    const { $, messages } = await menu(t, { pendingReload: ['styles'] });
    const input = $('[data-setting="styles"]'), row = input.closest('label');
    assert.ok(row);
    assert.equal(row.querySelectorAll('label').length, 0);
    assert.equal(input.getAttribute('aria-labelledby'), row.querySelector('.setting-name').id);
    assert.equal(input.getAttribute('aria-describedby'), row.querySelector('.setting-description').id);
    const before = input.checked;
    row.querySelector('.setting-description').click();
    await tick();
    assert.equal(input.checked, !before);
    assert.equal(messages.filter(item => item.type === 'rezka:save-setting').length, 1);
    assert.match($('#save-status').textContent, /сохранены/);
    assert.match($('#notice-status').textContent, /нужно обновить/);
    assert.match($('#notice-status').textContent, /Доступна кнопка/);
    assert.equal($('#reload-button').hidden, false);
});

test('failed setting save rolls back its switch and announces recovery', async t => {
    const { $ } = await menu(t, { save: () => ({ ok: false }) });
    const input = $('[data-setting="styles"]'), before = input.checked;
    input.click(); await tick();
    assert.equal(input.checked, before);
    assert.equal($('#save-status').dataset.error, 'true');
    assert.match($('#notice-status').textContent, /Повторите попытку/);
});

test('maximum quality is on by default, searchable and persists an explicit off choice', async t => {
    const { $, search, values, messages } = await menu(t, { section: 'player' });
    const input = $('[data-setting="player-max-quality"]');
    assert.equal(input.checked, true);
    input.click(); await tick();
    assert.equal(values['r4:player-max-quality'], false);
    assert.equal(input.checked, false);
    assert.equal(messages[0].name, 'player-max-quality');
    search('4K');
    assert.ok($('[data-setting="player-max-quality"]'));
    const reopened = await menu(t, { section: 'player', stored: { 'r4:player-max-quality': false } });
    assert.equal(reopened.$('[data-setting="player-max-quality"]').checked, false);
});

test('watched dimming is available in appearance, enabled by default and saved without a reload', async t => {
    const { $, search, values } = await menu(t);
    const input = $('[data-setting="dim-watched"]');
    assert.equal(input.checked, true);
    input.click(); await tick();
    assert.equal(values['r4:dim-watched'], false);
    assert.equal($('#reload-button').hidden, true);
    search('просмотренное');
    assert.ok($('[data-setting="dim-watched"]'));
    const reopened = await menu(t, { stored: { 'r4:dim-watched': false } });
    assert.equal(reopened.$('[data-setting="dim-watched"]').checked, false);
});

test('disconnected page is explained with an explicit reload action', async t => {
    const { $ } = await menu(t, { connected: false });
    assert.match($('#notice-status').textContent, /Обновите эту страницу/);
    assert.equal($('#reload-button').hidden, false);
});

test('build identity distinguishes a current page, an older build and an older extension', async t => {
    const current = await menu(t);
    assert.equal(current.$('#version').textContent, 'vtest · aaaaaaaa');
    assert.equal(current.$('#notice').hidden, true);
    for (const build of [{ ...testBuild, id: 'b'.repeat(64) }, null]) {
        const stale = await menu(t, { tabState: () => ({ connected: true, build, settings: [] }) });
        assert.match(stale.$('#notice-text').textContent, /загрузить текущую сборку/);
        assert.equal(stale.$('#site-dot').classList.contains('connected'), false);
        stale.$('#reload-button').click(); await tick();
        assert.deepEqual(stale.reloads, [1]);
    }
    for (const workerBuild of [{ ...testBuild, id: 'c'.repeat(64) }, null]) {
        const stale = await menu(t, { workerBuild });
        assert.match(stale.$('#notice-text').textContent, /chrome:\/\/extensions/);
        assert.equal(stale.$('#reload-button').hidden, true);
    }
});

test('an old build response cannot replace the current tab status', async t => {
    const pending = deferred();
    const h = await menu(t, { tabState: id => id === 1 ? pending.promise : { connected: true, settings: [] } });
    await h.activate({ id: 2, windowId: 10, url: 'https://rezka.fi/films/' });
    pending.resolve({ connected: true, build: { ...testBuild, id: 'old' }, settings: [] });
    await tick();
    assert.equal(h.$('#notice').hidden, true);
    assert.equal(h.$('#site-dot').classList.contains('connected'), true);
});

test('panel follows tabs and navigation without losing the search; reload targets the current tab', async t => {
    const { $, window, activate, update, reloads, search } = await menu(t, { section: 'player', pendingReload: ['styles'] });
    let closed = false;
    const close = window.close.bind(window);
    window.close = () => { closed = true; close(); };
    search('реклама');
    const results = $('#content').firstElementChild;
    await activate({ id: 2, windowId: 10, url: 'https://example.com/' });
    assert.equal($('#site-dot').classList.contains('connected'), false);
    assert.equal($('#reload-button').hidden, true);
    await update({ id: 2, windowId: 10, url: 'https://hdrezka.ag/film' });
    assert.match($('#site-label').textContent, /hdrezka.ag · подключено/);
    assert.equal($('#content').firstElementChild, results);
    assert.equal($('#search-input').value, 'реклама');
    assert.equal($('#tab-player').getAttribute('aria-selected'), 'true');
    $('#reload-button').click(); await tick();
    assert.deepEqual(reloads, [2]);
    assert.equal(closed, false);
    await activate({ id: 3, windowId: 99, url: 'https://another-rezka.example/' });
    assert.match($('#site-label').textContent, /hdrezka.ag/);
});

test('a delayed reply from the previous tab cannot restore its reload action', async t => {
    const stale = deferred();
    const { $, activate } = await menu(t, { tabState: id => id === 2 ? stale.promise : { connected: true, settings: [] } });
    await activate({ id: 2, windowId: 10, url: 'https://hdrezka.ag/' });
    await activate({ id: 3, windowId: 10, url: 'https://example.com/' });
    stale.resolve({ connected: true, settings: [], pendingReload: ['styles'] }); await tick();
    assert.match($('#site-label').textContent, /Настройки для всех зеркал/);
    assert.equal($('#site-dot').classList.contains('connected'), false);
    assert.equal($('#reload-button').hidden, true);
});

test('switching tabs while the panel first connects ignores the delayed initial reply', async t => {
    const initial = deferred();
    const { $, activate } = await menu(t, { tabState: id => id === 1 ? initial.promise : { connected: true, settings: [] } });
    await activate({ id: 2, windowId: 10, url: 'https://hdrezka.ag/' });
    assert.match($('#site-label').textContent, /hdrezka.ag · подключено/);
    initial.resolve({ connected: false }); await tick();
    assert.match($('#site-label').textContent, /hdrezka.ag · подключено/);
    assert.equal($('#reload-button').hidden, true);
});

test('semantic color pairs meet text and essential control contrast thresholds', () => {
    const css = read('extension/popup.css');
    const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(match => [match[1], match[2]]));
    const luminance = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
        .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const contrast = (a, b) => { const values = [luminance(tokens[a]), luminance(tokens[b])].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); };
    for (const [foreground, backgrounds] of [
        ['ink', ['canvas', 'surface']], ['muted', ['canvas', 'surface', 'subtle-surface']],
        ['accent', ['canvas', 'surface']], ['surface', ['accent', 'accent-hover']],
        ['notice-ink', ['notice-surface']], ['error-ink', ['error-surface', 'surface', 'canvas']]
    ]) for (const background of backgrounds) assert.ok(contrast(foreground, background) >= 4.5, `${foreground}/${background}`);
    for (const [foreground, background] of [['control-border', 'surface'], ['control-off', 'canvas'], ['surface', 'control-off'], ['accent', 'subtle-surface']]) {
        assert.ok(contrast(foreground, background) >= 3, `${foreground}/${background}`);
    }
});


test('movie panel uses film actions, generic thresholds and movie links while preserving series history', async t => {
    const movie = { kind: 'movie', rezkaId: 123, title: 'Example film', originalTitle: 'Original film' };
    const film = myshowsEntry({ id: 'film', key: 'movie:123', episode: movie });
    const initial = myshowsState([film, myshowsEntry({ status: 'done', episodeId: 987 })], { enabled: false });
    let current = { ok: true, current: { tabId: 1, key: 'movie:123', episode: movie } };
    const { $, messages, search, myshowsState: setState, poll } = await menu(t, { section: 'myshows', stored: { 'myshows:state': initial },
        myshows: async message => message.type === 'myshows:current' ? current : { ok: true } });
    assert.equal($('.myshows-current h2').textContent, 'Текущий фильм');
    assert.equal($('.myshows-current button').textContent, 'Засчитать фильм');
    assert.match($('.myshows-current .myshows-account').textContent, /Example film · Фильм/);
    assert.doesNotMatch($('.myshows-current').textContent, /Sundefined|Серия|серию/);
    assert.equal($('.myshows-settings input[type="range"]').getAttribute('aria-valuetext'), '90% просмотра');
    $('.myshows-current button').click(); await tick();
    assert.equal(messages.find(m => m.type === 'myshows:force').key, 'movie:123');
    search('original film'); await tick(); assert.equal($('.myshows-entry h3').textContent, 'Example film');
    assert.equal($('[data-myshows-action="film-force"]').textContent, 'Засчитать фильм');
    setState({ ...initial, entries: [{ ...film, status: 'done', movieId: 456, manualAt: 1 }, initial.entries[1]] });
    assert.equal($('.myshows-current button').hidden, true);
    assert.equal($('.myshows-current a').href, 'https://myshows.me/movie/456/');
    assert.equal($('.myshows-current a').textContent, 'Фильм в MyShows');
    assert.equal($('.myshows-entry a').href, 'https://myshows.me/movie/456/');
    current = currentMyshows(null); await poll();
    assert.equal($('.myshows-current h2').textContent, 'Текущая серия');
    assert.equal($('.myshows-current a').href, 'https://myshows.me/view/episode/987/');
});

test('completed films and episodes can be reset from current view and history, then marked again', async t => {
    for (const movie of [false, true]) {
        const episode = movie ? { kind: 'movie', rezkaId: 123, title: 'Example film' } : myshowsEpisode;
        const key = movie ? 'movie:123' : '123:1:2';
        const completed = myshowsEntry({ key, episode, status: 'done', submittedAt: 1 });
        const state = myshowsState([completed]);
        const pending = deferred();
        const h = await menu(t, { section: 'myshows', stored: { 'myshows:state': state }, myshows: message =>
            message.type === 'myshows:current' ? { ok: true, current: { tabId: 1, key, episode } }
                : message.type === 'myshows:reset' ? pending.promise : { ok: true } });
        const { $, messages, window } = h;
        $('[data-filter="history"]').click();
        const currentReset = $('[data-myshows-current="reset"]'), rowReset = $('[data-myshows-action="entry-reset"]');
        assert.equal(currentReset.hidden, false); assert.equal(rowReset.hidden, false);
        assert.match(currentReset.title, /локальную отметку и прогресс/i);
        assert.match($('.myshows-current').textContent, /Если вы сняли её в MyShows/);
        const control = movie ? currentReset : rowReset;
        control.focus(); control.click(); control.click();
        assert.equal(currentReset.disabled, true); assert.equal(rowReset.disabled, true);
        assert.deepEqual(messages.filter(m => m.type === 'myshows:reset').map(m => ({ id: m.id, account: m.account })), [{ id: 'entry', account: 'testuser' }]);
        const reset = myshowsEntry({ id: 'new-entry', key, episode, status: 'reset', progress: 0, watchedProgress: 0, confirmedPosition: 0 });
        h.myshowsState({ ...state, entries: [reset] });
        pending.resolve({ ok: true }); await tick();
        assert.equal($('[data-myshows-action="entry-reset"]'), null);
        assert.equal($('[data-myshows-current="reset"]').hidden, true);
        assert.equal($('.myshows-current .myshows-state').textContent, 'Сброшено в расширении');
        assert.equal($('.myshows-progress-meter').value, 0);
        assert.match($('.myshows-current').textContent, /В MyShows ничего не изменилось/);
        assert.match($('.myshows-current').textContent, /чтобы отметить просмотр заново/);
        assert.equal($('.myshows-current button').hidden, false);
        assert.equal($('.myshows-current button').textContent, movie ? 'Засчитать фильм' : 'Засчитать серию');
        assert.equal($('[data-myshows-current="resume"]').hidden, true);
        assert.equal($('[data-filter="history"] .myshows-filter-count').textContent, '1');
        assert.notEqual(window.document.activeElement, window.document.body);
        const force = $('[data-myshows-action="new-entry-force"]');
        assert.equal(force.hidden, false); force.click(); await tick();
        assert.equal(messages.at(-1).type, 'myshows:force'); assert.equal(messages.at(-1).id, 'new-entry');
    }
});

test('local reset stays available while disconnected and is hidden for pending or uncertain records', async t => {
    const state = myshowsState([myshowsEntry({ status: 'done' })], { connection: 'disconnected', enabled: false });
    const { $, myshowsState: update } = await menu(t, { section: 'myshows', stored: { 'myshows:state': state },
        myshows: message => message.type === 'myshows:current' ? currentMyshows(null) : { ok: true } });
    $('[data-filter="history"]').click();
    assert.equal($('[data-myshows-current="reset"]').disabled, false);
    assert.equal($('[data-myshows-action="entry-reset"]').disabled, false);
    for (const status of ['watching', 'queued', 'sending', 'confirming', 'checking', 'attention', 'cancelled']) {
        update({ ...state, entries: [myshowsEntry({ status, submittedAt: 1 })] });
        assert.equal($('[data-myshows-current="reset"]').hidden, true);
    }
});
