// Search data and pagination. No fetched markup is inserted into the live page.
const RezkaSearch = (() => {
    const TYPES = { films: 'Фильмы', series: 'Сериалы', cartoons: 'Мультфильмы', animation: 'Аниме' };
    const TYPE_IDS = { films: '1', series: '2', cartoons: '3', animation: '82' };
    const SORTS = { last: 'Последние поступления', popular: 'Популярные', watching: 'Сейчас смотрят', soon: 'В ожидании' };
    const COUNTRIES = ['Австралия', 'Австрия', 'Аргентина', 'Беларусь', 'Бельгия', 'Бразилия', 'Великобритания', 'Венгрия', 'Германия', 'Гонконг', 'Дания', 'Израиль', 'Индия', 'Индонезия', 'Ирландия', 'Исландия', 'Испания', 'Италия', 'Казахстан', 'Канада', 'Китай', 'Корея Южная', 'Кыргызстан', 'Мексика', 'Нидерланды', 'Новая Зеландия', 'Норвегия', 'Польша', 'Португалия', 'Россия', 'Румыния', 'СССР', 'США', 'Таиланд', 'Тайвань', 'Турция', 'Украина', 'Филиппины', 'Финляндия', 'Франция', 'Чехия', 'Швейцария', 'Швеция', 'ЮАР', 'Япония'];
    const GENRES = {
        action: 'Боевики', adventures: 'Приключения', arthouse: 'Арт-хаус',
        biographical: 'Биографические', comedy: 'Комедии', crime: 'Криминал', detective: 'Детективы',
        documentary: 'Документальные', drama: 'Драмы', family: 'Семейные', fantasy: 'Фэнтези',
        fiction: 'Фантастика', historical: 'Исторические', horror: 'Ужасы', kids: 'Детские',
        melodrama: 'Мелодрамы', military: 'Военные', musical: 'Музыкальные', short: 'Короткометражные',
        sport: 'Спортивные', thriller: 'Триллеры', western: 'Вестерны', romance: 'Романтические',
        mystery: 'Мистические', everyday: 'Повседневность', school: 'Школа', mecha: 'Меха',
        fairytale: 'Сказки', realtv: 'Реальное ТВ', telecasts: 'Телепередачи', standup: 'Стендап',
        cognitive: 'Познавательные', travel: 'Путешествия', theatre: 'Театр', concert: 'Концерт',
        erotic: 'Эротика', fighting: 'Боевые искусства', samurai: 'Самурайский боевик',
        educational: 'Образовательные', parody: 'Пародия', kodomo: 'Кодомо', shoujoai: 'Сёдзё-ай',
        shoujo: 'Сёдзё', shounen: 'Сёнэн', shounenai: 'Сёнэн-ай', ecchi: 'Этти', mahoushoujo: 'Махо-сёдзё',
        anime: 'Аниме', adult: 'Для взрослых', multseries: 'Мультсериалы', 'full-length': 'Полнометражные',
        soyzmyltfilm: 'Советские', russian: 'Русские', ukrainian: 'Украинские', foreign: 'Зарубежные'
    };
    const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
    const fold = value => clean(value).toLocaleLowerCase('ru').replaceAll('ё', 'е');
    function normalize(input = {}) {
        const year = value => /^\d{4}$/.test(String(value)) && +value >= 1890 && +value <= new Date().getFullYear() + 5 ? String(value) : '';
        const country = clean(input.country).slice(0, 80);
        return {
            q: clean(input.q).slice(0, 200), type: Object.hasOwn(TYPES, input.type) ? input.type : '',
            genre: Object.hasOwn(GENRES, input.genre) ? input.genre : '',
            from: year(input.from), to: year(input.to), country: COUNTRIES.find(value => fold(value) === fold(country)) || country,
            sort: Object.hasOwn(SORTS, input.sort) ? input.sort : 'last'
        };
    }
    function readState(url) {
        const parsed = new URL(url);
        return normalize({ ...Object.fromEntries(parsed.searchParams), ...Object.fromEntries(new URLSearchParams(parsed.hash.slice(1))) });
    }
    function pageURL(state, origin) {
        const url = new URL('/search/', origin);
        // Only native search parameters reach the server. Its own genre/type
        // parameters conflict with our values and can redirect a saved URL to /.
        url.searchParams.set('do', 'search');
        url.searchParams.set('subaction', 'search');
        const fragment = new URLSearchParams({ 'rc-search': '1' });
        for (const [key, value] of Object.entries(normalize(state))) {
            if (key === 'q') { if (value) url.searchParams.set('q', value); }
            else if (value && !(key === 'sort' && value === 'last')) fragment.set(key, value);
        }
        url.hash = fragment.toString();
        return url.href;
    }
    function plan(state, origin) {
        const s = normalize(state), url = new URL('/', origin);
        const covered = { country: false, genre: false };
        if (s.q) {
            url.pathname = '/search/';
            url.search = new URLSearchParams({ do: 'search', subaction: 'search', q: s.q }).toString();
        } else {
            if (s.country) {
                url.pathname = '/country/' + encodeURIComponent(s.country) + '/';
                covered.country = true;
            } else if (s.type && s.genre) {
                url.pathname = '/' + s.type + '/' + s.genre + '/';
                covered.genre = true;
            } else if (s.from && s.from === s.to) {
                url.pathname = '/year/' + s.from + '/';
            } else if (s.type) url.pathname = '/' + s.type + '/';
            url.searchParams.set('filter', s.sort);
            if (s.type && !url.pathname.startsWith('/' + s.type + '/')) url.searchParams.set('genre', TYPE_IDS[s.type]);
        }
        return { url: url.href, covered };
    }
    function safeURL(value, base, sameOrigin = true) {
        try {
            if (!value) return '';
            const url = new URL(value, base);
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
            if (sameOrigin && url.origin !== new URL(base).origin) return '';
            return url.href;
        } catch { return ''; }
    }
    function cardURL(value, base) {
        const href = safeURL(value, base);
        return href && /^\/(films|series|cartoons|animation)\/[^/]+\/\d+-[^/]+\.html$/.test(new URL(href).pathname) ? href : '';
    }
    function pageNumber(url) {
        const parsed = new URL(url);
        return Number(parsed.searchParams.get('page') || parsed.pathname.match(/\/page\/(\d+)\//)?.[1] || 1);
    }
    function nextURL(doc, current) {
        const base = new URL(current), currentPage = pageNumber(current);
        for (const anchor of doc.querySelectorAll('.b-navigation a[href]')) {
            const href = safeURL(anchor.getAttribute('href'), current);
            if (!href || pageNumber(href) !== currentPage + 1) continue;
            const candidate = new URL(href);
            if (candidate.pathname.replace(/\/page\/\d+\/$/, '/') !== base.pathname.replace(/\/page\/\d+\/$/, '/')) continue;
            // Some mirrors omit catalogue filters from pager links; preserve them.
            for (const [key, value] of base.searchParams) if (key !== 'page') candidate.searchParams.set(key, value);
            return candidate.href;
        }
        return null;
    }
    function documentFor(html) { return new DOMParser().parseFromString(html, 'text/html'); }
    function parseList(html, url) {
        const doc = documentFor(html);
        const container = doc.querySelector('.b-content__search_wrapper, .b-content__inline_items');
        const heading = clean(doc.querySelector('h1')?.textContent);
        if (!container) {
            if (/ничего не найден|не найдено|не дал результатов|нет результатов/i.test(doc.body.textContent) && /поиск/i.test(heading)) return { items: [], next: null };
            throw new Error('Сайт не вернул каталог. Откройте HDrezka и проверьте, выполнен ли вход, затем повторите поиск.');
        }
        const items = [];
        for (const card of container.querySelectorAll('.b-content__inline_item')) {
            const link = card.querySelector('.b-content__inline_item-link a');
            const href = cardURL(link?.getAttribute('href'), url);
            if (!href) continue;
            const path = new URL(href).pathname, parts = path.split('/');
            const info = clean(card.querySelector('.b-content__inline_item-link div')?.textContent);
            items.push({
                id: path.match(/\/(\d+)-/)[1], url: href, title: clean(link.textContent), type: parts[1],
                genre: parts[2], year: Number(info.match(/^\d{4}/)?.[0]) || null, info,
                country: info.split(',')[1]?.trim() || '',
                image: safeURL(card.querySelector('img')?.getAttribute('src') || '', url, false),
                episode: clean(card.querySelector('.info')?.textContent)
            });
        }
        if (!items.length && container.querySelector('.b-content__inline_item')) throw new Error('Разметка результатов изменилась. Попробуйте обычный поиск сайта.');
        return { items, next: nextURL(doc, url) };
    }
    function parseDetails(html, url) {
        const doc = documentFor(html);
        const metadata = { countries: [], genres: [] };
        let foundCountries = false, foundGenres = false;
        for (const row of doc.querySelectorAll('table tr')) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) continue;
            const label = clean(cells[0].textContent);
            if (/^Страна\s*:/.test(label)) {
                metadata.countries = clean(cells[1].textContent).split(',').map(clean).filter(Boolean);
                foundCountries = true;
            }
            if (/^Жанр\s*:/.test(label)) {
                metadata.genres = [...cells[1].querySelectorAll('a[href]')].map(a => {
                    const href = safeURL(a.getAttribute('href'), url);
                    return href ? new URL(href).pathname.match(/^\/(?:films|series|cartoons|animation)\/([^/]+)\/$/)?.[1] : null;
                }).filter(Boolean);
                // Text fallback covers mirrors that render metadata without links.
                const labels = clean(cells[1].textContent).split(',').map(fold);
                for (const [slug, name] of Object.entries(GENRES)) if (labels.includes(fold(name))) metadata.genres.push(slug);
                foundGenres = true;
            }
        }
        if (!foundCountries || !foundGenres) throw new Error('Не удалось прочитать страны и жанры фильма. Повторите загрузку; непроверенные результаты пока не показаны.');
        return metadata;
    }
    function basicMatch(item, state) {
        return (!state.type || item.type === state.type)
            && (!state.from || (item.year !== null && item.year >= +state.from))
            && (!state.to || (item.year !== null && item.year <= +state.to));
    }
    function needsDetails(item, s, covered) {
        return Boolean((s.country && !covered.country && fold(item.country) !== fold(s.country))
            || (s.genre && !covered.genre && item.genre !== s.genre));
    }
    function matches(item, state, covered, details) {
        if (!basicMatch(item, state)) return false;
        const country = !state.country || covered.country || fold(item.country) === fold(state.country)
            || details?.countries.some(value => fold(value) === fold(state.country));
        const genre = !state.genre || covered.genre || item.genre === state.genre || details?.genres.includes(state.genre);
        return Boolean(country && genre);
    }
    async function request(url, { signal } = {}) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, 20000);
        try {
            const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal, redirect: 'error' });
            if (!response.ok) throw new Error(response.status === 404 ? 'Такой раздел не найден. Проверьте страну и выбранные фильтры.' : 'Сайт временно недоступен. Попробуйте загрузить результаты ещё раз.');
            return await response.text();
        } catch (error) {
            if (signal?.aborted) throw error;
            if (error.name === 'AbortError') throw new Error('Сайт не ответил вовремя. Повторите загрузку.');
            if (error instanceof TypeError) throw new Error('Не удалось связаться с сайтом. Проверьте подключение и повторите загрузку.');
            throw error;
        } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }
    class Search {
        constructor(state, origin, fetchPage = request) {
            this.state = normalize(state);
            this.origin = new URL(origin).origin;
            this.source = plan(this.state, this.origin);
            this.next = this.source.url;
            this.pending = [];
            this.seen = new Set();
            this.pagesSeen = new Set();
            this.items = [];
            this.scanned = 0;
            this.pages = 0;
            this.fetchPage = fetchPage;
            this.busy = false;
        }
        get done() { return !this.next && !this.pending.length; }
        async load({ signal, progress = () => {} } = {}) {
            if (this.busy) return;
            this.busy = true;
            const startItems = this.items.length, startPages = this.pages, startScanned = this.scanned;
            try {
                while (!this.done && this.items.length - startItems < 24 && this.scanned - startScanned < 60) {
                    if (signal?.aborted) break;
                    if (!this.pending.length) {
                        if (this.pages - startPages >= 3) break;
                        const current = this.next;
                        if (this.pagesSeen.has(current)) throw new Error('Сайт повторяет страницу выдачи. Измените фильтры или повторите поиск.');
                        const html = await this.fetchPage(current, { signal });
                        if (signal?.aborted) break;
                        const parsed = parseList(html, current);
                        this.pagesSeen.add(current);
                        this.pending = parsed.items;
                        this.next = parsed.next;
                        this.pages++;
                    }
                    const item = this.pending[0];
                    if (!item) continue;
                    if (!this.seen.has(item.id)) {
                        let details;
                        if (basicMatch(item, this.state) && needsDetails(item, this.state, this.source.covered)) {
                            details = parseDetails(await this.fetchPage(item.url, { signal }), item.url);
                        }
                        if (signal?.aborted) break;
                        if (matches(item, this.state, this.source.covered, details)) {
                            // Explain secondary matches instead of showing only the primary metadata.
                            const additional = [];
                            if (this.state.country && fold(item.country) !== fold(this.state.country)) additional.push(this.state.country);
                            if (this.state.genre && item.genre !== this.state.genre) additional.push(GENRES[this.state.genre]);
                            item.additional = additional.join(' · ');
                            this.items.push(item);
                        }
                        this.seen.add(item.id);
                        this.scanned++;
                    }
                    this.pending.shift();
                    progress(this);
                }
            } finally { this.busy = false; }
        }
        snapshot() {
            return { state: this.state, next: this.next, pending: this.pending, items: this.items,
                seen: [...this.seen], pagesSeen: [...this.pagesSeen], scanned: this.scanned, pages: this.pages };
        }
        restore(data) {
            if (JSON.stringify(normalize(data.state)) !== JSON.stringify(this.state)) return false;
            if (!Array.isArray(data.items) || !Array.isArray(data.pending) || !Array.isArray(data.seen) || !Array.isArray(data.pagesSeen)) return false;
            if (!Number.isInteger(data.scanned) || data.scanned < 0 || !Number.isInteger(data.pages) || data.pages < 0) return false;
            const validItem = item => item && cardURL(item.url, this.origin) && typeof item.title === 'string' && typeof item.id === 'string'
                && Object.hasOwn(TYPES, item.type) && (item.year === null || Number.isInteger(item.year));
            if (![...data.items, ...data.pending].every(validItem)) return false;
            if (data.next) {
                if (!safeURL(data.next, this.origin)) return false;
                const candidate = new URL(data.next), source = new URL(this.source.url);
                if (candidate.pathname.replace(/\/page\/\d+\/$/, '/') !== source.pathname) return false;
                for (const [key, value] of source.searchParams) if (candidate.searchParams.get(key) !== value) return false;
                for (const key of candidate.searchParams.keys()) if (key !== 'page' && !source.searchParams.has(key)) return false;
            }
            this.items = data.items; this.pending = data.pending; this.next = data.next;
            this.seen = new Set(data.seen); this.pagesSeen = new Set(data.pagesSeen);
            this.scanned = data.scanned; this.pages = data.pages;
            return true;
        }
    }
    return { TYPES, GENRES, SORTS, COUNTRIES, normalize, readState, pageURL, plan, safeURL, cardURL, parseList, parseDetails, basicMatch, needsDetails, matches, Search };
})();
