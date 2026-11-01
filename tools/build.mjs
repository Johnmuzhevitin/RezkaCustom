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
        label: "Приглушать просмотренное",
        submenu: "Интерфейс",
        classes: ["r4-on-of-tumbler"],
        options: [
            { text: "Выкл", value: false },
            { text: "Вкл", value: true, default: true }
        ]
    });`);
const schema = extractSettings(source);
await write('extension/settings-schema.js', '// Generated from the pinned upstream declarations and explicit extension patches.\nconst REZKA_SETTINGS = ' + JSON.stringify(schema, null, 2) + ';\n');
source = source.slice(source.indexOf('(function () {'));
replaceOnce('    "use strict";', '    "use strict";\n    if (!RezkaNetwork.isSite(location.href)) return;');
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
