import { readFile, writeFile, rm } from 'node:fs/promises';
import { extractSettings } from './extract-settings.mjs';
import { fileURLToPath } from 'node:url';
import { writeBuildInfo } from './build-info.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const write = (path, content) => writeFile(new URL(`../${path}`, import.meta.url), content);
const cardCSS = await read('extension/cards.css');
const watchedCSS = await read('extension/watched.css');
await write('extension/search-style.js', '// Generated from cards.css, watched.css and search.css by tools/build.mjs.\n'
    + 'const REZKA_CARD_CSS = ' + JSON.stringify(cardCSS) + ';\n'
    + 'const REZKA_WATCHED_CSS = ' + JSON.stringify(watchedCSS) + ';\n'
    + 'const REZKA_SEARCH_CSS = ' + JSON.stringify(await read('extension/search.css')) + ' + "\\n" + REZKA_CARD_CSS + "\\n" + REZKA_WATCHED_CSS;\n');
let source = (await read('upstream/hdrezka-improvement-2.1.8.user.js')).replaceAll('\r\n', '\n');
// Remove the obsolete generated service key when rebuilding an older checkout.
await rm(new URL('../extension/service-config.js', import.meta.url), { force: true });
function replaceOnce(before, after) {
    if (source.split(before).length !== 2) throw new Error(`Patch no longer matches: ${before.slice(0, 80)}`);
    source = source.replace(before, after);
}
function removeRange(start, end) {
    if (source.split(start).length !== 2 || source.split(end).length !== 2) throw new Error('Removal anchor is not unique: ' + start);
    const from = source.indexOf(start), to = source.indexOf(end, from);
    if (to < from) throw new Error('Removal range is invalid: ' + start);
    source = source.slice(0, from) + source.slice(to);
}
function replaceCount(before, after, count) {
    if (source.split(before).length !== count + 1) throw new Error('Patch count changed: ' + before);
    source = source.replaceAll(before, after);
}
// Remove retired features before extracting settings, so saved values cannot
// reactivate their handlers or styles. Keep the pinned baseline unchanged.
removeRange('    /* --------------PLAYER-SCALE----------------------- */', '    /* --------------NAVBAR-LINKS----------------------- */');
removeRange('    /* --------------HIDE-INFO-------------------------- */', '    /* --------------HIDE-COMMENTS---------------------- */');
removeRange('    /* --------------HIDE-MORE-------------------------- */', '    /* --------------IMDB-RATING------------------------ */');
removeRange('    /* --------------SNAP-SCROLL------------------------- */', '    /* --------------SETTINGS--------------------------- */');
for (const name of ['initPlayerScale', 'initHideInfo', 'initHideMore', 'initHideTranslators', 'initSnapScroll']) {
    replaceOnce(`    ${name}();\n`, '');
}
removeRange('        function scale() {', '        function title() {');
replaceOnce('                    // scale();\n', '');
replaceCount('                    scale();\n', '', 5);
replaceOnce('            scale,\n', '');
replaceOnce('            scale: 1,               // Player scale\n', '');
replaceCount('            /* Somehow after scale it is mess with z-index in safari after scale */\n', '', 2);
// Scaling used to create a stacking context. Preserve that boundary explicitly
// so the negative video/poster layers stay above the player's black background.
replaceOnce('        .b-player .b-simple_seasons__list {', `        #oframecdnplayer {
            isolation: isolate;
        }
        .b-player .b-simple_seasons__list {`);
