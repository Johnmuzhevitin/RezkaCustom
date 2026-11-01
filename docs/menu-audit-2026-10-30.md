# Rezka Custom popup: technical audit

Date: 2026-10-30. Version: 0.2.1. Surface: `extension/popup.html`. Mode: Operate. Scope: accessibility, performance, theming, popup sizing and implementation integrity. This is an audit, not a redesign or an implementation change.

## Implementation integrity verdict

**Pass for product coherence; accessibility acceptance is not passed.** The five setting groups, shared control rows, direct width selector and player-related controls form a consistent interface specific to this extension. The width diagram reflects the selected value. No systemic decorative-content or unrelated-template problem was verified. There are localized accessibility and interaction gaps described below.

The Impeccable source detector returned four findings: one text-contrast advisory, one small-text warning and two border-accent warnings. The first two are supported by the source and reference screenshots. Both border warnings are false positives: `popup.css:67` uses transparent CSS borders to construct a play triangle, not an accent border around a rounded card.

## Audit health score

| Dimension | Score | Key finding |
| --- | ---: | --- |
| Accessibility | 2/4 | Insufficient contrast, an unrestricted character shortcut and unannounced status messages |
| Performance | 3/4 | Small, local popup implementation; no measured runtime profile |
| Theming | 2/4 | Six core color tokens, with 32 color literals outside the root token declaration |
| Responsive design | 3/4 | Appropriate intrinsic popup width; small pointer targets; enlarged-text behavior unverified |
| Implementation integrity | 3/4 | Coherent control system; search omits the account destination and account rendering replaces focusable content |
| **Total** | **13/20** | **Acceptable: significant work remains** |

This is a provisional source-and-reference assessment, not WCAG certification or an automated native-browser acceptance result. Responsive scoring is scoped to a desktop extension popup, not a mobile website.

## Executive summary

**9 verified implementation findings: P0 0, P1 4, P2 5, P3 0.** Prioritize contrast, accessible status feedback and the search shortcut, then stabilize account focus and complete search coverage. Keep the existing fixed-width popup, native controls and immediate-save model.

## Evidence and limits

- Read the current popup HTML/CSS/JS, setting schema and relevant background request paths. Ran the Impeccable context loader once and its source detector once. Detector invocation: `impeccable.cmd detect --json extension/popup.html extension/popup.css extension/popup.js`.
- Reviewed `docs/images/menu-view.png`, `menu-player.png`, `menu-filter.png` and `menu-subtitles-error.png`. These are 440×590 reference captures from 0.2.0. They predate the 0.2.1 root-width fix. The relevant colors, control sizes, text styles and account-error rendering still match current source; they do not prove current native popup geometry. The obsolete 320px `menu-narrow.png` is not current layout authority.
- The user reported that the installed menu looked normal in their own Chrome after the 0.2.1 correction. That supports the sizing fix, not a full accessibility or functional pass.
- Native browser automation remains blocked by the previously reported permission failures. No new browser session, alternate profile or workaround was used for this audit. Actual keyboard focus after asynchronous updates, screen-reader announcements, 200% text/zoom, Windows forced colors and touch were not exercised.
- Calculated contrast from the actual opaque CSS color pairs using WCAG relative luminance. These are source calculations, not screenshot pixel estimates.
- Executed the current schema and search predicate offline: `субтитры`, `OpenSubtitles` and `аккаунт` each match zero entries; `реклама` matches the two advertising settings.
- Popup HTML, CSS, JS, schema and network-policy source total **48,836 bytes** before compression. This excludes background/content scripts and is not a startup-time measurement.
- PRODUCT.md and DESIGN.md are absent. Existing implementation, `docs/menu-design.md`, supplied requirements and the user's visual confirmation provide the scoped context. No new product assumptions or visual world were introduced.

## Detailed findings

### A01 — [P1] Unselected tab labels fall below text contrast requirements

