// Browser-only layout regression harness. No extension settings or accounts are accessed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('../extension/', import.meta.url);
const files = new Set(['popup.html', 'popup.css', 'popup.js', 'build-info.js', 'network-policy.js', 'settings-schema.js']);
const shim = `
const state = { 'ui:last-section': 'player' };
window.chrome = {
  storage: { local: { get: async () => ({...state}), set: async values => Object.assign(state, values) }, onChanged: { addListener() {} } },
  tabs: { query: async () => [{ id: 1, windowId: 1, url: 'https://rezka.fi/' }], sendMessage: async () => ({ connected: true, build: REZKA_BUILD, settings: [] }), onActivated: { addListener() {} }, onUpdated: { addListener() {} } },
  runtime: { getManifest: () => ({version:'layout-check'}), sendMessage: async message => message.type === 'rezka:build-info' ? REZKA_BUILD : ({ok:false,error:'Preview only'}), openOptionsPage() {} }
};`;
const harness = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Проверка размеров меню Rezka</title>
<style>body{margin:28px;font:15px/1.5 'Segoe UI',sans-serif;background:#e3e7ef;color:#222a3b}h1{font-size:22px}iframe{border:0;background:#f2f4f8;box-shadow:0 8px 30px #2233}button{padding:8px 14px}pre{white-space:pre-wrap} .checks{display:flex;gap:32px;align-items:start}</style>
<h1>Проверка размеров меню Rezka</h1><p>Локальная проверка вёрстки. Настройки расширения не изменяются.</p>
<button id="run">Проверить размеры панели</button><pre id="results" role="status">Проверяем…</pre>
<iframe id="menu" title="Меню расширения" width="440" height="900" src="/popup.html"></iframe>
<script>
const frame=document.querySelector('iframe'), output=document.querySelector('#results');
const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
async function check(){
 const results=[];
 for(const width of [320,360,440]){
  frame.width=width;await tick();
  const measured=frame.contentDocument.body.getBoundingClientRect().width;
  const measuredHeight=frame.contentDocument.body.getBoundingClientRect().height;
  results.push({width,measured,measuredHeight,pass:measured===width&&measuredHeight===900});
 }
 frame.width=440;await tick();
 const doc=frame.contentDocument, bounds=doc.querySelector('.tabs').getBoundingClientRect();
 const tabs=[...doc.querySelectorAll('[role=tab]')].map(el=>({name:el.textContent,inside:el.getBoundingClientRect().right<=bounds.right}));
 const pass=results.every(r=>r.pass)&&tabs.every(r=>r.inside);
 output.textContent=JSON.stringify({pass,devicePixelRatio,results,tabs},null,2);
 output.dataset.pass=String(pass);
}
frame.addEventListener('load',check);document.querySelector('#run').onclick=check;
</script></html>`;

const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname.slice(1);
    try {
        if (path === '') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(harness); return; }
        if (path === 'preview-shim.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(shim); return; }
        if (!files.has(path)) { response.writeHead(404).end(); return; }
        let content = await readFile(new URL(path, root), 'utf8');
        if (path === 'popup.html') content = content.replace('<script src="network-policy.js"', '<script src="preview-shim.js"></script><script src="network-policy.js"');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
        response.end(content);
    } catch { response.writeHead(500).end(); }
});
server.listen(4318, '127.0.0.1', () => console.log('Menu layout check: http://127.0.0.1:4318'));
