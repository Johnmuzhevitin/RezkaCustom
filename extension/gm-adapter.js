// The compatibility surface used by the original script. Kept in ISOLATED world.
const GM = (() => {
    const prefix = "r4:";
    return {
        info: { script: { name: "Rezka Custom", version: "2.1.8" } },
        addStyle(css) {
            const style = document.createElement("style");
            style.textContent = css;
            const append = () => {
                const target = document.head || document.documentElement;
                if (!target) return false;
                target.appendChild(style);
                return true;
            };
            if (!append()) {
                const observer = new MutationObserver(() => { if (append()) observer.disconnect(); });
                observer.observe(document, { childList: true, subtree: true });
            }
            return style;
        },
        async getValue(name, fallback) {
            const key = prefix + name;
            const data = await chrome.storage.local.get(key);
            return Object.hasOwn(data, key) ? data[key] : fallback;
        },
        async setValue(name, value) {
            if (value === undefined) return chrome.storage.local.remove(prefix + name);
            return chrome.storage.local.set({ [prefix + name]: value });
        },
        async deleteValue(name) { return chrome.storage.local.remove(prefix + name); },
        async listValues() {
            return Object.keys(await chrome.storage.local.get(null))
                .filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
        },
        async xmlHttpRequest(details) {
            let result;
            try {
                result = await chrome.runtime.sendMessage({ type: "rezka:request", details: {
                    method: details.method, url: details.url, headers: details.headers,
                    data: details.data, timeout: details.timeout
                } });
            } catch (error) { result = { ok: false, error: error.message }; }
            if (!result?.ok) {
                const response = { status: 0, responseText: "", error: result?.error };
                const callback = result?.timeout ? (details.ontimeout || details.onerror) : details.onerror;
                callback?.(response);
                return response;
            }
            const response = result.response;
            response.response = response.responseText;
            if (details.responseType === "json") {
                try { response.response = JSON.parse(response.responseText); }
                catch { response.response = null; }
            }
            details.onload?.(response);
            return response;
        }
    };
})();

