const $ = selector => document.querySelector(selector);
const content = $('#content');
const sectionCopy = {
    view: ['Под ваш экран', 'Оформление сайта, в котором удобно смотреть.'],
    player: ['Ваш способ смотреть', 'Качество видео, размер плеера, серии и управление.'],
    myshows: ['MyShows', 'Автоматические отметки, очередь и история синхронизации.']
};
const copy = {
    'content-size': ['view', 'Ширина страницы', ''],
    font: ['view', 'Шрифт сайта', ''],
    styles: ['view', 'Улучшенное оформление', 'Аккуратные отступы, кнопки и блоки'],
    'dim-watched': ['view', 'Различать статусы просмотра', 'Смотрю — золотистый постер. Просмотренное — бледные карточки и названия. По записям в «Досмотреть»'],
    imdb: ['view', 'Рейтинги IMDb', 'Оценки на карточках фильмов и сериалов'],
    'navbar-links': ['view', 'Разделы каталога открывать', ''],
    'search-candidate-limit': ['view', 'Лимит проверки карточек', 'В расширенном поиске за один запуск. Затем можно продолжить. Больший лимит — дольше поиск. Изменения действуют со следующего запуска или продолжения'],
    'theme-color-black': ['view', 'Чёрная панель браузера', 'Для браузеров с поддержкой цвета страницы'],
    'player-max-quality': ['player', 'Всегда максимальное качество', 'Лучшее доступное для каждого видео и озвучки: 4K, 2K, 1080p Ultra и ниже'],
    'player-no-margin': ['player', 'Плеер без боковых отступов', 'На всю ширину блока просмотра'],
    'player-top-bar': ['player', 'Название поверх видео', 'Название фильма, сезон и номер серии'],
    'player-extra-controls': ['player', 'Дополнительные кнопки', 'Перемотка, серии и разворачивание'],
    'auto-play-next': ['player', 'Переход к следующей серии', ''],
    'player-cover': ['player', 'Обложка до начала просмотра', 'Постер фильма вместо пустого плеера'],
    hotkeys: ['player', 'Горячие клавиши', 'Работают, даже когда плеер не в фокусе'],
    'hide-ads': ['view', 'Скрывать рекламные блоки', 'Реклама в баннерах и вставках на странице'],
    'hide-player-ads': ['view', 'Отключать рекламу в плеере', 'Реклама перед началом просмотра'],
    'comments-hide': ['view', 'Сворачивать отзывы', 'Отзывы остаются доступны по нажатию']
};
let data = {}, configs = [], section = 'view', targetTab = null, connected = false;
let refreshId = 0, searchAnnouncement;
let targetWindowId, tabQueryId = 0;
// Same-extension help views can inspect this loaded panel without reading its journal.
window.getRezkaPanelDiagnostics = () => ({ build: { ...REZKA_BUILD }, tabId: targetTab?.id, windowId: targetWindowId });
const optimistic = new Map();

