# Advanced search technical audit — 2026-10-31

## Implementation integrity verdict: PASS

The search page expresses a coherent, product-specific system: type, genre, sort and country share one picker, search-specific tokens follow the site's theme, and catalogue filtering preserves the site's data and ordering semantics. The bundled Impeccable source detector returned `[]` for `extension/search-page.js`, `extension/search-core.js` and `extension/search.css`. No detector findings required dismissal as false positives.

This verdict concerns implementation coherence, not release readiness. Browser verification found one major responsive defect and two isolated interaction defects. No application code was changed during this audit.

## Executive summary

- **Audit health: 14/20 — Good; address the weak dimensions.**
- **Three verified findings:** P0: 0; P1: 1; P2: 2; P3: 0.
- **P1:** the host site's minimum width prevents the search page from reflowing at 320–390 CSS px.
- **P2:** entering advanced search from the empty native search page changes the fragment but does not mount the interface.
- **P2:** keyboard activation of “Показать ещё” loses focus; subsequent Tab navigation skips the appended cards.
- Address responsive integration first, then route activation and loading focus management. Preserve the shared picker and theme implementation.

## Audit health score

| Dimension | Score | Key evidence |
| --- | ---: | --- |
| Accessibility | 3/4 | Labels, picker keyboard behavior and sampled contrast are sound; loading loses keyboard focus. Reflow is scored separately below. |
| Performance | 3/4 | Lazy images, bounded sequential loading, cancellation and caching; no measured performance defect, but no sustained profiling. |
| Theming | 4/4 | Shared tokens and live light/dark switching work in the checked states. |
| Responsive design | 1/4 | Internal breakpoints exist, but the outer site's minimum width leaves a 980 px document at 320–390 px. |
| Implementation integrity | 3/4 | Coherent shared components; isolated route-lifecycle defect. |
| **Total** | **14/20** | **Good — address weak dimensions.** |

Scores describe the inspected scope and are not a WCAG conformance certification.

## Detailed findings

### [P1] The site's outer width defeats the search page's responsive layout

- **Location:** `extension/search-page.js:22` mounts inside `.b-content`; `extension/search-page.js:33` only constrains the extension host; `extension/search.css:100` changes the internal grid.
- **Category:** Responsive design / accessibility.
- **Evidence:** In the user's existing Chrome, an emulated viewport of 390 × 844 CSS px produced `document.documentElement.scrollWidth = 980`. The same document width persisted at 320 × 900. The search host was 920 px wide, from x=30 to x=950. At 320 px, the “Найти” button occupied x=874–950 and was outside the visible viewport. The containing `.b-content.b-wrapper` retained `min-width: 960px`; the site also supplied `meta name="viewport" content="width=640"`. The internal single-column breakpoint was active, so changing that breakpoint alone will not resolve the issue.
- **Impact:** Narrow-window and magnification users must scroll horizontally to reach filters and submit controls and cannot read the form in one vertical flow.
- **Standard:** This observed layout fails the 320 CSS px reflow expectation for this form under [WCAG 2.2 SC 1.4.10, Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). The form has no essential two-dimensional layout exception.
- **Recommendation:** On the dedicated route, remove or override the inherited minimum width of the containing site wrappers and establish appropriate viewport behavior. Keep site-wide changes scoped to the search route. Verify the whole document, form, menus and results at 320, 390, tablet and desktop widths, as well as browser zoom; checking the shadow-root grid alone is insufficient.
- **Suggested command:** `$impeccable adapt`.
- **Evidence image:** Narrow search page (local-only evidence).

### [P2] The advanced-search entry does not activate from empty native search

- **Location:** `extension/search-page.js:5`, `extension/search-page.js:16`, `extension/search-page.js:21`; navigation handling at `extension/search-page.js:367` is installed only after dedicated-page initialization.
- **Category:** Implementation integrity / navigation.
- **Reproduction:** Open `https://rezka.fi/search/?do=search&subaction=search`, then click “Расширенный поиск”. The address gains `#rc-search=1`, but the native heading remains `Результаты поиска «»` and `#rc-search-root` is absent. Reloading that exact address mounts the advanced-search interface and loads results.
- **Cause:** The initial `dedicated` decision is evaluated once. On the native page the script returns early; a same-document fragment navigation does not rerun the content script or activate the new route.
- **Impact:** This entry point appears broken until the user manually reloads. The defect is specific to the same-document native search route; it does not establish that all navigation entries fail.
- **Standard:** Functional navigation defect; no separate WCAG violation asserted.
- **Recommendation:** Handle route activation when the relevant fragment changes, with idempotent mounting and correct Back/Forward behavior, or make this entry explicitly perform the required document navigation. Verify ordinary native search, empty native search, already-mounted advanced search and repeated entry clicks.
- **Suggested command:** `$impeccable harden`.
- **Evidence image:** Native search remains visible after entry click (local-only evidence).

