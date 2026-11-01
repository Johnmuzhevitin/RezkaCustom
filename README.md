# Rezka Custom

Standalone Manifest V3 Chromium extension, ported from the user's installed **HDrezka Improvement 2.1.8** by rub4ek. Version **0.7.2** adds a local reset for completed MyShows films and episodes, allowing a fresh manual mark after the user removes it on MyShows. Version 0.7.1 fixes movie confirmation against the native MyShows history card and recovers already-submitted records without resending them. Version 0.7.0 adds MyShows movie tracking, manual movie marks and verified movie status, sharing the existing progress threshold and journal with episodes. Version 0.6.7 refines MyShows with a grouped current episode, a credited-progress bar and threshold marker, lighter journal filters and compact entries, retaining the light palette. Version 0.6.6 adds a read-only diagnostic report in Help. The current MyShows film or episode, credited percentage, live 30-second position confirmation and recovery actions sit above collapsible settings. Search covers the entire account journal; status updates preserve keyboard focus and immediately reflect the configured threshold and automatic-tracking pause. The side panel contains **«Вид»**, **«Плеер»**, **«Скрытие»**, and **MyShows**. Use **«Расширенный поиск»** on the site to select films and series. MyShows retains automatic film and episode marks, manual completion, cancellation, a persistent queue and synchronization history. Subtitle integration was removed in 0.3.1 at the user's request. Chrome 116 or newer is required; other Chromium browsers must support the Side Panel API.

## Install for local use

1. Disable **HDrezka Improvement** in Tampermonkey. Keep the original installed for rollback.
2. Open `chrome://extensions` (or the equivalent extensions page in another Chromium browser).
3. Enable **Developer mode**, select **Load unpacked**, and choose this project's **`extension`** directory.
4. Reload the Rezka tabs. Pin Rezka Custom in the browser's extensions menu, then click its toolbar icon to open settings. No settings switch is inserted into the site header.

The ready-to-load directory needs no Node.js or build step. A packaged copy is at `dist/rezka-custom-0.7.2.zip`; extract it before selecting its directory. The archive contains `manifest.json` at its root. For an existing installation, reload the extension at `chrome://extensions`, then reload the site. The toolbar icon still opens settings; **«Расширенный поиск»** in the site's navigation opens the search page.

For an update, replace the files in the same directory, reload the extension on the browser's extensions page, and reload the site. Keep the directory at the same path so the unpacked extension ID and its saved settings remain stable.

For troubleshooting, open Help, select the affected Rezka tab and click **«Собрать отчёт»**, then **«Скопировать диагностику»**. The preview includes loaded builds, MyShows status counts and current progress without account names, titles, URLs, tokens or viewing-history rows. An unavailable panel/page is reported explicitly. See [development diagnostics and checks](docs/development.md) and [the known native Chrome access blocker](docs/chrome-access-status.md).

## Preserved features

| Area | Included behavior |
| --- | --- |
| Layout | Content width presets, card layout, navigation links, typography, decorative styles, black browser theme color |
| Cleanup | Hide advertising blocks, player advertising toggle, collapse description, comments, recommendations and translators |
| Player | Highest available quality, size and scale, margins, cover, title/episode bar, extra controls, seek, fullscreen, full-page mode, existing PiP control forwarding |
| Episodes | Previous/next, autoplay next episode, triple/multiple click controls |
| Keyboard | Space, F, N, P and the original arrow-key behavior |
| Scrolling | Snap to player and scroll on page load |
| Catalogue | IMDb rating requests/cache, country filtering, inversion and hide/dim modes; site-wide dimming of explicitly watched titles |
| Settings | Appearance, player and hiding controls plus MyShows in a full-height browser side panel; persistence across supported mirrors |

The original country-filter defaults and associated site banner are unchanged. Their controls were removed from the side panel in 0.6.3; saved preferences are not reset by this menu change.

## Watched titles

MyShows film and episode marks are separate from Rezka's whole-title watched action described below. Connect an existing token under **«MyShows»** in the side panel. The threshold slider allows 1–100% in 1% steps; the default is 90%. Progress uses the greater of unique played coverage and the furthest player position confirmed by 30 seconds of playback. A seek alone cannot mark a film or episode; another seek starts confirmation again. Pauses and buffering earn no confirmation time, and playback speed does not shorten the wait. Saved confirmed progress survives rewinds and browser restarts. Confirmation uses an authenticated background MyShows tab because the public scrobble endpoint alone left records pending in the verified account. Exact matches are confirmed automatically and checked against the film or episode's watched state; uncertain outcomes are reconciled without duplicate submissions. MyShows sign-in and scrobbling access (currently advertised as PRO) are required. See [MyShows integration](docs/myshows-integration.md) for operation, privacy, failure handling and limits.

