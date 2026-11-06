# Historical verification records

This publication summary omits personal browser sessions, viewing-history details, account-specific requests and screenshots. See [development.md](development.md) for the current workflow.

## Publication privacy review — 2026-11-07

The 0.12.2 publication excludes local browser screenshots, design previews, detailed critique reports and live-preview configuration. Machine-specific paths were found in unpublished critique reports. The unpublished work was consolidated on top of the existing public main branch so those reports never enter the outgoing history; a verified local Git bundle and working-tree patch preserve the original work outside publication. Public history is retained without a force push.

The candidate contains 146 text files. Targeted personal-identifier/path/email checks found no owner-specific data in the candidate, reachable public history or either release archive. Credential-like literals were reviewed as synthetic test values, invalid URL cases or interface messages. Gitleaks 8.30.1, downloaded from its official release with a verified SHA-256 checksum, reported no secrets across the 41 locally reachable commits or inside the 0.7.2 and 0.12.2 archives. Commit author and committer use the project identity `Rezka Custom contributors <contributors@example.invalid>`.

These checks cover repository content, commit metadata and release assets, not the owner's public GitHub profile or account name in repository URLs. Release notes retain the installed-Chrome verification limitation. See [repository privacy](../README.md#repository-privacy) for the retained publication boundaries.

## MyShows matching without IMDb — 2026-11-07

Version 0.12.2, build `8de7f13bf8825c8b3f24ecbc7902b234903345509b2c5fa1e9a0f344e8d5181e`, passed all **337 offline tests** and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.12.2.zip`.

A read-only check in the owner's existing Chrome confirmed that the affected series page provided a title, release year and selected episode but no IMDb link. Its loaded page build was 0.12.1 `5783946dac498ad7fd537f1b065f66bce999bfebec47b8c02b4ab080c28efdc8`. No playback, journal or MyShows account data was changed. The regression command `node --test --test-name-pattern='a title without IMDb reaches' tests/myshows.test.mjs` first failed with the exact missing-IMDb message and zero outgoing requests, then passed after the worker accepted title/year submissions and the payload omitted empty IMDb values.

The focused suite passed **70 tests**, including films and episodes, the real tracker-to-worker path, an old persisted attention entry, missing-year rejection, manual correction of a guessed match, restart, watched-state verification and no duplicate POST on retry. Title-only results never permit automatic native confirmation, even if the response says `exact`.

Live fallback-payload acceptance, final matching of the affected record and the updated real toolbar panel/worker/page build agreement remain unverified pending the owner's extension reload. The [known Chrome access limits](chrome-access-status.md) were read; no new native-helper correction was established and no unchanged refused-surface retry or separate browser/profile was used.

## Configurable search candidate limit — 2026-11-06

Version 0.12.1, build `5783946dac498ad7fd537f1b065f66bce999bfebec47b8c02b4ab080c28efdc8`, passed all **331 offline tests** and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.12.1.zip`.

The settings panel offers 1,000, 5,000, 10,000 (default), 25,000 and 50,000 checked candidates per search run. Tests cover the exact 10,000 boundary, remaining candidates and snapshot restoration, setting changes between continuation runs, stable boundaries during an active run, invalid-value fallback, cancellation during preference loading, panel persistence and backup round-tripping. Existing adaptive/concurrent metadata checks explicitly select 1,000 and still verify no requests beyond that budget. The real settings-engine check also passes.

A read-only check through the supported browser connector found the owner's existing search page still on 0.12.0, build `e5dbc7db9b7fa525e9164fc764ab45becebe04b754551481f5a99dedab384369`. The page and its filters were not changed. New-build installed-page behavior, actual toolbar control, and panel/worker/page build agreement remain unverified pending the owner's extension reload. The known native/extension-management access limits remain applicable; no new helper correction was established and no refused-surface retry or disposable browser was used.

## Missing viewport during settings initialization — 2026-11-06

Version 0.11.3, build `64dd10f6b0ea4c2a737f3193809e86588c33ceee3ffaf0f4af62b16c8c0086c6`, passed all **311 offline tests** and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.11.3.zip`.

The owner supplied an extension error screenshot at `improvement.js:792`: `Cannot read properties of null (reading 'setAttribute')`. Its original load/build boundary is unknown. `node --test tests/content-size.test.mjs` exercised the shipped `initContentSizeTumbler` settings callback and reproduced the exact exception when viewport metadata was absent or removed before settings start (two failures; the present-tag case passed). The durable build patch now guards this optional lookup. All three regression cases pass, retaining `width=640` when a tag exists and adding no forced metadata when it does not. No instrumentation or independent browser profile was used.

Installed acceptance of this correction requires another extension/page reload and a fresh error boundary. The catalogue/collection acceptance of 0.11.2 below remains valid for the unchanged continuation code; it is not proof that 0.11.3 has been loaded into Chrome.

## Native catalogue continuation — 2026-11-06

Version 0.11.2, build `a47695b74654a94d034454aabe784f3631826bd8572885eed34d5abaa2acb691`, passed all **308 offline tests** and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.11.2.zip`. No separate browser/profile was launched.