function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}
function details(config) {
    return copy[config.name];
}
function indexOf(config) {
    if (optimistic.has(config.name)) return optimistic.get(config.name);
    const value = data['r4:' + config.name];
    const index = config.options.findIndex(option => option.unset ? value === undefined : option.value === value);
    return index < 0 ? config.defaultIndex : index;
}
function loadConfigs(live = []) {
    const all = new Map(REZKA_SETTINGS.map(config => [config.name, config]));
    for (const config of live) all.set(config.name, config);
    // Only settings with a retained menu section belong in the panel or its search.
    configs = [...all.values()].filter(config => Object.hasOwn(copy, config.name));
}
function status(text, error = false) {
    $('#save-status span').textContent = text;
    $('#save-status').dataset.error = String(error);
}
function notice(text, reload = false, error = false) {
    $('#notice').hidden = !text;
    $('#notice').classList.toggle('error', error);
    $('#notice-text').textContent = text;
    $('#reload-button').hidden = !reload;
    const message = text + (text && reload ? ' Доступна кнопка «Обновить страницу».' : '');
    if ($('#notice-status').textContent !== message) $('#notice-status').textContent = message;
}
async function refreshConnection() {
    const id = ++refreshId;
    const tab = targetTab;
    connected = false;
    $('#site-dot').classList.remove('connected');
    const supported = tab && RezkaNetwork.isSite(tab.url);
    $('#site-label').textContent = supported ? new URL(tab.url).hostname + ' · подключаемся…' : 'Настройки для всех зеркал Rezka';
    notice('');
    const [workerBuild, state] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'rezka:build-info' }).catch(() => null),
        supported ? chrome.tabs.sendMessage(tab.id, { type: 'rezka:settings-state' }, { frameId: 0 }).catch(() => null) : null
    ]);
    if (id !== refreshId) return;
    $('#version').title = `Панель: ${REZKA_BUILD.id}\nРасширение: ${workerBuild?.id || 'не определено'}\nСтраница: ${state?.build?.id || 'не определено'}`;
    if (!workerBuild?.id || workerBuild.id !== REZKA_BUILD.id) {
        $('#site-label').textContent = 'Нужно проверить обновление расширения';
        notice((workerBuild?.id ? 'Загруженные файлы расширения не совпадают. ' : 'Не удалось определить сборку расширения. ')
            + 'Обновите Rezka Custom в chrome://extensions/ и откройте панель заново.', false, true);
        return;
    }
    if (!supported) {
        $('#site-label').textContent = 'Настройки для всех зеркал Rezka';
        notice('Изменения применятся, когда вы откроете Rezka.');
        return;
    }
    const staleBuild = state?.connected && state.build?.id !== workerBuild.id;
    connected = !!state?.connected && !staleBuild;
    $('#site-dot').classList.toggle('connected', connected);
    $('#site-label').textContent = new URL(tab.url).hostname + (connected ? ' · подключено' : ' · нужно обновить страницу');
    if (staleBuild) { notice('Обновите эту страницу, чтобы загрузить текущую сборку расширения.', true); return; }
    if (!connected) { notice('Обновите эту страницу, чтобы подключить настройки.', true); return; }
    loadConfigs(state.settings);
    if (state.errors?.length) notice('Часть изменений не применилась. Обновите страницу.', true, true);
    else if (state.pendingReload?.length) notice('Для части изменений нужно обновить эту страницу.', true);
    else notice('');
}

async function followActiveTab() {
    const id = ++tabQueryId;
    ++refreshId; // Ignore replies from a tab that was active before this query.
    targetTab = null;
    connected = false;
    $('#site-dot').classList.remove('connected');
    $('#site-label').textContent = 'Подключаемся к странице…';
    notice('');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (id !== tabQueryId) return;
    targetTab = tab || null;
    targetWindowId = tab?.windowId ?? targetWindowId;
    await refreshConnection();
}

