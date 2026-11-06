// An extra tab in the site's own profile settings. Never submit or rewrite its form.
(() => {
    if (window.top !== window || !RezkaNetwork.isSite(location.href)) return;
    const form = document.querySelector('form#userinfo');
    const nav = form?.querySelector('.b-tabs__main');
    const nativeContent = form?.querySelector('.b-content__inline');
    if (!nav || !nativeContent || !nav.querySelector('a[href="/settings/"]')) return;
    if (document.getElementById('rc-exclusions-tab')) return;
    const nativeLinks = [...nav.querySelectorAll('a')].map(link => ({ link,
        active: link.classList.contains('active'), current: link.getAttribute('aria-current') }));
    const item = document.createElement('li'); item.className = 'b-tabs__main_item';
    const tab = document.createElement('a'); tab.id = 'rc-exclusions-tab'; tab.className = 'b-tabs__main_link';
    tab.textContent = 'Исключения'; tab.href = location.pathname + location.search + '#rc-exclusions=1';
    tab.setAttribute('aria-controls', 'rc-exclusions-profile'); item.append(tab);
    const personality = nav.querySelector('a[href="/settings/personality/"]')?.closest('li');
    if (personality) personality.after(item); else nav.append(item);

    const section = document.createElement('section'); section.id = 'rc-exclusions-profile'; section.className = 'rc-exclusions-profile';
    section.setAttribute('aria-labelledby', 'rc-exclusions-heading'); section.hidden = true;
    const heading = document.createElement('h2'); heading.id = 'rc-exclusions-heading'; heading.textContent = 'Исключённые фильмы и сериалы';
    const description = document.createElement('p'); description.className = 'rc-exclusions-description';
    description.textContent = 'Эти карточки скрыты во всех списках сайта. Нажмите «Вернуть», чтобы снова их видеть.';
    const scope = document.createElement('p'); scope.className = 'rc-exclusions-scope';
    scope.textContent = 'Список сохраняется в этом браузере и действует на всех зеркалах Rezka.';
    const label = document.createElement('label'); label.htmlFor = 'rc-exclusions-query'; label.textContent = 'Найти исключение';
    const search = document.createElement('input'); search.id = label.htmlFor; search.type = 'search'; search.placeholder = 'Название фильма или сериала';
    const count = document.createElement('p'); count.className = 'rc-exclusions-count';
    const list = document.createElement('ul');
    const empty = document.createElement('p'); empty.className = 'rc-exclusions-empty'; empty.textContent = 'Загружаем исключения…';
    const status = document.createElement('p'); status.className = 'rc-exclusions-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-atomic', 'true');
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Повторить загрузку'; retry.hidden = true;
    section.append(heading, description, scope, label, search, count, list, empty, status, retry);
    // Keep the search input outside the native POST form, including its Save button.
    form.after(section);
    const rows = new Map(), pending = new Set();
    let loaded = false;
    function render() {
        const records = RezkaExclusions.list(), query = search.value.trim().toLocaleLowerCase('ru');
        const visible = records.filter(record => record.title.toLocaleLowerCase('ru').includes(query));
        const visibleIDs = new Set(visible.map(record => record.id));
        const focused = document.activeElement, focusedID = focused?.dataset.excludedId;
        const oldIndex = [...list.children].findIndex(row => row.contains(focused));
        for (const [id, row] of rows) if (!visibleIDs.has(id)) { row.remove(); rows.delete(id); }
        visible.forEach((record, index) => {
            let row = rows.get(record.id);
            if (!row) {
                row = document.createElement('li');
                const name = document.createElement('span'), restore = document.createElement('button');
                restore.type = 'button'; restore.textContent = 'Вернуть'; restore.dataset.excludedId = record.id;
                restore.addEventListener('click', async () => {
                    if (pending.has(record.id)) return;
                    pending.add(record.id); restore.setAttribute('aria-disabled', 'true'); status.textContent = 'Возвращаем карточку…';
                    try { await RezkaExclusions.remove(record.id); status.textContent = 'Карточка снова показывается на сайте.'; }
                    catch (error) { status.textContent = error.message; }
                    finally { pending.delete(record.id); restore.setAttribute('aria-disabled', 'false'); }
                });
                row.append(name, restore); rows.set(record.id, row);
            }
            row.firstChild.textContent = record.title;
            row.lastChild.setAttribute('aria-label', 'Вернуть: ' + record.title);
            if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
        });
        if (focusedID && !rows.has(focusedID)) (list.children[Math.max(0, Math.min(oldIndex, list.children.length - 1))]?.lastChild || search).focus();
        count.textContent = loaded ? query ? `Найдено: ${visible.length} из ${records.length}` : `Всего исключений: ${records.length}` : '';
        empty.hidden = visible.length > 0;
        empty.textContent = loaded ? records.length ? 'По этому названию ничего не найдено.' : 'Пока нет исключений. Нажмите красный крестик на карточке фильма или сериала, чтобы скрыть её.' : 'Загружаем исключения…';
    }
    function route() {
        const active = new URLSearchParams(location.hash.slice(1)).get('rc-exclusions') === '1';
        section.hidden = !active;
        nativeContent.classList.toggle('rc-exclusions-native-hidden', active);
        tab.classList.toggle('active', active);
        if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
        for (const state of nativeLinks) {
            state.link.classList.toggle('active', !active && state.active);
            if (active || state.current === null) state.link.removeAttribute('aria-current');
            else state.link.setAttribute('aria-current', state.current);
        }
        if (active && nativeContent.contains(document.activeElement)) tab.focus();
        else if (!active && section.contains(document.activeElement)) nativeLinks.find(state => state.active)?.link.focus();
    }
    const plainClick = event => event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
    tab.addEventListener('click', event => {
        if (!plainClick(event)) return;
        event.preventDefault();
        if (section.hidden) { history.pushState(null, '', tab.href); route(); }
    });
    for (const state of nativeLinks.filter(state => state.active)) state.link.addEventListener('click', event => {
        if (!plainClick(event) || section.hidden) return;
        event.preventDefault();
        const url = new URL(location.href); url.hash = ''; history.pushState(null, '', url); route();
    });
    search.addEventListener('input', render);
    section.addEventListener('keydown', event => event.stopPropagation());
    section.addEventListener('keyup', event => event.stopPropagation());
    window.addEventListener('hashchange', route); window.addEventListener('popstate', route);
    RezkaExclusions.subscribe(render);
    async function load() {
        const focused = document.activeElement === retry;
        retry.disabled = true; status.textContent = ''; empty.textContent = 'Загружаем исключения…';
        try {
            await RezkaExclusions.ready(); loaded = true; render();
            if (focused) search.focus(); retry.hidden = true;
        } catch (error) {
            empty.textContent = ''; status.textContent = error.message; retry.hidden = false;
        } finally { retry.disabled = false; }
    }
    retry.addEventListener('click', () => void load());
    route(); void load();
})();