Fifteen new checks cover sequential appending, preserved sort/search parameters across catalogue routes, path/query pagination, collection posters, safe card markup, favorite input/label preservation, retries, duplicate responses/cards/clicks, loading and keyboard focus, enhancement events, multiple lists, stale/replaced pages and unrelated pagination. Existing dynamic-card checks cover watched and excluded states. Native IMDb and country enhancements receive only the appended batch through an explicit build patch.

After the owner reloaded the extension, the existing Chrome connector matched the exact packaged page build above at the owner's normal display scale. On `/films/`, two successive clicks appended 45 cards each (45 → 90 → 135), with 135 unique IDs; appended cards received watched/exclusion controls, country classes and optional IMDb ratings. On `/collections/`, one click appended 36 collection cards (36 → 72), with 72 unique URLs and linked posters. The continuation button remained below the list, measured 44px high, and had visible keyboard focus. Screenshots: `docs/screenshots/catalogue-more-2026-11-06.png` and `collections-more-2026-11-06.png`. The agent-created tab was closed; the original search and unrelated tabs were preserved.

The captured console contained failed requests from the site's `j/andt.js`; no extension exception appeared in this catalogue/collection check. This does not clear or disprove historical extension errors. The owner's separate viewport-error screenshot prompted the 0.11.3 correction above. Native toolbar/panel/worker build acceptance remains subject to the [recorded browser access limits](chrome-access-status.md); these checks establish the page build and the exercised routes only.

## Resume MyShows tracking after removal — 2026-11-06

Version 0.10.1, build `88286460cdc946564584eec013134b6f5055f5bedde6b1f3bde98be0e4d74b77`, passed all **279 offline tests** and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.10.1.zip`. No separate browser/profile was launched.

The 101 focused MyShows/panel checks include explicit restoration of deleted movie/episode entries, fresh source and zero progress, the real tracker-to-worker 29/30-second position boundary, suppression of old progress batches, buffered samples, delayed stop replies and failed saves, duplicate clicks, stale media/account/sender rejection, persistence after restart and preservation of the global pause. The four new regression checks failed before implementation and passed afterward.

Installed-Chrome acceptance is pending: the package must be loaded into the existing extension, then its real toolbar panel, worker and page builds and the affected recovery action must be verified at the owner's current display scale. The existing native URL-confidence and extension-management access limits are documented in [Chrome access status](chrome-access-status.md).

## Local backup and selective restore — 2026-11-04

Version 0.10.0, build `671719fc1561e502030e79b59ceb722a2906e7eaa55c83cbbf454cb69fde75a9`, passed all **275 offline tests** and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.10.0.zip`. No separate browser/profile was launched.

Thirteen added contracts cover the actual worker, backup dialog DOM, open search and panel refresh behavior: default/false settings, allowlisted export without credentials or MyShows records, selective/idempotent merges, full-file validation before any write, size/version/schema failures, trusted sender checks, serialization with normal setting changes, storage failures/retry, Blob download contents, filename escaping, section availability, stale preview replies, modal shortcut isolation and focus recovery. Restored filter sets refresh in an already open search while retaining filter drafts and rejecting late stale reads. Reload-only settings expose the existing explicit action without reloading the site automatically. See [backup scope and contract](backup.md).

The installed extension has not been reloaded or visually accepted for this build. The [known native Chrome URL-confidence failure](chrome-access-status.md) has no established correction, and the browser connector's extension-management URL restriction was already confirmed during 0.9.9. No unchanged native retry, alternate controller or separate profile was used. Real toolbar layout, OS file selection, completed browser download and installed panel/worker/page build agreement remain unverified. The offline DOM tests do not establish these rendering and native-file behaviors.

## Black video after player-scale removal — 2026-11-04

Version 0.9.9, build `5d60f158d8db0e7083f6e801467d6179b29ea562491c44471f1548c4ff77194a`, passed all 262 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.9.9.zip`. The first package attempt encountered a transient Windows file-open error; the unchanged retry passed the complete gate. No disposable browser was launched.

The user's existing desktop Chrome reproduced the black-picture report on installed 0.9.8 (`56449ebb9fd90208ba45d472bff2db2981dd14062162bd145753acf4fa7a7038`). The real video reached readyState 4, advanced in time and exposed 1920 × 960 frames, while its full-size wrapper had z-index -1 and the opaque player root had no stacking context. Retiring scaling had removed the root's transform, which previously supplied that context even at scale(1). A single temporary `isolation: isolate` on `#oframecdnplayer` restored the paused video image; removing it returned the same frame to black. The probe was removed and playback paused.

The durable correction is an anchored patch in `tools/build.mjs`, regenerated into `extension/improvement.js`. `node --test tests/player-layers.test.mjs` failed on the original shipped CSS and passed after the change; it checks the observed native video/poster/iframe layering contract without claiming jsdom renders video. The retained manual-control test also passed.

After the owner reloaded the extension, a fresh tab in the existing Chrome profile reported the exact packaged 0.9.9 build. With no temporary stylesheet or inline isolation, the shipped CSS computed to `isolation: isolate`. Real video was visible during initial playback, after switching to the second episode, and after a paused seek; both episodes exposed 1920 × 960 frames with readyState 4. The original black-layer predicate changed from true to false. The normal desktop viewport was 2560 × 1215 CSS pixels at DPR 1.5 for the final capture; no viewport override was used. Local screenshots are in `.scratch/player-black-video-2026-11-04/installed-099*.jpg`. Playback was paused and the agent-created verification tab closed.

