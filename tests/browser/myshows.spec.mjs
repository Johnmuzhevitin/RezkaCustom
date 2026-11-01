import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixturePage } from '../helpers/fixtures.mjs';
import { silentWave, fulfillMedia, seekMedia } from '../helpers/media.mjs';
import { openNativePanel, attachPanel } from '../helpers/native-panel.mjs';

// Supplementary, explicitly authorized disposable-browser checks. No real account,
// token, site response or viewing history is copied into this profile.
const account = 'fixture_myshows';
const episode = { rezkaId: 123, season: 1, number: 1, title: 'Тестовый сериал', originalTitle: 'Fixture Series', imdb: 'tt1234567' };
const makeEntry = (number, status, extra = {}) => ({
    id: `fixture-${number}`, key: `123:1:${number}`, account, episode: { ...episode, number },
    status, duration: 120, ranges: [[0, 24]], progress: 20, watchedProgress: 20,
    createdAt: 1793491200000, updatedAt: 1793491200000 + number, events: [],
    nextAt: Date.now() + 86400000, ...extra
});

let context, worker, page, panel, errors, externalRequests;
test.beforeEach(async () => {
    const extension = resolve('extension');
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium', headless: true, viewport: null,
        args: ['--screen-info={2560x1440}', '--window-size=2560,1392', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    errors = []; externalRequests = [];
    context.on('weberror', error => errors.push(error.error().message));
    const js = await readFile(new URL('./fixture.js', import.meta.url), 'utf8');
    const html = fixturePage()
        .replace('b-simple_episode__item active"', 'b-simple_episode__item active" data-id="123" data-season_id="1" data-episode_id="1"')
        .replace('<video></video>', '<video controls muted preload="auto" src="/episode.wav"></video>');
    const media = silentWave();
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.protocol === 'chrome-extension:') return route.continue();
        if (url.origin !== 'https://rezka.fi') { externalRequests.push(url.origin + url.pathname); return route.abort(); }
        if (url.pathname === '/episode.wav') return fulfillMedia(route, media);
        if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: js });
        if (url.pathname === '/cover.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"/>' });
        if (url.pathname === '/series/123-fixture.html') return route.fulfill({ contentType: 'text/html', body: html });
        return route.fulfill({ contentType: 'text/plain', body: '' });
    });
    worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => !!(await chrome.alarms.get('rezka-myshows-sync')))).toBe(true);
    await worker.evaluate(async ({ account, entries }) => {
        // A fixed fake token only in this newly created disposable extension profile.
        await new Promise((resolve, reject) => {
            const request = indexedDB.open('rezka-myshows-credentials', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('credentials');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result, tx = db.transaction('credentials', 'readwrite');
                tx.objectStore('credentials').put({ account, token: 'fixture-token-never-valid' }, 'active');
                tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
            };
        });
        await chrome.storage.local.set({ 'ui:last-section': 'myshows', 'myshows:state': {
            version: 1, enabled: true, threshold: 90, account, connection: 'connected', message: '', entries
        } });
    }, { account, entries: [makeEntry(1, 'watching'), makeEntry(2, 'attention', { reason: 'Тестовая ошибка сопоставления' }),
        makeEntry(3, 'done', { episodeId: 123456, manualAt: 1 }), makeEntry(4, 'cancelled'),
        makeEntry(5, 'queued'), makeEntry(6, 'done', { account: 'other_fixture_account' })] });
    page = await context.newPage();
    await page.goto('https://rezka.fi/series/123-fixture.html');
    await expect.poll(() => page.locator('video').evaluate(v => v.duration)).toBe(120);
    const extensionId = worker.url().split('/')[2];
    const { inspector } = await openNativePanel(context, worker, page);
    panel = await attachPanel(context, inspector, extensionId);
    await expect.poll(() => panel.text('.myshows-current .myshows-account')).toContain('S01E01');
    const build = await worker.evaluate(() => REZKA_BUILD.id);
    expect(await page.locator('html').getAttribute('data-rezka-build')).toBe(build);
    expect(await panel.evaluate(() => REZKA_BUILD.id)).toBe(build);
    await expect.poll(() => panel.text('#site-label')).toContain('подключено');
});
test.afterEach(async () => { try { await panel?.close(); } finally { await context?.close(); panel = null; } });

test('MyShows help collects a private diagnostic snapshot from the installed worker, panel and selected page', async () => {
    const help = await context.newPage();
    await help.goto(`chrome-extension://${worker.url().split('/')[2]}/help.html`);
    await expect(help.locator('#diagnostics-tab option')).toHaveCount(2);
    await help.locator('#diagnostics-collect').click();
    await expect(help.locator('#diagnostics-report')).toBeVisible();
    const text = await help.locator('#diagnostics-report').inputValue();
    const report = JSON.parse(text), build = await worker.evaluate(() => REZKA_BUILD.id);
    for (const value of Object.values(report.builds)) expect(value?.id).toBe(build);
    expect(report.buildChecks).toEqual({ help: 'match', panel: 'match', page: 'match' });
    expect(report.page.state).toBe('responding');
    expect(report.myshows.current.progress).toBe(20);
    expect(report.myshows.counts.done).toBe(1);
    expect(text).not.toMatch(/fixture_myshows|other_fixture_account|Fixture Series|Тестовый сериал|fixture-token|https:/);
    await help.locator('#diagnostics-copy').click();
    await expect(help.locator('#diagnostics-status')).toHaveText('Диагностика скопирована.');
    await help.locator('.diagnostics').screenshot({ path: test.info().outputPath('myshows-diagnostics.png') });
    await help.locator('#diagnostics-tab').selectOption('');
    await expect(help.locator('#diagnostics-copy')).toBeDisabled();
    await expect(help.locator('#diagnostics-report')).toBeHidden();
    expect(externalRequests).toEqual([]); expect(errors).toEqual([]);
});

