(() => {
    'use strict';
    if (window !== window.top || typeof RezkaNetwork === 'undefined' || !RezkaNetwork.isSite(location.href)) return;
    const prefix = 'rezka:voice-favorite:';
    const paths = {
        chevron: 'm5 9 7 7 7-7', close: 'm6 6 12 12M18 6 6 18',
        check: 'm5 12 4 4L19 6', star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',
        audio: 'M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v7h4v-7ZM20 12h1v7h-4v-7Z'
    };
    const messages = {
        'missing-episode': 'У этой озвучки нет текущей серии. Продолжается просмотр с прежней озвучкой.',
        'network': 'Не удалось проверить озвучку. Проверьте соединение и попробуйте ещё раз.',
        'unavailable': 'Эта озвучка сейчас недоступна. Выберите другую или попробуйте ещё раз.',
        'restricted': 'Эта озвучка недоступна для текущего аккаунта. Прежний выбор сохранён.',
        'context-changed': 'Серия или озвучка уже изменилась. Выберите вариант для текущей серии.',
        'not-ready': 'Плеер ещё не готов. Дождитесь загрузки и попробуйте ещё раз.',
        'unsupported': 'Не удалось переключить озвучку в этом плеере.',
        'switch-failed': 'Не удалось завершить переключение. Проверьте выбранную озвучку и повторите попытку.',
        'playback': 'Озвучка выбрана, но восстановить воспроизведение не удалось. Запустите видео или выберите другую озвучку.',
        'busy': 'Дождитесь завершения переключения.'
    };
    let nativeList, nativeObserver, bar, trigger, playerButton, playerHost, menu, search, clear, list, status, opener;
    let favorites = new Set(), rows = [], pending = false, opened = false, scheduled = false, requestSequence = 0;
    let snapshot = '', query = '', saving = new Set();
    const requests = new Map();
    const el = (tag, className, text) => {
        const node = document.createElement(tag); if (className) node.className = className;
        if (text !== undefined) node.textContent = text; return node;
    };
    function icon(name) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[name]); svg.append(path); return svg;
    }
    function button(className, label, iconName) {
        const node = el('button', className); node.type = 'button';
        if (label) { node.setAttribute('aria-label', label); node.title = label; }
        if (iconName) node.append(icon(iconName)); return node;
    }
    const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const key = node => [node.dataset.translator_id, ...['camrip', 'ads', 'director'].map(name => /^\d+$/.test(node.dataset[name] || '') ? node.dataset[name] : '0')].join(':');
    function readRows() {
        return [...nativeList.querySelectorAll('li.b-translator__item[data-translator_id]')]
            .filter(node => /^\d+$/.test(node.dataset.translator_id))
            .map(node => {
                let name = node.textContent.trim().replace(/\s+/g, ' ');
                if (node.dataset.director === '1' && !/реж/i.test(name)) name += ' (реж. версия)';
                const language = [...node.querySelectorAll('img[title], img[alt]')].map(img => img.title || img.alt).filter(Boolean).join(', ');
                return { key: key(node), id: node.dataset.translator_id, name, language, selected: node.classList.contains('active'), disabled: node.classList.contains('disabled') };
            });
    }
    function announce(text = '', failed = false) { status.textContent = text; status.dataset.error = String(failed); }
    function updateTriggers() {
        const selected = rows.find(row => row.selected);
        for (const control of [trigger, playerButton].filter(Boolean)) {
            const name = control.querySelector('.rc-voice-trigger-name');
            name.textContent = selected?.name || 'Выбрать';
            control.setAttribute('aria-label', `Озвучка: ${selected?.name || 'не выбрана'}`);
            control.title = `${selected?.name || 'Выбрать озвучку'}${pending ? ' — переключение' : ''}`;
            control.setAttribute('aria-expanded', String(opened));
            control.setAttribute('aria-busy', String(pending));
        }
    }
    function render() {
        if (!menu) return;
        const focusKey = document.activeElement?.closest('[data-voice-key]')?.dataset.voiceKey;
        const focusStar = document.activeElement?.classList.contains('rc-voice-star');
        const scroll = list.scrollTop;
        const matched = rows.filter(row => normalize(`${row.name} ${row.language}`).includes(normalize(query)));
        const groups = [matched.filter(row => favorites.has(row.id)), matched.filter(row => !favorites.has(row.id))];
        list.replaceChildren();
        for (let index = 0; index < groups.length; index++) {
            if (!groups[index].length) continue;
            const section = el('section');
            const heading = el('h3', 'rc-voice-group-title', index === 0 ? 'Избранные' : groups[0].length ? 'Другие озвучки' : 'Все озвучки');
            heading.id = `rc-voice-group-${index}`; section.setAttribute('aria-labelledby', heading.id); section.append(heading);
            for (const row of groups[index]) {
                const wrapper = el('div', 'rc-voice-row'); wrapper.dataset.voiceKey = row.key; wrapper.dataset.selected = String(row.selected);
                const choice = button('rc-voice-choice', null, 'check');
                choice.setAttribute('aria-current', String(row.selected)); choice.disabled = pending || row.disabled;
                const label = el('span', 'rc-voice-name', row.name);
                if (row.language) label.append(el('span', 'rc-voice-language', row.language));
                choice.append(label); choice.addEventListener('click', () => choose(row));
                const favorite = favorites.has(row.id);
                const star = button('rc-voice-icon-button rc-voice-star', `${favorite ? 'Убрать из избранного' : 'Добавить в избранное'}: ${row.name}`, 'star');
                star.setAttribute('aria-pressed', String(favorite)); star.setAttribute('aria-disabled', String(saving.has(row.id)));
                star.addEventListener('click', () => toggleFavorite(row));
                wrapper.append(choice, star); section.append(wrapper);
            }
            list.append(section);
        }
        if (!matched.length) list.append(el('p', 'rc-voice-message', query ? 'Озвучки не найдены' : 'Нет доступных озвучек'));
        clear.hidden = !query;
        list.scrollTop = scroll;
        if (focusKey) {
            const row = [...list.querySelectorAll('[data-voice-key]')].find(node => node.dataset.voiceKey === focusKey);
            const focus = row?.querySelector(focusStar ? '.rc-voice-star' : '.rc-voice-choice');
            if (focus && !focus.disabled) {
                focus.focus({ preventScroll: true });
                // Favoriting can move the focused row between groups. Scroll this list only.
                const itemRect = row.getBoundingClientRect(), listRect = list.getBoundingClientRect();
                if (itemRect.top < listRect.top) list.scrollTop += itemRect.top - listRect.top;
                else if (itemRect.bottom > listRect.bottom) list.scrollTop += itemRect.bottom - listRect.bottom;
            }
            else if (opened) search.focus({ preventScroll: true });
        }
        updateTriggers();
    }
    async function toggleFavorite(row) {
        if (saving.has(row.id)) return;
        saving.add(row.id); render();
        try {
            const favorite = !favorites.has(row.id);
            await chrome.storage.local.set({ [prefix + row.id]: favorite });
            if (favorite) favorites.add(row.id); else favorites.delete(row.id);
            announce(favorite ? `${row.name} — в избранном` : `${row.name} — удалена из избранного`);
        } catch { announce('Не удалось сохранить избранное. Попробуйте ещё раз.', true); }
        finally { saving.delete(row.id); render(); }
    }
    function switchVoice(value) {
        return new Promise(resolve => {
            const id = `${Date.now()}-${++requestSequence}`;
            const timer = setTimeout(() => { requests.delete(id); resolve({ ok: false, code: 'switch-failed' }); }, 35000);
            requests.set(id, { resolve, timer });
            document.dispatchEvent(new CustomEvent('rezka-custom:voice-request', { detail: JSON.stringify({ id, key: value }) }));
        });
    }
    document.addEventListener('rezka-custom:voice-response', event => {
        let message; try { message = JSON.parse(event.detail); } catch { return; }
        const request = requests.get(message?.id); if (!request) return;
        clearTimeout(request.timer); requests.delete(message.id); request.resolve(message);
    });
    async function choose(row) {
        if (pending || row.disabled) return;
        if (row.selected) { close(); return; }
        pending = true; announce(`Проверяем и переключаем: ${row.name}…`); render();
        const result = await switchVoice(row.key);
        pending = false; refresh(); render();
        if (result.ok) { announce(); close(); }
        else announce(messages[result.code] || messages.unavailable, true);
    }
    function position() {
        if (!opened || !opener?.isConnected) return;
        const rect = opener.getBoundingClientRect();
        const width = Math.min(360, window.innerWidth - 24);
        const below = window.innerHeight - rect.bottom - 16, above = rect.top - 16;
        const upwards = below < 280 && above > below;
        const height = Math.max(160, Math.min(480, upwards ? above : below, window.innerHeight - 24));
        menu.style.width = `${width}px`; menu.style.maxHeight = `${height}px`;
        menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
        menu.style.top = upwards ? 'auto' : `${Math.max(12, rect.bottom + 6)}px`;
        menu.style.bottom = upwards ? `${Math.max(12, window.innerHeight - rect.top + 6)}px` : 'auto';
    }
    function open(control) {
        if (opened) { close(); return; }
        opener = control; query = ''; search.value = ''; announce();
        const host = document.fullscreenElement || document.body;
        if (menu.parentElement !== host) host.append(menu);
        opened = true; render(); position(); menu.showPopover(); search.focus();
    }
    function close(restoreFocus = true) {
        if (!opened) return;
        opened = false; menu.hidePopover(); updateTriggers();
        if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
    }
    function createMenu() {
        menu = el('div', 'rc-voice-menu'); menu.id = 'rc-voice-menu'; menu.setAttribute('popover', 'auto');
        menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-labelledby', 'rc-voice-title');
        menu.addEventListener('toggle', event => {
            if (event.newState === 'closed' && opened) {
                opened = false; updateTriggers();
                if (opener?.isConnected) opener.focus({ preventScroll: true });
            }
        });
        const header = el('div', 'rc-voice-heading');
        const heading = el('h2', '', 'Озвучка'); heading.id = 'rc-voice-title';
        const dismiss = button('rc-voice-icon-button', 'Закрыть выбор озвучки', 'close'); dismiss.addEventListener('click', () => close()); header.append(heading, dismiss);
        const searchWrap = el('div', 'rc-voice-search-wrap');
        search = el('input'); search.type = 'search'; search.placeholder = 'Найти озвучку'; search.setAttribute('aria-label', 'Найти озвучку'); search.autocomplete = 'off';
        clear = button('rc-voice-icon-button', 'Очистить поиск', 'close'); clear.hidden = true;
        clear.addEventListener('click', () => { query = ''; search.value = ''; render(); search.focus(); });
        search.addEventListener('input', () => { query = search.value; render(); list.scrollTop = 0; });
        searchWrap.append(search, clear); list = el('div', 'rc-voice-list');
        status = el('p', 'rc-voice-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        menu.append(header, searchWrap, list, status); document.body.append(menu);
        for (const name of ['click', 'dblclick', 'pointerdown', 'mousedown', 'wheel']) menu.addEventListener(name, event => event.stopPropagation());
        // Capture before site/player shortcuts. Typing and arrows must never seek or toggle playback.
        document.addEventListener('keydown', event => {
            if (!opened) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
            if (!menu.contains(event.target)) return;
            event.stopImmediatePropagation();
            const choices = [...list.querySelectorAll('.rc-voice-choice:not(:disabled)')];
            const current = choices.indexOf(event.target);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const index = current < 0 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1) : Math.max(0, Math.min(choices.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
                choices[index]?.focus();
            } else if (current >= 0 && ['Home', 'End'].includes(event.key)) { event.preventDefault(); choices[event.key === 'Home' ? 0 : choices.length - 1]?.focus(); }
        }, true);
        document.addEventListener('pointerdown', event => { if (opened && !menu.contains(event.target) && !opener?.contains(event.target)) close(false); }, true);
        document.addEventListener('focusin', event => { if (opened && !menu.contains(event.target) && !opener?.contains(event.target)) close(false); });
        document.addEventListener('fullscreenchange', () => {
            const wasOpen = opened; close(false); mountPlayerButton();
            if (wasOpen) (document.fullscreenElement ? playerButton : trigger)?.focus({ preventScroll: true });
        });
        window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    }
    function createTrigger(player = false) {
        const control = button(player ? 'rc-voice-player-button' : 'rc-voice-trigger', 'Выбрать озвучку');
        control.setAttribute('aria-haspopup', 'dialog'); control.setAttribute('aria-controls', 'rc-voice-menu');
        if (player) control.append(icon('audio'));
        else control.append(el('span', 'rc-voice-trigger-label', 'Озвучка:'));
        control.append(el('span', 'rc-voice-trigger-name'), icon('chevron'));
        control.addEventListener('click', event => { event.stopPropagation(); open(control); });
        for (const name of ['mousedown', 'pointerdown', 'dblclick']) control.addEventListener(name, event => event.stopPropagation());
        return control;
    }
    function mountPlayerButton() {
        const host = document.querySelector('#oframecdnplayer');
        if (!host || (host === playerHost && playerButton?.isConnected)) return;
        playerButton?.remove(); playerHost = host;
        playerButton = createTrigger(true); host.append(playerButton); updateTriggers();
    }
    window.addEventListener('message', event => {
        if (event.source !== window || event.origin !== location.origin) return;
        if (event.data?.event === 'ui' && playerButton) playerButton.dataset.uiHidden = String(!event.data.data);
    });
    function refresh() {
        if (!nativeList?.isConnected) return;
        const next = readRows(), signature = JSON.stringify(next);
        if (signature === snapshot) return;
        snapshot = signature; rows = next; render();
    }
    function mount() {
        const found = document.querySelector('#translators-list');
        if (!found || typeof HTMLElement.prototype.showPopover !== 'function') return;
        if (found !== nativeList) {
            nativeObserver?.disconnect(); bar?.remove(); nativeList = found; snapshot = '';
            if (!menu) createMenu();
            bar = el('div', 'rc-voice-bar'); trigger = createTrigger(); bar.append(trigger);
            found.parentElement.prepend(bar); found.parentElement.classList.add('rc-voice-enhanced');
            nativeObserver = new MutationObserver(refresh); nativeObserver.observe(found, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'title'] });
            refresh();
        }
        mountPlayerButton();
    }
    chrome.storage.local.get(null).then(data => {
        favorites = new Set(Object.keys(data).filter(name => name.startsWith(prefix) && data[name] === true).map(name => name.slice(prefix.length)));
        render();
    }).catch(() => { if (status) announce('Не удалось загрузить избранное.', true); });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        let changed = false;
        for (const [name, value] of Object.entries(changes)) if (name.startsWith(prefix)) {
            changed = true; const id = name.slice(prefix.length);
            if (value.newValue === true) favorites.add(id); else favorites.delete(id);
        }
        if (changed) render();
    });
    new MutationObserver(() => {
        if (scheduled) return; scheduled = true;
        setTimeout(() => { scheduled = false; mount(); }, 0);
    }).observe(document.documentElement, { childList: true, subtree: true });
    mount();
})();
