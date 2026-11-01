const RezkaPlayer = (() => {
    const pending = new Map();
    let sequence = 0;
    document.addEventListener("rezka-custom:player-response", event => {
        let message;
        try { message = JSON.parse(event.detail); } catch { return; }
        const entry = pending.get(message?.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.delete(message.id);
        if (message.error) console.warn("Rezka Custom:", message.error);
        entry.resolve(message.result);
    });
    function call(method, value) {
        return new Promise(resolve => {
            const id = `${++sequence}-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`;
            const timer = setTimeout(() => {
                pending.delete(id);
                console.warn("Rezka Custom: нет ответа от плеера.");
                resolve(undefined);
            }, 3000);
            pending.set(id, { resolve, timer });
            // Synchronous dispatch preserves the user gesture for fullscreen.
            document.dispatchEvent(new CustomEvent("rezka-custom:player-request", {
                detail: JSON.stringify({ id, method, value })
            }));
        });
    }
    return { call };
})();
