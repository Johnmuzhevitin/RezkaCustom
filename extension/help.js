document.querySelector('#build-info').textContent =
    `Rezka Custom ${REZKA_BUILD.version} · сборка ${REZKA_BUILD.id.slice(0, 12)}`;

(() => {
    const tabs = document.querySelector('#diagnostics-tab'), collect = document.querySelector('#diagnostics-collect');
    const copy = document.querySelector('#diagnostics-copy'), report = document.querySelector('#diagnostics-report');
    const status = document.querySelector('#diagnostics-status'), label = document.querySelector('#diagnostics-report-label');
    let windowId, request = 0;
    const panelSnapshot = () => {
        const views = chrome.extension.getViews({ windowId }).filter(view => view.location.pathname === '/popup.html');
        return views.length === 1 ? views[0].getRezkaPanelDiagnostics?.() : null;
    };
    const clear = () => { request++; report.value = ''; report.hidden = label.hidden = true; copy.disabled = true; status.textContent = ''; };
    tabs.addEventListener('change', clear);
    async function loadTabs() {
        const old = tabs.value;
        windowId = (await chrome.windows.getCurrent()).id;
        const available = (await chrome.tabs.query({ windowId })).filter(tab => RezkaNetwork.isSite(tab.url));
        tabs.replaceChildren(new Option('Без выбранной вкладки', ''));
        for (const tab of available) tabs.append(new Option(tab.title || new URL(tab.url).hostname, String(tab.id)));
        const preferred = old || String(panelSnapshot()?.tabId || '');
        tabs.value = available.some(tab => String(tab.id) === preferred) ? preferred : available.length === 1 ? String(available[0].id) : '';
        if (old !== tabs.value) clear();
    }
    collect.addEventListener('click', async () => {
        clear(); const currentRequest = request;
        collect.disabled = tabs.disabled = true;
        status.textContent = 'Собираем сведения…';
        try {
            const snapshot = panelSnapshot();
            const reply = await chrome.runtime.sendMessage({ type: 'rezka:diagnostics', helpBuild: REZKA_BUILD,
                panelBuild: snapshot?.build, tabId: tabs.value ? Number(tabs.value) : null });
            if (currentRequest !== request) return;
            if (!reply?.ok) throw new Error('unavailable');
            report.value = JSON.stringify(reply.report, null, 2); report.hidden = label.hidden = false; copy.disabled = false;
            status.textContent = 'Отчёт готов. Его можно просмотреть и скопировать. Недоступные части отмечены в отчёте.';
        } catch {
            if (currentRequest === request) status.textContent = 'Не удалось собрать отчёт. Откройте справку заново после обновления расширения.';
        } finally { collect.disabled = tabs.disabled = false; }
    });
    copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(report.value); status.textContent = 'Диагностика скопирована.'; }
        catch { report.focus(); report.select(); status.textContent = 'Браузер не разрешил копирование. Отчёт выделен — нажмите Ctrl+C.'; }
    });
    window.addEventListener('focus', () => { loadTabs().catch(() => {}); });
    loadTabs().catch(() => { status.textContent = 'Список вкладок недоступен. Можно собрать отчёт без страницы.'; });
})();