**«Вид → Приглушать просмотренное»** is enabled by default. It reads the site's explicit watched marks in **«Досмотреть»** (`/continue/`), matching titles by their numeric title ID. A visit, saved playback position, completed episode or bookmark alone does not mark a title watched. A series explicitly marked watched is dimmed as a whole, including links to its updates.

Watched catalogue cards, slider cards, recommendations, bookmarks, search results, update rows and other title links become desaturated at 10% opacity. On a title's own page, only its headings are dimmed; the player stays unchanged. Hovering card content or using keyboard focus on a title link restores readability; hovering or focusing the watched action keeps the content dim so its result is visible immediately. Mouse focus does not keep the action visible after the pointer leaves the card. History action buttons remain accessible. Turning the setting off restores the original appearance immediately, without reloading; the preference persists under `r4:dim-watched`.

The native **«Досмотреть»** page opens on **«Смотрю»**, hiding explicitly watched titles until **«Завершено»** is selected. These tabs remain available with dimming off. A completed production is not a watched title unless explicitly marked. Completed rows retain their normal appearance, including the date and latest information; watched titles everywhere outside this list remain dimmed. The original order, links and watched/delete controls are preserved. Native mark changes move rows between tabs, and arrows/Home/End navigate the tabs without changing account data.

A 26 px checkmark at the top right of catalogue, slider, recommendation, bookmark and advanced-search cards marks or unmarks the title directly in **«Досмотреть»**. It appears only while the card is hovered or contains keyboard focus, and remains available when dimming is off. The native semantics apply: a watched series also stops new-episode notifications, as explained in the button tooltip. Signed-out pages do not show the account action.

The module reads signed-in history from the current mirror using same-origin requests and never persists a copy of viewing history. A click reads fresh history, uses its save ID with the native `cdn_saves_view.php` endpoint, then confirms the result from history. A title absent from history first gets a native `send_save` entry using numeric metadata parsed from its title page; fetched scripts are never executed. Multipart films retain the native season `0` and positive part number. Existing playback positions are never replaced. New entries use the site's default translation/episode with zero playback time. Browser locks serialize extension writes to the same title across tabs where available. Ambiguous responses are reconciled before any retry, duplicate clicks are blocked, and failed writes show a retryable message instead of a false success.

For a title absent from the last in-memory list, metadata loading overlaps the fresh history read. This hint only starts a read; fresh server state still determines whether to create or toggle a save. Confirmed actions reuse the verification result instead of loading history again, and the originating page ignores its own revision notification. Foreign updates and uncertain failures still trigger reconciliation. With a single history page, an existing-save action uses three requests and a new-title action six; pagination and recovery may require more.

The module observes dynamically added cards and the dedicated search's shadow root. Changes update every appearance and invalidate other open extension tabs; returning to a tab refreshes the list at most once a minute. Failed reads retain that tab's last confirmed state and retry on a later visit/focus. Account reads continue with dimming off to keep the checkmarks current. Signed-out pages remain inactive.

On **2026-10-31**, the current Chrome session confirmed the native history markup, explicit watched classes and complete history list. Version **0.4.1** passed **60 offline checks**, including watched/unwatched updates, late cards, shadow-root results, cross-tab invalidation, setting persistence and asynchronous races. Visual acceptance of the updated extension and its actual toolbar side panel remains unverified: Windows Computer Use stopped because it could not determine the active browser URL confidently. No disposable browser was launched.

Live verification identified a title URL matcher that omitted the `/show/` route. Version **0.4.2** adds that route and passed **61 offline checks**. After the extension was reloaded, watched-state dimming was verified in the native history, catalogue, search and collection views. Operating the actual side-panel switch remained unverified because native browser control could not confidently identify the active URL. Account-specific viewing data and individual titles are intentionally excluded from this record.

Version **0.5.1** passed **71 offline checks** and was verified after an extension reload. A card exposed its own 26 px action on hover; search showed the same hover and keyboard behavior, with watched content at 10% opacity. A controlled write check verified creation, marking, keyboard unmarking and remarking of a history entry. Account-specific titles, identifiers and resulting watch history are excluded from this record.

