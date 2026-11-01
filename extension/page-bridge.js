// Only player commands cross into the page world; storage and network do not.
(() => {
    // include_globs can also match a path; enforce the original host intent.
    if (/\.(home|local)$/.test(location.hostname)
        || !(location.hostname.includes("rezka")
            || ["rezkify.com", "rezkery.com", "kinopub.me"].includes(location.hostname))) return;
    const commands = new Set([
        "play", "pause", "stop", "volume", "time", "duration", "seek",
        "fullscreen", "exitfullscreen", "muted", "mute", "unmute", "poster", "update:vast"
    ]);
    document.addEventListener("rezka-custom:player-request", event => {
        let message;
        try { message = JSON.parse(event.detail); } catch { return; }
        if (typeof message?.id !== "string") return;
        let result;
        let error;
        try {
            if (message.method === "max-quality") {
                result = RezkaQuality.setEnabled(message.value);
            } else if (message.method === "build") {
                if (typeof sof === "undefined" || typeof sof.tv?.buildCDNPlayer !== "function") throw new Error("Плеер ещё не готов.");
                sof.tv.buildCDNPlayer();
            } else if (commands.has(message.method)) {
                if (typeof CDNPlayer !== "undefined") result = CDNPlayer.api(message.method, message.value);
                // The callers only use primitive return values.
                if (!["string", "number", "boolean"].includes(typeof result)) result = undefined;
            } else { throw new Error("Неизвестная команда плеера."); }
        } catch (cause) { error = cause.message; }
        document.dispatchEvent(new CustomEvent("rezka-custom:player-response", {
            detail: JSON.stringify({ id: message.id, result, error })
        }));
    });
})();