removeRange('        body.r4-content-size-mobile.r4-player-cover.r4-hide-info .r4-player-top-bar-heading {', '        body.r4-content-size-mobile .b-tophead-right {');
replaceOnce(`        body.r4-player-no-margin .r4-hide-info-button {
            right: -10px;
        }

        body.r4-player-no-margin.r4-hide-info .b-content__columns {
            padding-top: 0 !important;
        }

`, '');
removeRange('        body.r4-player-cover.r4-hide-info:not(.r4-playing) .r4-player-top-bar-cover {', '        .r4-player-top-bar-title {');
removeRange('        body.r4-style .r4-toggle-translators-button {', '        /* Misc */');
// The large click zones belong only to triple-click navigation. Normal player
// buttons, fullscreen and manual full-page expansion remain available.
removeRange('        .r4-player-control-large-next,', '        #oframecdnplayer > pjsdiv {');
removeRange('        const config = {\n            multiClick:', '        const elements = {\n            topBar:');
replaceOnce('            controlsLargePrev: null,\n            controlsLargeNext: null,\n', '');
removeRange('            elements.controlsLargePrev = createControlLarge(', '        });\n\n        function appendElements() {');
replaceOnce('                r4.player.elements.oframecdnplayer.appendChild(elements.controlsLargePrev);\n                r4.player.elements.oframecdnplayer.appendChild(elements.controlsLargeNext);\n', '');
replaceCount('                    r4.player.elements.oframecdnplayer.querySelector(".r4-player-control-large-prev").classList.add("hidden");\n', '', 2);
removeRange('        function createControlLarge(', '        window.addEventListener("message", (event) => {\n            switch (event.data?.event) {\n                case "init":\n                    appendElements();');
replaceOnce(`                case "play":
                    if (!r4.player.state.collapsed && document.body.classList.contains("r4-player-full-page-enabled")) {
                        expand();
                    }
                    break;
`, '');
replaceOnce('            collapsed: false,       // Player was already collapsed, used to prevent ferther collapses if auto expand is enabled\n', '');
replaceOnce('            r4.player.state.collapsed = true;\n', '');
removeRange('        r4.settings?.createTumblerSetting({\n            name: "player-triple-click",', '    }\n\n    /* ------------------------------------------------- */\n    /* --------------PLAYER-AUTO-PLAY-NEXT-------------- */');
replaceOnce('            submenu: "Автоматическое сворачивание",', '            submenu: "Интерфейс",');
// Add the extension setting before capture so the panel and runtime share one
// declaration. The pinned upstream file remains unchanged.
replaceOnce('    r4.player = initPlayer();', `    r4.player = initPlayer();
    r4.settings.createTumblerSetting({
        name: "player-max-quality",
        label: "Всегда максимальное качество",
        submenu: "Плеер",
        classes: ["r4-on-of-tumbler"],
        options: [
            { text: "Выкл", value: false, start: () => RezkaPlayer.call("max-quality", false) },
            { text: "Вкл", value: true, default: true, start: () => RezkaPlayer.call("max-quality", true) }
        ]
    });`);
replaceOnce('    initStyleImprovements();', `    initStyleImprovements();
    r4.settings.createTumblerSetting({
        name: "dim-watched",
        label: "Различать статусы просмотра",
        submenu: "Интерфейс",
        classes: ["r4-on-of-tumbler"],
        options: [
            { text: "Выкл", value: false },
            { text: "Вкл", value: true, default: true }
        ]
    });
    r4.settings.createTumblerSetting({
        name: "search-candidate-limit",
        label: "Лимит проверки карточек",
        submenu: "Поиск",
        classes: [],
        options: [
            { text: "1 000", value: 1000 },
            { text: "5 000", value: 5000 },
            { text: "10 000", value: 10000, default: true },
            { text: "25 000", value: 25000 },
            { text: "50 000", value: 50000 }
        ]
    });`);
const schema = extractSettings(source);
await write('extension/settings-schema.js', '// Generated from the pinned upstream declarations and explicit extension patches.\nconst REZKA_SETTINGS = ' + JSON.stringify(schema, null, 2) + ';\n');
source = source.slice(source.indexOf('(function () {'));
replaceOnce('    "use strict";', '    "use strict";\n    if (!RezkaNetwork.isSite(location.href)) return;');
// The site can omit viewport metadata, including on a title page. This optional
// legacy adjustment must not break settings initialization in that document.
replaceOnce("            viewport.setAttribute('content', 'width=640');",
    "            viewport?.setAttribute('content', 'width=640');");