The fresh page log contained three fetch errors from the site's `/j/andt.js`, with no captured extension errors. Browser-connector navigation to `chrome://extensions` was explicitly denied by the URL policy (HTTP/HTTPS only); the owner performed the reload, and no alternate controller or indirect reload was attempted. Native toolbar/panel and worker identity remain unverified under the [recorded access limitation](chrome-access-status.md).

## Adaptive search concurrency up to 32 — 2026-11-04

Version 0.9.8, build `56449ebb9fd90208ba45d472bff2db2981dd14062162bd145753acf4fa7a7038`, passed all 261 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.9.8.zip`. The approved ordinary Windows run included the existing loopback HTTP and Git-hook checks; no disposable browser was launched.

Eight new contracts verify useful ramp-up through 4/8/16/32, rollback on saturation, slowdown, bounded pressure recovery, reacceleration after cooldown, cache-heavy/short-page workloads, hidden-tab timing, cancellation, order and the exact 1000-candidate budget. In the deterministic 100 ms latency model, 1000 cold reads require 74 waves instead of 250 under the previous fixed-four implementation; both repeat queries use zero metadata requests. This is a model, not installed-site speed evidence. See [controller policy and benchmark](search-performance-2026-11-04.md#adaptive-concurrency--098).

After the owner reloaded the extension, the existing Chrome search page reported the exact packaged 0.9.8 build. The owner had already started searching and later changed the query, so the combined observations are not a whole-run timing comparison. They showed concurrency rising to eight and pressure recovery. A subsequent stable-query sample reached a terminal HTTP 503 at 948 checked candidates after bounded retries, even with a single request; this is retained as a real-site limitation, not reported as a clean full-batch pass.

After a pause, the agent used the existing retry action and observed the same query advance from 948 to 1125 candidates. That complete observation recorded 124 title requests: 123 HTTP 200 responses and one cancellation when the agent stopped the verification run. Peak active title requests rose from one during the first two seconds to 12; cache hits and short batches mean actual active requests can be below the configured powers-of-two limit. The network request span was 22.3 seconds, with no HTTP errors in this retry interval. The page showed seven matches, 28 insufficient-data candidates, no error banner and an enabled continuation action. Results and the owner's filters/drafts were retained.

The normal viewport was 2560 × 1215 CSS pixels at DPR 1.5. Network observation was disabled and only aggregate metrics plus a local screenshot were retained in `.scratch/search-optimize-2026-11-04/installed-098-*`. No temporary page-code patch, disposable profile or new native-management attempt was used. Reaching 32 is verified by deterministic tests; the live run verifies adaptive growth and resumability, not a reliable 32-way capacity or an eightfold site speedup. The [native management limitation](chrome-access-status.md) remains unchanged.

## Search continues past incomplete title metadata — 2026-11-04

Version 0.9.7, build `718d1e96e23a927e3cf2cfce8a5eb87851463b14b6b59729e72a261cb79fcb0a`, passed all 253 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.9.7.zip`. The Windows sandbox blocked the existing loopback HTTP and Git-hook checks; the approved ordinary run passed the complete gate. No disposable browser was launched.

The reported country/genre parsing failure at 208 candidates reproduced after reloading the exact installed 0.9.6 build. The failing public page had normal genre, release and rating rows but omitted country. Four new tests failed before the fix and now verify continued scanning, conservative unknown/exclusion behavior, partial-cache reuse, legacy compatibility and rejection of invalid pages/cache flags. See [reproduction and measurement](search-performance-2026-11-04.md).

After the owner reloaded 0.9.7, the existing desktop Chrome page reported the exact packaged build at its normal 2560 × 1271 CSS-pixel viewport and DPR 1.5. Continuing the same saved query passed the failing title and checked exactly 1000 additional candidates: 208 to 1208, 27 catalogue pages, 33 matches and 35 insufficient-data candidates. It stopped normally at the candidate budget with no error banner and an enabled continuation action.

The complete, non-truncated network observation recorded 763 title requests: 760 HTTP 200 responses, two HTTP 503 responses and one cancelled request. Peak concurrency was four, falling to one after the automatic cooldown; the search recovered without manual retry. The title-request span was 290.41 seconds, including server pressure and serial recovery. This workload differs from the earlier baseline and is not a before/after speed ratio. Observation was disabled afterward. Only aggregate metrics and a local screenshot were retained under `.scratch/search-optimize-2026-11-04/installed-097-*`; no request headers or account details were exported. The user's query/results remain open; the diagnostic title tab was closed.

## Advanced-search metadata throughput — 2026-11-04

