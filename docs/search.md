# Advanced search — 0.4.0

## Scope and integration

The user approved a dedicated HDrezka search page with title, content type, genre, year range and country. Ratings, dubbing and quality are excluded. The navigation entry is `Расширенный поиск`. The page uses `/search/?do=search&subaction=search&q=...#rc-search=1` with extension filters in the URL fragment. Only native search parameters reach the server. Live testing showed that including the extension's `type`/`genre`/country parameters in the server query redirects saved links to the homepage even with the native `do` and `subaction` present. The fragment avoids those conflicts and preserves normal Back navigation.

The content script runs only in the top frame on the existing supported hosts. The site's desktop content-width setting remains in use. On the dedicated route, outer site wrappers can shrink below their legacy minimum width; at narrow widths, header links and footer content wrap and the main form supplies title search. The viewport uses the device width while this route is active. A shadow root isolates form controls and result cards from legacy rating injection, country hiding and site selectors. The base text size is established inside the shadow root because the site's universal selector overrides a normal `:host` font-size declaration. Known homepage promotional blocks are hidden only on the dedicated route.

Fragment changes and Back/Forward activate or deactivate one reusable search page instance, including entry from empty native search without a document reload. Returning to native search restores the original title and viewport metadata and removes the route's body class. An inactive page cannot write a new scroll position into its search cache or apply a delayed scroll restoration.

This is an Operate surface within the site's established visual system. It inherits the site's font and tracks `b-theme__template__night`. Dark colors follow the live site's deep blue-black ground; light controls use neutral white surfaces. A two-column filter/results layout becomes one column below 700px. Labels, focus rings, status/error announcements, missing posters and reduced-motion/forced-color styles are supplied. The existing `DESIGN.md` describes the settings side panel and is not replaced by these on-site tokens.

## Shared catalogue card captions

`extension/cards.css` is the shared source for native catalogue and advanced-search caption styles. The build includes it in `search-style.js` for both document and shadow-root use. Native rules are scoped to `body.r4-style .b-content__inline_items`, so they follow the existing appearance setting and do not affect the newest-title slider. The selected site font is preserved.

Both surfaces use 16px/22px semibold titles, 14px/20px regular metadata and 13px/18px regular content types. Captions begin 12px below the poster, with 6px between text roles and 28px between rows. Titles and metadata retain their full text and natural height. Light colors are `#222a30` and `#53616a`; dark colors are `#edf2f4` and `#a6b7bf`.

Native content types use the same plain text treatment as search and remain visible on hover. The poster border and background do not extend behind the type. Native episode badges stay on the poster, using the metadata scale; search episode details remain below the metadata. Existing rating presentation, country-filter markup and poster links are retained.

The desktop Chrome pass confirmed the shared computed sizes and colors in films, series and search. No text overflow was found in the sampled native cards and search results. The original page settings were restored. The final typography scan reported no findings for the changed card/search sources; account-specific filters and local screenshots are excluded from this report.

During this pass, `/collections/` exposed a separate inherited navigation error: the active `Подборки` item is a `span`, but the filter updater passed its missing `href` to `new URL`. The build patch now selects actual anchors, skips empty/invalid/non-site addresses and the advanced-search entry, and changes only `filter` while retaining other URL parameters. Two regression checks reproduced the error before the fix and pass afterward. A fresh Chrome collections tab initialized normally with no extension error; Chrome's existing error history can retain the earlier entry. The complete suite now has 50 passing Node checks.

## Data behavior

