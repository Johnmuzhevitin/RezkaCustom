import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { fixturePage } from '../helpers/fixtures.mjs';
import { openNativePanel, captureNativePanel } from '../helpers/native-panel.mjs';

const extension = resolve('extension');
const html = fixturePage();
const js = await readFile(new URL('./fixture.js', import.meta.url), 'utf8');
let context, worker, page, errors;

async function openMenu() {
    const popup = await context.newPage();
    popup.on('pageerror', error => errors.push(error.message));
    await popup.setViewportSize({ width: 440, height: 900 });
    await page.bringToFront();
    await popup.goto(`chrome-extension://${worker.url().split('/')[2]}/popup.html`);
    await expect(popup.locator('#content')).toHaveAttribute('aria-busy', 'false');
    return popup;
}

test.beforeEach(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium', headless: true,
        args: ['--screen-info={1600x1200}', '--window-size=1440,1100', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
        viewport: null
    });
    worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.protocol === 'chrome-extension:') return route.continue();
        if (url.hostname.endsWith('.localhost')) return route.continue();
        if (url.hostname.endsWith('imdb.com')) return route.fulfill({ contentType: 'text/html', body: '<meta property="imdb:pageConst" content="tt1234567">' });
        if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: js });
        if (url.pathname === '/cover.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"><rect width="40" height="60" fill="#555"/></svg>' });
        if (url.pathname === '/engine/ajax/quick_content.php') return route.fulfill({ body: '<span class="imdb">IMDb: <b>8.4</b> <i>(123)</i></span>' });
        return route.fulfill({ contentType: 'text/html', body: url.pathname === '/collections/' ? fixturePage({ activeCollections: true }) : html,
            headers: { 'Content-Security-Policy': "script-src 'self'; object-src 'none'" } });
    });
    page = await context.newPage();
    errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://rezka.fi/series/test.html');
    await expect(page.locator('body')).toHaveClass(/r4-hotkeys-enabled/);
    await expect(page.locator('.r4-player-controls-right')).toBeAttached();
});
test.afterEach(async () => { await context?.close(); });