async function save(config, index) {
    optimistic.set(config.name, index);
    updateControls();
    status('Сохраняем…');
    try {
        const response = await chrome.runtime.sendMessage({ type: 'rezka:save-setting', name: config.name, index });
        if (!response?.ok) throw new Error(response?.error || 'Не удалось сохранить.');
        data = await chrome.storage.local.get(null);
        if (optimistic.get(config.name) === index) optimistic.delete(config.name);
        updateControls();
        status('Изменения сохранены');
        await refreshConnection();
    } catch {
        if (optimistic.get(config.name) === index) optimistic.delete(config.name);
        updateControls();
        status('Не удалось сохранить', true);
        notice('Не удалось сохранить настройку. Повторите попытку.', false, true);
    }
}
function optionText(config, index) {
    if (config.name === 'content-size') return ['580', '960', '1150', '1340', '1530', 'Вся'][index];
    if (config.name === 'auto-play-next') return ['Как в профиле Rezka', 'Сразу, включая следующий сезон', 'Не переключать'][index];
    if (config.name === 'navbar-links' && index === 0) return 'Без дополнительного фильтра';
    return config.options[index].text;
}
function segments(config, label) {
    const group = el('div', 'segments');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', label);
    config.options.forEach((option, index) => {
        const button = el('button', '', optionText(config, index));
        button.type = 'button';
        button.dataset.setting = config.name;
        button.dataset.index = index;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-label', config.name === 'content-size' ? (index === 5 ? 'На всю ширину' : `${optionText(config, index)} пикселей`) : optionText(config, index));
        button.addEventListener('click', () => save(config, index));
        button.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? config.options.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + config.options.length) % config.options.length;
            group.children[next].focus();
            save(config, next);
        });
        group.append(button);
    });
    return group;
}
function widthControl(config) {
    const panel = el('section', 'viewport-panel');
    const heading = el('div', 'viewport-heading');
    heading.append(el('span', '', 'Ширина страницы'), el('output', '', ''));
    panel.append(heading, segments(config, 'Ширина страницы'));
    return panel;
}
function settingRow(config) {
    const [, label, description] = details(config);
    const binary = config.options.length === 2 && config.options.every(option => ['Выкл', 'Вкл'].includes(option.text));
    const id = 'setting-' + config.name;
    const row = el(binary ? 'label' : 'div', binary ? 'setting setting-toggle' : 'setting');
    const text = el('span', 'setting-text');
    const title = el(binary ? 'span' : 'label', 'setting-name', label);
    title.id = id + '-label';
    if (!binary) title.htmlFor = id;
    text.append(title);
    if (description) {
        const help = el('span', 'setting-description', description);
        help.id = id + '-description'; text.append(help);
    }
    row.append(text);
    if (binary) {
        const input = el('input', 'switch');
        input.type = 'checkbox';
        input.id = id;
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-labelledby', title.id);
        if (description) input.setAttribute('aria-describedby', id + '-description');
        input.dataset.setting = config.name;
        input.addEventListener('change', () => save(config, input.checked ? 1 : 0));
        row.append(input);
    } else {
        row.classList.add('stacked');
        const select = el('select');
        select.id = id;
        if (description) select.setAttribute('aria-describedby', id + '-description');
        select.dataset.setting = config.name;
        config.options.forEach((option, index) => {
            const item = el('option', '', optionText(config, index));
            item.value = index;
            select.append(item);
        });
        select.addEventListener('change', () => save(config, Number(select.value)));
        row.append(select);
    }
    return row;
}
function updateControls() {
    const byName = new Map(configs.map(config => [config.name, config]));
    for (const control of document.querySelectorAll('[data-setting]')) {
        const config = byName.get(control.dataset.setting);
        if (!config) continue;
        const index = indexOf(config);
        if (control.type === 'checkbox') control.checked = index === 1;
        else if (control.tagName === 'SELECT') control.value = index;
        else {
            const checked = Number(control.dataset.index) === index;
            control.setAttribute('aria-checked', String(checked));
            control.tabIndex = checked ? 0 : -1;
        }
    }
    const width = byName.get('content-size');
    if ($('.viewport-panel') && width) {
        const index = indexOf(width);
        $('.viewport-panel output').textContent = index === 5 ? 'На всю ширину' : optionText(width, index) + ' px';
    }
}
function render() {
    const query = $('#search-input').value.trim().toLocaleLowerCase('ru');
    clearTimeout(searchAnnouncement);
    if (section === 'myshows') {
        if (RezkaMyShowsPanel.setQuery(query)) return;
        RezkaMyShowsPanel.unmount();
        content.replaceChildren();
        content.setAttribute('role', 'tabpanel');
        content.setAttribute('aria-labelledby', 'tab-myshows');
        content.setAttribute('aria-busy', 'false');
        $('#search-status').textContent = '';
        RezkaMyShowsPanel.mount(content, query, () => targetTab);
        return;
    }
    RezkaMyShowsPanel.unmount();
    // A search has its own heading; the selected tab continues to identify the return destination.
    content.setAttribute('role', query ? 'region' : 'tabpanel');
    content.setAttribute('aria-labelledby', query ? 'results-heading' : 'tab-' + section);
    content.replaceChildren();
    content.setAttribute('aria-busy', 'false');
    const intro = sectionCopy[section];
    const heading = el('h1', '', query ? 'Результаты поиска' : intro[0]);
    heading.id = 'results-heading';
    content.append(heading, el('p', 'intro', query ? 'Настройки и разделы меню.' : intro[1]));
    if (!query) $('#search-status').textContent = '';
    let selected = configs.filter(config => {
        const [group, label, description] = details(config);
        return query ? `${label} ${description} ${config.label}`.toLocaleLowerCase('ru').includes(query) : group === section;
    });
    const myshowsResult = query && 'myshows синхронизация автоматические отметки очередь история'.includes(query);
    if (myshowsResult) {
        const destination = el('button', 'text-button search-destination', 'MyShows — отметки, очередь и история');
        destination.addEventListener('click', () => selectSection('myshows'));
        content.append(destination);
    }
    if (query) {
        const count = selected.length + Number(!!myshowsResult);
        searchAnnouncement = setTimeout(() => {
            $('#search-status').textContent = count ? `По запросу «${query}» найдено: ${count}.` : `По запросу «${query}» ничего не найдено. Попробуйте другой запрос.`;
        }, 250);
    }
    if (!selected.length && !myshowsResult) {
        const empty = el('div', 'empty');
        empty.append(el('h2', '', 'Ничего не нашлось'), el('p', '', 'Попробуйте «серии», «реклама» или «ширина».'));
        const clear = el('button', 'text-button', 'Очистить поиск');
        clear.addEventListener('click', () => { $('#search-input').value = ''; render(); $('#search-input').focus(); });
        empty.append(clear);
        content.append(empty);
    }
    // Keep the width choices together, ahead of miscellaneous rows.
    if (!query && section === 'view') {
        const width = selected.find(config => config.name === 'content-size');
        content.append(widthControl(width));
        selected = selected.filter(config => config !== width);
        const order = ['styles', 'imdb', 'font', 'navbar-links', 'theme-color-black', 'search-candidate-limit'];
        selected.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    }
    for (const config of selected) content.append(settingRow(config));
    if (!query && section === 'player') {
        const keys = el('div', 'key-list');
        for (const [key, label] of [['Space', 'Пауза'], ['F', 'Полный экран'], ['N / P', 'Серии']]) {
            const item = el('span'); item.append(el('kbd', '', key), document.createTextNode(label)); keys.append(item);
        }
        content.append(keys);
    }
    updateControls();
}
function selectSection(next, focus = false) {
    section = next;
    $('#search-input').value = '';
    $('#search-input').placeholder = next === 'myshows' ? 'Найти фильм или сериал в журнале' : 'Найти настройку';
    $('#search-input').setAttribute('aria-label', $('#search-input').placeholder);
    for (const button of document.querySelectorAll('[role="tab"]')) {
        const selected = button.dataset.section === next;
        button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
        if (selected && focus) button.focus();
    }
    content.setAttribute('aria-labelledby', 'tab-' + next);
    chrome.storage.local.set({ 'ui:last-section': next }).catch(() => status('Не удалось запомнить раздел', true));
    render(); content.scrollTop = 0;
}
document.querySelectorAll('[role="tab"]').forEach((button, index, tabs) => {
    button.addEventListener('click', () => selectSection(button.dataset.section));
    button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        selectSection(tabs[next].dataset.section, true);
    });
});
$('#search-input').addEventListener('input', () => { render(); content.scrollTop = 0; });
document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !event.isComposing && event.code === 'KeyF') {
        event.preventDefault(); $('#search-input').focus(); $('#search-input').select();
    }
    if (event.key === 'Escape' && $('#search-input').value) { event.preventDefault(); $('#search-input').value = ''; render(); $('#search-input').focus(); }
});
$('#search-shortcut').textContent = navigator.platform.startsWith('Mac') ? '⌘ F' : 'Ctrl F';
$('#help-button').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.addEventListener('rezka:backup-restored', () => {
    refreshConnection().catch(() => notice('Не удалось проверить применение настроек. Откройте панель заново.', false, true));
});
$('#reload-button').addEventListener('click', async () => {
    if (!targetTab?.id) return;
    try { await chrome.tabs.reload(targetTab.id); }
    catch { notice('Не удалось обновить вкладку. Обновите её вручную.', false, true); }
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
        if (change.newValue === undefined) delete data[key]; else data[key] = change.newValue;
    }
    updateControls();
});
(async () => {
    try {
        data = await chrome.storage.local.get(null);
        loadConfigs();
        $('#version').textContent = `v${REZKA_BUILD.version} · ${REZKA_BUILD.id.slice(0, 8)}`;
        selectSection(sectionCopy[data['ui:last-section']] ? data['ui:last-section'] : 'view');
        chrome.tabs.onActivated.addListener(info => {
            if (targetWindowId === undefined || info.windowId === targetWindowId) followActiveTab().catch(() => notice('Не удалось подключиться к вкладке. Откройте панель заново.', false, true));
        });
        chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
            if (tabId !== targetTab?.id || (!change.status && !change.url)) return;
            targetTab = tab;
            refreshConnection();
        });
        await followActiveTab();
        render();
    } catch {
        content.replaceChildren(el('h1', '', 'Не удалось открыть настройки'), el('p', 'intro', 'Закройте меню и откройте его снова.'));
        content.setAttribute('aria-busy', 'false'); status('Ошибка загрузки', true);
    }
})();