test('MyShows native panel searches the whole journal and shows recovery and completion states', async () => {
    await panel.click('[data-filter="history"]');
    await expect.poll(() => panel.evaluate(() => document.querySelectorAll('.myshows-entry').length)).toBe(2);
    await panel.click('.myshows-settings summary');
    await panel.capture('myshows-native-settings.png');
    await panel.search('тестовый');
    await expect.poll(() => panel.evaluate(() => document.querySelectorAll('.myshows-entry').length)).toBe(5);
    expect(await panel.evaluate(() => document.querySelector('.myshows-filters').hidden)).toBe(true);
    expect(await panel.evaluate(() => document.querySelector('.myshows-settings').open)).toBe(true);
    expect(await panel.text('.myshows-list')).toMatch(/Смотрю/);
    expect(await panel.text('.myshows-list')).toMatch(/Нужно внимание/);
    expect(await panel.text('.myshows-list')).toMatch(/Отмечено в MyShows/);
    expect(await panel.text('.myshows-list')).toMatch(/Отменено/);
    expect(await panel.text('.myshows-list')).toMatch(/В очереди/);
    await panel.search('S01E04');
    await expect.poll(() => panel.evaluate(() => document.querySelectorAll('.myshows-entry').length)).toBe(1);
    expect(await panel.text('.myshows-list')).toContain('Отменено');
    await panel.search('нет такого сериала');
    await expect.poll(() => panel.text('.myshows-empty')).toContain('Ничего не найдено');
    await panel.search('');
    await expect.poll(() => panel.evaluate(() => document.querySelector('[data-filter="history"]').getAttribute('aria-pressed'))).toBe('true');
    await panel.click('.myshows-settings summary');
    await panel.capture('myshows-native-history.png');
    await panel.click('[data-filter="queue"]');
    await panel.click('[data-myshows-current="cancel"]');
    await expect.poll(() => panel.text('.myshows-current .myshows-state')).toBe('Отменено');
    await panel.click('[data-myshows-current="resume"]');
    await expect.poll(() => panel.text('.myshows-current .myshows-state')).toBe('Смотрю');
    for (const status of ['attention', 'done']) {
        await worker.evaluate(async status => {
            const state = (await chrome.storage.local.get('myshows:state'))['myshows:state'];
            Object.assign(state.entries[0], { status, episodeId: 123456, submittedAt: 1, reason: '' });
            await chrome.storage.local.set({ 'myshows:state': state });
        }, status);
        await expect.poll(() => panel.text('.myshows-current .myshows-state')).toBe(status === 'done' ? 'Отмечено в MyShows' : 'Нужно внимание');
        expect(await panel.evaluate(() => document.querySelector('[data-myshows-current="retry"]').hidden)).toBe(status === 'done');
        if (status === 'attention') await panel.capture('myshows-native-attention.png');
    }
    await panel.capture('myshows-native-done.png');
    expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(externalRequests).toEqual([]); expect(errors).toEqual([]);
});

test('MyShows countdown uses real playback, freezes on pause, resets on seek and credits position after 30 seconds', async () => {
    test.setTimeout(85000);
    await seekMedia(page.locator('video'), 35);
    await page.locator('video').evaluate(v => v.play());
    await expect.poll(() => panel.text('.myshows-confirmation'), { timeout: 16000 }).toMatch(/(?:[5-9]|1\d) из 30 секунд$/);
    await page.locator('video').evaluate(v => v.pause());
    await expect.poll(() => panel.text('.myshows-confirmation')).toContain('пауза');
    const frozen = await panel.text('.myshows-confirmation');
    // Deliberate elapsed playback/idle time is the subject of this integration test.
    await new Promise(resolve => setTimeout(resolve, 3200));
    expect(await panel.text('.myshows-confirmation')).toBe(frozen);
    await seekMedia(page.locator('video'), 60);
    await expect.poll(() => panel.text('.myshows-confirmation')).toBe('Подтверждение позиции: 0 из 30 секунд · пауза');
    await page.locator('video').evaluate(v => v.play());
    await expect.poll(() => panel.text('.myshows-confirmation'), { timeout: 27000 }).toMatch(/2[0-7] из 30 секунд$/);
    const before = await worker.evaluate(async () => (await chrome.storage.local.get('myshows:state'))['myshows:state'].entries[0]);
    expect(before.confirmedPosition || 0).toBe(0); expect(before.progress).toBeLessThan(50);
    await panel.capture('myshows-native-countdown.png');
    await expect.poll(() => panel.text('.myshows-confirmation'), { timeout: 16000 }).toBe('Позиция подтверждена просмотром.');
    await page.locator('video').evaluate(v => v.pause());
    await expect.poll(() => panel.text('.myshows-current .myshows-progress')).toMatch(/Учтено 7\d% · порог 90%/);
    const after = await worker.evaluate(async () => (await chrome.storage.local.get('myshows:state'))['myshows:state'].entries[0]);
    expect(after.confirmedPosition).toBeGreaterThanOrEqual(90);
    expect(after.progress).toBeGreaterThanOrEqual(75); expect(after.status).toBe('watching');
    await panel.capture('myshows-native-confirmed.png');
    expect(externalRequests).toEqual([]); expect(errors).toEqual([]);
});