// Subtitle integration is intentionally absent from the shipped extension.
// Keep the pinned upstream input intact and verify every removal boundary.
removeRange('    function initPlayerSubtitles(options = {}) {', '    function initPlayerExtraControls() {');
removeRange('    r4.subtitles = initPlayerSubtitles({', '\n})();');
replaceOnce('    /* --------------PLAYER-SUBTITLES------------------- */', '    /* --------------PLAYER-EXTRA-CONTROLS-------------- */');
replaceOnce('        .r4-player-control-pip,\n        .r4-player-control-subtitles {', '        .r4-player-control-pip {');
removeRange('        body:not(.r4-opensubtitles-logged-in) .r4-player-control-subtitles {', '        .r4-player-control-icon {');
removeRange('        .r4-player-control-subtitles-icon {', '        body.r4-player-full-page .r4-player-control-expand-icon {');
removeRange('                    <div class="r4-player-control r4-player-control-subtitles">', '                    <div class="r4-player-control r4-player-control-pip">');
removeRange('            elements.controlsRight.querySelector(".r4-player-control-subtitles").addEventListener', '            elements.controlsRight.querySelector(".r4-player-control-expand").addEventListener');
replaceOnce('                    r4.subtitles.clear();\n', '');
replaceOnce('        const subtitle = async (url) => await CDNPlayerApi("subtitle", url);\n', '');
replaceOnce('            subtitle,\n', '');
replaceOnce('            /* This fixes the issue with scroll in subtitles and volume scroll */', '            /* Keep volume scrolling inside the player. */');
const apiStart = source.indexOf('        async function CDNPlayerApi(method, value) {');
const apiEnd = source.indexOf('        function fit() {', apiStart);
if (apiStart < 0 || apiEnd < 0) throw new Error('Player API patch not found');
source = source.slice(0, apiStart) + `        async function CDNPlayerApi(method, value) {
            return await RezkaPlayer.call(method, value);
        }

` + source.slice(apiEnd);
replaceOnce('            sof.tv.buildCDNPlayer();', '            await RezkaPlayer.call("build");');
// A userscript update link would install the original script, not this extension.
replaceOnce('        script_homepage: "https://greasyfork.org/en/scripts/425494",', '        script_homepage: null,');
replaceOnce('        version_text: "Версия",', '        version_text: "Исходный скрипт",');
// Active navigation entries can be spans, not links (e.g. /collections/).
// Change only the catalogue filter, retaining search routing and other params.
replaceOnce(`                const url = new URL(elem.href);
                url.search = filter ? new URLSearchParams({ filter }).toString() : "";
                elem.href = url;`, `                if (elem.id === "rc-search-entry") return;
                const href = elem.getAttribute("href")?.trim();
                if (!href || href.startsWith("#")) return;
                let url;
                try { url = new URL(href, document.baseURI); }
                catch { return; }
                if (url.origin !== location.origin || !["http:", "https:"].includes(url.protocol)) return;
                if (filter) url.searchParams.set("filter", filter);
                else url.searchParams.delete("filter");
                elem.href = url.href;`);
replaceOnce('navbar.querySelectorAll(".b-topnav__item-link").forEach(replace);',
    'navbar.querySelectorAll("a.b-topnav__item-link[href]").forEach(replace);');
replaceOnce('navbar.querySelectorAll(".b-topnav__sub_inner .left a").forEach(replace);',
    'navbar.querySelectorAll(".b-topnav__sub_inner .left a[href]").forEach(replace);');
// Appended native cards need the same optional enhancements as the initial page.
replaceOnce('        r4.settings?.createTumblerSetting({\n            name: "imdb",', `        document.addEventListener("rezka:cards-added", event => {
            if (!document.body.classList.contains("r4-imdb") || !(event.target instanceof Element)) return;
            getAndShowRatings(Array.from(event.target.querySelectorAll(".b-content__inline_item[data-rc-page-added]")));
        });

        r4.settings?.createTumblerSetting({
            name: "imdb",`);
replaceOnce('            document.querySelectorAll(".b-content__inline_item .b-content__inline_item-link div").forEach((elem) => {',
    `            function markCountries(root, selector = ".b-content__inline_item .b-content__inline_item-link div") {
            root.querySelectorAll(selector).forEach((elem) => {`);
