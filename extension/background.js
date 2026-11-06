importScripts("build-info.js", "network-policy.js", "settings-schema.js");

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rezka:build-info') return;
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
    respond(REZKA_BUILD);
});

// Keep the same toolbar entry point, with a full-height, persistent side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(error => console.error('Rezka Custom: side panel setup failed', error));

// The worker owns writes so closing the panel cannot cancel queued changes.
let settingsWrites = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rezka:save-setting') return;
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
    settingsWrites = settingsWrites.catch(() => {}).then(async () => {
        const cached = await chrome.storage.local.get(null);
        const country = cached['ui:country:' + message.name];
        const config = REZKA_SETTINGS.find(item => item.name === message.name) || country;
        const option = Number.isInteger(message.index) && config?.options[message.index];
        if (!option) throw new Error('Настройка недоступна. Откройте меню заново.');
        const updates = {};
        if (country) {
            const label = country.label.replace(/ \(.+\)$/, '');
            const selected = new Set((cached['r4:hide-country-list'] || '').split(',').filter(Boolean));
            if (option.unset) selected.delete(label); else selected.add(label);
            updates['r4:hide-country-list'] = [...selected].join(',');
        }
        if (!option.unset) updates['r4:' + config.name] = option.value;
        if (Object.keys(updates).length) await chrome.storage.local.set(updates);
        if (option.unset) await chrome.storage.local.remove('r4:' + config.name);
    });
    settingsWrites.then(() => respond({ ok: true }), () => respond({ ok: false, error: 'Не удалось сохранить настройку. Попробуйте ещё раз.' }));
    return true;
});

// Limit extension requests and their redirects to supported sites and IMDb.
async function configureNetworkRules() {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1, 2, 3, 4, 5],
        addRules: [{
            id: 2, priority: 1, action: { type: "block" },
            condition: { regexFilter: "^https?://", initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"] }
        }, {
            id: 3, priority: 2, action: { type: "allow" },
            condition: {
                regexFilter: "^https?://([a-z0-9.-]*rezka[a-z0-9.-]*|rezkify\\.com|rezkery\\.com|kinopub\\.me)(:[0-9]+)?/|^https://(([a-z0-9-]+\\.)*imdb\\.com)/",
                initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"]
            }
        }, {
            id: 4, priority: 4, action: { type: "block" },
            condition: { regexFilter: "^https?://[^/]+\\.(home|local)(:[0-9]+)?/", initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"] }
        }, {
            id: 5, priority: 2, action: { type: "allow" },
            condition: { regexFilter: "^https://myshows\\.me/scrobble/(check|stop)$", initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"] }
        }]
    });
}
const rulesReady = configureNetworkRules();
rulesReady.catch(error => console.error("Rezka Custom: network rule setup failed", error));

async function request(details, source) {
    if (!RezkaNetwork.allowed(details.url, source)) throw new Error("Адрес запроса не разрешён.");
    const method = (details.method || "GET").toUpperCase();
    if (!["GET", "POST", "HEAD"].includes(method)) throw new Error("Метод запроса не разрешён.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(details.timeout || 20000, 25000));
    try {
        await rulesReady;
        const url = new URL(details.url);
        const headers = new Headers();
        for (const [key, value] of Object.entries(details.headers || {})) {
            if (["content-type", "accept"].includes(key.toLowerCase())) {
                headers.set(key, String(value));
            }
        }
        // Fetch hides manual redirect destinations. Let Chromium follow public
        // redirects with DNR enforcing the allowlist before each network hop.
        const response = await fetch(url.href, {
            method, headers,
            body: ["GET", "HEAD"].includes(method) ? undefined : details.data,
            credentials: url.origin === new URL(source).origin ? "include" : "omit",
            redirect: "follow",
            signal: controller.signal
        });
        if (!RezkaNetwork.allowed(response.url || url.href, source)) throw new Error("Переадресация не разрешена.");
        return {
            status: response.status, statusText: response.statusText,
            finalUrl: response.url || url.href, readyState: 4,
            responseHeaders: [...response.headers].map(([k, v]) => `${k}: ${v}`).join("\r\n"),
            responseText: await response.text()
        };
    } finally { clearTimeout(timer); }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== "rezka:request") return;
    if (sender.id !== chrome.runtime.id || !sender.tab || !RezkaNetwork.isSite(sender.url)) {
        respond({ ok: false, error: "Источник запроса не разрешён." });
        return;
    }
    request(message.details || {}, sender.url).then(
        response => respond({ ok: true, response }),
        error => respond({ ok: false, error: error.message, timeout: error.name === "AbortError" })
    );
    return true;
});

importScripts('myshows-core.js', 'myshows-worker.js');
importScripts('diagnostics-worker.js');
importScripts('search-rules.js', 'search-core.js', 'search-store.js', 'backup-core.js', 'backup-worker.js');
