# Catalogue viewing states — 2026-11-02

## Selected appearance

The local preview used six downloaded catalogue posters with simulated statuses. The user selected **Deep bronze**, variant 3, at full colour strength and brightness `0.7` after reviewing the working alternatives.

| State | Appearance | Source |
| --- | --- | --- |
| Unseen | Original poster | No matching Rezka history entry |
| Watching | Bronze poster; unchanged title and metadata | Saved, incomplete Rezka history entry |
| Completed | Existing dimming, with hover/focus restoration | Completed Rezka history entry |

The selected poster filter desaturates the image, maps RGB channels to `0.10 0.98`, `0.055 0.78`, and `0.018 0.32` in sRGB, then applies `brightness(.7)`. It is shared by the catalogue and advanced-search cards. A hidden “Смотрю” description supplements the visual treatment without replacing existing accessible descriptions. No new persistent status or MyShows dependency was introduced.

The existing setting is now labelled “Различать статусы просмотра”. Disabling it restores original posters and removes the added descriptions. Successful watched toggles consume the confirmed history snapshot; deleted history entries revert to the ordinary appearance.

## Verification

- Packaged version: `0.8.5`.
- Build: `a7d0c718694804aa6defa857bb8253c6460c4541e205347e8690a18c16b28bcb`.
- `npm run package`: all **203** offline tests and shipped-JavaScript syntax checks passed; archive `dist/rezka-custom-0.8.5.zip`.
- Focused contracts cover incomplete/absent/completed entries, toggling, disabling the setting, removal, remote changes, failed refreshes, reused cards and shadow-root descriptions/filter definitions.
- After the user reloaded the extension and site, the installed catalogue and advanced-search pages both reported the exact packaged build.
- Existing Chrome was checked at its normal `2560 × 1215` CSS-pixel viewport and DPR `1.5`, in the current dark theme. No disposable browser or viewport override was used.
- Catalogue rendering showed all three states. Bronze applies to the poster; title, metadata and episode status retain their normal styling.
- Advanced search returned a saved, incomplete series with the bronze poster inside its shadow root, a loaded image and the accessible description. Its fresh log contained only site-script fetch failures from `/j/andt.js`, with no captured extension warning or error.
- No real viewing-history entries were changed for this verification. The agent-created search tab was closed after capture.

Local visual evidence: `docs/screenshots/card-states-catalogue-2026-11-02.png` and `docs/screenshots/card-states-search-2026-11-02.png`. These personal-session captures are local verification artifacts, not publication evidence.

The real toolbar panel and worker build were not verified. The native Chrome access blocker remains as recorded in `chrome-access-status.md`; the browser connector rejected the `chrome://extensions/` protocol, so the user performed the reload. A matching page build does not establish panel or worker identity.

## Preview and design checks

The selected simulation remains in `design-previews/card-states/`; its temporary variant wrappers and live-selection controls were removed after acceptance. The Impeccable live session was completed and its helper stopped.

Three detector exceptions are scoped only to `design-previews/card-states/index.html`: existing completed-card opacity `0.10`, native Arial differing from panel typography, and the generic overused-font warning. They preserve the requested incumbent catalogue appearance; no project-wide detector rule was disabled.