- Title searches use `/search/?do=search&subaction=search&q=...` and native ordering.
- Otherwise a country route takes precedence, followed by type + genre, exact release year, type, or the full catalogue. Native `filter` and numeric type IDs are retained across pagination.
- Year bounds match the title's initial release year, including series. They are inclusive. The form rejects inverted ranges; malformed bookmarked ranges are normalized.
- Primary metadata can prove a positive country/genre match. A differing primary value cannot disprove it: full detail metadata is requested for secondary countries/genres. Native country/genre sources already establish their respective condition.
- Known country names are canonicalized without regard to case. The country list offers suggestions; another site country name can be entered directly.
- Country suggestions use a themed editable combobox instead of Chrome's unstyled datalist. The popup matches the input width and opens above when space below is limited. Typing filters names; arrows and Enter choose a suggestion without submitting the form, Escape/Tab dismiss it, and `Любая страна` clears the country. Unlisted text remains editable. Keyboard behavior follows the [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
- Type, genre, sorting and country share one picker implementation and the same control, arrow, popup and option styles. Genre supports text filtering, while type/sorting offer fixed choices with arrow keys, Home/End and letter navigation. Only one popup opens at a time. Hidden native selects retain the validated form values; uncommitted genre text is discarded on dismissal. Changing type refreshes available genres; sorting remains disabled during title search and applies an explicit selection immediately.
- Results are deduplicated by title ID and retained in native order. No global rating or local-per-page sort is presented as a catalogue-wide sort.
- A batch stops at 24 matches, 60 newly checked candidates, or three catalogue pages. It never reports completion until both pending candidates and the native next page are exhausted.
- The load control remains focusable with `aria-disabled` while busy, and repeated activation does not create another request. After an explicit continuation, focus moves to the first appended card if it is still on the load control. Focus moved elsewhere by the user is respected. Failure retains retry focus; stopping returns focus to continuation; a completed empty batch can focus the status. Synchronously completed buffered batches follow the same rules.
- Requests are sequential, same-origin, carry the site's session, reject redirects and time out after 20 seconds. Abort and generation checks prevent a superseded query from changing the current results. Failed candidates remain pending for retry.
- HTML is parsed into inert documents. Only selected text/URL fields enter the interface; remote markup and scripts are never inserted. Card routes and pagination origins/paths are validated.
- A short-lived sessionStorage cache restores results and scroll after title navigation. Storage failure does not prevent searching. Cached item URLs and next-page paths are validated before use. This cache belongs to the current tab and mirror; it is not an account service or a cross-device history.

## Verification

Offline checks: 48 passing Node checks, including 20 search checks. They cover state/URLs, native route planning, pagination across empty matches, duplicate IDs, secondary metadata, batch continuation, navigation cache, retry, cancellation, stale responses, DOM isolation, safe rendering, theme changes, form validation, filter reset, country suggestion keyboard/dismissal behavior, dependent type/genre choices and sorting commit/disable behavior. Regression checks cover native-page entry, Back/Forward and viewport restoration, focus during asynchronous and buffered loading, retry, cancellation and respecting a changed focus destination.

Live verification used the existing Chrome browser and installed unpacked extension. The initial desktop pass confirmed combined filters, secondary country/genre matching, direct saved fragment URLs, Back restoration from a title and loading results across native pages. A narrow viewport override did not take effect, so responsive browser acceptance remained unverified in that pass. Toolbar verification was stopped when browser control could not determine the active URL.

After the country-control update and a user-performed extension reload, the actual Chrome desktop pass confirmed popup alignment/width, the full list, `авст` filtering to Australia and Austria, keyboard highlighting, Enter selection without starting a search, Escape dismissal, unlisted text feedback and mouse selection of `Любая страна`. Original filters were restored afterward. Screenshots are in `.impeccable/review/country-{open,filtered,empty}.jpg`. Light theme, narrow viewport and upward-opening behavior have not been visually verified in this pass.

The subsequent unified-picker pass confirmed the three popup styles, type and genre selection, filtering and sorting. Typing a title disabled both the visible sorting field and its arrow. Back restored the prior filter labels and cached results. This pass covered the desktop dark theme; it did not add narrow/light acceptance.

## Primary evidence

The [2026-10-31 audit](search-audit-2026-10-31.md) subsequently reproduced narrow overflow and two route/focus defects. The [follow-up audit](search-audit-2026-10-31-followup.md) closes all three after adapt/harden/polish, with actual Chrome checks at 320, 390, 768, 1000, 1024 and normal desktop widths, all four narrow picker popups, light/dark themes, native-entry Back/Forward and keyboard loading from 24 to 48 results. It supersedes the earlier narrow/light verification limitations above; physical touch devices and the native toolbar remain unverified.

- Live search: `/search/?do=search&subaction=search&q=Матрица`.
- Live country/type and year/type links: `/country/США/?filter=last&genre=1`, `/year/1999/?filter=last&genre=1`.
- Native combined genre/year example: `/films/best/fiction/1999/` (its ranking is not IMDb).
- The Matrix detail metadata lists USA and Australia, and both science fiction and action. This was used to verify secondary matches.
- Public client reference: [go-hdrezka search.go](https://github.com/n0madic/go-hdrezka/blob/e54f622419178cc48b58347facc36d325ac6ac59/search.go), consulted through GitMCP before implementation. No client code or new runtime dependency is imported.
