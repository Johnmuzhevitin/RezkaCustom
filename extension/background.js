importScripts("network-policy.js");

// Chromium fetch drops custom User-Agent headers. Scope the replacement to
// requests made by this extension to OpenSubtitles, never to page requests.
async function configureHeaders() {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1, 2, 3, 4],
        addRules: [{
            id: 1, priority: 3,
            action: { type: "modifyHeaders", requestHeaders: [{
                header: "User-Agent", operation: "set",
                value: "hdrezka-improvement userscript v2.1.8"
            }] },
            condition: {
                urlFilter: "|https://api.opensubtitles.com/",
                initiatorDomains: [chrome.runtime.id],
                resourceTypes: ["xmlhttprequest"]
            }
        }, {
            id: 2, priority: 1, action: { type: "block" },
            condition: { regexFilter: "^https?://", initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"] }
        }, {
            id: 3, priority: 2, action: { type: "allow" },
            condition: {
                regexFilter: "^https?://([a-z0-9.-]*rezka[a-z0-9.-]*|rezkify\\.com|rezkery\\.com|kinopub\\.me)(:[0-9]+)?/|^https://(api\\.opensubtitles\\.com|([a-z0-9-]+\\.)*imdb\\.com)/",
                initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"]
            }
        }, {
            id: 4, priority: 4, action: { type: "block" },
            condition: { regexFilter: "^https?://[^/]+\\.(home|local)(:[0-9]+)?/", initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"] }
        }]
    });
}
const headersReady = configureHeaders();
headersReady.catch(error => console.error("Rezka Custom: header setup failed", error));

async function request(details, source) {
    if (!RezkaNetwork.allowed(details.url, source)) throw new Error("Адрес запроса не разрешён.");
    const method = (details.method || "GET").toUpperCase();
    if (!["GET", "POST", "HEAD"].includes(method)) throw new Error("Метод запроса не разрешён.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(details.timeout || 20000, 25000));
    try {
        await headersReady;
        const url = new URL(details.url);
        const headers = new Headers();
        for (const [key, value] of Object.entries(details.headers || {})) {
            if (["content-type", "accept", "api-key", "authorization"].includes(key.toLowerCase())) {
                headers.set(key, String(value));
            }
        }
        if (url.hostname !== "api.opensubtitles.com") {
            headers.delete("Authorization");
            headers.delete("Api-Key");
        }
        // Fetch hides manual redirect destinations. Let Chromium follow public
        // redirects with DNR enforcing the allowlist before each network hop.
        // Never forward OpenSubtitles credentials through a redirect.
        const response = await fetch(url.href, {
            method, headers,
            body: ["GET", "HEAD"].includes(method) ? undefined : details.data,
            credentials: url.origin === new URL(source).origin ? "include" : "omit",
            redirect: url.hostname === "api.opensubtitles.com" ? "error" : "follow",
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

chrome.action.onClicked.addListener(async tab => {
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "rezka:settings" }, { frameId: 0 });
        if (response?.opened) return;
    } catch { /* No content script on this tab. */ }
    await chrome.runtime.openOptionsPage();
});