Version 0.9.6, build `a48dd31dcb2979ae4af997aeca88004caab48b7d1862c8d1bfb177a9ecef5cae`, passed all 249 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.9.6.zip`. The approved ordinary Windows run included the loopback redirect and Git-hook checks; no disposable browser was launched.

The installed 0.9.4 baseline captured 97 title requests over 38.79 seconds, with peak concurrency one and median response 367 ms. The actual search core's deterministic benchmark reproduced 24 serial cold-read waves and total cache churn on a repeated 240-candidate query. After separate cache and concurrency changes, the same workload uses six cold-read waves and no metadata requests for the repeated query. Nine added contracts cover overlap, order, cancellation/late replies, failure/retry, duplicate/budget boundaries, cache expiry, bounded storage, reuse after reload, server cooldown and bounded recovery. See [measurement details and reproduction](search-performance-2026-11-04.md).

The first installed candidate, 0.9.5 build `bba28d7814f74861b3acf7d85edda75cee83d122d48fff9b10daea322823d1cf`, confirmed four concurrent title requests but stopped after 216 candidates when three nearby requests returned HTTP 503 without `Retry-After`. Its 247 offline checks had passed; the live finding added two recovery contracts and motivated 0.9.6. The corrected loader pauses and switches to serial requests after HTTP 429/502/503/504, with at most two retries per load and cancellation during the wait. The test tab was closed.

The owner reloaded 0.9.6 and its page build matched the package. Resuming a different query reproduced the missing-country parsing failure described above; this did not exercise transient HTTP recovery. Browser timings are not inferred from the synthetic latency model. The [native toolbar-panel limitation](chrome-access-status.md) remains unchanged.

## Watched-state observer performance — 2026-11-04

Version 0.9.4, build `1ac8d782150e78d5c0fa54b3ff97ffc30644c5e9560488001a5194b5a7bdb8ed`, passed all 240 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.9.4.zip`. Watched-state scans now depend on relevant added/removed DOM content; filter suggestions, progress text and player clocks no longer rescan every card. Native history changes, new cards, recycled links and restoration of removed extension controls remain covered by 30 focused watched tests.

The installed 0.9.3 baseline in the owner's existing Chrome had 1000 results at the normal 2560 × 1215 CSS-pixel viewport and DPR 1.5. Four country-input edits caused four full watched-control passes and 4000 `aria-busy` writes. The field was restored and temporary instrumentation removed. The reproducible synthetic Node/jsdom workload reduced 20 scheduled scans and 20,000 card attribute writes to zero; it does not measure Chrome layout, paint or INP. See [performance evidence and reproduction](performance-2026-11-04.md).

After the owner reloaded the extension, reloading the claimed search tab loaded the exact packaged 0.9.4 build and restored 1000 results. The same four country edits produced zero watched-action `aria-busy` writes, compared with 4000 before. All card identities, viewing-state classes, action states and accessible descriptions were preserved, and all 1000 actions remained present. Escape closed the dropdown with focus retained; the empty country draft was restored and temporary measurement instrumentation removed. No warning/error entries were captured during the measurement interval. The local screenshot is `.scratch/optimize-2026-11-04/installed-094.png`. No disposable browser, account write or new native-helper attempt was used. This confirms the search-input optimization; the [native toolbar-panel limitation](chrome-access-status.md) remains in effect.

## Search follows canonical title redirects — 2026-11-04

Version 0.9.3, build `eedf9c6cfe5b5bc813ebd547df3e52cfddb341453d787023b939d1a5e6cb20c5`, passed all 237 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.9.3.zip`. Only `search-core.js`, the manifest version and generated build identity differ from the previous archive.

The installed 0.9.2 search reproduced the reported IMDb >= 7 failure after three checked candidates: two matches, one unknown and a connection-error banner. Repeating the request failed at the same detail URL. A focused request comparison in the existing Chrome confirmed that `redirect: 'error'` rejected a same-origin canonical redirect, while `redirect: 'follow'` with `mode: 'same-origin'` returned HTTP 200 and title metadata at the `-latest.html` destination. The fix follows redirects while retaining the browser-enforced origin boundary.

The new regression test exercises the default search transport against a loopback HTTP server: two matching titles, one missing rating, a redirected fourth title and a fifth non-match. Before the fix it failed at the redirect with the exact connection-error message; afterward it checked all five candidates and returned the three matches. It also checks that every request retains same-origin mode and credentials. This is an HTTP/Node check, not a substitute for browser origin enforcement. The Windows sandbox denied loopback connections; the approved run completed the regression and full package gate.

After the owner reloaded the extension, a fresh search tab in the existing desktop Chrome reported the exact packaged 0.9.3 build. The same IMDb filter passed the previously failing title and continued to 80 checked candidates across two catalogue pages, returning 34 matches and five unknowns without a search alert. The test load was stopped manually and its agent-created tab closed; the normal viewport and display scale were retained. No temporary page-code patch or separate browser profile was used. Captured console errors came from the site's `j/andt.js`, not extension scripts. Native toolbar-panel interaction and panel/worker build matching remain outside this search check under the [recorded native access blocker](chrome-access-status.md).

## Remove unused settings and merge hiding controls into appearance — 2026-11-04

Version 0.9.2, build `83fb8d2805c58cb01ac13c6d288f9b80a63ca9945085f0c181b99cbe175a5453`, passed all 236 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.9.2.zip`. The build removes eight settings and their handlers/styles: player scaling, triple-click navigation, automatic full-page expansion, scroll snapping, automatic scrolling to the player, and collapsing descriptions, recommendations and translators. The remaining advertising switches and comment collapsing are in appearance; the hiding tab and icon are removed.