- **Location:** `extension/popup.css:34` and `:35` (`.tabs`, `.tabs button`).
- **Category:** Accessibility.
- **Evidence:** `#626d80` text over `#e6eaf1` is **4.33:1**, below 4.5:1 for these 11px labels. Unselected tabs remain enabled controls, so the disabled-component exception does not apply.
- **Impact:** Reduced readability of the main navigation, especially with impaired contrast perception.
- **Standard:** [WCAG 1.4.3, Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Recommendation:** Darken the tab-label token or lighten the rail. Verify normal, hover and selected states, with a margin above the threshold.
- **Suggested command:** `$impeccable harden`.

### A02 — [P1] Off switches and empty account fields lack non-text contrast

- **Location:** `extension/popup.css:49`, `:50`, `:89`.
- **Category:** Accessibility.
- **Evidence:** Off-switch border/canvas **2.03:1**, track/canvas **1.72:1**, thumb/track **1.89:1**. The account-field border `#cbd2df` against its white surrounding card is **1.52:1**. These are the visible cues identifying the switch state and empty editable area.
- **Impact:** Users may miss controls or struggle to determine their state and editable boundaries.
- **Standard:** [WCAG 1.4.11, Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), 3:1 for necessary component/state information. This finding does not claim that every decorative divider or labeled button needs a 3:1 border.
- **Recommendation:** Define contrast-tested control-border and off-state tokens. Preserve clear thumb position and a distinguishable track. Check unfocused empty fields as well as focused states.
- **Suggested command:** `$impeccable harden`.

### A03 — [P1] The global `/` shortcut has no disable or remap mechanism

- **Location:** `extension/popup.js:348` and `:349`.
- **Category:** Accessibility.
- **Evidence:** A document-level printable-character handler focuses search whenever focus is outside INPUT/SELECT/TEXTAREA. There is no popup preference to disable/remap it. The page-player hotkeys setting does not control this handler.
- **Impact:** Speech input or accidental character entry can unexpectedly move keyboard focus.
- **Standard:** [WCAG 2.1.4, Character Key Shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html). A printable-character shortcut must be switchable, remappable or limited to the relevant focused component.
- **Recommendation:** Add a genuine off/remap mechanism or use a suitable non-character modifier combination without conflicting with Chrome shortcuts; update the visible keyboard hint.
- **Suggested command:** `$impeccable harden`.

### A04 — [P1] Empty-search and reload-required feedback is not announced

- **Location:** `extension/popup.js:67`, `:88`, `:222`; `extension/popup.html:38`.
- **Category:** Accessibility.
- **Evidence:** `Ничего не нашлось` is inserted as ordinary heading/text while focus stays in search. The reload-required notice is also ordinary text with no status role or live region. The footer announces saving, but not the separate requirement to reload.
- **Impact:** A screen-reader user can receive “saved” feedback without learning that applying the change needs another action, or miss an empty search result.
- **Standard:** [WCAG 4.1.3, Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). A brief no-results message is a status update; the result list itself does not need to be a live region.
- **Recommendation:** Use a persistent, concise polite status region for search completion/empty state and pending-reload feedback. Keep the results list outside it and avoid duplicate announcements with the existing save status. Verify actual output with a screen reader.
- **Suggested command:** `$impeccable harden`.

### A05 — [P2] Account actions destroy the focused form without restoring focus

- **Location:** `extension/popup.js:211`, `:308`, `:320` and `:331`.
- **Category:** Accessibility / Implementation integrity.
- **Evidence:** Login/logout set busy state and call `renderAccountIfVisible()`, which calls `render()` and `content.replaceChildren()`. Success, error and final cleanup repeat the replacement. There is no focus restoration for the removed input/submit button. This removal is verified in code; the resulting native-browser focus position was not exercised.
- **Impact:** Keyboard users can lose their place when submitting or correcting credentials. The alert exists, but does not preserve the editing context.
- **Standard:** [WCAG 2.4.3, Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) is the relevant acceptance criterion; no browser-specific conformance verdict is asserted for this finding.
- **Recommendation:** Keep the form nodes stable during requests, update busy/error state in place, and intentionally move focus after success or failure. Do not persist the password. Check Enter submission, failed login, retry and logout.
- **Suggested command:** `$impeccable harden`.

### A06 — [P2] Search cannot find the subtitles/account destination

- **Location:** `extension/popup.js:217` and `:218`.
- **Category:** Implementation integrity.
- **Evidence:** Search filters only `configs`. The account screen is rendered only with an empty query. Offline execution of the exact current index returned zero matches for `субтитры`, `OpenSubtitles`, and `аккаунт`.
- **Impact:** A user searching for an existing account/subtitle function sees an incorrect impression that it is unavailable, although manual tab navigation works.
- **Standard:** Product interaction consistency; no specific WCAG violation claimed.
- **Recommendation:** Index section/account destinations as well as individual settings and show a result that opens the relevant section. Include common aliases without fabricating non-existent controls.
- **Suggested command:** `$impeccable harden`.

### A07 — [P2] Helpful text is consistently very small

- **Location:** `extension/popup.css:24`, `:35`, `:48`, `:76`.
- **Category:** Accessibility / Responsive design.
- **Evidence:** Connection status, navigation and setting explanations use 11px; save status and version use 10px. Reference captures confirm the difference from 13px control labels.
- **Impact:** Users with reduced vision must work harder to read explanations and saving feedback. Physical display scale affects perceived size, so the screenshots do not represent every user's experience.
- **Standard:** No WCAG minimum-font-size violation is claimed. Enlarged-text acceptance remains untested.
- **Recommendation:** Raise explanatory/status text toward a practical 12–13px baseline while retaining compact navigation. Recheck the native popup at the user's actual scale and enlarged text before settling values.
- **Suggested command:** `$impeccable typeset`.

### A08 — [P2] Switch pointer targets are smaller than the row suggests

- **Location:** `extension/popup.css:44`, `:49`; `extension/popup.js:154`.
- **Category:** Responsive design / Accessibility.
- **Evidence:** The switch itself is 34×20px in a row at least 57px tall. The associated title is clickable, but the description and intervening row whitespace are not. The help button is also only 34×34px from its icon and padding.
- **Impact:** Fine pointer movement is required, particularly on touch-enabled Windows devices or with motor impairments.
- **Standard:** [WCAG 2.5.8, Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) allows spacing/equivalent-target exceptions; this audit does not claim an AA failure solely from the 20px height. A 44px hit area is a usability target, not the AA minimum.
- **Recommendation:** Expand the clickable switch label/hit area to use the row's existing space without enlarging the visible thumb unnecessarily. Verify pointer and keyboard behavior; touch has not been tested.
- **Suggested command:** `$impeccable adapt`.

### A09 — [P2] Control-state colors are not part of the token system

- **Location:** `extension/popup.css:1`, `:23`, `:49`, `:55`, `:74`, `:79`, `:89`, `:91`.
- **Category:** Theming.
- **Evidence:** Six root color tokens coexist with 32 raw color-literal occurrences outside that declaration. Off-switch, input-border, hover, error and success colors are set independently. The file contains 36 unique raw color literals overall, including alpha colors and decorative diagram colors.
- **Impact:** Adjusting contrast or adding a theme requires chasing separate selectors; related controls can drift apart during later changes.
- **Standard:** Maintainability/design-system consistency; no WCAG violation solely from literal colors. The deliberate `color-scheme: light` is not itself a defect, and dark mode was not required by the brief.
- **Recommendation:** Document the actual small token system and add shared semantic control-border, off-state, hover, error and success roles. Preserve the selected palette; dark mode is a separate product choice.
- **Suggested commands:** `$impeccable document`, then `$impeccable polish`.

## Patterns and positive findings

- Accessibility support is present but incomplete at state transitions: static labels/roles are stronger than search feedback and async focus behavior.
- Small type and pointer targets recur across the surface rather than appearing in one isolated widget.
- Most raw colors represent component states; consolidate those first instead of mechanically tokenizing every decorative diagram pixel.
- Positive: Russian document language, labeled controls, explicit tab/radio roles and state, roving tab stops, arrow/Home/End navigation, visible focus outlines, labeled native selects and switches.
- Positive: an existing live save-status region, account error alerts, useful empty/offline messages, username retention after login errors and no persisted password.
- Positive: one scrollable content region, stable navigation/footer, no automatic page reload, service-worker-owned setting writes and a user-confirmed sizing correction.
- Positive: all popup assets are local; no UI framework, remote font or raster image is loaded by the popup. No forced-layout read/write loop, broad `will-change`, expensive filter or continuous animation was found. The small diagram's short width transition is bounded, not evidence of a performance defect.
- Positive: reduced-motion mode removes optional transitions while preserving immediate checked, selected and focus states. This is not the harmful global 0.01ms animation workaround.

## Recommended action sequence

1. **[P1/P2] `$impeccable harden`** — A01–A06: contrast, keyboard shortcut, announcements, stable account focus and complete search coverage.
2. **[P2] `$impeccable typeset`** — A07: readable descriptions/status text within the existing popup layout.
3. **[P2] `$impeccable adapt`** — A08: generous pointer targets and native-popup checks at enlarged text, constrained height and the user's actual display scale. Preserve intrinsic sizing; do not reintroduce the viewport-width clamp.
4. **[P2] `$impeccable document`** — A09: capture existing visual decisions and semantic state tokens.
5. **[P2] `$impeccable polish`** — consolidate the tokens and verify the combined result, without replacing the visual identity.

The user can request these commands individually, together or in a preferred order. Re-run `$impeccable audit` after fixes. Browser acceptance must remain in the user's existing Chrome; it must not be replaced with a disposable-profile preview.

## Source snapshot

| File | SHA-256 |
| --- | --- |
| `extension/popup.html` | `9254e5452dd23c097f23c6a9a0d5065b516f699bf5571eeb0755aa9089a5e609` |
| `extension/popup.css` | `4409e7e59ea18894915d46c653254e2cfb8f9d4634fb72393d4999c2b747fcf1` |
| `extension/popup.js` | `fd836581cf4d2ea1a32d8499ebeafe0bc32c042b596d3b8019e8cb342b4d22cd` |

No production UI files were changed by this audit.