### [P2] Loading more results discards the keyboard user's position

- **Location:** `extension/search-page.js:305` hides the focused load button; `extension/search-page.js:307` shows a different stop button; `extension/search-page.js:327` renders completion without focus restoration.
- **Category:** Accessibility / interaction state.
- **Reproduction:** In a separate tab in the same Chrome profile, activate “Показать ещё” with Enter. The result count increased from 24 to 48 while focus fell to `BODY`. Repeating the action from 48 to 72 cards with native keyboard input produced the same focus loss. A subsequent native Tab, sent without refocusing an element, moved to the footer's “Фильмы” link instead of the appended results.
- **Impact:** Keyboard users lose their reading position and must navigate backwards to discover the new cards. The results themselves load successfully, so a workaround exists.
- **Standard:** Relevant to focus-order usability under WCAG SC 2.4.3; this audit records the observed defect without claiming an independently established conformance failure for that criterion.
- **Recommendation:** Define a stable keyboard focus transition for load, completion, cancellation and failure. Either preserve a focusable loading control with an appropriate busy state or deliberately move focus to the first newly appended result after successful completion. Do not hide the active control without a destination. Verify Enter/Space followed by Tab, including retry and end-of-results states.
- **Suggested command:** `$impeccable harden`.

## Patterns and systemic issues

The remaining problems occur at integration boundaries: the shadow-root layout versus the outer site's layout, initial script execution versus fragment navigation, and asynchronous rendering versus browser focus. Local component checks are insufficient for these boundaries. Future acceptance checks should include the complete document, same-document entry routes and keyboard continuity across loading.

No repeated token drift, duplicated picker styling or decorative placeholder functionality was found in the inspected search implementation. The 42 × 42 px arrow buttons are below the common 44 px comfort target but exceed WCAG AA's 24 px minimum and are paired with the full-height combobox. They are not reported as an AA target-size violation.

## Positive findings

- Type, genre, sorting and country use the same picker implementation, popup styles, selected states and theme tokens. Only one popup opens at a time.
- The picker implementation supplies labels and expanded/selected states, visible focus, Escape dismissal and keyboard option navigation. Earlier checks in this work session covered selection, dependent genre updates, sorting and title-search disabling.
- Both light and dark themes were exercised in the installed extension. Host theme state and rendered controls updated correctly. The original dark theme was restored.
- Sampled text contrast passed AA: primary text 14.56:1 light / 16.17:1 dark; muted text on inset surfaces 5.85:1 / 6.86:1; primary button text 7.07:1 / 9.35:1; error text 6.87:1 / 9.07:1. Control-border contrast was 3.68:1 / 4.68:1. These are specific sampled pairs, not a full-page contrast certification.
- Search results use lazy-loaded, asynchronously decoded images with reserved poster proportions. Fetching is sequential and bounded per batch, with cancellation and a 20-second request timeout. The page reuses cached results and does not introduce a third-party UI runtime.
- Status and empty/error states distinguish incomplete catalogue scanning from completed searches. Reduced-motion and forced-color styles are present.
- All **43 Node tests passed**. These complement, but do not replace, browser verification.
- Light-theme evidence (local-only evidence).

## Verification scope and limitations

Target: Rezka Custom **0.4.0**, installed in the existing Chrome browser. Narrow layouts were checked using temporary viewport overrides in that same browser, not a disposable profile. The viewport and original page settings were restored, and the audit-only tab was closed. Device-specific dimensions and browsing preferences are excluded from this report.

This pass combined source review, the Impeccable file detector, Node tests, DOM measurements, screenshots and actual mouse/keyboard interaction. The detector's URL/Puppeteer mode was not run because a separate browser was not authorized. No synthetic touch gestures, physical mobile device, screen reader, forced-color runtime check, full browser-zoom matrix or sustained performance trace was run. The responsive screenshot proves layout, not touch behavior.

Native toolbar/side-panel acceptance remains unverified: earlier native-window access was blocked by browser safety checks. This report covers the on-site search page and does not certify the toolbar interface. Console inspection showed failed fetch retries from the site's `j/andt.js`; these were not attributed to the extension's search code and are not counted as search findings.

## Recommended actions

1. **[P1] `$impeccable adapt`:** fix the outer width/viewport integration and verify the complete search page at narrow widths.
2. **[P2] `$impeccable harden`:** fix same-document route activation and preserve keyboard continuity while loading more results.
3. **Final step — `$impeccable polish`:** check alignment, popup placement and focus appearance after those behavioral changes.

These commands can be requested individually, together or in a different order. Re-run `$impeccable audit` after fixes to compare the findings and score.