Regression checks cover restoration from a remembered hiding section, persisted values and saves for relocated switches, rejection of retired controls from stale page replies and search, three-tab keyboard navigation, removal from the shipped schema/runtime, and manual player expansion, Escape and episode buttons after removing automatic expansion/click zones. The supplementary browser scenarios now use the retained theme-color setting for reload-only changes; their syntax was checked, but they were not executed.

Installed-Chrome rendering, real toolbar-panel interaction and panel/worker/page build matching remain unverified under the [recorded native Chrome access blocker](chrome-access-status.md). No new native access attempt or disposable browser was run for this change. Reload extension 0.9.2, the relevant Rezka tab and the settings panel before checking the installed build.

## MyShows compact history and local removal — 2026-11-04

Version 0.9.1, build `6acba2438a5e02d0467845def9abd21b6735a5c0721f43e9124f279a9df086f7`, passed all 233 offline checks and shipped-JavaScript syntax checks through `npm run package`. The 94 focused MyShows/panel checks cover compact completed/cancelled/reset rows, labelled icons and retained information, account and sender boundaries, removal while disconnected, duplicate clicks, failure recovery, focus/count/search updates, submitted-request rejection, restart and late-progress suppression, and explicit new movie/episode marks after removal. The initial package attempt encountered a transient Windows `UNKNOWN` error opening generated `search-style.js`; the unmodified retry completed the full gate and archive.

After reloading the extension and Rezka, the owner supplied a fresh screenshot of the installed panel. It shows compact history rows with trailing icon actions, no expanded cancellation text, deletion controls on unsent cancelled entries, and footer version 0.9.1 with build prefix `6acba243`, matching the package. The owner then confirmed that deletion works and the removed entry does not return after reopening the panel. These results are screenshot evidence and owner-performed functional verification; no agent action changed the real MyShows account.

The explicitly requested native Chrome check used the bundled Computer Use interface: `sky.list_apps` and `sky.get_window` succeeded, but `sky.get_window_state` stopped the turn before returning a screenshot or accessibility state because the browser URL could not be determined confidently. No alternate controller or disposable browser was used. Direct agent interaction, live keyboard checks and full panel/worker/page build matching remain unverified under the [recorded native Chrome access blocker](chrome-access-status.md); this does not invalidate the owner's visual and deletion checks above.

## Player voice menu — 2026-11-03

Version 0.9.0, build `02c17b5333632e6a6b48efab3748085569c5d87bee9d9673b1bceb133e913e34`, passed all 228 offline checks and shipped-JavaScript syntax checks through `npm run package`. The restricted run initially could not start Git for Windows' shell for the existing hook check; the ordinary Windows run passed the complete gate. Nine targeted voice checks cover preflight rejection, exact episode/time/play-pause preservation, stale/concurrent requests, restricted and malformed responses, inert markup, movie variant flags and unstarted playback, search/favorites/focus, and errors in place.

Live development verification in the existing desktop Chrome confirmed that the native player fullscreen element contains extension controls, a same-origin episode request can reject an unavailable current episode without touching playback, and actual paused/playing switches preserve the current episode and timestamp. Search and favorites were exercised without switching playback. The original voice was restored and test favorites removed. A true fullscreen capture showed the menu inside the fullscreen element with working search; programmatic fullscreen activation from the background was denied, so the owner entered that mode manually.

Independent review accepted the local composition and found one keyboard issue: regrouping a favorite could leave focus outside the scrolled list. The final build scrolls the list just enough to expose the focused row. After the owner's extension reload, the installed page reported the exact packaged build without temporary development styles. Keyboard addition from the lower part of the list and removal from favorites both retained visible focus on the star; only the list scrolled, while the page position and paused playback timestamp stayed unchanged. Screenshots confirmed both states, Escape returned focus to the opener, and the test favorite was removed. Native toolbar panel/worker verification remains subject to the recorded Chrome access blocker. No disposable browser was launched.

## Search layout stability — 2026-11-03

Version 0.8.8, build `af569ec81d62f35f9c5c2545d5d70421a4bd1885fa079ca052458036149ce286`, passed all 219 offline checks and shipped-JavaScript syntax checks through `npm run package`. Independent rendered-layout and mechanical assessments retained the existing query-to-filters-to-results path, two-column structure and catalogue density. The layout detector returned `[]` before and after the change.

The live reproduction used a country draft followed by a pending sort change. The sort explanation increased the toolbar from 44px to 71.5px and moved the result heading 13.75px below the filter heading. Top-aligning the toolbar and giving its heading a 44px minimum row keeps both headings aligned while the explanation remains beside its control. After the owner's reload, the existing Chrome reported the exact packaged build at the current desktop window size and DPR 1.5. Text ranges for both headings began at y=415.333px before and after the explanation appeared. The page had no horizontal overflow; keyboard selection still changed the pending sort without applying the other draft fields.

