// PlayerJS API: https://playerjs.com/docs/en=apicommands
// Keep quality discovery and selection in the page world, next to CDNPlayer.
const RezkaQuality = (() => {
    let enabled = false, interval, scheduled, lastAttempt;
    const events = new Set(['init', 'inited', 'new', 'start', 'started', 'play', 'metadata', 'quality']);

    function labelText(label) {
        return label.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
            .replace(/\s+/g, ' ').trim();
    }

    function score(label) {
        // PlayerJS group headings occupy indices, but cannot be selected.
        // Rezka marks subscription-only teaser streams with a premium badge.
        if (/^\s*<<<|\bpremium\b|prem-quality|prem-icon|\bdisabled\b/i.test(label)) return null;
        const text = labelText(label);
        if (/^(auto|авто)(\b|\s|$)/i.test(text)) return null;
        const dimensions = text.match(/\b\d{3,5}\s*[x×]\s*(\d{3,5})\b/i);
        const pixels = text.match(/\b(\d{3,5})\s*p\b/i) || text.match(/^(\d{3,5})$/);
        const kilo = text.match(/\b([248])\s*k\b/i);
        let height = dimensions ? Number(dimensions[1]) : pixels ? Number(pixels[1]) : 0;
        if (!height && kilo) height = { 2: 1440, 4: 2160, 8: 4320 }[kilo[1]];
        if (!height) {
            if (/\b(uhd|ultra\s*hd)\b/i.test(text)) height = 2160;
            else if (/\b(qhd|wqhd)\b/i.test(text)) height = 1440;
            else if (/\b(fhd|full\s*hd)\b/i.test(text)) height = 1080;
            else if (/\bhd\b/i.test(text)) height = 720;
            else if (/\bsd\b/i.test(text)) height = 480;
        }
        if (!height) return null;
        const bitrate = text.match(/\b(\d+(?:\.\d+)?)\s*([km])bps\b/i);
        return [height, /\bultra\b/i.test(text) ? 1 : 0,
            bitrate ? Number(bitrate[1]) * (bitrate[2].toLowerCase() === 'm' ? 1000 : 1) : 0];
    }

    function better(left, right) {
        for (let index = 0; index < left.length; index++) {
            if (left[index] !== right[index]) return left[index] > right[index];
        }
        return false;
    }

    function check() {
        if (!enabled) return;
        try {
            if (typeof CDNPlayer === 'undefined' || typeof CDNPlayer?.api !== 'function') return;
            const player = CDNPlayer;
            const available = player.api('qualities');
            const labels = typeof available === 'string' ? available.split(',') : available;
            if (!Array.isArray(labels)) return;
            let best;
            labels.forEach((label, index) => {
                if (typeof label !== 'string' && typeof label !== 'number') return;
                const rank = score(String(label));
                if (rank && (!best || better(rank, best.rank))) best = { index, label: String(label), rank };
            });
            if (!best) return;
            const current = player.api('quality');
            // An unavailable getter usually means initialization is unfinished.
            if (!['string', 'number'].includes(typeof current) || current === '') return;
            if (current === best.index || labelText(String(current)) === labelText(best.label)) {
                lastAttempt = undefined;
                return;
            }
            const signature = JSON.stringify([labels, current, best.index]);
            // An async or unsupported setter must not repeatedly reload playback.
            if (lastAttempt?.player === player && lastAttempt.signature === signature) return;
            lastAttempt = { player, signature };
            player.api('quality', best.index);
            const selected = player.api('quality');
            if (selected === best.index || labelText(String(selected)) === labelText(best.label)) lastAttempt = undefined;
        } catch {
            // Player instances may disappear while a series or translation loads.
            // Permit a later retry after a transient API exception.
            lastAttempt = undefined;
        }
    }

    function onMessage(event) {
        if (event.source !== window || event.origin !== location.origin || !events.has(event.data?.event)) return;
        // Let the site's event handler finish replacing the player/source first.
        if (scheduled !== undefined) return;
        scheduled = setTimeout(() => { scheduled = undefined; check(); }, 0);
    }

    function setEnabled(value) {
        if (typeof value !== 'boolean') throw new Error('Некорректная настройка качества.');
        if (enabled === value) return enabled;
        enabled = value;
        lastAttempt = undefined;
        if (enabled) {
            window.addEventListener('message', onMessage);
            // Covers late initialization, silent source changes and rebuilt players.
            interval = setInterval(check, 1000);
            check();
        } else {
            window.removeEventListener('message', onMessage);
            clearInterval(interval);
            clearTimeout(scheduled);
            interval = scheduled = undefined;
        }
        return enabled;
    }

    return { setEnabled };
})();
