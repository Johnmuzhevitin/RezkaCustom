// Hide title appearances without changing native history, account data or playback.
const RezkaExclusionsSite = (() => {
    if (window.top !== window || !RezkaNetwork.isSite(location.href)) return { registerRoot() {} };
    const ACTION = '.b-content__inline_item, article.card';
    const ITEM = ACTION + ', .b-seriesupdate__block_list_item, .b-videosaves__list_item, .b-post__partcontent_item, .b-newest_slider__item';
    const CONTENT = ITEM + ', a[href], [data-url]';
    const roots = new Set(), hidden = new Set(), pending = new Set();
    let timer, initialized = false, noticeVersion = 0;
    const notice = document.createElement('div'); notice.id = 'rc-excluded-notice'; notice.hidden = true;
    const message = document.createElement('span');
    const live = document.createElement('span'); live.className = 'rc-exclusion-status';
    live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
    document.body.append(live);
    notice.append(message); document.body.append(notice);
    function setMessage(text) { message.textContent = text; live.textContent = text; }
    // Native player shortcuts must not consume activation keys on our controls.
    const isolateKeys = event => { if ([' ', 'Enter'].includes(event.key)) event.stopPropagation(); };
    notice.addEventListener('keydown', isolateKeys);
    notice.addEventListener('keyup', isolateKeys);
    const { titleID } = RezkaWatchedSite;
    function href(item) {
        return item.querySelector('.b-content__inline_item-link a[href], .title a[href], a.card-link')?.getAttribute('href')
            || item.querySelector('a[href]')?.getAttribute('href') || item.getAttribute('data-url')
            || (item.matches('.b-post__partcontent_item.current') ? location.href : null);
    }
    function title(item) {
        return item.querySelector('.b-content__inline_item-link a, h3, .title')?.textContent.trim()
            || item.querySelector('img')?.alt || 'Без названия';
    }
    function showNotice(text, id, source) {
        const version = ++noticeVersion;
        for (const button of notice.querySelectorAll('button')) button.remove();
        notice.hidden = false; setMessage(text);
        function returnFocus() {
            const root = source?.getRootNode() || document;
            const cards = [...root.querySelectorAll(ACTION)];
            const index = Math.max(0, cards.indexOf(source));
            const candidates = [...cards.slice(index), ...cards.slice(0, index).reverse()];
            const target = candidates.find(card => !card.classList.contains('rc-excluded'))?.querySelector('.rc-exclude-toggle');
            if (target) target.focus();
            else {
                const fallback = root.querySelector('#query, .rc-history-tabs button[aria-selected="true"], #search-field');
                fallback?.focus();
            }
        }
        if (id) {
            const undo = document.createElement('button'); undo.type = 'button'; undo.textContent = 'Отменить';
            undo.addEventListener('click', async () => {
                if (undo.disabled) return;
                undo.disabled = true;
                try {
                    await RezkaExclusions.remove(id);
                    if (version !== noticeVersion) return;
                    setMessage('Карточка возвращена.'); undo.remove();
                    apply(); source?.querySelector('.rc-exclude-toggle')?.focus();
                } catch (error) { if (version === noticeVersion) { setMessage(error.message); undo.disabled = false; } }
            });
            notice.append(undo);
        }
        const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Закрыть';
        close.addEventListener('click', () => { notice.hidden = true; setMessage(''); noticeVersion++; returnFocus(); }); notice.append(close);
    }
    async function exclude(card) {
        const id = titleID(href(card));
        if (!id || pending.has(id)) return;
        const keyboard = card.getRootNode().activeElement === card.querySelector('.rc-exclude-toggle');
        pending.add(id); apply();
        try {
            const restoring = RezkaExclusions.has(id);
            if (restoring) await RezkaExclusions.remove(id); else await RezkaExclusions.add(id, title(card));
            showNotice(restoring ? '«' + title(card) + '» возвращён в списки сайта.' : '«' + title(card) + '» больше не появится в списках сайта.', restoring ? undefined : id, card);
            apply();
            if (keyboard) notice.querySelector('button').focus();
        } catch (error) { showNotice(error.message); }
        finally { pending.delete(id); apply(); }
    }
    function apply() {
        if (!initialized) return;
        const next = new Set();
        for (const root of roots) {
            const showExcluded = policies.get(root)?.showExcluded?.() === true;
            for (const link of root.querySelectorAll('a[href]')) {
                if (!showExcluded && RezkaExclusions.has(titleID(link.getAttribute('href')))) next.add(link.closest(ITEM) || link);
            }
            for (const item of root.querySelectorAll(ITEM + ', [data-url]')) {
                if (!showExcluded && RezkaExclusions.has(titleID(href(item)))) next.add(item);
            }
            for (const card of root.querySelectorAll(ACTION)) {
                const id = titleID(href(card));
                let button = [...card.children].find(child => child.classList.contains('rc-exclude-toggle'));
                if (!id) { button?.remove(); card.classList.remove('rc-excludable'); continue; }
                card.classList.add('rc-excludable');
                if (!button) {
                    button = document.createElement('button'); button.type = 'button'; button.className = 'rc-exclude-toggle';
                    button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5 5 10 10M5 15 15 5"/></svg>';
                    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void exclude(card); });
                    button.addEventListener('keydown', isolateKeys);
                    button.addEventListener('keyup', isolateKeys);
                    card.append(button);
                }
                const label = pending.has(id) ? 'Сохраняем…' : RezkaExclusions.has(id) ? 'Вернуть в списки: ' + title(card) : 'Больше не показывать: ' + title(card);
                button.title = label + '\nВернуть можно на сайте: Настройки профиля → Исключения.';
                button.setAttribute('aria-label', label);
                button.setAttribute('aria-busy', String(pending.has(id)));
                button.setAttribute('aria-disabled', String(pending.has(id)));
            }
        }
        for (const item of hidden) if (!next.has(item)) item.classList.remove('rc-excluded');
        hidden.clear();
        for (const item of next) { item.classList.add('rc-excluded'); hidden.add(item); }
    }
    function schedule() {
        if (!timer) timer = setTimeout(() => { timer = undefined; apply(); }, 40);
    }
    const contains = (node, selector) => node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector));
    const policies = new Map();
    function registerRoot(root, policy = {}) {
        if (roots.has(root)) return;
        policies.set(root, policy);
        roots.add(root);
        new MutationObserver(records => {
            if (records.some(record => record.type === 'attributes'
                ? record.attributeName !== 'class' || (record.target.matches('.b-post__partcontent_item')
                    && /(?:^|\s)current(?:\s|$)/.test(record.oldValue || '') !== record.target.classList.contains('current'))
                : [...record.addedNodes].some(node => contains(node, CONTENT))
                    || [...record.removedNodes].some(node => contains(node, CONTENT + ', .rc-exclude-toggle')))) schedule();
        }).observe(root, { childList: true, subtree: true, attributes: true, attributeOldValue: true,
            attributeFilter: ['href', 'data-url', 'class'] });
        schedule();
    }
    RezkaExclusions.subscribe(() => { initialized = true; apply(); });
    registerRoot(document);
    RezkaExclusions.ready().then(() => { initialized = true; apply(); }).catch(error => showNotice(error.message));
    return { registerRoot };
})();
