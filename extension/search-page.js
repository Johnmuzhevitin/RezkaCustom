// A dedicated site page, isolated from legacy card filters and player hotkeys.
(() => {
    if (window.top !== window || !RezkaNetwork.isSite(location.href)) return;
    const cardStyle = document.createElement('style');
    cardStyle.id = 'rc-cards-style';
    cardStyle.textContent = REZKA_CARD_CSS;
    document.head.append(cardStyle);
    const S = RezkaSearch;
    const isDedicated = () => (new URLSearchParams(location.hash.slice(1)).get('rc-search') === '1'
        || new URL(location.href).searchParams.get('rc-search') === '1') && location.pathname === '/search/';
    function addEntry() {
        const nav = document.querySelector('#topnav-menu');
        if (!nav || document.querySelector('#rc-search-entry')) return;
        const item = document.createElement('li');
        item.className = 'b-topnav__item';
        const link = document.createElement('a');
        link.id = 'rc-search-entry';
        link.className = 'b-topnav__item-link';
        link.textContent = 'Расширенный поиск';
        link.href = S.pageURL({}, location.origin);
        item.append(link); nav.append(item);
    }
    addEntry();
    let page, routeURL;
    function route() {
        if (routeURL === location.href) return;
        routeURL = location.href;
        const dedicated = isDedicated(), entry = document.querySelector('#rc-search-entry');
        if (dedicated) entry?.setAttribute('aria-current', 'page');
        else entry?.removeAttribute('aria-current');
        if (dedicated) { page ??= createPage(); page?.show(); }
        else page?.hide();
    }
    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', route);
    route();
    function createPage() {
        const container = document.querySelector('.b-content');
        if (!container) return;
        const nativeTitle = document.title;
        const host = document.createElement('section');
        host.id = 'rc-search-root'; host.hidden = true;
        const root = host.attachShadow({ mode: 'open' });
        if (typeof RezkaWatched !== 'undefined') RezkaWatched.registerRoot(root);
        const outerStyle = document.createElement('style');
        outerStyle.textContent = `body.rc-search-page .b-content > :not(#rc-search-root),
            body.rc-search-page #main > .b-newest_slider_wrapper,
            body.rc-search-page #main > .b-dwnapp,
            body.rc-search-page #main > .b-collections__newest,
            body.rc-search-page #main > .r4-russia {display:none!important}
            #rc-search-root{display:block;width:100%;min-width:0}
            #rc-search-root[hidden]{display:none!important}
            body.rc-search-page{min-width:0!important}
            body.rc-search-page .b-wrapper{min-width:0!important;box-sizing:border-box}
            @media(max-width:1000px){
                body.rc-search-page .b-wrapper{width:100%!important;max-width:100%;padding-inline:16px!important}
                body.rc-search-page #top-head,body.rc-search-page #top-nav{position:relative!important;height:auto}
                body.rc-search-page #top-nav-wrapper{display:none!important}
                body.rc-search-page .b-tophead{display:flex;flex-wrap:wrap;align-items:center;height:auto}
                body.rc-search-page .b-tophead-left{display:flex;flex:1;flex-wrap:wrap;align-items:center;min-width:0;height:auto}
                body.rc-search-page .b-tophead__logo{position:static;margin:0;padding:0;flex:0 0 174px;scale:1}
                body.rc-search-page .b-tophead-right{width:100%;height:auto;flex-wrap:wrap;white-space:normal}
                body.rc-search-page .b-tophead-right>*{width:auto;max-width:100%}
                body.rc-search-page .b-topnav{height:auto}
                body.rc-search-page #topnav-menu{display:flex;flex-wrap:wrap;gap:0 16px;height:auto;margin:0!important;padding:4px 0!important}
                body.rc-search-page #topnav-menu:after{display:none}
                body.rc-search-page .b-topnav__item{float:none;margin:0;height:auto}
                body.rc-search-page .b-topnav__item-link{display:block;min-height:44px;line-height:44px;padding:0}
                /* The main search form provides the same title search at this width. */
                body.rc-search-page #search{display:none}
                body.rc-search-page .b-content{padding-top:12px;padding-bottom:32px}
                body.rc-search-page #main{padding-bottom:0!important}
                body.rc-search-page #footer{margin-top:0!important}
                body.rc-search-page .b-footer__inner{display:flex;flex-wrap:wrap;gap:24px}
                body.rc-search-page .b-footer__left,body.rc-search-page .b-footer__right{float:none;width:auto;min-width:0;max-width:100%;overflow-wrap:anywhere}
                body.rc-search-page .b-footer__menu{display:flex;flex-wrap:wrap;gap:12px 20px;height:auto}
                body.rc-search-page .b-footer__menu_item{float:none;padding:0}
            }`;
        document.head.append(outerStyle);
        let viewport = document.querySelector('meta[name="viewport"]');
        const hadViewport = Boolean(viewport), nativeViewport = viewport?.getAttribute('content');
        if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport'; }
        const style = document.createElement('style');
        style.textContent = REZKA_SEARCH_CSS;
        root.append(style);
        const shell = document.createElement('main');
        shell.innerHTML = `
            <header class="page-heading"><h1>Расширенный поиск</h1><p>Найдите фильм по названию или выберите, что посмотреть.</p></header>
            <form id="search-form" class="search-layout">
                <div class="query-row"><label class="query-label" for="query">Название фильма или сериала</label><div class="query-controls">
                    <input id="query" name="q" type="search" placeholder="Например, Матрица" maxlength="200" autocomplete="off">
                    <button class="primary" type="submit">Найти</button></div></div>
                <aside class="filters" aria-label="Фильтры поиска">
                    <div class="filter-heading"><h2>Фильтры</h2><button type="button" id="reset" class="text-button">Сбросить</button></div>
                    <label for="type">Тип</label><select id="type" name="type"><option value="">Все типы</option></select>
                    <label for="genre">Жанр</label><select id="genre" name="genre"><option value="">Любой жанр</option></select>
                    <fieldset><legend>Год выхода</legend><div class="years">
                        <label for="from"><span>От</span><input id="from" name="from" type="number" min="1890" step="1" placeholder="Любой"></label>
                        <label for="to"><span>До</span><input id="to" name="to" type="number" min="1890" step="1" placeholder="Любой"></label>
                    </div></fieldset>
                    <label for="country">Страна</label><input id="country" name="country" aria-describedby="country-help" maxlength="80" placeholder="Любая страна" autocomplete="off" spellcheck="false">
                    <p id="country-help" class="field-help">Выберите страну или начните вводить название.</p>
                    <button class="apply" type="submit">Применить фильтры</button>
                    <p id="draft-note" class="field-help" hidden>Фильтры изменены. Нажмите «Применить».</p>
                </aside>
                <section class="results" aria-labelledby="results-heading">
                    <div class="results-toolbar"><h2 id="results-heading">Результаты</h2><div class="sort-field"><label for="sort">Порядок</label><select id="sort" name="sort"></select></div></div>
                    <p id="sort-note" class="field-help" hidden>При поиске по названию сохраняется порядок результатов HDrezka.</p>
                    <div id="active-filters" class="active-filters" aria-label="Применённые фильтры"></div>
                    <p id="status" class="status" role="status" aria-live="polite" aria-atomic="true" tabindex="-1"></p>
                    <div id="error" class="error" role="alert" hidden></div>
                    <div id="cards" class="cards" aria-busy="false"></div>
                    <div id="empty" class="empty" hidden><h3>Совпадений пока нет</h3><p></p></div>
                    <div class="load-actions"><button id="more" type="button" class="primary">Показать ещё</button><button id="stop" type="button" hidden>Остановить загрузку</button></div>
                    <p class="source-note">Результаты из каталога HDrezka. Сочетания фильтров проверяются по мере загрузки страниц.</p>
                </section>
            </form>`;
        root.append(shell); container.prepend(host);
        const $ = selector => root.querySelector(selector);
        const form = $('#search-form');
        // Keep the site's player shortcuts away from form controls.
        root.addEventListener('keydown', event => event.stopPropagation());
        function option(select, value, label) {
            const element = document.createElement('option'); element.value = value; element.textContent = label; select.append(element);
        }
        for (const [value, label] of Object.entries(S.TYPES)) option($('#type'), value, label);
        for (const [value, label] of Object.entries(S.SORTS)) option($('#sort'), value, label);
        const nativeGenres = new Map();
        for (const select of document.querySelectorAll('select.select-category')) {
            for (const item of select.options) {
                const match = item.value.match(/^\/(films|series|cartoons|animation)\/best\/([^/]+)\/$/);
                if (!match || !Object.hasOwn(S.GENRES, match[2])) continue;
                if (!nativeGenres.has(match[1])) nativeGenres.set(match[1], new Set());
                nativeGenres.get(match[1]).add(match[2]);
            }
        }
        const countries = new Set(S.COUNTRIES);
        for (const link of document.querySelectorAll('a[href*="/country/"]')) if (link.textContent.trim()) countries.add(link.textContent.trim());
        const countryNames = [...countries].sort((a, b) => a.localeCompare(b, 'ru'));
        const pickers = new Map();
        const choiceKey = value => value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
        // One popup and keyboard implementation for fixed choices and free country text.
        function createPicker(id, label, { editable = false, freeText = false } = {}) {
            const source = $('#' + id), field = document.createElement('div');
            field.className = 'picker-field'; source.before(field); field.append(source);
            const input = freeText ? source : document.createElement('input');
            if (!freeText) {
                source.hidden = true; source.tabIndex = -1;
                input.id = id + '-display'; input.autocomplete = 'off'; input.spellcheck = false;
                input.readOnly = !editable;
                root.querySelector(`label[for="${id}"]`).htmlFor = input.id;
                field.append(input);
            }
            input.classList.add('picker-control');
            input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', editable ? 'list' : 'none');
            input.setAttribute('aria-haspopup', 'listbox'); input.setAttribute('aria-expanded', 'false');
            const toggle = document.createElement('button');
            toggle.id = id + '-toggle'; toggle.type = 'button'; toggle.tabIndex = -1; toggle.className = 'picker-toggle';
            toggle.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5"/></svg>';
            const popup = document.createElement('div'); popup.id = id + '-popup'; popup.className = 'picker-popup'; popup.hidden = true;
            const list = document.createElement('ul'); list.id = id + '-options'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', label);
            const empty = document.createElement('p'); empty.id = id + '-empty'; empty.className = 'picker-empty'; empty.setAttribute('role', 'status'); empty.hidden = true;
            empty.textContent = freeText ? 'Нет в списке. Можно оставить введённое название.' : 'Ничего не найдено. Попробуйте другое название.';
            popup.append(list, empty); field.append(toggle, popup);
            input.setAttribute('aria-controls', list.id); toggle.setAttribute('aria-controls', list.id);
            let choices = [], index = -1, typed = '', typedAt = 0;
            const values = () => freeText ? [['', 'Любая страна'], ...countryNames.map(name => [name, name])] : [...source.options].map(item => [item.value, item.textContent]);
            const resetLabel = () => { if (!freeText) input.value = source.selectedOptions[0]?.textContent || ''; };
            function close() {
                popup.hidden = true; index = -1; typed = '';
                input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
                toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Показать список: ' + label);
                resetLabel();
            }
            function place() {
                if (popup.hidden) return;
                const rect = field.getBoundingClientRect(), below = window.innerHeight - rect.bottom - 16, above = rect.top - 16;
                const upward = below < 220 && above > below;
                popup.classList.toggle('above', upward);
                popup.style.maxHeight = Math.max(88, Math.min(264, upward ? above : below)) + 'px';
            }
            function highlight(next, scroll = false) {
                index = next;
                for (const [i, item] of [...list.children].entries()) item.setAttribute('aria-selected', String(i === index));
                const item = list.children[index];
                if (!item) { input.removeAttribute('aria-activedescendant'); return; }
                input.setAttribute('aria-activedescendant', item.id);
                if (scroll) {
                    // Scroll options only, keeping the input and page stationary.
                    const top = item.offsetTop, bottom = top + item.offsetHeight;
                    if (top < popup.scrollTop) popup.scrollTop = top;
                    else if (bottom > popup.scrollTop + popup.clientHeight) popup.scrollTop = bottom - popup.clientHeight;
                }
            }
            function open(filter = '') {
                if (source.disabled) return;
                for (const other of pickers.values()) if (other.input !== input) other.close();
                const query = choiceKey(filter);
                choices = values().filter(([, name]) => !query || choiceKey(name).includes(query));
                list.replaceChildren();
                for (const [i, [value, name]] of choices.entries()) {
                    const item = document.createElement('li'); item.id = id + '-option-' + i; item.dataset.index = String(i);
                    item.setAttribute('role', 'option'); item.textContent = name;
                    item.dataset.current = String(value === source.value); list.append(item);
                }
                empty.hidden = choices.length > 0; popup.hidden = false; popup.scrollTop = 0;
                input.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-expanded', 'true');
                toggle.setAttribute('aria-label', 'Скрыть список: ' + label);
                place(); highlight(!editable ? choices.findIndex(([value]) => value === source.value) : -1, true);
            }
            function choose(next) {
                if (source.disabled || next < 0 || next >= choices.length) return;
                const previous = source.value; source.value = choices[next][0];
                input.focus(); close();
                if (source.value !== previous) source.dispatchEvent(new Event('change', { bubbles: true }));
            }
            input.addEventListener('click', () => {
                if (popup.hidden) { open(); if (editable && !freeText) input.select(); }
                else if (!editable) close();
            });
            if (editable) input.addEventListener('input', () => open(input.value));
            input.addEventListener('keydown', event => {
                if (event.isComposing || event.ctrlKey || event.metaKey) return;
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (popup.hidden) { open(); if (!editable) return; }
                    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1) : index + (event.key === 'ArrowDown' ? 1 : -1);
                    highlight(Math.max(-1, Math.min(choices.length - 1, next)), true);
                } else if (event.key === 'Enter' || (!editable && event.key === ' ')) {
                    if (!popup.hidden && index >= 0) { event.preventDefault(); choose(index); }
                    else if (!freeText) { event.preventDefault(); if (popup.hidden) open(); }
                } else if (event.key === 'Escape' && !popup.hidden) {
                    event.preventDefault(); close();
                } else if (event.key === 'Tab') close();
                else if (!editable && ['Home', 'End'].includes(event.key)) {
                    event.preventDefault(); if (popup.hidden) open(); highlight(event.key === 'Home' ? 0 : choices.length - 1, true);
                } else if (!editable && event.key.length === 1 && !event.altKey) {
                    event.preventDefault(); if (popup.hidden) open();
                    typed = Date.now() - typedAt > 700 ? event.key : typed + event.key; typedAt = Date.now();
                    highlight(choices.findIndex(([, name]) => choiceKey(name).startsWith(choiceKey(typed))), true);
                } else if (editable && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) highlight(-1);
            });
            toggle.addEventListener('mousedown', event => event.preventDefault());
            toggle.addEventListener('click', () => { const wasOpen = !popup.hidden; input.focus(); if (wasOpen) close(); else open(); });
            list.addEventListener('mousedown', event => event.preventDefault());
            list.addEventListener('click', event => { const item = event.target.closest('[role="option"]'); if (item) choose(Number(item.dataset.index)); });
            field.addEventListener('focusout', event => { if (!field.contains(event.relatedTarget)) close(); });
            function sync() {
                input.disabled = source.disabled; toggle.disabled = source.disabled; resetLabel();
                if (source.disabled) close();
            }
            const picker = { input, field, close, place, sync };
            pickers.set(id, picker); close(); sync(); return picker;
        }
        createPicker('type', 'Тип');
        createPicker('genre', 'Жанр', { editable: true });
        createPicker('sort', 'Порядок');
        createPicker('country', 'Страна', { editable: true, freeText: true });
        document.addEventListener('pointerdown', event => {
            for (const picker of pickers.values()) if (!event.composedPath().includes(picker.field)) picker.close();
        });
        const placePickers = () => { for (const picker of pickers.values()) picker.place(); };
        window.addEventListener('resize', placePickers);
        window.addEventListener('scroll', placePickers, { passive: true });
        window.addEventListener('blur', () => { for (const picker of pickers.values()) picker.close(); });
        for (const id of ['from', 'to']) $('#' + id).max = String(new Date().getFullYear() + 5);
        function genres(type, selected) {
            $('#genre').replaceChildren(); option($('#genre'), '', 'Любой жанр');
            const entries = Object.entries(S.GENRES).filter(([slug]) => !type || !nativeGenres.has(type) || nativeGenres.get(type).has(slug));
            for (const [slug, name] of entries.sort((a, b) => a[1].localeCompare(b[1], 'ru'))) option($('#genre'), slug, name);
            $('#genre').value = entries.some(([slug]) => slug === selected) ? selected : '';
            pickers.get('genre').close(); pickers.get('genre').sync();
        }
        let active = S.readState(location.href), search, controller, generation = 0, rendered = 0, failed = false, stopped = false;
        const cachePrefix = 'rc-search:v1:';
        const cacheKey = () => cachePrefix + S.pageURL(active, location.origin);
        function draft() {
            const values = Object.fromEntries(new FormData(form));
            values.sort = $('#sort').value;
            return S.normalize(values);
        }
        function updateDraft() {
            $('#to').setCustomValidity(''); $('#country').setCustomValidity('');
            const q = $('#query').value.trim();
            $('#sort').disabled = Boolean(q); $('#sort-note').hidden = !q;
            pickers.get('sort').sync();
            $('#draft-note').hidden = JSON.stringify(draft()) === JSON.stringify(active);
        }
        function fill(state) {
            for (const picker of pickers.values()) picker.close();
            $('#query').value = state.q; $('#type').value = state.type;
            genres(state.type, state.genre);
            for (const key of ['from', 'to', 'country', 'sort']) $('#' + key).value = state[key];
            for (const picker of pickers.values()) picker.sync();
            updateDraft();
        }
        function save() {
            if (!search || host.hidden) return;
            try {
                // A tab-local cache restores cards and paging after visiting a title.
                const keys = Object.keys(sessionStorage).filter(key => key.startsWith(cachePrefix));
                for (const key of keys.slice(0, Math.max(0, keys.length - 3))) sessionStorage.removeItem(key);
                sessionStorage.setItem(cacheKey(), JSON.stringify({ at: Date.now(), scroll: window.scrollY, data: search.snapshot() }));
            } catch { /* Search still works if session storage is unavailable or full. */ }
        }
        function chips() {
            const target = $('#active-filters'); target.replaceChildren();
            const labels = { q: active.q ? 'Название: ' + active.q : '', type: S.TYPES[active.type], genre: S.GENRES[active.genre],
                from: active.from ? 'От ' + active.from : '', to: active.to ? 'До ' + active.to : '', country: active.country };
            for (const [key, label] of Object.entries(labels)) {
                if (!label) continue;
                const button = document.createElement('button'); button.type = 'button'; button.className = 'chip';
                button.textContent = label; button.setAttribute('aria-label', 'Убрать фильтр: ' + label);
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                icon.setAttribute('viewBox', '0 0 16 16'); icon.setAttribute('aria-hidden', 'true');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M4 4l8 8M12 4l-8 8'); icon.append(path); button.append(icon);
                button.addEventListener('click', () => { const next = { ...active, [key]: '' }; start(next, true); $('#query').focus(); });
                target.append(button);
            }
        }
        function appendCards() {
            for (const item of search.items.slice(rendered)) {
                const card = document.createElement('article'); card.className = 'card';
                const link = document.createElement('a'); link.href = S.cardURL(item.url, location.origin); link.className = 'card-link';
                const poster = document.createElement('div'); poster.className = 'poster';
                const imageURL = S.safeURL(item.image, location.origin, false);
                if (imageURL && item.image) {
                    const img = document.createElement('img'); img.src = imageURL; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
                    img.addEventListener('error', () => { img.remove(); poster.textContent = 'Без постера'; }, { once: true }); poster.append(img);
                } else poster.textContent = 'Без постера';
                const title = document.createElement('h3'); title.textContent = item.title;
                const info = document.createElement('p'); info.textContent = item.info;
                const type = document.createElement('span'); type.className = 'card-type'; type.textContent = S.TYPES[item.type];
                link.append(poster, type, title); card.append(link, info);
                if (item.additional) { const extra = document.createElement('p'); extra.textContent = 'Также: ' + item.additional; card.append(extra); }
                if (item.episode) { const episode = document.createElement('p'); episode.className = 'episode'; episode.textContent = item.episode; card.append(episode); }
                $('#cards').append(card);
            }
            rendered = search.items.length;
        }
        function render() {
            appendCards();
            const count = search.items.length;
            $('#results-heading').textContent = count ? 'Найдено: ' + count : 'Результаты';
            let message = search.busy ? 'Ищем совпадения… ' : search.done ? 'Поиск завершён. ' : stopped ? 'Загрузка остановлена. ' : '';
            message += `Проверено: ${search.scanned}. Страниц: ${search.pages}.`;
            if (!search.done && !search.busy) message += ' Это ещё не вся выдача.';
            if ($('#status').textContent !== message) $('#status').textContent = message;
            $('#cards').setAttribute('aria-busy', String(search.busy));
            // Keep the active button in the tab order while a batch is loading.
            $('#more').hidden = !search.busy && search.done;
            $('#more').setAttribute('aria-disabled', String(search.busy));
            $('#more').textContent = search.busy ? 'Загружаем…' : failed ? 'Повторить загрузку' : !count || stopped ? 'Продолжить поиск' : 'Показать ещё';
            $('#stop').hidden = !search.busy;
            $('#empty').hidden = Boolean(count) || search.busy || failed;
            $('#empty h3').textContent = search.done ? 'Ничего не найдено' : 'Совпадений пока нет';
            $('#empty p').textContent = search.done ? 'Попробуйте другое название или уберите часть фильтров.' : 'В проверенной части каталога нет совпадений. Продолжите поиск или измените фильтры.';
        }
        async function load({ focusResults = false } = {}) {
            if (search.busy || search.done) return;
            controller = new AbortController();
            const token = generation, current = search, signal = controller.signal, firstNew = search.items.length;
            failed = false; stopped = false; $('#error').hidden = true;
            let lastProgress = 0;
            const task = current.load({ signal, progress: () => {
                if (token === generation && Date.now() - lastProgress > 500) { render(); lastProgress = Date.now(); }
            } });
            // A buffered final batch can finish synchronously; let finally move focus
            // before hiding its active load control in that case.
            if (current.busy) render();
            try { await task; }
            catch (error) {
                if (token !== generation) return;
                if (!signal.aborted) { failed = true; $('#error').textContent = error.message; $('#error').hidden = false; }
            } finally {
                if (token === generation) {
                    const focused = root.activeElement;
                    render();
                    const firstLink = $('#cards').children[firstNew]?.querySelector('.card-link');
                    if (focused === $('#more') && focusResults && !failed && !stopped && firstLink) firstLink.focus();
                    else if (focused === $('#stop') || (focused === $('#more') && search.done)) {
                        (search.done ? firstLink || $('#status') : $('#more')).focus();
                    }
                    save();
                }
            }
        }
        function start(state, push = false, restore = false) {
            save(); controller?.abort(); generation++;
            active = S.normalize(state);
            if (active.from && active.to && +active.from > +active.to) [active.from, active.to] = [active.to, active.from];
            const url = S.pageURL(active, location.origin);
            if (push && url !== location.href) history.pushState(null, '', url);
            else if (!push && url !== location.href) history.replaceState(null, '', url);
            routeURL = location.href;
            search = new S.Search(active, location.origin);
            rendered = 0; failed = false; stopped = false;
            $('#cards').replaceChildren(); $('#error').hidden = true;
            fill(active); chips();
            let saved;
            if (restore) {
                try {
                    const candidate = JSON.parse(sessionStorage.getItem(cacheKey()));
                    if (candidate && Date.now() - candidate.at < 30 * 60 * 1000 && search.restore(candidate.data)) saved = candidate;
                } catch { /* Ignore an expired or malformed cache. */ }
            }
            render();
            if (saved) {
                const token = generation;
                requestAnimationFrame(() => { if (token === generation && !host.hidden) window.scrollTo({ top: Number(saved.scroll) || 0, behavior: 'instant' }); });
            } else void load();
        }
        form.addEventListener('input', updateDraft);
        $('#type').addEventListener('change', () => { genres($('#type').value, $('#genre').value); updateDraft(); });
        form.addEventListener('change', updateDraft);
        form.addEventListener('submit', event => {
            event.preventDefault();
            const state = draft();
            if (state.from && state.to && +state.from > +state.to) { $('#to').setCustomValidity('Год «До» должен быть не меньше года «От».'); $('#to').reportValidity(); return; }
            if (state.country && !/^[\p{L}\p{M}][\p{L}\p{M}\s()'’.-]*$/u.test(state.country)) { $('#country').setCustomValidity('Введите название страны, например США или Великобритания.'); $('#country').reportValidity(); return; }
            start(state, true);
        });
        $('#sort').addEventListener('change', () => { if (!$('#query').value.trim()) form.requestSubmit(); });
        $('#reset').addEventListener('click', () => { start({}, true); $('#query').focus(); });
        $('#more').addEventListener('click', () => void load({ focusResults: true }));
        $('#stop').addEventListener('click', () => { stopped = true; controller?.abort(); });
        window.addEventListener('pagehide', () => { save(); controller?.abort(); });
        function theme() { host.dataset.theme = document.body.classList.contains('b-theme__template__night') ? 'dark' : 'light'; }
        theme(); new MutationObserver(theme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return {
            show() {
                document.body.classList.add('rc-search-page');
                document.title = 'Расширенный поиск — HDrezka';
                viewport.content = 'width=device-width, initial-scale=1';
                if (!viewport.isConnected) document.head.append(viewport);
                start(S.readState(location.href), false, true);
                host.hidden = false;
            },
            hide() {
                if (host.hidden) return;
                save(); controller?.abort(); generation++;
                for (const picker of pickers.values()) picker.close();
                host.hidden = true;
                document.body.classList.remove('rc-search-page');
                document.title = nativeTitle;
                if (!hadViewport) viewport.remove();
                else if (nativeViewport === null) viewport.removeAttribute('content');
                else viewport.content = nativeViewport;
            }
        };
    }
})();