Rendered evidence preserved the primary query action, the filter/result separation and aligned card rows. Existing 12px poster-to-caption, 6px caption and 28px row intervals retain the distinction between related content and separate results. Long film titles wrap within their tracks. Source inspection confirms wrapping applied chips, bounded native dialogs and the separate empty-results region; this change does not reorder DOM or focus targets. Preset-dialog paragraphs now allow unbroken names to wrap, matching the existing summary treatment. The live save dialog remained 480px wide with no overflow and computed `overflow-wrap: anywhere` on its paragraphs; an 80-character stored name was not created for testing. The dialog was cancelled and the test tab closed without saving records or applying drafts. Captured console errors came from the site's `andt.js` requests. Native toolbar panel/worker acceptance remains subject to the recorded access blocker.

## Search select polish — 2026-11-03

Version 0.8.8, build `e1f5122c4b8b8f3969b61b57585025027843f9bcd6793484169fc5ebb1f178eb`, passed all 219 offline checks and shipped-JavaScript syntax checks through `npm run package`. Native selects in the additional filters and condition editor now share the filter pickers' 18px chevron, 13px right inset and 44px text clearance. The saved-set selector retains its separate decorative SVG without a duplicate background arrow. Disabled selectors retain the default cursor. Forced colors restore the system select appearance.

After the owner's extension reload, a test tab in the existing Chrome reported the exact packaged build at the normal 2018 × 1263 CSS-pixel viewport and DPR 1.5. In the current dark theme, sidebar and editor selects measured 44px tall with 11px leading padding and no horizontal overflow. ArrowDown changed the native operator; Tab moved focus between the editor fields. Submitting a blank rating showed the inline error and focused its input. Adding an editor condition focused its field selector; Escape closed the dialog and returned focus to the complex-conditions opener. The temporary test tab was closed without applying its draft or changing saved sets. Light and forced-color rendering were reviewed in source only; the native toolbar panel/worker acceptance remains subject to the recorded access blocker.

## Saved-set control alignment — 2026-11-03

Version 0.8.8, build `3eeccb41ff2927aff388a8954417023b55b8d6a82de789b2c8cab552bde9ebbc`, passed all 219 offline checks and shipped-JavaScript syntax checks through `npm run package`. The restricted run passed 218 checks; Git for Windows could not start its shell for the hook check. The approved ordinary Windows run passed the complete gate. The targeted Impeccable layout scan returned no findings.

After the owner reloaded the extension, the existing search tab reported the exact packaged build at the normal 2560 × 1271 CSS-pixel viewport and DPR 1.5. The saved-set field measured 205 × 44 CSS px, matching the filter width to within subpixel border rounding; the label remained fully visible, and the 18px chevron used the filter controls' inset and stroke. Selecting an existing set exposed its actions and draft notice. Reloading restored the original empty query and filters without changing saved records. A screenshot confirmed the alignment and keyboard focus. Captured errors belonged to the site's `andt.js` fetch requests. Native popup expansion was not confirmed by the browser accessibility snapshot; native toolbar panel/worker acceptance remains subject to the recorded access blocker.

## Search editor entry validation and future ordering — 2026-11-03

Version 0.8.8, build `f67dd50a90100918bcada4b29d5c86e13932f399cf0338c0c63ca86eea544b15`, passed all 219 offline checks and shipped-JavaScript syntax checks through `npm run package`. All 41 archive entries matched shipped bytes. The 63 focused search checks cover invalid common fields at both complex-editor entry points, retained drafts and future-versus-applied title-order explanations. The Git-hook check required the ordinary Windows execution environment after the restricted run blocked MSYS shell startup.

After the owner's reload, a fresh tab in the existing Chrome reported the exact packaged build at the normal 2560 × 1271 CSS-pixel viewport and DPR 1.5. Both complex-editor entry points rejected inverted years before opening, focused the offending field and preserved the applied search. Correcting the range allowed applying IMDb ≥ 7 and reopening it intact. Future-order feedback distinguished an unapplied title from previous results, then returned to ordinary text on reversion or application. Screenshots confirmed readable feedback without overlap. The fresh log contained only site-script fetch errors; test filters were reset and the verification tab closed without saved-set or account changes. See [the follow-up](search-hardening-2026-11-03.md) for evidence and the unchanged native panel/worker and screen-reader limits.

## Search reset, pending order and title context — 2026-11-03

Version 0.8.7, build `2fba6e892781eaa596778ab0a37c2fdd5d5f4c0b015af951eb3774e169093eaa`, passed all 217 offline checks and shipped-JavaScript syntax checks through `npm run package`. All 41 archive entries independently matched the shipped files. The 61 focused search checks cover title-preserving reset, pending-order feedback and title/catalogue scope in complex conditions, alongside existing search behavior.

After the owner's reload, the existing Chrome reported the exact packaged build at its normal 2560×1271 CSS-pixel viewport and DPR 1.5. Live checks confirmed that reset keeps applied and edited title text, pending order is locally identified and clears on application, and the condition dialog shows the current title or whole-catalogue scope. Screenshots retained the existing visual treatment without overlap. Only site-script fetch errors were captured; the verification tab was closed without saved-set or account changes. Native toolbar/worker and screen-reader limits are recorded in [the follow-up](search-clarity-2026-11-03.md).

## Search draft preservation and loading controls — 2026-11-03

