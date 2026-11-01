# Advanced search follow-up audit — 2026-10-31

## Implementation integrity verdict: PASS

All three findings from [the initial audit](search-audit-2026-10-31.md) are closed in the verified scenarios. The changes preserve the site's visual system and shared picker implementation. The final Impeccable source scan returned `[]` for `search-page.js`, `search-core.js` and `search.css`; there were no detector findings or false positives to classify.

## Executive summary

- **Health score: 17/20 — Good**, up from 14/20.
- **Open verified findings:** P0: 0; P1: 0; P2: 0; P3: 0.
- **Closed findings:** one P1 responsive defect and two P2 navigation/focus defects.
- Implementation followed the requested order: adapt, harden, polish, then audit.
- The existing Chrome profile and installed extension were used. No disposable browser was launched.
- The build and all **48 Node tests** pass. The rebuilt `dist/rezka-custom-0.4.0.zip` matches all 25 packaged extension files byte-for-byte.

## Health score

| Dimension | Before | After | Evidence and qualification |
| --- | ---: | ---: | --- |
| Accessibility | 3/4 | 3/4 | Confirmed keyboard-focus defect fixed; labels, visible focus and shared controls retained. Screen-reader and forced-color runtime coverage remains incomplete. |
| Performance | 3/4 | 3/4 | No new dependency, duplicate requests or repeated page mounts; bounded loading retained. No sustained performance trace. |
| Theming | 4/4 | 4/4 | Light and dark controls work; existing contrast tokens preserved. |
| Responsive design | 1/4 | 3/4 | No document overflow at all six checked widths. Physical touch devices and the complete browser-zoom matrix remain untested. |
| Implementation integrity | 3/4 | 4/4 | Coherent components and working same-document route lifecycle. |
| **Total** | **14/20** | **17/20** | **Good.** |

The remaining score margin reflects verification limits, not additional diagnosed defects. These scores are not a WCAG certification.

## Closed findings and verification

### [P1, closed] Outer site layout prevented narrow reflow

- **Location:** `extension/search-page.js:48`, `extension/search-page.js:50`, `extension/search.css:109`.
- The dedicated route removes the inherited body/wrapper minimum widths. Narrow header and footer content wrap; the search form supplies the title search previously duplicated in the site navigation. The search page temporarily uses `width=device-width, initial-scale=1` and restores native viewport metadata on departure.
- The smallest layout stacks the title input and search button, allows loading actions to wrap, and keeps the sorting picker within the available width. The final polish corrected inherited padding and retained the full 174 px site logo.
- **Measured in actual Chrome using viewport overrides:**

| Requested viewport width | Document client width | Document scroll width | Search columns |
| ---: | ---: | ---: | --- |
| 320 | 305 | 305 | 272.667 px |
| 390 | 375 | 375 | 342.667 px |
| 768 | 753 | 753 | 200 + 496.667 px |
| 1000 | 985 | 985 | 200 + 728.667 px |
| 1024 | 1009 | 1009 | 230 + 682.667 px |
| 2560, normal desktop | 2545 | 2545 | Desktop layout retained |

The client/viewport difference is the browser's vertical scrollbar. Equal client and scroll widths demonstrate that the tested document no longer requires horizontal scrolling. At 320 px, all four picker popups stayed between x=16 and x=288.667, inside the 305 px client area. Each opened and dismissed successfully.

Evidence: 320 px page (local-only evidence), 390 px light-theme picker (local-only evidence), desktop (local-only evidence).

### [P2, closed] Empty native search failed to activate advanced search

- **Location:** `extension/search-page.js:21`, `extension/search-page.js:427`, `extension/search-page.js:435`.
- A route handler now responds to both fragment changes and Back/Forward and reuses one mounted search page. Leaving restores the native title, viewport metadata and page contents. Loading and delayed scroll restoration from the inactive route cannot overwrite the current page.
- **Actual Chrome reproduction:** start at `/search/?do=search&subaction=search`; click “Расширенный поиск”; the interface appears without reload and exactly one root exists. Back returns to native search with `width=640`; Forward reveals the same advanced-search root with device-width viewport metadata.
- A Node regression also verifies duplicate entry/events, native title restoration and cache reuse.

### [P2, closed] Loading more discarded keyboard position

- **Location:** `extension/search-page.js:346`, `extension/search-page.js:355`, `extension/search-page.js:375`.
- The load button remains focusable while busy, with an announced unavailable state and guarded repeated activation. Successful explicit continuation focuses the first appended card only while focus remains on that control. User-directed focus elsewhere is preserved. Errors retain retry focus; cancellation returns to continuation. A synchronously completed final buffered batch also moves focus before hiding the load button.
- **Actual Chrome reproduction:** Enter loads the first 24 cards; a second Enter on “Показать ещё” produces 48 cards and focuses card 25. Tab then moves to card 26, rather than the footer.
- Node regressions additionally verify a changed focus destination, duplicate activation, retry, cancellation and the final buffered batch. These error/cancellation cases were not artificially injected into the live site.

## Positive findings and systemic result

The fixes address the original integration boundaries: outer document versus shadow-root layout, fragment navigation versus page initialization, and asynchronous rendering versus browser focus. Existing shared pickers, filter semantics, cache validation, text contrast tokens, lazy images and cancellation safeguards remain intact. No new implementation pattern drift was observed.

## Scope, cleanup and remaining verification limits

The installed extension was reloaded by the user before browser verification and again after the final narrow-header polish. Responsive screenshots are from viewport emulation in the user's Chrome, not physical phone testing. Mouse and keyboard actions were exercised; synthetic touch gestures, physical iOS/Android devices, screen readers, forced colors, the complete zoom matrix and sustained profiling were not tested.

The real toolbar/side-panel acceptance check remains unverified because native browser access was previously stopped by its safety check. No toolbar code changed in this work. Site-owned `j/andt.js` fetch retry errors remain visible in the console; they were not attributed to search code and are not counted as extension findings.

The audit-only tab was closed. Viewport overrides were reset and the original page settings were preserved.

## Recommended actions

No further code fixes are required for the three reported defects. Broader accessibility, physical-device and performance checks would expand coverage beyond this audit. Re-run `$impeccable audit` after future changes to the search page or host-site layout.