replaceOnce('            // Add NOT_SPECIFIED_COUNTRY\n            countries.push(NOT_SPECIFIED_COUNTRY);',
    `            }
            markCountries(document);
            document.addEventListener("rezka:cards-added", event => {
                if (!(event.target instanceof Element)) return;
                const previousCount = countries.length;
                markCountries(event.target, ".b-content__inline_item[data-rc-page-added] .b-content__inline_item-link > div");
                countries.slice(previousCount).forEach(handleCountry);
                void makeHiddenCounters();
            });

            // Add NOT_SPECIFIED_COUNTRY
            countries.push(NOT_SPECIFIED_COUNTRY);`);
// The side panel owns the visible settings UI and persists country selections.
const menuStart = source.indexOf('    function initSettings() {');
const menuEnd = source.indexOf('    function missingSettingHandler(name) {', menuStart);
if (menuStart < 0 || menuEnd < 0) throw new Error('Header menu patch not found');
source = source.slice(0, menuStart) + '    function initSettings() { /* The side panel owns the settings UI. */ }\n\n' + source.slice(menuEnd);
replaceOnce('                            await removeEnabledCountry(country);', '                            // Country selections are persisted by the popup.');
replaceOnce('                            await addEnabledCountry(country);', '                            // Country selections are persisted by the popup.');
if (/subtitle/i.test(source)) throw new Error('Subtitle integration remains in the generated feature code');
await write('extension/improvement.js', '// Generated by tools/build.mjs from rub4ek\'s MIT-licensed HDrezka Improvement 2.1.8.\n' + source);

// Retain only the DOM/text helpers actually used; remove the javascript: fallback.
let utils = await read('upstream/vendor/r4-utils.js');
const helpersEnd = utils.indexOf('    class AsyncLock');
if (helpersEnd < 0) throw new Error('Utils patch not found');
utils = utils.slice(0, helpersEnd) + '    return { fromHTML, transliterate, slugify };\n}\n';
await write('extension/vendor/r4-utils.js', utils);

let images = (await read('upstream/vendor/r4-images.js')).replaceAll('\r\n', '\n');
const iconStart = '        subtitles:', iconEnd = '        collapse:';
if (images.split(iconStart).length !== 2 || images.split(iconEnd).length !== 2) throw new Error('Subtitle icon removal anchors changed');
images = images.slice(0, images.indexOf(iconStart)) + images.slice(images.indexOf(iconEnd));
await write('extension/vendor/r4-images.js', images);

let settings = (await read('upstream/vendor/r4-settings.js')).replaceAll('\r\n', '\n');
function patchSettings(before, after) {
    if (settings.split(before).length !== 2) throw new Error('Settings patch no longer matches: ' + before);
    settings = settings.replace(before, after);
}
patchSettings('    const utils = R4Utils();', `    const configs = new Map();
    const applied = new Map();
    const initialization = new Map();
    const utils = R4Utils();`);
patchSettings('        const option = getDefaultOption(config);\n        await setCongigSetting(config, option);', '        const option = getDefaultOption(config);');
patchSettings('    async function initSetting(config) {\n        const currentOption = await getCurrentOption(config);', '    async function initSetting(config) {\n        const currentOption = await getCurrentOption(config);\n        applied.set(config.name, currentOption);');
patchSettings('        initSetting(config);', '        configs.set(config.name, config);\n        initialization.set(config.name, initSetting(config));\n        RezkaSettings.registerCountry(config);');
patchSettings('        tumbler: elements.tumbler,', '        ...RezkaSettings.attach({ configs, applied, initialization, setBodyClass, afterStart, afterEnd }),\n        tumbler: elements.tumbler,');
await write('extension/vendor/r4-settings.js', settings);
const manifest = JSON.parse(await read('extension/manifest.json'));
const build = await writeBuildInfo(fileURLToPath(new URL('../extension/', import.meta.url)));
console.log(`Built Rezka Custom ${manifest.version}, build ${build.id.slice(0, 12)}, ${schema.length} base settings.`);
