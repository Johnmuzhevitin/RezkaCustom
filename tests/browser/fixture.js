window.playerCalls = [];
let playing = false;
let time = 25;
window.CDNPlayer = { api(method, value) {
    playerCalls.push({ method, value });
    if (method === 'time') return time;
    if (method === 'duration') return 120;
    if (method === 'seek') time = Number(value);
    if (method === 'volume') return 0.5;
    if (method === 'muted') return false;
    if (method === 'play' || method === 'pause') {
        playing = method === 'play';
        window.postMessage({ event: playing ? 'resumed' : 'paused', time }, '*');
    }
} };
window.sof = { tv: { buildCDNPlayer() { playerCalls.push({ method: 'build' }); } } };
document.querySelectorAll('.b-simple_episode__item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.b-simple_episode__item').forEach(other => other.classList.remove('active'));
        item.classList.add('active');
    });
});
setTimeout(() => {
    window.postMessage({ event: 'init' }, '*');
    window.postMessage({ event: 'inited' }, '*');
}, 300);
