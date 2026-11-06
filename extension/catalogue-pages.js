// Append native catalogue pages without replacing the current list or its controls.
(() => {
    if (window.top !== window || !RezkaNetwork.isSite(location.href)) return;
    const LIST = '.b-content__inline_items, .b-content__collections_list, .b-content__search_wrapper';
    const CARD = '.b-content__inline_item, .b-content__collections_item';
    const states = new Map();
    const tags = new Set(['DIV', 'SPAN', 'A', 'IMG', 'I', 'B', 'STRONG', 'EM', 'SMALL', 'BR', 'INPUT', 'LABEL']);
    const attributes = new Set(['class', 'title', 'alt', 'width', 'height', 'data-id', 'data-full']);
    let scheduled = false;
    const listType = list => list.matches('.b-content__collections_list') ? '.b-content__collections_list'
        : list.matches('.b-content__inline_items') ? '.b-content__inline_items' : '.b-content__search_wrapper';

    function pageNumber(url) {
        return Number(url.searchParams.get('page') || url.pathname.match(/\/page\/(\d+)\/?$/)?.[1] || 1);
    }
    const route = url => url.pathname.replace(/\/page\/\d+\/?$/, '/');
    function nextURL(pager, current) {
        const base = new URL(current);
        for (const link of pager.querySelectorAll('a[href]')) {
            const href = RezkaSearch.safeURL(link.getAttribute('href'), current);
            if (!href) continue;
            const next = new URL(href);
            if (route(next) !== route(base) || pageNumber(next) !== pageNumber(base) + 1) continue;
            // Native pagers can omit the selected order, genre or search query.
            for (const key of new Set(base.searchParams.keys())) {
                if (key === 'page') continue;
                next.searchParams.delete(key);
                for (const value of base.searchParams.getAll(key)) next.searchParams.append(key, value);
            }
            next.hash = '';
            return next.href;
        }
        return null;
    }
    function listFor(pager) {
        if (pager.closest('#comments, .b-comments, #rc-search-root')) return null;
        const containing = pager.closest(LIST);
        if (containing) return containing;
        // Some mirrors place navigation immediately after the list/wrapper.
        const previous = pager.previousElementSibling;
        if (previous?.matches(LIST)) return previous;
        const lists = previous?.querySelectorAll(LIST);
        return lists?.length === 1 ? lists[0] : null;
    }
    function cardsIn(list) {
        return [...list.querySelectorAll(CARD)].filter(card => card.closest(LIST) === list);
    }
    function keyFor(card, base) {
        const collection = card.matches('.b-content__collections_item');
        const href = card.querySelector(collection ? 'a.title[href]' : '.b-content__inline_item-link a[href]')?.getAttribute('href');
        const safe = RezkaSearch.safeURL(href || card.getAttribute('data-url'), base);
        if (!safe) return null;
        const path = new URL(safe).pathname;
        if (collection) return /^\/collections\/\d+-[^/]+\/$/.test(path) ? path : null;
        return RezkaSearch.cardURL(safe, base) ? path.match(/\/(\d+)-[^/]+\.html$/)[1] : null;
    }
    function copyCard(source, base) {
        // Rebuild only card markup. Never activate fetched scripts, handlers,
        // frames, styles or arbitrary URL schemes in the signed-in document.
        function copy(node) {
            if (node.nodeType === 3) return document.createTextNode(node.textContent);
            if (node.nodeType !== 1 || !tags.has(node.tagName)) return null;
            if (node.tagName === 'INPUT' && node.getAttribute('type') !== 'checkbox') return null;
            const result = document.createElement(node.localName);
            for (const { name, value } of node.attributes) {
                if (attributes.has(name)) result.setAttribute(name, value);
                else if (['href', 'src', 'data-url', 'data-cover_url'].includes(name)) {
                    const href = RezkaSearch.safeURL(value, base, name !== 'src' && name !== 'data-cover_url');
                    if (href) result.setAttribute(name, href);
                } else if (['id', 'for'].includes(name) && /^label-favorite-\d+$/.test(value)) result.setAttribute(name, value);
                else if (node.tagName === 'INPUT' && ['type', 'value'].includes(name)) result.setAttribute(name, value);
            }
            if (result.tagName === 'IMG') { result.loading = 'lazy'; result.decoding = 'async'; }
            for (const child of node.childNodes) { const cloned = copy(child); if (cloned) result.append(cloned); }
            return result;
        }
        const card = copy(source);
        if (card.matches('.b-content__inline_item')) card.setAttribute('data-id', keyFor(source, base));
        // Collection posters rely on a page-load click handler on some mirrors.
        // Give appended posters a native link, including Ctrl-click support.
        if (card.matches('.b-content__collections_item')) {
            const img = card.querySelector('img.cover'), link = card.querySelector('a.title[href]');
            if (img && link && !img.closest('a')) {
                const anchor = document.createElement('a'); anchor.href = link.href;
                img.replaceWith(anchor); anchor.append(img);
            }
        }
        card.setAttribute('data-rc-page-added', '');
        return card;
    }
    function attach(pager) {
        const list = listFor(pager);
        if (!list || states.has(pager) || !cardsIn(list).some(card => keyFor(card, location.href))) return;
        const next = nextURL(pager, location.href);
        // A last page opened directly has no more cards to request.
        if (!next) { pager.hidden = true; pager.classList.add('rc-pages-native'); return; }
        const holder = document.createElement('div'); holder.className = 'rc-catalogue-pages';
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Показать ещё';
        const status = document.createElement('p'); status.className = 'rc-pages-status';
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
        holder.append(button, status); pager.after(holder);
        pager.hidden = true; pager.classList.add('rc-pages-native');
        const state = { list, holder, button, status, next, busy: false, controller: null, page: location.href,
            index: [...document.querySelectorAll(listType(list))].indexOf(list),
            keys: new Set(cardsIn(list).map(card => keyFor(card, location.href)).filter(Boolean)) };
        states.set(pager, state);
        button.addEventListener('click', () => void load(pager, state));
    }
    async function load(pager, state) {
        if (state.busy || !state.next || !state.list.isConnected) return;
        const { list, holder, button, status } = state;
        state.busy = true; state.controller = new AbortController();
        button.setAttribute('aria-disabled', 'true'); button.setAttribute('aria-busy', 'true');
        button.textContent = 'Загружаем…'; status.textContent = ''; holder.classList.remove('rc-pages-error');
        const timeout = setTimeout(() => state.controller?.abort(), 20000);
        const requested = state.next;
        try {
            const response = await fetch(requested, { credentials: 'same-origin', redirect: 'error', signal: state.controller.signal });
            if (!response.ok) throw new Error('Page request failed');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const candidates = [...doc.querySelectorAll(listType(list))];
            const source = list.id ? candidates.find(candidate => candidate.id === list.id) : candidates[state.index];
            if (!source) throw new Error('Catalogue missing');
            const cards = cardsIn(source);
            if (!cards.length || cards.some(card => !keyFor(card, requested))) throw new Error('Invalid catalogue');
            const nextPager = [...doc.querySelectorAll('.b-navigation')].find(item => listFor(item) === source);
            const next = nextPager ? nextURL(nextPager, requested) : null;
            if (!pager.isConnected || !list.isConnected || location.href !== state.page) return;
            const added = [], keys = new Set(state.keys);
            for (const card of cards) {
                const key = keyFor(card, requested);
                if (keys.has(key)) continue;
                keys.add(key); added.push(copyCard(card, requested));
            }
            // A repeated response is retryable, never a silent loop or a false end.
            if (!added.length) throw new Error('Page repeated');
            const fragment = document.createDocumentFragment(); fragment.append(...added);
            if (pager.parentElement === list) list.insertBefore(fragment, pager);
            else list.append(fragment);
            state.keys = keys; state.next = next;
            list.dispatchEvent(new Event('rezka:cards-added', { bubbles: true }));
            for (const card of added) card.removeAttribute('data-rc-page-added');
            button.textContent = next ? 'Показать ещё' : 'Всё загружено';
            status.textContent = 'Добавлено: ' + added.length + (next ? '.' : '. Больше карточек нет.');
            // Keep the viewport in place; keyboard users enter the new batch next.
            if (document.activeElement === button) {
                const firstLink = added.find(card => typeof RezkaExclusions === 'undefined'
                    || !RezkaExclusions.has(keyFor(card, requested)))?.querySelector('a[href]');
                firstLink?.focus({ preventScroll: true });
            }
        } catch {
            if (!holder.isConnected) return;
            button.textContent = 'Повторить загрузку';
            status.textContent = 'Не удалось загрузить карточки. Попробуйте ещё раз.';
            holder.classList.add('rc-pages-error');
        } finally {
            clearTimeout(timeout); state.busy = false; state.controller = null;
            button.setAttribute('aria-disabled', String(!state.next)); button.removeAttribute('aria-busy');
        }
    }
    function scan() {
        scheduled = false;
        for (const [pager, state] of states) if (!pager.isConnected || !state.list.isConnected) {
            state.controller?.abort(); state.holder.remove(); states.delete(pager);
        }
        for (const pager of document.querySelectorAll('.b-navigation:not(.rc-pages-native)')) attach(pager);
    }
    scan();
    new MutationObserver(records => {
        if (scheduled || !records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
            node.nodeType === 1 && (node.matches('.b-navigation, ' + LIST) || node.querySelector('.b-navigation'))))) return;
        scheduled = true; queueMicrotask(scan);
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => { for (const state of states.values()) state.controller?.abort(); });
})();
