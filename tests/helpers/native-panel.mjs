import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function openNativePanel(context, worker, page) {
    const inspector = await context.newPage();
    await inspector.goto(`chrome-extension://${worker.url().split('/')[2]}/help.html`);
    const windowId = await inspector.evaluate(async () => (await chrome.windows.getCurrent()).id);
    // A real click supplies the user gesture required by the Side Panel API.
    await inspector.evaluate(windowId => {
        const button = document.createElement('button');
        button.id = 'test-open-panel'; button.textContent = 'Open test panel';
        button.onclick = () => chrome.sidePanel.open({ windowId });
        document.body.append(button);
    }, windowId);
    await inspector.locator('#test-open-panel').click();
    await page.bringToFront();
    await expect.poll(() => worker.evaluate(() => chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'] }).then(items => items.length))).toBe(1);
    await expect.poll(() => inspector.evaluate(() => {
        const panel = chrome.extension.getViews().find(view => view.location.pathname === '/popup.html');
        return panel?.innerHeight > 600 && panel.document.querySelector('#content')?.getAttribute('aria-busy') === 'false';
    })).toBe(true);
    return { inspector, windowId };
}

export async function attachPanel(context, inspector, extensionId) {
    const session = await context.newCDPSession(inspector);
    const { targetInfos } = await session.send('Target.getTargets');
    const target = targetInfos.find(item => item.url === `chrome-extension://${extensionId}/popup.html`);
    if (!target) throw new Error('Native side-panel target was not created');
    const { sessionId } = await session.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
    let nextId = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { session.off('Target.receivedMessageFromTarget', receive); reject(new Error(`${method} timed out`)); }, 10000);
        function receive(event) {
            if (event.sessionId !== sessionId) return;
            const message = JSON.parse(event.message);
            if (message.id !== id) return;
            clearTimeout(timer); session.off('Target.receivedMessageFromTarget', receive);
            if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
        }
        session.on('Target.receivedMessageFromTarget', receive);
        session.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => {
            clearTimeout(timer); session.off('Target.receivedMessageFromTarget', receive); reject(error);
        });
    });
    const evaluate = async (fn, arg = null) => {
        const reply = await send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true });
        if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text + ': ' + (reply.exceptionDetails.exception?.description || ''));
        return reply.result.value;
    };
    const click = async selector => {
        const point = await evaluate(selector => {
            const node = document.querySelector(selector);
            if (!node || node.hidden || node.disabled) throw new Error(`Unavailable control: ${selector}`);
            node.scrollIntoView({ block: 'center' });
            const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, selector);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    };
    return {
        evaluate, click,
        text: selector => evaluate(selector => document.querySelector(selector)?.textContent || '', selector),
        async search(value) {
            await click('#search-input');
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
            if (value) await send('Input.insertText', { text: value });
        },
        async capture(name) {
            await evaluate(() => { document.querySelector('#content').scrollTop = 0; });
            const image = await send('Page.captureScreenshot', { format: 'png' });
            await writeFile(test.info().outputPath(name), Buffer.from(image.data, 'base64'));
        },
        async close() { await session.send('Target.detachFromTarget', { sessionId }); await session.detach(); }
    };
}

export async function captureNativePanel(context, inspector, extensionId, name) {
    const panel = await attachPanel(context, inspector, extensionId);
    try { await panel.capture(name); } finally { await panel.close(); }
}
