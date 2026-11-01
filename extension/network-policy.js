/* Shared by the worker and contract tests. No page-supplied executable code. */
const RezkaNetwork = (() => {
    function isSite(input) {
        try {
            const url = new URL(input);
            return ["http:", "https:"].includes(url.protocol)
                && !/\.(home|local)$/.test(url.hostname)
                && (url.hostname.includes("rezka")
                    || ["rezkify.com", "rezkery.com", "kinopub.me"].includes(url.hostname));
        } catch { return false; }
    }

    function allowed(input, source) {
        try {
            const url = new URL(input);
            if (!isSite(source) || url.username || url.password) return false;
            if (!["http:", "https:"].includes(url.protocol)) return false;
            if (url.origin === new URL(source).origin) return true;
            if (url.protocol !== "https:") return false;
            return url.hostname === "api.opensubtitles.com"
                || url.hostname === "imdb.com" || url.hostname.endsWith(".imdb.com");
        } catch { return false; }
    }
    return { isSite, allowed };
})();