Version 0.8.6, build `d459a46e31deb0eae9df202e33778f5bcfa272f7002c379f2c7d67ffaad5e9da`, passed all 215 offline checks and shipped-JavaScript syntax checks through `npm run package`. All 41 entries in `dist/rezka-custom-0.8.6.zip` independently matched the shipped files. Nine new regressions cover draft preservation, explicit sort application, contextual group names, summaries and upper loading controls. The restricted Git-hook launch failed; the approved ordinary Windows packaging run passed without skips.

After the owner reloaded the extension, the existing Chrome reported the exact packaged build at its normal 2560×1271 CSS-pixel viewport and DPR 1.5. Live checks confirmed preserved drafts after chip removal, explicit application of sorting with pending fields, upper continuation/stop with stable focus, plain summaries, distinct nested-group accessible names and validation focus, and hidden controls after complete results. The captured log contained only site-script fetch errors. The verification tab was closed; no saved set, watched state or theme was changed. Native toolbar and worker verification remain subject to the recorded access limitation; screen-reader speech was not exercised. See [the follow-up record](search-followup-2026-11-03.md).

## Refined franchise-list controls — 2026-11-02

Version 0.8.5, build `231fd151a2546f637acf85183cd405c34ca40cfdc14752cc31c692d3eeea0d53`, passed all 206 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.8.5.zip`. The list action now uses an 18px outline circle inside the unchanged 26px target, a hover/focus check preview and an accent-filled confirmed state. Light/dark control contrast is 3.68:1 / 4.68:1; the filled-state check contrast is 7.07:1 / 9.35:1. Poster-card styling and account operations are unchanged.

The final CSS was first previewed in the existing Chrome tab through a temporary inspector stylesheet. Hover, checked and busy appearances were simulated only in the DOM and restored without account writes. After the user's extension reload, a fresh verification tab in the same Chrome profile reported the exact packaged build and rendered all 13 row actions without overlap at the current `2560 × 1440` CSS-pixel viewport and DPR `1.5`. Native Tab navigation exposed the themed focus outline and check preview. The fresh log contained only the site's `/j/andt.js` fetch errors. Local screenshot `docs/screenshots/franchise-controls-refined-2026-11-02.png` records the installed result; `franchise-controls-states-preview-2026-11-02.png` is explicitly a simulation of visual states. The agent-created verification tab was closed. No disposable browser, viewport override or real history mutation was used. Panel/worker verification remains subject to the recorded native-access limitation.

## Franchise-list watched actions — 2026-11-02

Version 0.8.5, build `10ab08cb6ecc13c1352401605858461ec419d29e9f7646135ab158793c7a6119`, passed all 206 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.8.5.zip`. Native list markup and table styles were read from the user's existing Chrome before implementation. New contracts cover current non-link titles, mark/unmark confirmation, duplicate-click prevention, synchronization with cards, preserved row navigation, dynamic URLs and guest cleanup. The restricted runner could not launch the Git hook shell; the approved ordinary Windows run passed the complete gate without skips or a disposable browser.

After the user reloaded the extension and page, the installed page reported the exact packaged build. In the existing Chrome at its normal `2560 × 1271` CSS-pixel viewport and DPR `1.5`, all 13 franchise rows, including the current non-link title, showed exactly one 26 px checkmark after the rating. Screenshot inspection and measured bounds confirmed alignment without overlap; Tab moved from the current-title action to the next title link and then to its action with a visible focus outline. A representative screenshot was captured in the verification chat. The captured log contained site-script fetch errors from `/j/andt.js`, with no extension warning or error. No account marks were changed: live mark/unmark persistence and completed-row hover were not exercised in this pass and remain covered only by offline contracts. The real toolbar panel and worker identity remain unverified under the recorded browser-access limitation.

## Three catalogue viewing states — 2026-11-02

Version 0.8.5, build `a7d0c718694804aa6defa857bb8253c6460c4541e205347e8690a18c16b28bcb`, passed all 203 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.8.5.zip`. The installed catalogue and advanced-search pages matched this build in the existing Chrome profile at its normal display scale. The native toolbar panel and worker identity remain unverified because of the recorded browser-access limitation.

## Watched-card request latency — 2026-11-02

Version 0.7.2, build `dc3fab91580fb25e8697e1ff72ab571b0203d4567f2c6b908578bd5a4b25db91`, passed all 170 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`.

## Multipart-film watched action — 2026-11-02

Version 0.7.2, build `a5949e18f57f6890ac08e1ba1b8a950cb540b11dfdf621903ffbca1da265cb64`, passed all 167 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The focused watched suites passed all 25 checks.

## Keep completed history readable — 2026-11-02

