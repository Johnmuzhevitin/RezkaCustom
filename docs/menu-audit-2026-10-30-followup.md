# Rezka Custom popup: follow-up audit

Date: 2026-10-30. Version: 0.2.2. Surface: `extension/popup.html`. Mode: Operate. Baseline: [0.2.1 audit](menu-audit-2026-10-30.md). Requested sequence: harden, typeset, adapt, document, polish, repeat audit.

## Implementation integrity verdict

**Pass for source and DOM behavior; native-browser acceptance remains pending.** All nine original findings have implementation changes and evidence below. The five sections, immediate-save behavior, stored setting values, light identity and 440px intrinsic popup width remain intact. No new confirmed P0/P1/P2/P3 defect was found in this pass. One detector advisory remains qualified below; it is not a verified visible defect.

## Audit health score

| Dimension | Before | After | Evidence and limitation |
| --- | ---: | ---: | --- |
| Accessibility | 2/4 | 3/4 | Contrast, keyboard shortcut, persistent live regions and account focus addressed; screen-reader/native acceptance pending |
| Performance | 3/4 | 3/4 | Stable account nodes, local assets, no width animation; startup and interaction latency not profiled |
| Theming | 2/4 | 4/4 | Semantic palette throughout the intended light theme; documented system and component sidecar |
| Responsive design | 3/4 | 3/4 | Larger targets, relative type, wrapping and coarse-pointer rules; actual popup/text-scaling checks pending |
| Implementation integrity | 3/4 | 4/4 | Search coverage and account lifecycle verified offline; coherent product-specific controls preserved |
| **Total** | **13/20** | **17/20** | **Good; source/DOM assessment, not WCAG certification** |

Theming is scored against the deliberately light interface, not an unrequested dark mode. Responsive scope is the desktop extension popup, not a general mobile website. Scores do not imply that unavailable runtime checks passed.

## Original finding disposition

| Finding | Implementation | Verification |
| --- | --- | --- |
| A01 — tab text contrast | Muted token darkened to `#58657a` on `#e6eaf1` | **4.89:1**, up from 4.33:1; automated semantic-pair assertions |
| A02 — switch/field contrast | Dedicated `#77839a` border and off-track tokens | Border/white **3.82:1**, track/canvas **3.47:1**, white thumb/track **3.82:1** |
| A03 — unrestricted `/` | Ctrl+F/Command+F, physical KeyF handling, matching hint and help text | Plain `/` leaves focus alone; modified shortcut works with Russian layout; Escape clears and focuses search |
| A04 — unannounced results/reload | Separate persistent polite search and notice regions; atomic saved status | Empty/count text, stale announcement cancellation and reload-action feedback asserted in DOM; actual speech pending |
| A05 — account focus loss | Stable form/card nodes; read-only fields while busy; duplicate request guards; deliberate focus transitions | Failure retains form identity, focus and values; success clears password; logout, retry, expired session and navigation-away cases pass |
| A06 — missing account/subtitle search | Destination entry with Russian/English aliases, opens Subtitles tab | `субтитры`, `OpenSubtitles`, `аккаунт`, `пароль`, `сдвиг` return a working destination |
| A07 — small/inconsistent text | 12px supporting roles, 13px controls, 16/22px headings at default base; rem scale, 400/600 weights | Independent typography assessment and source review; detector no longer reports tiny text; actual scaling pending |
| A08 — small targets | Whole native label row, 44px help/actions, coarse-pointer fields/radio options | Description click toggles once and saves; no nested labels; CSS dimensions reviewed, physical hit testing pending |
| A09 — color literals/system drift | All authored palette values centralized; DESIGN.md and five component specimens | Color contracts pass; documented tokens match the current light UI; source scan reviewed |

## Completed stages

