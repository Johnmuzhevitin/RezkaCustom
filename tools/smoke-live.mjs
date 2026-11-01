import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve('.browser-binaries');
const { chromium } = await import('@playwright/test');
const extension = resolve('extension');
const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1440, height: 1000 }
});
const report = [];
try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const settingsState = url => worker.evaluate(async url => {
        const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
        return tab ? chrome.tabs.sendMessage(tab.id, { type: 'rezka:settings-state' }, { frameId: 0 }) : null;
    }, url);
    await mkdir('test-results', { recursive: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const url of [process.argv[2] || 'https://rezka.fi/']) {
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
            const state = await settingsState(page.url());
            report.push({ url: page.url(), status: response.status(), title: await page.title(), connected: state?.connected, settings: state?.settings?.length, errors });
            await page.screenshot({ path: 'test-results/live-home.png', fullPage: false });
            const firstTitle = page.locator('.b-content__inline_item-link a[href]').first();
            const href = await firstTitle.count() ? await firstTitle.getAttribute('href') : null;
            if (href) {
                await page.goto(new URL(href, page.url()).href, { waitUntil: 'domcontentloaded', timeout: 25000 });
                await settingsState(page.url());
                report.push({ url: page.url(), title: await page.title(), player: await page.locator('#cdnplayer').count(), controls: await page.locator('.r4-player-controls-right').count(), errors: [...errors] });
                await page.screenshot({ path: 'test-results/live-title.png', fullPage: false });
            }
        } catch (error) {
            report.push({ url, finalUrl: page.url(), error: error.message, title: await page.title(),
                text: (await page.locator('body').innerText().catch(() => '')).slice(0, 700), errors });
            await page.screenshot({ path: 'test-results/live-failure.png' }).catch(() => {});
        }
    }
    await writeFile('test-results/live-smoke.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} finally { await context.close(); }