Version 0.7.2, build `a6903231fe33d0c2d14c6ea9bb4731eb0deb62b4fae0a2ca01510632d7263bfe`, passed all 166 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`.

## Watching and completed history tabs — 2026-11-02

Version 0.7.2, build `39a0c13261f5ef6f3dce7e0b4126f2d4da34f36126a647322c9108f59ff5c983`, passed all 166 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The focused watched-state suite passed all 17 checks.

## MyShows journal icon controls — 2026-11-02

Version 0.7.2, build `b95710608335fdd23e363ed5f7b69fd119ce2418ddfc95080c4385f40c4254d3`, passed all 162 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. All 31 panel checks also passed separately.

## Compact MyShows journal — 2026-11-02

Version 0.7.2, build `2503920c56d2b1efd1dfa2b58290f745abab7480fdfa3170c3973e245b3edc5e`, passed all 161 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The existing 30 panel checks also passed separately, including retained history disclosure, keyboard focus, movie/episode links, reset controls and recovery.

## MyShows threshold slider — 2026-11-02

Version 0.7.2, build `a151b782b011b76de3d7ea51b4bf4741e43317d55516bd2f5651437a50c43872`, passed all 161 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The first restricted run passed 160 checks but could not start the Git hook shell (`NtCreateDirectoryObject` access denied); the approved ordinary Windows run passed the full gate without skips.

## Local MyShows record reset — 2026-11-02

Version 0.7.2, build `367551226c8ac6254df8ba251c391d326ccb7d0e7150ef413bbcde890fff78f1`, passed all 157 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The approved ordinary Windows runner also passed the Git hook check; no test was skipped and no browser process was launched.

## MyShows native movie card repair — 2026-11-02

Version 0.7.1, build `fb9b106b452610e8353dc4b258bd1cf7357ec23c4d1e85c61325bea3f00bacd9`, passed all 152 offline tests and shipped-JavaScript syntax checks through `npm run package` in the approved ordinary Windows execution environment. Archive: `dist/rezka-custom-0.7.1.zip`. No checks were skipped and no disposable browser was launched.

## MyShows movies — 2026-11-02

Version 0.7.0, build `f3fa28f5ebb2a5a939fde4a2feb34a38fc867726b7a486ec0535ac4b6724df77`, passed all 148 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.0.zip`. The first restricted pass passed 147 tests but the Git for Windows hook process failed to start (`NtCreateDirectoryObject` access denied). The approved ordinary Windows packaging pass then passed the entire gate with no skipped checks.

## MyShows composition refinement — 2026-11-01

Version 0.6.7, build `7f3348d94356fc96a628724a75e35c536dc18682db60babd8b7cb206e9aa0036`, passed all 137 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.6.7.zip`. As in 0.6.6, the Git hook test could not start the Git for Windows shell in the restricted runner; the complete gate passed in the approved ordinary Windows execution environment, with no skipped checks.

## Retrospective improvements and support diagnostics — 2026-11-01

Version 0.6.6, build `84115a7feb829a174ca38b2cc6cce8db65e3604d3fb49d78ac98665e6f988f15`, passed all 137 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.6.6.zip`.

## MyShows panel during playback — 2026-11-01

Version 0.6.5, build `d6fa78c25b96d81d4ce1e8767c27300b48e6c0f2814e31b0e744ef84837602f8`, passed all 131 offline checks and the JavaScript syntax gate through `npm run package`. The archive is `dist/rezka-custom-0.6.5.zip`.

## MyShows progress after seeking — 2026-11-01

Version 0.6.4, build `efeae075727a05f34ebd9968a4cbbfe61e7be8eee3a5911f5c156561f679dcd8`, passed all 122 offline checks and the JavaScript syntax gate through `npm run package`. The archive is `dist/rezka-custom-0.6.4.zip`.

## Remove the filter menu section — 2026-11-01

Version 0.6.3, build `3fc5acdce6f40ace9cd16dc81b45d57a57b203f164e221e341bdaf7b2a621e28`, passed all 116 offline checks and the JavaScript syntax gate through `npm run package`. The archive is `dist/rezka-custom-0.6.3.zip`.

## MyShows rejection recovery and cancellation — 2026-11-01

Version 0.6.2, build `6a57b0bf1e695ac80cd143f887aa98e273325e79f578c044f2d833f9ec46a9d0`, passed all 115 offline checks and the JavaScript syntax gate through `npm run package`. The resulting archive is `dist/rezka-custom-0.6.2.zip`. Regression checks cover the real source-length rejection, safe retry after definite rejection, ready content scripts in still-loading tabs, legacy recovery, preserved UUID identity, cancellation during network/history work, tracking recovery without manual completion, and the cancelled current-episode UI.

## MyShows manual episode marks — 2026-11-01

Version 0.6.1, build `97f77f9c3c99f063b7697bee0972a96314bbc7ab9cf2a9ddd5ba26ef9d403620`, passed all 106 offline checks and the JavaScript syntax gate through `npm run package`. The resulting archive is `dist/rezka-custom-0.6.1.zip`. New checks cover current-episode reads before playback, manual threshold bypass with automatic sync off, preserving measured progress, independent queue processing, repeated clicks, stale episode/tab rejection, account isolation, cancelled-entry recovery, uncertain-write protection and manual control states.

## Development workflow improvements — 2026-10-31

Version 0.5.2, build `1889e5bc61e51c4f4777af1fb2af2ac0184e9d710ce7cf0b908f4bbf3c5fa376`, passed 79 offline checks through the package gate. The archive's build identity matched the verified directory. The gate's integration check confirmed that a deliberately failing test or invalid shipped JavaScript preserves an existing archive, and that an empty suite fails.

## Verification boundary

Offline tests and source checks do not establish acceptance in the installed Chrome extension. Native toolbar/panel verification remains subject to the [recorded access blocker](chrome-access-status.md). Account-specific evidence is retained only outside version control.
