/* Only the worker may ask this isolated script to use the signed-in MyShows UI. */
(() => {
    'use strict';
    if (window !== window.top || location.origin !== 'https://myshows.me') return;
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    function account() {
        const profiles = [...document.querySelectorAll('a.SidebarMenuItem')].filter(a => a.querySelector('.SidebarMenuItem__text')?.textContent.trim() === 'Профиль');
        if (profiles.length !== 1) return '';
        const path = new URL(profiles[0].href).pathname;
        return /^\/[a-z0-9_.-]+\/?$/i.test(path) ? path.replace(/^\/|\/$/g, '').toLowerCase() : '';
    }
    async function ready() {
        for (let attempt = 0; attempt < 30; attempt++) {
            if (account()) return;
            await sleep(300);
        }
        throw new Error('login');
    }
    function ensureAccount(expected) { if (!expected || account() !== expected) throw new Error('account'); }
    async function connect() {
        await ready();
        const login = account();
        if (location.pathname !== '/profile/watch-history/') throw new Error('page');
        let input = document.querySelector('input[name="token"]');
        if (!input) {
            const buttons = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Токен');
            if (buttons.length !== 1) throw new Error('token');
            buttons[0].click();
            for (let i = 0; i < 20 && !input; i++) { await sleep(200); input = document.querySelector('input[name="token"]'); }
        }
        ensureAccount(login);
        const token = input?.value.trim();
        if (!token || token.length < 16 || token.length > 2048 || /\s/.test(token)) throw new Error('token');
        return { account: login, token };
    }
    function cardFor(source) {
        const cards = [...document.querySelectorAll('.ScrobbleCard__info')].filter(card => card.querySelector('.ScrobbleCard__source')?.textContent.trim() === source);
        if (cards.length > 1) throw new Error('duplicate');
        return cards[0];
    }
    function inspect(card, request) {
        const episode = card.querySelector('a[href*="/view/episode/"]')?.getAttribute('href')?.match(/^\/view\/episode\/(\d+)\//)?.[1];
        const code = card.querySelector('.ScrobbleCard__title')?.textContent.match(/\bs(\d+)e(\d+)\b/i);
        if (!code || Number(code[1]) !== request.season || Number(code[2]) !== request.number) throw new Error('match');
        const episodeId = Number(episode);
        if (!Number.isSafeInteger(episodeId) || episodeId <= 0 || (request.episodeId && request.episodeId !== episodeId)) throw new Error('match');
        const approved = !!card.querySelector('.ScrobbleCard__status--approved');
        return { episodeId, approved };
    }
    async function reconcile(request) {
        await ready(); ensureAccount(request.account);
        if (location.pathname !== '/profile/watch-history/' || !/^Rezka Custom · [a-f0-9-]{36}$/.test(request.source)) throw new Error('page');
        let card;
        for (let i = 0; i < 20; i++) { card = cardFor(request.source); if (card) break; await sleep(250); }
        if (!card) throw new Error('missing');
        let result = inspect(card, request);
        if (result.approved) return result;
        if (!request.allowApprove || !request.episodeId) throw new Error('manual');
        if (!card.querySelector('.ScrobbleCard__status--pending')) throw new Error('manual');
        const progress = Number(card.querySelector('.ScrobbleCard__progress-value')?.textContent.replace('%', '').trim());
        if (!Number.isFinite(progress) || progress < request.threshold) throw new Error('progress');
        const buttons = [...card.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Подтвердить');
        if (buttons.length !== 1 || buttons[0].disabled) throw new Error('layout');
        ensureAccount(request.account);
        buttons[0].click();
        for (let i = 0; i < 35; i++) {
            await sleep(300); ensureAccount(request.account);
            card = cardFor(request.source);
            if (card) { result = inspect(card, request); if (result.approved) return result; }
        }
        throw new Error('pending');
    }
    async function verify(request) {
        await ready(); ensureAccount(request.account);
        if (location.pathname !== `/view/episode/${request.episodeId}/`) throw new Error('page');
        const checks = document.querySelectorAll('.EpisodeDetails__watch-label.WatchCheckbox');
        if (checks.length !== 1) throw new Error('layout');
        return { watched: checks[0].classList.contains('WatchCheckbox--checked') };
    }
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (sender.id !== chrome.runtime.id || sender.tab || !message?.type?.startsWith('myshows:site-')) return;
        const actions = { 'myshows:site-connect': connect, 'myshows:site-reconcile': reconcile, 'myshows:site-verify': verify,
            'myshows:site-account': async () => { await ready(); return { account: account() }; } };
        const action = actions[message.type];
        if (!action) return;
        action(message).then(value => respond({ ok: true, ...value }), error => respond({ ok: false, code: error.message }));
        return true;
    });
})();
