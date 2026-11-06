// Search data and pagination. No fetched markup is inserted into the live page.
const RezkaSearch = (() => {
    const R = RezkaSearchRules;
    const TYPES = { films: 'Фильмы', series: 'Сериалы', cartoons: 'Мультфильмы', animation: 'Аниме', show: 'Передачи и шоу' };
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
        soyzmyltfilm: 'Советские', russian: 'Русские', ukrainian: 'Украинские', foreign: 'Зарубежные',
        'reality-shows': 'Реалити-шоу', humor: 'Юмористические', contests: 'Конкурсы', hunting: 'Охота и рыбалка'
    };
    const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
    const fold = value => clean(value).toLocaleLowerCase('ru').replaceAll('ё', 'е');
    // Public metadata only. No viewing history is saved in the suggestion index.
    const optionKey = 'rc-search:options:v1', optionListeners = new Set();
    const learned = { country: new Map(), voice: new Map(), actor: new Map() };
    const genreTypes = new Map(), genreNames = new Map();
    let optionTimer, genreRevision = 0, personalRevision = 0;
    const limits = { country: 300, voice: 2000, actor: 5000 };
    function addOptions(field, values) {
        let changed = false;
        for (const value of values || []) {
            if (typeof value !== 'string' || !clean(value) || value.length > 120) continue;
            const name = clean(value), key = fold(name), target = learned[field];
            if (!target.has(key)) { target.set(key, name); changed = true; }
            if (target.size > limits[field]) target.delete(target.keys().next().value);
        }
        return changed;
    }
    function acceptGenre(type, slug, name) {
        if (!Object.hasOwn(TYPES, type) || !/^[a-z][a-z0-9-]{0,59}$/.test(slug) || typeof name !== 'string' || !clean(name) || name.length > 120) return false;
        if (!genreTypes.has(type)) genreTypes.set(type, new Set());
        if (!genreNames.has(slug)) genreNames.set(slug, new Set(Object.hasOwn(GENRES, slug) ? [GENRES[slug]] : []));
        const names = genreNames.get(slug), previous = GENRES[slug];
        const newType = !genreTypes.get(type).has(slug);
        names.add(clean(name)); genreTypes.get(type).add(slug);
        GENRES[slug] = [...names].join(' / ');
        const changed = newType || previous !== GENRES[slug];
        if (changed) genreRevision++;
        return changed;
    }
    function mergeOptions(data) {
        if (!data || data.version !== 1) return;
        for (const field of Object.keys(learned)) if (Array.isArray(data[field])) addOptions(field, data[field].slice(-limits[field]));
        if (Array.isArray(data.genres)) for (const entry of data.genres.slice(0, 1000)) {
            if (Array.isArray(entry) && entry.length === 3) acceptGenre(...entry);
        }
    }
    function optionsChanged() {
        for (const listener of optionListeners) listener();
        if (optionTimer || typeof chrome === 'undefined') return;
        optionTimer = setTimeout(() => {
            optionTimer = undefined;
            const data = { version: 1, genres: [...genreTypes].flatMap(([type, slugs]) => [...slugs].flatMap(slug => [...genreNames.get(slug)].map(name => [type, slug, name]))) };
            for (const [field, values] of Object.entries(learned)) data[field] = [...values.values()];
            try { chrome.storage.local.set({ [optionKey]: data }).catch(() => {}); } catch { /* Optional suggestions. */ }
        }, 500);
    }
    function suggestions(field) {
        let legacy = [];
        if (field === 'voice') { try { legacy = JSON.parse(sessionStorage.getItem('rc-search:voices:v2') || '[]'); } catch { /* Optional old cache. */ } }
        const values = [...(field === 'country' ? COUNTRIES : []), ...(learned[field]?.values() || []), ...(Array.isArray(legacy) ? legacy : [])];
        return [...new Map(values.filter(value => typeof value === 'string' && value.length <= 120).map(value => [fold(value), value])).values()].sort((a, b) => a.localeCompare(b, 'ru'));
    }
    function learnOptions(doc, url) {
        let changed = false;
        for (const node of doc.querySelectorAll('select.select-category option, a[href]')) {
            const href = safeURL(node.getAttribute('href') || node.getAttribute('value'), url);
            if (!href) continue;
            const path = new URL(href).pathname;
            const genre = path.match(/^\/(films|series|cartoons|animation|show)\/(?:best\/)?([a-z][a-z0-9-]*)\/$/);
            if (genre && !['best', 'new', 'popular'].includes(genre[2])) changed = acceptGenre(genre[1], genre[2], clean(node.textContent)) || changed;
            const country = path.match(/^\/country\/([^/]+)\/$/);
            if (country) { try { changed = addOptions('country', [decodeURIComponent(country[1])]) || changed; } catch { /* Invalid URL escape. */ } }
        }
        if (changed) optionsChanged();
    }
    function rememberOptions(metadata) {
        let changed = false;
        for (const [field, values] of [['country', metadata.countries], ['voice', metadata.voices?.map(voice => voice.name)], ['actor', metadata.actors]]) changed = addOptions(field, values) || changed;
        if (changed) optionsChanged();
    }
    // Supplement the original common-country list, retaining Rezka's spellings.
    addOptions('country', ['Азербайджан', 'Албания', 'Алжир', 'Армения', 'Афганистан', 'Бангладеш', 'Бахрейн', 'Болгария', 'Боливия', 'Босния и Герцеговина', 'Бутан', 'Венесуэла', 'Вьетнам', 'Гана', 'Гватемала', 'Германия (ГДР)', 'Германия (ФРГ)', 'Греция', 'Грузия', 'Доминикана', 'Египет', 'Замбия', 'Зимбабве', 'Иордания', 'Ирак', 'Иран', 'Камбоджа', 'Катар', 'Кения', 'Кипр', 'Колумбия', 'Корея Северная', 'Коста-Рика', 'Куба', 'Кувейт', 'Латвия', 'Ливан', 'Литва', 'Лихтенштейн', 'Люксембург', 'Македония', 'Малайзия', 'Мальта', 'Марокко', 'Молдова', 'Монако', 'Монголия', 'Непал', 'Нигерия', 'ОАЭ', 'Пакистан', 'Палестина', 'Панама', 'Парагвай', 'Перу', 'Пуэрто Рико', 'Саудовская Аравия', 'Сенегал', 'Сербия', 'Сербия и Черногория', 'Сингапур', 'Сирия', 'Словакия', 'Словения', 'Таджикистан', 'Тунис', 'Узбекистан', 'Уругвай', 'Хорватия', 'Черногория', 'Чехословакия', 'Чили', 'Шри-Ланка', 'Эквадор', 'Эстония', 'Эфиопия', 'Югославия', 'Ямайка']);
    if (typeof document !== 'undefined') try {
        chrome.storage.local.get(optionKey).then(data => { mergeOptions(data[optionKey]); for (const listener of optionListeners) listener(); }).catch(() => {});
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && Object.keys(changes).some(key => key === 'ui:watched-revision' || key.startsWith('rc-excluded:v1:'))) personalRevision++;
            if (area !== 'local' || !changes[optionKey]?.newValue) return;
            mergeOptions(changes[optionKey].newValue); for (const listener of optionListeners) listener();
        });
    } catch { /* Core parsing also runs without extension storage. */ }
    function normalize(input = {}) {
        if (input.version !== undefined && input.version !== 2) throw new Error('Эта версия поискового запроса не поддерживается. Обновите расширение.');
        if (input.extra !== undefined && !Array.isArray(input.extra)) throw new Error('Повреждены дополнительные фильтры.');
        let extra;
        try { extra = input.extra?.length ? R.validate(R.group(input.extra)).children : []; }
        catch (error) { error.scope = 'extra'; throw error; }
        if (extra.some(node => node.kind !== 'rule')) throw new Error('В обычных фильтрах допустимы только отдельные условия.');
        let advanced;
        try { advanced = input.advanced == null ? null : R.validate(input.advanced); }
        catch (error) { error.scope = 'advanced'; throw error; }
        if (advanced && advanced.kind !== 'group') throw new Error('Сложные условия должны начинаться с группы.');
        const year = value => /^\d{4}$/.test(String(value)) && +value >= 1890 && +value <= new Date().getFullYear() + 5 ? String(value) : '';
        const country = clean(input.country).slice(0, 80);
        return {
            q: clean(input.q).slice(0, 200), type: Object.hasOwn(TYPES, input.type) ? input.type : '',
            genre: typeof input.genre === 'string' && /^[a-z][a-z0-9-]{0,59}$/.test(input.genre) && !['constructor', 'prototype'].includes(input.genre) ? input.genre : '',
            from: year(input.from), to: year(input.to), country: suggestions('country').find(value => fold(value) === fold(country)) || country,
            sort: Object.hasOwn(SORTS, input.sort) ? input.sort : 'last', version: 2, extra, advanced
        };
    }
    function readState(url) {
        const parsed = new URL(url);
        const fragment = new URLSearchParams(parsed.hash.slice(1));
        const input = { ...Object.fromEntries(parsed.searchParams), ...Object.fromEntries(fragment) };
        // Structured criteria must never be interpreted as legacy scalar fields.
        for (const key of ['version', 'extra', 'advanced']) if (Object.hasOwn(input, key)) throw new Error('Некорректный формат ссылки поиска.');
        if (fragment.has('v') && fragment.get('v') !== '2') throw new Error('Версия ссылки поиска не поддерживается. Обновите расширение.');
        if (fragment.has('rules')) {
            if (fragment.get('v') !== '2' || fragment.get('rules').length > 65536) throw new Error('Некорректная или слишком длинная ссылка поиска.');
            let rules;
            try { rules = JSON.parse(fragment.get('rules')); } catch { throw new Error('Не удалось прочитать условия из ссылки.'); }
            if (!rules || typeof rules !== 'object' || Array.isArray(rules) || !Array.isArray(rules.extra) || !Object.hasOwn(rules, 'advanced')) throw new Error('Повреждены условия в ссылке.');
            input.extra = rules.extra; input.advanced = rules.advanced;
        }
        return normalize(input);
    }
    function pageURL(state, origin) {
        const url = new URL('/search/', origin);
        // Only native search parameters reach the server. Its own genre/type
        // parameters conflict with our values and can redirect a saved URL to /.
        url.searchParams.set('do', 'search');
        url.searchParams.set('subaction', 'search');
        const fragment = new URLSearchParams({ 'rc-search': '1' });
        const normalized = normalize(state);
        for (const key of ['q', 'type', 'genre', 'from', 'to', 'country', 'sort']) {
            const value = normalized[key];
            if (key === 'q') { if (value) url.searchParams.set('q', value); }
            else if (value && !(key === 'sort' && value === 'last')) fragment.set(key, value);
        }
        if (normalized.extra.length || normalized.advanced) {
            const serialized = JSON.stringify({ extra: normalized.extra, advanced: normalized.advanced });
            if (serialized.length > 65536) throw new Error('Слишком длинный запрос. Уменьшите число условий или выбранных значений.');
            fragment.set('v', '2');
            fragment.set('rules', serialized);
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
            if (s.type === 'show') {
                // The site's numeric type filter for this legacy section is not
                // advertised. Read its own route and check other facts locally.
                url.pathname = '/show/';
            } else if (s.country) {
                url.pathname = '/country/' + encodeURIComponent(s.country) + '/';
                covered.country = true;
            } else if (s.type && s.genre) {
                url.pathname = '/' + s.type + '/' + s.genre + '/';
                covered.genre = true;
            } else if (s.from && s.from === s.to) {
                url.pathname = '/year/' + s.from + '/';
            } else if (s.type) url.pathname = '/' + s.type + '/';
            url.searchParams.set('filter', s.sort);
            if (TYPE_IDS[s.type] && !url.pathname.startsWith('/' + s.type + '/')) url.searchParams.set('genre', TYPE_IDS[s.type]);
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
        return href && /^\/(films|series|cartoons|animation|show)\/[^/]+\/\d+-[^/]+\.html$/.test(new URL(href).pathname) ? href : '';
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
        learnOptions(doc, url);
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
        const genreLabels = new Set(Object.values(GENRES).flatMap(name => name.split(' / ').map(fold)));
        if (addOptions('country', items.map(item => item.country).filter(country => !genreLabels.has(fold(country))))) optionsChanged();
        return { items, next: nextURL(doc, url) };
    }
    function parseDetails(html, url) {
        const doc = documentFor(html);
        learnOptions(doc, url);
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
                    return href ? new URL(href).pathname.match(/^\/(?:films|series|cartoons|animation|show)\/([^/]+)\/$/)?.[1] : null;
                }).filter(Boolean);
                // Text fallback covers mirrors that render metadata without links.
                const labels = clean(cells[1].textContent).split(',').map(fold);
                if (!metadata.genres.length) for (const [slug, name] of Object.entries(GENRES)) if (name.split(' / ').some(alias => labels.includes(fold(alias)))) metadata.genres.push(slug);
                foundGenres = true;
            }
        }
        if (!foundCountries && !foundGenres) throw new Error('Не удалось прочитать страны и жанры фильма. Повторите загрузку; непроверенные результаты пока не показаны.');
        // Real title pages can omit a field (for example, country). Preserve the
        // usable facts without treating absence as proof for an exclusion rule.
        metadata.countriesComplete = foundCountries && metadata.countries.length > 0;
        metadata.genresComplete = foundGenres && metadata.genres.length > 0;
        const cast = [...doc.querySelectorAll('[itemprop="actor"]')];
        metadata.actors = [...new Set(cast.map(node => clean(node.querySelector('[itemprop="name"]')?.textContent || node.querySelector('a')?.textContent || node.textContent)).filter(Boolean))];
        if (!metadata.actors.length) {
            const row = [...doc.querySelectorAll('table tr')].find(node => /^В ролях|^Акт[её]ры\s*:/.test(clean(node.querySelector('td')?.textContent)));
            metadata.actors = [...(row?.querySelectorAll('a[href*="/person/"]') || [])].map(node => clean(node.textContent)).filter(Boolean);
        }
        metadata.actorsComplete = metadata.actors.length > 0;
        const number = (value, integer = false) => {
            const text = clean(value).replace(/[\s()]/g, '').replace(',', '.');
            if (/^(?:—|-|нет|n\/a)$/i.test(text)) return null;
            if (!/^\d+(?:\.\d+)?$/.test(text)) return undefined;
            const result = Number(text);
            return Number.isFinite(result) && (!integer || Number.isSafeInteger(result)) ? result : undefined;
        };
        metadata.ratings = {};
        metadata.readErrors = [];
        for (const [name, selector] of [['imdb', '.b-post__info_rates.imdb, span.imdb'], ['kp', '.b-post__info_rates.kp, span.kp']]) {
            const block = doc.querySelector(selector);
            metadata.ratings[name] = block ? number(block.querySelector('span, b')?.textContent) : null;
            metadata.ratings[name + 'Votes'] = block?.querySelector('i') ? number(block.querySelector('i').textContent, true) : null;
        }
        const rating = doc.querySelector('.b-post__rating [itemprop="rating"] .num, [itemprop="rating"] > .num');
        const votes = doc.querySelector('.b-post__rating .votes > span, .votes [itemprop="votes"]');
        metadata.ratings.rezkaVotes = votes ? number(votes.textContent, true) : null;
        metadata.ratings.rezka = metadata.ratings.rezkaVotes === 0 ? null : rating ? number(rating.textContent) : null;
        for (const name of ['imdb', 'kp', 'rezka']) if (metadata.ratings[name] != null && metadata.ratings[name] > 10) metadata.ratings[name] = undefined;
        for (const [key, value] of Object.entries(metadata.ratings)) if (value === undefined) metadata.readErrors.push(key);
        const translators = [...doc.querySelectorAll('.b-translator__item[data-translator_id]')];
        metadata.voices = translators.map(node => {
            const language = clean(node.querySelector('img[title]')?.getAttribute('title'));
            let name = clean(node.textContent || node.getAttribute('title'));
            const fullName = clean(node.getAttribute('title'));
            if (/(?:…|\.{3})$/.test(name) && fullName.length > name.length) name = fullName;
            if (node.getAttribute('data-director') === '1' && !/реж|director/i.test(name)) name += ' (реж. версия)';
            if (language && !fold(name).includes(fold(language))) name += ' (' + language + ')';
            return { name, id: node.getAttribute('data-translator_id'), language };
        });
        if (!metadata.voices.length) {
            for (const row of doc.querySelectorAll('table tr')) {
                const cells = row.querySelectorAll('td');
                if (cells.length > 1 && /^В переводе\s*:/.test(clean(cells[0].textContent))) {
                    metadata.voices = clean(cells[1].textContent).split(/,\s*|\s+и\s+(?=Оригинал)/).filter(Boolean).map(name => ({ name, id: '', language: '' }));
                }
            }
        }
        metadata.voicesKnown = metadata.voices.length > 0;
        metadata.kinds = [...new Set(metadata.voices.flatMap(voice => R.translationKinds(voice.name)))];
        metadata.kindsComplete = metadata.voicesKnown && metadata.voices.every(voice => R.translationKinds(voice.name).length);
        const release = [...doc.querySelectorAll('table tr')].find(row => /^Дата выхода\s*:/.test(clean(row.querySelector('td')?.textContent)));
        metadata.year = Number(release?.querySelectorAll('td')[1]?.textContent.match(/\b\d{4}\b/)?.[0]) || null;
        rememberOptions(metadata);
        return metadata;
    }
    function expression(state) {
        const nodes = [];
        for (const key of ['type', 'genre', 'country']) if (state[key]) nodes.push({ kind: 'rule', field: key, op: 'any', values: [state[key]] });
        if (state.from) nodes.push({ kind: 'rule', field: 'year', op: 'gte', value: +state.from });
        if (state.to) nodes.push({ kind: 'rule', field: 'year', op: 'lte', value: +state.to });
        nodes.push(...(state.extra || []));
        if (state.advanced) nodes.push(state.advanced);
        return R.group(nodes);
    }
    function facts(item, state, covered = {}, details, personal) {
        return { type: { values: [item.type], complete: true }, year: item.year ?? details?.year ?? null,
            country: { values: details?.countries || [item.country, ...(covered.country && state.country ? [state.country] : [])], complete: !!details && details.countriesComplete !== false },
            genre: { values: details?.genres || [item.genre, ...(covered.genre && state.genre ? [state.genre] : [])], complete: !!details && details.genresComplete !== false },
            voice: { values: details?.voices?.map(v => v.name) || [], complete: !!details?.voicesKnown },
            translation: { values: details?.kinds || [], complete: !!details?.kindsComplete },
            actor: { values: details?.actors || [], complete: !!details?.actorsComplete },
            status: { values: personal ? [personal.watched?.has(item.id) ? 'completed' : personal.saved?.has(item.id) ? 'watching' : 'unwatched', ...(personal.excluded?.has(item.id) ? ['excluded'] : [])] : [], complete: !!personal }, ...details?.ratings };
    }
    const detailCache = new Map(), cacheTTL = 30 * 60 * 1000, detailLimit = 1000;
    function validDetails(data) {
        const strings = values => Array.isArray(values) && values.length <= 1000 && values.every(value => typeof value === 'string' && value.length <= 500);
        return !!data && strings(data.countries) && strings(data.genres) && strings(data.kinds) && strings(data.readErrors || [])
            && ['countriesComplete', 'genresComplete'].every(key => data[key] === undefined || typeof data[key] === 'boolean')
            && (data.actors === undefined || (strings(data.actors) && typeof data.actorsComplete === 'boolean'))
            && typeof data.voicesKnown === 'boolean' && typeof data.kindsComplete === 'boolean'
            && Array.isArray(data.voices) && data.voices.length <= 1000 && data.voices.every(voice => voice && typeof voice.name === 'string' && voice.name.length <= 500)
            && data.ratings && typeof data.ratings === 'object' && !Array.isArray(data.ratings)
            && Object.entries(data.ratings).every(([key, value]) => Object.hasOwn(R.FIELDS, key) && R.FIELDS[key].rating
                && (value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= R.FIELDS[key].max)))
            && (data.year === null || Number.isInteger(data.year));
    }
    function cachedDetails(url) {
        let entry = detailCache.get(url);
        if (!entry) {
            try { entry = JSON.parse(sessionStorage.getItem('rc-search:detail:v2:' + url)); } catch { /* Optional tab cache. */ }
        }
        if (!entry || !Number.isFinite(entry.at) || Date.now() - entry.at > cacheTTL || !validDetails(entry.data)) return undefined;
        return entry.data;
    }
    function rememberDetails(url, data) {
        if (!validDetails(data) || data.readErrors?.length) return;
        const entry = { at: Date.now(), data };
        detailCache.delete(url); detailCache.set(url, entry);
        if (detailCache.size > detailLimit) detailCache.delete(detailCache.keys().next().value);
        try {
            const cacheKey = 'rc-search:detail:v2:' + url;
            const keys = Object.keys(sessionStorage).filter(key => key.startsWith('rc-search:detail:v2:') && key !== cacheKey);
            for (const key of keys.slice(0, Math.max(0, keys.length - (detailLimit - 1)))) sessionStorage.removeItem(key);
            sessionStorage.setItem(cacheKey, JSON.stringify(entry));
            const previous = JSON.parse(sessionStorage.getItem('rc-search:voices:v2') || '[]');
            const names = new Map((Array.isArray(previous) ? previous : []).filter(v => typeof v === 'string').map(v => [fold(v), v]));
            for (const voice of data.voices || []) names.set(fold(voice.name), voice.name);
            sessionStorage.setItem('rc-search:voices:v2', JSON.stringify([...names.values()].slice(-1000)));
        } catch { /* Searching does not require storage. */ }
    }
    function basicMatch(item, state) {
        return (!state.type || item.type === state.type)
            && (!state.from || (item.year !== null && item.year >= +state.from))
            && (!state.to || (item.year !== null && item.year <= +state.to));
    }
    function needsDetails(item, s, covered) {
        return R.evaluate(expression(s), facts(item, s, covered)) === null;
    }
    function matches(item, state, covered, details) {
        return R.evaluate(expression(state), facts(item, state, covered, details)) === true;
    }
    async function request(url, { signal } = {}) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, 20000);
        try {
            // Title URLs can redirect to their canonical slug (for example, -latest.html).
            // Keep every redirect on this mirror, including intermediate hops.
            const response = await fetch(url, { mode: 'same-origin', credentials: 'same-origin', signal: controller.signal, redirect: 'follow' });
            if (!response.ok) {
                const error = new Error(response.status === 404 ? 'Такой раздел не найден. Проверьте страну и выбранные фильтры.' : 'Сайт временно недоступен. Попробуйте загрузить результаты ещё раз.');
                error.status = response.status;
                const header = response.headers?.get('Retry-After');
                const delay = header && (/^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now());
                error.retryAfter = Number.isFinite(delay) ? Math.max(0, delay) : 0;
                throw error;
            }
            return await response.text();
        } catch (error) {
            if (signal?.aborted) throw error;
            if (error.name === 'AbortError') throw new Error('Сайт не ответил вовремя. Повторите загрузку.');
            if (error instanceof TypeError) throw new Error('Не удалось связаться с сайтом. Проверьте подключение и повторите загрузку.');
            throw error;
        } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }
    function cooldown(delay, signal) {
        return new Promise((resolve, reject) => {
            const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
            const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); };
            const timer = setTimeout(finish, delay);
            signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted) abort();
        });
    }
    // Compare sustained, uncached title throughput before keeping a wider probe.
    // Timing excludes catalogue requests, cooldowns and under-filled page tails.
    class DetailThroughput {
        constructor() {
            this.limit = 4;
            this.rate = 0;
            this.probe = null;
            this.holdUntil = 0;
            this.resetSample();
        }
        resetSample() { this.reads = 0; this.elapsed = 0; this.batches = 0; }
        resume() {
            if (this.probe) this.limit = this.probe.limit;
            this.probe = null; this.rate = 0; this.resetSample();
        }
        pressure(now) {
            this.limit = 1; this.rate = 0; this.probe = null;
            this.holdUntil = now + 15000; this.resetSample();
        }
        observe(reads, elapsed, now) {
            // Sparse/cache-only batches cannot demonstrate available network capacity.
            if (reads < Math.ceil(this.limit / 2) || elapsed <= 0) return;
            this.reads += reads; this.elapsed += elapsed; this.batches++;
            if (this.batches < 3 || this.elapsed < 2000 || this.reads < this.limit * 2) return;
            const rate = this.reads / this.elapsed;
            this.resetSample();
            if (this.probe) {
                const previous = this.probe; this.probe = null;
                if (rate < previous.rate * 1.1) {
                    this.limit = previous.limit; this.rate = previous.rate;
                    this.holdUntil = now + 15000;
                    return;
                }
            } else if (this.rate && rate < this.rate * 0.8 && this.limit > 1) {
                this.limit /= 2; this.rate = 0;
                this.holdUntil = now + 15000;
                return;
            }
            this.rate = rate;
            if (this.limit < 32 && now >= this.holdUntil) {
                this.probe = { limit: this.limit, rate };
                this.limit *= 2;
            }
        }
    }
    const candidateLimits = [1000, 5000, 10000, 25000, 50000], defaultCandidateLimit = 10000;
    const candidateLimit = value => candidateLimits.includes(value) ? value : defaultCandidateLimit;
    class Search {
        constructor(state, origin, fetchPage = request) {
            this.state = normalize(state);
            this.origin = new URL(origin).origin;
            this.source = plan(this.state, this.origin);
            this.expression = expression(this.state);
            this.personal = null;
            this.usesPersonal = R.fields(this.expression).has('status');
            this.showExcluded = R.includesExcluded(this.expression);
            this.next = this.source.url;
            this.pending = [];
            this.seen = new Set();
            this.pagesSeen = new Set();
            this.items = [];
            this.scanned = 0;
            this.unknown = 0;
            this.pages = 0;
            this.fetchPage = fetchPage;
            this.busy = false;
            this.pauseReason = '';
            this.batchLimit = defaultCandidateLimit;
            this.throughput = new DetailThroughput();
        }
        get concurrency() { return this.throughput.limit; }
        get done() { return !this.next && !this.pending.length; }
        async loadPersonal(signal) {
            if (!this.usesPersonal || this.personal) return;
            const revision = personalRevision;
            let needsHistory = false;
            const visit = node => {
                if (node.kind === 'rule' && node.field === 'status' && node.values.some(value => value !== 'excluded')) needsHistory = true;
                for (const child of node.children || []) visit(child);
            };
            visit(this.expression);
            if (needsHistory && !document.querySelector('.b-tophead__contwatch')) throw new Error('Для фильтра «Мой список» войдите в аккаунт Rezka и обновите страницу.');
            let history;
            if (needsHistory) {
                try { history = await RezkaWatchedSite.load(signal); }
                catch (cause) { throw new Error('Не удалось загрузить историю просмотров. Проверьте вход на сайт и повторите поиск.', { cause }); }
            }
            if (typeof RezkaExclusions === 'undefined') throw new Error('Не удалось прочитать исключения. Обновите расширение и страницу.');
            await RezkaExclusions.ready();
            if (signal.aborted) return;
            if (revision !== personalRevision) throw new Error('Списки просмотра изменились во время загрузки. Повторите поиск, чтобы применить актуальные отметки.');
            this.personal = { watched: history?.watched, saved: new Set(history?.entries.keys()), excluded: new Set(RezkaExclusions.list().map(item => item.id)) };
        }
        async load({ signal, progress = () => {} } = {}) {
            if (this.busy) return;
            this.busy = true;
            this.pauseReason = '';
            this.throughput.resume();
            const startScanned = this.scanned;
            let controller = new AbortController(), workSignal = controller.signal, retries = 0;
            const abort = () => controller.abort();
            signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted) abort();
            const requiredFields = R.fields(this.expression);
            const recover = async error => {
                const transient = [429, 502, 503, 504].includes(error.status);
                if (transient && !signal?.aborted) { abort(); this.throughput.pressure(performance.now()); }
                if (signal?.aborted || !transient || retries >= 2 || error.retryAfter > 60000) throw error;
                await cooldown(Math.max(error.retryAfter || 0, ++retries * 5000), signal);
                this.throughput.pressure(performance.now());
                controller = new AbortController(); workSignal = controller.signal;
                if (signal?.aborted) abort();
            };
            const inspect = async (item, requestSignal) => {
                let details = cachedDetails(item.url), fetched = false;
                if (requiredFields.has('actor') && details?.actors === undefined) details = undefined;
                let answer = R.evaluate(this.expression, facts(item, this.state, this.source.covered, details, this.personal));
                if (answer === null && !details) {
                    const html = await this.fetchPage(item.url, { signal: requestSignal });
                    if (requestSignal.aborted) return;
                    details = parseDetails(html, item.url);
                    answer = R.evaluate(this.expression, facts(item, this.state, this.source.covered, details, this.personal));
                    if (answer === null && details.readErrors.some(field => requiredFields.has(field))) {
                        throw new Error('Не удалось прочитать нужный рейтинг на странице тайтла. Повторите загрузку; непроверенный результат пока не показан.');
                    }
                    fetched = true;
                }
                return { details, answer, fetched };
            };
            let pagesWithoutCandidates = 0;
            try {
                // Capture the preference once per run, including continuation. Changing
                // settings must not move the boundary of a batch already in progress.
                this.batchLimit = candidateLimit(typeof GM === 'undefined' ? undefined
                    : await GM.getValue('search-candidate-limit', defaultCandidateLimit));
                if (workSignal.aborted) return;
                if (this.usesPersonal) await this.loadPersonal(workSignal);
                while (!this.done && this.scanned - startScanned < this.batchLimit) {
                    if (workSignal.aborted) break;
                    if (!this.pending.length) {
                        if (pagesWithoutCandidates >= 50) { this.pauseReason = 'stalled'; break; }
                        const current = this.next;
                        if (this.pagesSeen.has(current)) throw new Error('Сайт повторяет страницу выдачи. Измените фильтры или повторите поиск.');
                        let html;
                        try { html = await this.fetchPage(current, { signal: workSignal }); }
                        catch (error) { await recover(error); continue; }
                        if (workSignal.aborted) break;
                        const parsed = parseList(html, current);
                        // Bound broken pagination without limiting pages that advance the search.
                        pagesWithoutCandidates = parsed.items.some(item => !this.seen.has(item.id)) ? 0 : pagesWithoutCandidates + 1;
                        this.pagesSeen.add(current);
                        this.pending = parsed.items;
                        this.next = parsed.next;
                        this.pages++;
                    }
                    // Keep requests bounded and commit in catalogue order. Failed or
                    // stopped candidates stay in pending, including their later peers.
                    const width = this.concurrency;
                    const batch = [], ids = new Set(), remaining = this.batchLimit - (this.scanned - startScanned);
                    for (const item of this.pending) {
                        const skip = this.seen.has(item.id) || ids.has(item.id);
                        if (batch.length >= width || (!skip && ids.size >= remaining)) break;
                        batch.push({ item, skip });
                        if (!skip) ids.add(item.id);
                    }
                    const started = performance.now();
                    let coldReads = 0, complete = true;
                    const tasks = batch.map(({ item, skip }) => skip ? Promise.resolve({ skip: true })
                        : inspect(item, workSignal).then(value => ({ value }), error => ({ error })));
                    for (let index = 0; index < batch.length; index++) {
                        const result = await tasks[index];
                        if (workSignal.aborted) { complete = false; break; }
                        if (result.error) { complete = false; await recover(result.error); break; }
                        if (result.skip) { this.pending.shift(); progress(this); continue; }
                        const { item } = batch[index], { details, answer, fetched } = result.value;
                        if (fetched) { coldReads++; rememberDetails(item.url, details); }
                        if (answer === true) {
                            // Explain secondary matches instead of showing only the primary metadata.
                            const additional = [];
                            if (this.state.country && fold(item.country) !== fold(this.state.country)) additional.push(this.state.country);
                            if (this.state.genre && item.genre !== this.state.genre) additional.push(GENRES[this.state.genre]);
                            item.additional = additional.join(' · ');
                            item.details = details;
                            this.items.push(item);
                        }
                        if (answer === null) this.unknown++;
                        this.seen.add(item.id);
                        this.scanned++;
                        this.pending.shift();
                        progress(this);
                    }
                    if (complete && batch.length === width && !workSignal.aborted && document.visibilityState !== 'hidden') {
                        const now = performance.now();
                        this.throughput.observe(coldReads, now - started, now);
                    }
                }
                if (!this.done && !workSignal.aborted && this.scanned - startScanned >= this.batchLimit) this.pauseReason = 'budget';
            } finally {
                abort(); signal?.removeEventListener('abort', abort); this.busy = false;
            }
        }
        snapshot() {
            return { state: this.state, next: this.next, pending: this.pending, items: this.items,
                seen: [...this.seen], pagesSeen: [...this.pagesSeen], scanned: this.scanned, pages: this.pages, unknown: this.unknown,
                pauseReason: this.pauseReason, batchLimit: this.batchLimit };
        }
        restore(data) {
            // Personal marks can change in other tabs or between visits.
            if (this.usesPersonal) return false;
            try { if (JSON.stringify(normalize(data.state)) !== JSON.stringify(this.state)) return false; } catch { return false; }
            if (!Array.isArray(data.items) || !Array.isArray(data.pending) || !Array.isArray(data.seen) || !Array.isArray(data.pagesSeen)) return false;
            if (!Number.isInteger(data.scanned) || data.scanned < 0 || !Number.isInteger(data.pages) || data.pages < 0) return false;
            const validItem = item => item && cardURL(item.url, this.origin) && typeof item.title === 'string' && typeof item.id === 'string'
                && Object.hasOwn(TYPES, item.type) && (item.year === null || Number.isInteger(item.year)) && (!item.details || validDetails(item.details));
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
            this.unknown = Number.isSafeInteger(data.unknown) && data.unknown >= 0 ? data.unknown : 0;
            this.pauseReason = ['budget', 'stalled'].includes(data.pauseReason) ? data.pauseReason : '';
            // Snapshots from before this preference used a fixed 1000-card budget.
            this.batchLimit = data.batchLimit === undefined ? 1000 : candidateLimit(data.batchLimit);
            return true;
        }
    }
    return { TYPES, GENRES, SORTS, COUNTRIES, normalize, readState, pageURL, plan, safeURL, cardURL, parseList, parseDetails,
        expression, facts, cachedDetails, rememberDetails, basicMatch, needsDetails, matches, Search,
        suggestions, learnOptions, genreTypes, genreVersion: () => genreRevision,
        subscribeOptions(listener) { optionListeners.add(listener); return () => optionListeners.delete(listener); } };
})();