Version **0.5.2** fixes a visual regression missed by those state checks: card-wide `:hover` and `:focus-within` restored full opacity while the action was hovered and after a mouse click left it focused. In the existing Chrome, the live `checkClickDimming()` probe reproduced `aria-pressed=true` and `rc-watched` with content opacity **1** both immediately after saving and after moving the pointer away. Moving focus elsewhere restored **0.1**, isolating the CSS cause from account persistence. The same probe passed after reloading the installed 0.5.2 extension: **0.1** in both positions, with the action hidden after mouse exit. Native cards and shadow-root search results passed; keyboard focus on the action keeps content dim, while keyboard focus on the title link restores readability. All **71 offline checks** also passed. Screenshot: `dist/watched-immediate-0.5.2.jpg`.

To repeat this regression check in the existing Chrome, use an explicitly authorized test title: unmark it if necessary, click its card action to mark it watched, wait for the confirmed pressed state, then assert content opacity is **0.1** while the pointer is still over the button and again after moving it away without clicking elsewhere. Do not reload between the click and either assertion. Check keyboard access separately and leave the title in its intended final state. The offline DOM tests do not model browser mouse/keyboard focus modality or rendered hover; this scenario requires the installed-extension browser check.

## Advanced search

**«Расширенный поиск»** opens a full page inside the current mirror, with its existing header, content width, font and light/dark theme. Enter a title or leave it blank to browse using type, genre, release-year bounds and country. Submit with Enter, **«Найти»** or **«Применить фильтры»**. Applied filters can be removed individually or reset together.

Catalogue ordering uses the site's latest, popular, currently watching and upcoming modes. Name searches retain HDrezka's own ordering; the catalogue sort control is disabled and explained. Ratings, dubbing and video-quality filters are not included.

The extension chooses a native search, country, genre/type or exact-year catalogue and checks remaining conditions progressively. Secondary countries and genres are checked in full title pages when necessary. A card can show **«Также»** to explain a match not present in its primary metadata. Results are not restricted to the first native page, and partial counts are explicitly identified. **«Показать ещё»** continues from the saved position; a batch adds up to 24 matches, scans at most 60 new candidates, or fetches at most three catalogue pages. Loading can be stopped, and errors can be retried without skipping a candidate.

Parameters are saved in the URL. A tab-local session cache retains results, paging and scroll for 30 minutes to restore navigation from a title; cached entries are bounded to a few recent searches. No new permissions or external search service are required. The existing country hiding/dimming setting applies to ordinary site cards; advanced-search results use their explicit filters and are isolated from those legacy rules.

See [search implementation and acceptance notes](docs/search.md).

## Automatic maximum quality

The player section includes **«Всегда максимальное качество»**, enabled by default. It reads each video's available qualities instead of saving a fixed resolution: 2160p/4K takes priority over 1440p/2K, then 1080p Ultra, 1080p, 720p and lower resolutions. At equal resolution, Ultra takes priority, followed by a higher advertised bitrate. The list's order does not matter.

Selection is checked on player events and once per second to cover late initialization, new episodes, translation changes and replaced players. An already selected maximum is left alone. While enabled, a manual downgrade is corrected; turn the setting off to choose manually. Disabling is immediate, stops checking, and leaves the current quality unchanged. The preference is stored under `r4:player-max-quality` and follows the existing cross-tab settings flow.

Only qualities exposed by the player are candidates. Auto entries, group separators, unknown labels and subscription-only teaser entries marked with `prem-quality`/`prem-icon` are skipped. The implementation uses PlayerJS's documented [quality commands](https://playerjs.com/docs/en=apicommands) and [quality labels/group indices](https://playerjs.com/docs/en=quality). The premium badge convention is documented in the [HDRezka client source](https://github.com/n0madic/go-hdrezka/blob/e54f622419178cc48b58347facc36d325ac6ac59/utils.go). Changes to the live site's API or labels still need verification in the installed browser.

## Settings panel behavior

- Four sections: appearance, player, hiding blocks and MyShows. Search spans the retained settings, with announced result counts and empty states. A remembered retired section falls back to appearance.
- Clicking the toolbar icon opens Chrome's side panel. It uses the full available height and adapts to the panel width selected in Chrome. Only the settings pane scrolls; tabs and the footer remain visible. Colors, type, icons and control styling are retained.
- Width is selected directly with numeric choices and an all-width option. Binary settings use accessible switches, and other modes use radio groups or selects.
- The existing `r4:` storage keys and option values are retained. Changes are saved immediately in the service worker, so closing the panel does not cancel a submitted write.
- Changes propagate to already-open supported tabs. Repeated toggles do not reinstall keyboard handlers.
- A setting whose reversal needs a reload shows an explicit reload action. Playback is never interrupted by an automatic reload. Pending changes are tracked separately in each page, and remain visible after reopening the panel. Connection and reload actions follow the active tab in the panel's window, including navigation within a tab. Reloading keeps the panel open.
- Settings can be edited away from Rezka. Country choices are collected from visited catalogues and remain available offline. The last section is remembered.
- A previously remembered subtitle section falls back to appearance. The extension no longer supplies subtitle controls, account forms, search, downloads or time shifting. The website's own player features are not modified by this removal.
- Keyboard users can navigate tabs/radio choices with arrows, focus search with Ctrl+F (Command+F on Mac), and clear a search with Escape. Reduced motion is respected.
- Text uses a relative-size scale; switch rows and help have larger click areas. Semantic tokens define contrast-tested text, borders and feedback. Forced-color styles and coarse-pointer targets are provided; native verification remains pending.