test('active collection navigation and native card inheritance also work in advanced search', async () => {
    await page.goto('https://rezka.fi/collections/');
    await expect(page.locator('.b-topnav__item-link.active')).toHaveText('Подборки');
    await expect(page.locator('#rc-cards-style')).toBeAttached();
    const native = await page.locator('[data-id="42"] .b-content__inline_item-link > a').evaluate(element => {
        const style = getComputedStyle(element);
        return { size: style.fontSize, line: style.lineHeight, color: style.color };
    });
    const coverBackground = await page.locator('[data-id="42"] .b-content__inline_item-cover').evaluate(element => getComputedStyle(element).backgroundColor);
    expect(coverBackground).toBe('rgba(0, 0, 0, 0)');
    await page.locator('#rc-search-entry').click();
    await expect(page.locator('#rc-search-root .card')).toHaveCount(2);
    const search = await page.locator('#rc-search-root .card h3').first().evaluate(element => {
        const style = getComputedStyle(element);
        return { size: style.fontSize, line: style.lineHeight, color: style.color };
    });
    expect(search).toEqual(native);
    await expect(page.locator('#rc-search-root .episode')).toHaveText('1 сезон, 8 серия');
    expect(await page.locator('#rc-search-root .card h3').first().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
});

test('panel settings persist through reload and another mirror', async () => {
    const popup = await openMenu();
    await expect(popup.locator('#site-label')).toContainText('подключено');
    await expect(popup.getByRole('tab')).toHaveCount(4);
    await expect(page.locator('.r4-settings')).toHaveCount(0);
    await popup.getByRole('radio', { name: '1340 пикселей' }).click();
    await expect(page.locator('body')).toHaveClass(/r4-content-size-ultrawide/);
    const settings = await worker.evaluate(() => chrome.storage.local.get(null));
    expect(settings['r4:content-size']).toBeTruthy();
    await page.reload();
    await expect.poll(() => page.locator('body').getAttribute('class')).toContain(settings['r4:content-size']);
    await page.goto('https://hdrezka.ag/series/test.html');
    await expect.poll(() => page.locator('body').getAttribute('class')).toContain(settings['r4:content-size']);
    expect(errors).toEqual([]);
});

test('play/pause, fullscreen, next/previous and autoplay reach the page player without subtitle controls', async () => {
    await expect(page.locator('body')).toHaveClass(/r4-hotkeys-enabled/);
    await page.keyboard.press('Space');
    await expect(page.locator('body')).toHaveClass(/r4-playing/);
    await page.keyboard.press('Space');
    await expect(page.locator('body')).toHaveClass(/r4-paused/);
    await page.keyboard.press('f');
    await expect.poll(() => page.evaluate(() => playerCalls.some(call => call.method === 'fullscreen'))).toBe(true);
    await page.keyboard.press('n');
    await expect(page.locator('.b-simple_episode__item.active')).toHaveText('Серия 2');
    await expect.poll(() => page.evaluate(() => playerCalls.some(call => call.method === 'build'))).toBe(true);
    await page.keyboard.press('p');
    await expect(page.locator('.b-simple_episode__item.active')).toHaveText('Серия 1');
    await page.evaluate(() => {
        document.body.classList.add('r4-auto-play-next-enabled');
        window.postMessage({ event: 'ended' }, '*');
    });
    await expect(page.locator('.b-simple_episode__item.active')).toHaveText('Серия 2');
    await expect(page.locator('.r4-player-control-subtitles, .r4-subtitles-list-wrapper')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('storage is isolated from page JS and script does not run on unrelated sites', async () => {
    expect(await page.evaluate(() => typeof GM)).toBe('undefined');
    expect(await page.evaluate(() => typeof RezkaPlayer)).toBe('undefined');
    await page.goto('https://example.com/');
    await expect(page.locator('.r4-settings')).toHaveCount(0);
    await page.goto('https://example.com/rezka/anything/');
    await expect(page.locator('.r4-settings')).toHaveCount(0);
    await page.goto('https://rezka.local/');
    await expect(page.locator('.r4-settings')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('HTTP mirrors can use the player bridge without secure-context-only APIs', async () => {
    await page.goto('http://rezka.fi/series/test.html');
    await expect(page.locator('.r4-player-controls-right')).toBeAttached();
    await page.keyboard.press('Space');
    await expect(page.locator('body')).toHaveClass(/r4-playing/);
    expect(errors).toEqual([]);
});

test('IMDb ratings, country filter and collapsed blocks remain functional', async () => {
    const popup = await openMenu();
    await popup.getByRole('switch', { name: 'Рейтинги IMDb' }).check();
    await expect(page.locator('.rating-value b')).toHaveText(['8.4', '8.4']);
    await expect(page.locator('[data-id="43"]')).toHaveClass(/r4-content-russian/);
    await page.locator('.r4-hide-info-button').click();
    await expect(page.locator('body')).toHaveClass(/r4-hide-info/);
    await page.locator('.r4-comments-title').click();
    await expect(page.locator('body')).toHaveClass(/r4-comments-hide/);
    expect(errors).toEqual([]);
});

test('browser action opens the side panel and network rules exclude the removed subtitle service', async () => {
    const id = worker.url().split('/')[2];
    const rules = await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
    expect(rules.find(rule => rule.id === 1)).toBeUndefined();
    expect(rules.every(rule => rule.condition.initiatorDomains.join() === id)).toBe(true);
    expect(new RegExp(rules.find(rule => rule.id === 3).condition.regexFilter).test('https://api.opensubtitles.com/api/v1/login')).toBe(false);
    expect(await worker.evaluate(() => chrome.runtime.getManifest().action.default_popup)).toBeUndefined();
    expect(await worker.evaluate(() => chrome.sidePanel.getOptions({}))).toMatchObject({ path: 'popup.html', enabled: true });
    expect(await worker.evaluate(() => chrome.sidePanel.getPanelBehavior())).toEqual({ openPanelOnActionClick: true });
    const popup = await openMenu();
    await expect(popup.getByRole('heading', { name: 'Под ваш экран' })).toBeVisible();
    await popup.screenshot({ path: test.info().outputPath('menu-view.png') });
    expect(errors).toEqual([]);
});

test('native side panel fills the available height in every section and resizes with the browser', async () => {
    const { inspector, windowId } = await openNativePanel(context, worker, page);
    for (const height of [1100, 750]) {
        await worker.evaluate(({ windowId, height }) => chrome.windows.update(windowId, { height }), { windowId, height });
        await expect.poll(() => page.evaluate(() => outerHeight)).toBe(height);
        const pageHeight = await page.evaluate(() => innerHeight);
        for (const section of ['view', 'player', 'hide', 'myshows']) {
            await inspector.evaluate(section => {
                chrome.extension.getViews().find(view => view.location.pathname === '/popup.html').document.getElementById(`tab-${section}`).click();
            }, section);
            await expect.poll(() => inspector.evaluate(pageHeight => {
                const panel = chrome.extension.getViews().find(view => view.location.pathname === '/popup.html');
                const doc = panel.document, content = doc.getElementById('content');
                content.scrollTop = content.scrollHeight;
                const pane = content.getBoundingClientRect(), footer = doc.querySelector('.footer').getBoundingClientRect();
                return {
                    fillsHeight: panel.innerHeight >= pageHeight - 64 && panel.innerHeight <= pageHeight,
                    shellFillsPanel: doc.querySelector('.shell').getBoundingClientRect().height === panel.innerHeight,
                    fitsWidth: doc.body.getBoundingClientRect().width === panel.innerWidth && doc.documentElement.scrollWidth === panel.innerWidth,
                    visibleTabs: [...doc.querySelectorAll('[role="tab"]')].filter(tab => {
                        const box = tab.getBoundingClientRect();
                        return box.left >= 0 && box.right <= panel.innerWidth && box.top >= 0 && box.bottom <= panel.innerHeight;
                    }).length,
                    contentReachable: content.clientHeight > 0 && content.lastElementChild.getBoundingClientRect().bottom <= pane.bottom + 1,
                    footerVisible: footer.top >= pane.bottom && footer.bottom === panel.innerHeight
                };
            }, pageHeight)).toEqual({ fillsHeight: true, shellFillsPanel: true, fitsWidth: true, visibleTabs: 4, contentReachable: true, footerVisible: true });
        }
        await inspector.evaluate(() => {
            const panel = chrome.extension.getViews().find(view => view.location.pathname === '/popup.html');
            panel.document.getElementById('tab-view').click();
        });
        await captureNativePanel(context, inspector, worker.url().split('/')[2], `side-panel-window-${height}.png`);
    }
    expect(errors).toEqual([]);
});

test('native side panel follows the active tab, keeps settings and stays open after reload', async () => {
    const { inspector } = await openNativePanel(context, worker, page);
    const state = () => inspector.evaluate(() => {
        const doc = chrome.extension.getViews().find(view => view.location.pathname === '/popup.html').document;
        return { label: doc.getElementById('site-label').textContent, connected: doc.getElementById('site-dot').classList.contains('connected'), reload: !doc.getElementById('reload-button').hidden };
    });
    await expect.poll(state).toMatchObject({ label: 'rezka.fi · подключено', connected: true });
    await inspector.evaluate(() => {
        const doc = chrome.extension.getViews().find(view => view.location.pathname === '/popup.html').document;
        doc.querySelector('[data-setting="content-size"][data-index="3"]').click();
    });
    await expect(page.locator('body')).toHaveClass(/r4-content-size-ultrawide/);
    const second = await context.newPage();
    await second.goto('https://hdrezka.ag/series/test.html');
    await second.bringToFront();
    await expect.poll(state).toMatchObject({ label: 'hdrezka.ag · подключено', connected: true });
    await second.goto('https://example.com/');
    await expect.poll(state).toMatchObject({ connected: false, reload: false });
    await second.goto('https://hdrezka.ag/series/test.html');
    await expect.poll(state).toMatchObject({ label: 'hdrezka.ag · подключено', connected: true });
    await expect(second.locator('body')).toHaveClass(/r4-content-size-ultrawide/);
    await page.evaluate(() => { window.reloadSentinel = true; });
    await second.evaluate(() => { window.reloadSentinel = true; });
    for (const index of [1, 0]) {
        await inspector.evaluate(index => {
            const doc = chrome.extension.getViews().find(view => view.location.pathname === '/popup.html').document;
            doc.getElementById('tab-player').click();
            doc.querySelector(`[data-setting="player-scale"][data-index="${index}"]`).click();
        }, index);
        // Reverting this setting deliberately waits for an explicit reload.
        await expect(second.locator('#oframecdnplayer')).toHaveCSS('transform', 'matrix(1.5, 0, 0, 1.5, 0, 0)');
    }
    await expect.poll(state).toMatchObject({ reload: true });
    await Promise.all([second.waitForEvent('domcontentloaded'), inspector.evaluate(() => {
        chrome.extension.getViews().find(view => view.location.pathname === '/popup.html').document.getElementById('reload-button').click();
    })]);
    await expect.poll(state).toMatchObject({ label: 'hdrezka.ag · подключено', reload: false });
    expect(await second.evaluate(() => window.reloadSentinel)).toBeUndefined();
    await expect(second.locator('#oframecdnplayer')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    expect(await page.evaluate(() => window.reloadSentinel)).toBe(true);
    expect(errors).toEqual([]);
});

test('search, keyboard navigation, offline editing and responsive panel width work', async () => {
    const popup = await openMenu();
    await popup.getByRole('searchbox').fill('реклама');
    await expect(popup.getByRole('switch')).toHaveCount(2);
    await expect(popup.getByRole('switch', { name: 'Отключать рекламу в плеере' })).toBeVisible();
    await popup.getByRole('searchbox').fill('несуществующая настройка');
    await expect(popup.getByRole('heading', { name: 'Ничего не нашлось' })).toBeVisible();
    await popup.getByRole('button', { name: 'Очистить поиск' }).click();
    await popup.getByRole('tab', { name: 'Вид', exact: true }).focus();
    await popup.keyboard.press('ArrowRight');
    await expect(popup.getByRole('tab', { name: 'Плеер', exact: true })).toHaveAttribute('aria-selected', 'true');
    await popup.screenshot({ path: test.info().outputPath('menu-player.png') });
    for (const width of [320, 440]) {
        await popup.setViewportSize({ width, height: 900 });
        expect(await popup.evaluate(() => document.body.getBoundingClientRect().width)).toBe(width);
        expect(await popup.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        if (width === 320) await popup.screenshot({ path: test.info().outputPath('panel-narrow.png') });
    }
    await popup.close();
    await page.goto('https://example.com/');
    const offline = await openMenu();
    await expect(offline.locator('#notice')).toContainText('когда вы откроете Rezka');
    await offline.getByRole('tab', { name: 'Вид', exact: true }).click();
    await offline.getByRole('switch', { name: 'Рейтинги IMDb' }).check();
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('r4:imdb'))['r4:imdb'])).toBe('r4-imdb');
    await page.goto('https://rezka.fi/series/test.html');
    await expect(page.locator('.rating-value b')).toHaveText(['8.4', '8.4']);
    expect(errors).toEqual([]);
});

test('reload-only changes preserve playback until requested and retain pending state on reopen', async () => {
    let popup = await openMenu();
    await popup.getByRole('tab', { name: 'Плеер', exact: true }).click();
    await popup.getByRole('radio', { name: '1.5x', exact: true }).click();
    await expect(page.locator('#oframecdnplayer')).toHaveCSS('transform', 'matrix(1.5, 0, 0, 1.5, 0, 0)');
    await page.evaluate(() => { window.reloadSentinel = true; });
    await popup.getByRole('radio', { name: '1x', exact: true }).click();
    await expect(popup.getByRole('button', { name: 'Обновить страницу' })).toBeVisible();
    expect(await page.evaluate(() => window.reloadSentinel)).toBe(true);
    await popup.close(); popup = await openMenu();
    await expect(popup.getByRole('button', { name: 'Обновить страницу' })).toBeVisible();
    await Promise.all([page.waitForEvent('domcontentloaded'), popup.getByRole('button', { name: 'Обновить страницу' }).click()]);
    expect(await page.evaluate(() => window.reloadSentinel)).toBeUndefined();
    await expect(page.locator('#oframecdnplayer')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    expect(errors).toEqual([]);
});

test('switches apply to existing tabs without duplicating hotkeys and persist after reload', async () => {
    const second = await context.newPage();
    await second.goto('https://hdrezka.ag/series/test.html');
    await expect(second.locator('.r4-player-controls-right')).toBeAttached();
    const popup = await openMenu();
    await popup.getByRole('tab', { name: 'Плеер', exact: true }).click();
    const hotkeys = popup.getByRole('switch', { name: 'Горячие клавиши', exact: true });
    for (let index = 0; index < 2; index++) {
        await hotkeys.uncheck();
        await expect(page.locator('body')).not.toHaveClass(/r4-hotkeys-enabled/);
        await hotkeys.check();
        await expect(second.locator('body')).toHaveClass(/r4-hotkeys-enabled/);
    }
    await page.evaluate(() => { window.playerCalls = []; });
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => playerCalls.filter(call => call.method === 'play').length)).toBe(1);
    await expect(popup.getByRole('tab', { name: 'Фильтр', exact: true })).toHaveCount(0);
    await popup.screenshot({ path: test.info().outputPath('menu-player.png') });
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/r4-hotkeys-enabled/);
    expect(errors).toEqual([]);
});

test('retired subtitle selection falls back safely and changes survive closing the panel', async () => {
    const subtitleRequests = [];
    context.on('request', request => {
        if (new URL(request.url()).hostname.endsWith('opensubtitles.com')) subtitleRequests.push(request.url());
    });
    await worker.evaluate(() => chrome.storage.local.set({ 'ui:last-section': 'subs', 'r4:content-size': 'r4-content-size-ultrawide' }));
    let panel = await openMenu();
    await expect(panel.getByRole('tab')).toHaveCount(4);
    await expect(panel.getByRole('tab', { name: 'Вид', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('radio', { name: '1340 пикселей' })).toHaveAttribute('aria-checked', 'true');
    await expect(panel.locator('#tab-subs, #account-form')).toHaveCount(0);
    await panel.getByRole('searchbox').fill('субтитры');
    await expect(panel.getByRole('heading', { name: 'Ничего не нашлось' })).toBeVisible();
    await panel.getByRole('button', { name: 'Очистить поиск' }).click();
    await panel.getByRole('switch', { name: 'Рейтинги IMDb' }).check();
    await panel.close();
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('r4:imdb'))['r4:imdb'])).toBe('r4-imdb');
    panel = await openMenu();
    await expect(panel.getByRole('switch', { name: 'Рейтинги IMDb' })).toBeChecked();
    await page.evaluate(() => window.postMessage({ event: 'new' }, '*'));
    await expect(page.locator('.r4-player-control-subtitles, .r4-subtitles-list-wrapper')).toHaveCount(0);
    expect(await worker.evaluate(async () => {
        try { await request({ url: 'https://api.opensubtitles.com/api/v1/subtitles' }, 'https://rezka.fi/'); }
        catch (error) { return error.message; }
    })).toBe('Адрес запроса не разрешён.');
    expect(subtitleRequests).toEqual([]);
    expect(errors).toEqual([]);
});

test('worker follows allowed redirects and refuses redirects outside the service allowlist', async () => {
    let forbiddenReached = false;
    const server = createServer((req, res) => {
        if (req.url === '/allowed') res.writeHead(302, { location: '/final' }).end();
        else if (req.url === '/denied') res.writeHead(302, { location: `http://other.localhost:${server.address().port}/secret` }).end();
        else if (req.url === '/secret') { forbiddenReached = true; res.end('secret'); }
        else res.end('redirect-success');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const source = `http://rezka.localhost:${server.address().port}`;
    try {
        const result = await worker.evaluate(source => request({ url: source + '/allowed' }, source), source);
        expect(result.status).toBe(200);
        expect(result.responseText).toBe('redirect-success');
        const denied = await worker.evaluate(async source => {
            try { await request({ url: source + '/denied' }, source); }
            catch (error) { return error.message; }
        }, source);
        expect(denied).toBeTruthy();
        expect(forbiddenReached).toBe(false);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
