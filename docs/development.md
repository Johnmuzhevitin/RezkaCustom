# Development and verification

## Source ownership

| Change | Edit here | Generated output / consumer |
| --- | --- | --- |
| Ported site features and navigation fixes | Explicit patches in `tools/build.mjs` | `extension/improvement.js` |
| Setting declarations | Upstream declarations plus explicit patches in `tools/build.mjs` | `extension/settings-schema.js` |
| Shared catalogue/search card appearance | `extension/cards.css` | `extension/search-style.js`; injected into the native document and search shadow root |
| Search layout and controls | `extension/search.css`, `extension/search-page.js` | CSS bundled into `search-style.js`; page script maintained directly |
| Search parsing, filters, pagination and cache | `extension/search-core.js` | Maintained directly |
| Watched state, card actions and history tabs | `extension/watched-site.js`, `extension/watched.js`, `extension/watched.css` | CSS bundled into `search-style.js`; scripts maintained directly |
| Side-panel interface | `extension/popup.html`, `popup.css`, `popup.js` | Maintained directly |
| MyShows sync and journal | `extension/myshows-core.js`, `myshows-worker.js`, `myshows-tracker.js`, `myshows-site.js`, `myshows-panel.js`, `myshows.css` | Maintained directly; worker import, manifest routes and panel entry are explicit |
| Page settings and connection state | `extension/settings-controller.js` | Used by generated `extension/vendor/r4-settings.js` |
| Worker requests and saved settings | `extension/background.js`, `network-policy.js`, `gm-adapter.js` | Maintained directly |
| Player integration | `extension/player-quality.js`, `player-client.js`, `page-bridge.js` | Maintained directly; MAIN/ISOLATED ordering is in `manifest.json` |
| Bundled vendor adjustments | Explicit patches in `tools/build.mjs` | `extension/vendor/r4-utils.js`, `r4-images.js`, `r4-settings.js` |
| Build identity | `tools/build-info.mjs`, called last by `tools/build.mjs` | `extension/build-info.js` |
| Read-only support report | `extension/diagnostics-worker.js`, `help.js`, `help.html`, `help.css` | Help view; bounded page reads through `settings-controller.js` and `myshows-tracker.js` |
| Local checks and archive gate | `tools/check.mjs`, `tools/package.mjs` | Verified `dist/rezka-custom-<version>.zip` |

The pinned `upstream/` directory records the supplied baseline and provenance. Change it only for an intentional baseline update. Generated files are build outputs: make durable changes in their source or build patch. Build anchors fail if the expected upstream fragment changes.

## Commands

Development requires the Node.js versions supported by the locked dependencies (see README) and `npm ci`. Packaging additionally uses Windows PowerShell/.NET.

| Command | Purpose |
| --- | --- |
| `npm run build` | Regenerate outputs and the content-based build identity |
| `npm test` | Fast offline checks against the current generated files; rebuild after shipped-file changes |
| `npm run check` or `npm run check:offline` | Rebuild, parse every shipped JavaScript file, run all Node tests; launches no browser |
| `npm run package` | Run the same offline gate, then create the ZIP; failed checks preserve the previous archive |
| `npm run test:browser` | Supplementary disposable-browser tests; explicit user permission required |
| `npm run test:browser:myshows` | Focused MyShows and support-report scenarios using the shared native panel/media fixtures; same permission requirement |
| `npm run setup:git` | Initialize this local repository if needed and install its pre-commit check |
| `npm run check:browser` | Offline gate followed by the supplementary browser suite; same permission requirement |

During implementation, run the focused checks appropriate to the change. At the end, `npm run package` supplies the complete offline gate; there is no need to run the identical full suite immediately beforehand. An empty offline test suite is an error. The gate runs an independent Node test runner even when its caller is itself a test.

## Automatic checks

Run `npm run setup:git` once per clone to configure this repository's `.githooks/pre-commit`. It runs the same `tools/check.mjs` as `npm run check`; it never launches a browser. The setup only changes local repository configuration and refuses to replace a different hooks path. Stage regenerated files after a build. The hook checks the working tree; CI checks the committed tree.

`.github/workflows/check.yml` runs `npm ci` and `npm run check` for pushes and pull requests on a Windows runner with Node 24. A manually dispatched workflow can additionally run the disposable browser suite; its browser option defaults to false. The workflow becomes operational after the repository is placed on GitHub. Local initialization does not create a remote repository or upload anything.

When native Chrome reports a URL-confidence failure, first read [the known blocker and latest attempt](chrome-access-status.md). Keep the attempted remedy and result there so future sessions do not repeat a completed diagnosis.

## Build identity and installed-page verification