- **Harden:** accessible names/descriptions, separate status feedback, complete search destinations, modified shortcut, stable account form, guarded busy state and failure recovery. Passwords are never stored; failed login keeps transient form values, successful login clears the password.
- **Typeset:** independent visual/source assessment and isolated detector scan were obtained before edits. Preserved local Segoe and compact density, raised supporting text to 12px, removed 10/11px roles, normalized weights, corrected keyboard-hint font declarations and enabled relative sizing. No downloaded font or new font family.
- **Adapt:** preserved the intrinsic sizing fix; allowed text/controls and navigation to wrap; added long-word handling, minimum field heights, coarse-pointer targets and forced-color switch states. No unrelated mobile navigation or theme was added.
- **Document:** extracted the actual system to root DESIGN.md and `.impeccable/design.json`. The document describes the accepted incumbent identity without inventing a brand metaphor or new creative preferences. Updated usage instructions and version metadata.
- **Polish:** aligned state styles, empty headings and focus destinations, removed unused styles and layout-width animation, checked changes against the baseline snapshots. Found and fixed an additional expired-session retry focus case within A05.
- **Repeat audit:** reran the bundled source detector, verified semantic contrast and reviewed all nine findings against the final implementation. No visual acceptance claim is made.

## Detector evidence

The automatic design hook reported no deterministic issues on changed HTML/CSS. The follow-up audit's combined scan is saved in the detector result (local-only evidence). After documenting the incumbent radius vocabulary, it reports one advisory: `outline rgb(0, 0, 0)` on the unclicked View button, outside DESIGN.md colors.

This is not an authored black outline: popup CSS defines accent focus outlines, and contains no black outline declaration. The source detector's inferred default outline is a likely false positive for a non-visible default state. It was not added to the palette just to silence the detector. Confirm computed outline style/width and visible keyboard focus in the user's Chrome before treating this advisory as conclusively resolved. No contrast, tiny-text or undocumented-radius findings remain in this scan.

## Verification performed

- `npm run build`: passes, retains **25 base setting declarations**.
- `npm test`: **19/19** pass — six existing contracts and thirteen new offline popup checks.
- `node --check extension/popup.js`: passes; manifest scripts also parse in the contract suite.
- Source contrast checks cover enabled navigation, supporting text, primary/hover actions, notice/error text, essential field/switch edges and thumb contrast.
- Popup HTML/CSS/JS/schema/network-policy source totals **58,267 bytes** before compression. This is a file-size observation, not a startup benchmark. jsdom is development-only and is not shipped in the extension.
- Packaged `dist/rezka-custom-0.2.2.zip`: **21/21 entries match the current extension files byte for byte**; package, lockfile and manifest versions agree at 0.2.2.

The DOM checks execute trusted local scripts with mocked extension messages and no resource loading. They launch no browser, use no real settings or credentials, and cannot establish layout, native focus painting or spoken announcements.

## Remaining acceptance in the user's existing Chrome

The previously reported browser-tool denial has not been resolved by a new external change. No alternate profile, origin, raw CDP route or browser workaround was used. The user's earlier visual acceptance applies to 0.2.1, not these 0.2.2 changes.

1. Reload the installed extension from its existing directory; open its **real toolbar popup** at the current display scale. Verify all five tabs, complete labels, scrolling, footer and notices.
2. Repeat with enlarged browser text/200% scaling, a short available window and long account/country/error strings. Confirm no clipped text, hidden controls or horizontal overflow.
3. Exercise Tab/arrows/Home/End, Ctrl+F, Escape, row clicks, loading, login failure/retry/logout and navigation during a delayed response. Check that focus remains visible.
4. Check actual search/reload/save announcements with a screen reader, and Windows forced colors/reduced motion. Test touch on available hardware; source target dimensions alone do not prove touch behavior.
5. Use the actual authenticated site/account if testing service integration. Offline fixtures do not establish current production player or OpenSubtitles behavior.

These are verification gaps, not newly asserted product defects. No further redesign stage is recommended based on the available evidence. Close native acceptance after the real popup passes; fix any observed regression at its narrowest source.