Reference rendering from the 0.2.0 fixed-width preview (not a native-popup acceptance screenshot):


Design decisions and older rendered critique are in [the menu design notes](docs/menu-design.md). The current system is captured in [DESIGN.md](DESIGN.md); the [0.2.2 follow-up audit](docs/menu-audit-2026-10-30-followup.md) records fixes and remaining acceptance checks.

## Port-specific changes

- `GM.*` calls used by the source are backed by `chrome.storage.local`, local style elements and extension-worker requests. This adapter implements the API subset actually used, not all of Tampermonkey.
- A packaged `MAIN`-world bridge exposes only fixed player operations and `sof.tv.buildCDNPlayer`. No arbitrary function strings, `eval`, `javascript:` URLs or remotely loaded executable code are used.
- The original helper libraries are bundled from the exact versions named in the supplied `@require` lines. The unused Safari `executeLocation` helper and subtitle icon are removed from the shipped copies.
- The upstream script-update link is disabled: it would install a Tampermonkey script rather than update this extension. Updates are local package replacements at this stage. The panel footer displays the extension version.
- Settings are separate from Tampermonkey's storage. They start at the original defaults. The old site's `localStorage` migration remains, but current Tampermonkey settings are not automatically imported.

## Permissions and data

The original script matches arbitrary hosts containing `rezka`, plus `rezkify.com`, `rezkery.com` and `kinopub.me`, excluding `.home` and `.local`. Chromium match patterns cannot express a substring in a host, so this parity build requests HTTP/HTTPS host access, filters injection with globs, and checks the hostname again before starting. The broad browser permission warning is expected. Unrelated sites do not receive the feature modifications.

Storage is local to the extension; it is not synced to a server. There is no account sign-in feature. The rating cache and old setting migration still use the site's `localStorage`, as in the original. The `sidePanel` permission enables the browser-owned settings panel. No new analytics or collection service has been added.

The generic worker request bridge accepts only this extension's content scripts on supported sites, to their own origin or IMDb. Declarative network rules also limit redirect destinations before a request is sent. A separate MyShows worker allows only its fixed `/scrobble/check` and `/scrobble/stop` endpoints, with redirects rejected. It keeps its token in extension-origin IndexedDB, never in the public settings store or page bridge. The retired subtitle service is no longer allowed, and its User-Agent override is removed on update. The page-world bridge cannot access storage or make privileged network requests.

## Development and verification

Development requires Node.js 24.15+ within 24.x, 22.22.2+ within 22.x, or 26+, plus `npm ci`. Packaging also requires Windows PowerShell. The ready-to-load extension requires neither.

- `npm run check` rebuilds and runs the complete offline gate without launching a browser.
- `npm run package` runs that gate before creating the ZIP. A failed check leaves the previous archive untouched.
- `npm run check:browser` adds supplementary disposable-browser tests and requires explicit user permission.

The [development guide](docs/development.md) is the source map for authored/generated files and the current procedure for build IDs, installed-Chrome acceptance, fresh error checks and shared site fixtures. Historical results are preserved in [verification history](docs/verification-history.md) and the feature audit reports.

## Source layout

- `upstream/`: pinned userscript, dependencies and provenance.
- `extension/`: ready-to-load files; ownership and generation relationships are in the [source map](docs/development.md#source-ownership).
- `tools/`: build, content-based identity, offline gate, packaging and optional diagnostic helpers.
- `tests/`: offline regression checks, shared site fixtures and supplementary browser scenarios.
- `docs/`: current development/feature references and historical acceptance evidence.

See [third-party notices](extension/THIRD_PARTY_NOTICES.md) for source attribution and dependency licensing status.

## Repository privacy

Published history uses a project identity instead of personal author details. Credentials, browser captures, account-specific viewing records and machine-specific audit reports are excluded. The pinned upstream copy has its bundled subtitle service key removed; provenance records the sanitized and original content hashes. Tests use synthetic account data and invalid fixture tokens.