The build ID is a SHA-256 hash of the sorted paths and exact bytes of every shipped file except `build-info.js` itself. It has no timestamp: unchanged shipped files produce the same ID, and an edited shipped file changes it even without a version bump. Rebuild before using the ID. Tests reject stale generated identity. Documentation and test-only changes do not change the installed build.

The worker, panel and page each load their own copy of `REZKA_BUILD`. The panel compares their IDs before claiming the page is connected:

- Matching IDs: normal connected state.
- A missing or different page ID: offer **«Обновить страницу»** for the active tab.
- A missing or different worker ID: ask to update the extension and reopen the panel.

The footer shows the version and a short ID. Its tooltip contains all three full IDs, and the help page shows the build ID too. The page's settings reply includes `build` and `loadedAt`; the top document exposes `data-rezka-build` and `data-rezka-version` on `html` for read-only browser inspection. These are local diagnostics and contain no account data. A running extension cannot detect edited disk files until those files are loaded: compare the ID printed by packaging with the installed ID when accepting an update.

The help page can collect and copy a versioned JSON diagnostic report for an explicitly selected open Rezka tab. It includes the loaded help/panel/worker/page builds, build comparisons, aggregate account-scoped journal status/error counts and current progress/confirmation. The panel build comes from the actual open same-extension view; a missing panel is `unavailable`, never inferred from the worker. The report omits account names, titles, episode identifiers, page/media URLs, free-text errors, settings, tokens and history rows. Collection neither opens credentials nor calls MyShows, changes playback, reloads tabs or edits storage. A navigation/account/configuration change during collection invalidates the current snapshot. Page reads have a three-second bound. Copy failure leaves a selectable report for manual copying.

### Acceptance sequence

1. Complete the edits, source review and offline package gate. Record the version and build ID from the final package operation.
2. Use the user's existing Chrome and installed extension at the normal window size and current display scale. Follow the desktop scope in `AGENTS.md`.
3. Reload the extension, then reload the relevant site tabs and reopen the real toolbar settings panel. If tool access to Chrome's extension-management page is blocked, ask the user once after the complete build is ready. A later required correction starts a new verification pass.
4. Match the panel/worker/page IDs to the packaged build. A matching old installed build is not proof that the new files were loaded. Reload only the requested tab through the panel; preserve unrelated tabs and playback.
5. Exercise the affected routes and states. Shared card changes cover films, series, advanced search, a long title, metadata and an episode status. Navigation changes include `/collections/`, where the active entry is a `span`. Panel changes include its actual toolbar surface and switching the active site tab.
6. Record the build ID, pages/actions, fresh extension errors and a representative screenshot. Restore test filters and close agent-created verification tabs. Report an unavailable check as unverified.

### Distinguishing an old error from a new failure

Chrome can retain error records across extension reloads and show current source text at an old stack's line number. Capture the old record before clearing it. Have the user clear only this extension's error history when that page is inaccessible to tools, then reload the affected site page and repeat the triggering action. Use a fresh tab/session log for an independent reproduction, with its build ID and load boundary recorded.

Report an error as reproduced only when it occurs after that boundary. Report a historical record as historical, with the fresh check that supports the conclusion. Keep site-script errors separate from extension-script errors; do not suppress either to make a report appear clean. Journal clearing alone is not a fix.

## Representative fixtures

`tests/fixtures/navigation.html`, `cards.html` and `native-cards.css` preserve the relevant desktop site structure observed on 2026-10-31. Titles and IDs are synthetic; no account or viewing-history data is included. `tests/helpers/fixtures.mjs` assembles them into `tests/browser/fixture.html` and supplies the same markup to the offline navbar/search checks.

The navigation has normal links and the active non-link collections entry. Cards include film/series types, an episode status, a long title, year ranges, country/genre text and a separate rating. The CSS reproduces the inherited cover background and caption structure involved in the card regression. Update these focused examples when live markup changes; retain the minimal synthetic cases for hostile URLs and asynchronous edge cases.

Node/jsdom checks validate data and DOM behavior, not layout. The optional browser scenario checks collection navigation, catalogue/search typography agreement, poster background separation and long-title containment. It is supplementary to actual installed-Chrome acceptance and must not be launched without the user's explicit permission.

`tests/helpers/native-panel.mjs` owns opening, attaching to and capturing the real disposable-browser side panel. Both browser suites use it. `tests/helpers/media.mjs` serves a genuine silent WAV with HTTP byte ranges and asserts completed seeking before countdown checks. This keeps a media-fixture failure distinct from tracker or journal failure. MyShows browser scenarios use synthetic records and an invalid fixture credential; external service requests are blocked. They do not log into a real account.

## Evidence and history

Historical checks are in [verification-history.md](verification-history.md), with feature-specific evidence in [search.md](search.md), the search audit reports and the menu audit reports. They describe the build and environment tested at that time. Use this document and current command definitions for the present workflow.
