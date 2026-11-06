// Synthetic DOM workload only: no browser, network, layout or account data.
// An optional source path allows comparing a saved pre-change implementation.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';

const read = name => readFileSync(new URL('../extension/' + name, import.meta.url), 'utf8');
const source = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : read('watched.js');
const count = 1000, cycles = 20;
const card = id => `<article class="card"><a href="/films/fiction/${id}-example.html"><img alt=""><h3>Title ${id}</h3></a></article>`;
const dom = new JSDOM('<a class="b-tophead__contwatch" href="/continue/">History</a><section id="search"></section>', {
    url: 'https://rezka.fi/search/', runScripts: 'outside-only'
});
const w = dom.window, root = w.document.querySelector('#search').attachShadow({ mode: 'open' });
root.innerHTML = '<p id="status"></p><ul id="options"></ul><div id="cards">' + Array.from({ length: count }, (_, i) => card(i + 1)).join('') + '</div>';
const timers = new Map(); let timerID = 0, scanMs = 0, scans = 0, writes = 0;
w.setTimeout = (fn, delay) => { timers.set(++timerID, { fn, delay }); return timerID; };
w.clearTimeout = id => timers.delete(id);
w.chrome = { storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } } };
w.fetch = async () => ({ ok: true, text: async () => '<div id="videosaves-list"></div>' });
async function flush() {
    // Deliver native MutationObserver microtasks, then drain only the scan debounce.
    for (let turn = 0; turn < 20; turn++) {
        await new Promise(resolve => setImmediate(resolve));
        const pending = [...timers].filter(([, task]) => task.delay === 60);
        if (!pending.length) return;
        for (const [id, task] of pending) {
            timers.delete(id); const started = performance.now(); task.fn();
            scanMs += performance.now() - started; scans++;
        }
    }
    throw new Error('Watched observer did not settle');
}
try {
    w.eval(read('network-policy.js') + '\nconst REZKA_WATCHED_CSS = "";\n' + read('watched-site.js') + '\n' + source + '\nRezkaWatched.registerRoot(document.querySelector("#search").shadowRoot);');
    await flush();
    const observer = new w.MutationObserver(records => { writes += records.length; });
    observer.observe(root.querySelector('#cards'), { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
    scans = 0; scanMs = 0;
    const started = performance.now();
    for (let i = 0; i < cycles; i++) {
        root.querySelector('#status').textContent = 'Checked: ' + i;
        const option = w.document.createElement('li'); option.textContent = 'Country ' + i;
        root.querySelector('#options').replaceChildren(option);
        await flush();
    }
    observer.disconnect();
    console.log(JSON.stringify({ cards: count, cycles, scans, cardAttributeWrites: writes,
        scanMs: Math.round(scanMs * 100) / 100, workloadMs: Math.round((performance.now() - started) * 100) / 100 }, null, 2));
} finally { w.close(); }
