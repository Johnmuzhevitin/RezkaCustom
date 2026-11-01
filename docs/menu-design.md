# Extension menu, version 0.2

The job is to adjust an ongoing viewing session from the browser toolbar, without searching through a page overlay or interrupting playback. Keep the existing setting values and effects. Replace cyclic controls with direct choices.

## Visual plan

- Canvas `#F2F4F8`, surface `#FFFFFF`, ink `#222A3B`, secondary `#626D80`, focus/accent `#4B5FC5`, separator `#DFE4ED`.
- Segoe UI Variable / Segoe UI for a native Windows control-panel feel and legible Cyrillic. System sans-serif fallback on other platforms. Title 22/28 semibold, brand 16/22 semibold, control labels 13/18 medium, explanations 12/17.
- Left-aligned copy; right-aligned switches. A 440 by 590 popup with fixed navigation/footer and one scrollable content area. The document must advertise its 440px intrinsic width even while Chrome is measuring a narrower initial viewport.
- The memorable element is a working viewport diagram tied to the width selection. Quiet rows and restrained separators surround it. No decorative metrics, gradients or repeating cards.

Compared layouts:

```text
A: vertical sidebar              B: compact horizontal navigation (selected)
+----------+---------------+     +----------------------------------+
| sections | title         |     | Rezka Custom             Help    |
|          | controls      |     | current site                     |
|          |               |     | search                           |
|          |               |     | View Player Hide Filter Subtitles|
+----------+---------------+     | heading + viewport + controls    |
                                 |                                  |
                                 | saved             version       |
                                 +----------------------------------+
```

Review before implementation: a sidebar left too little room for the existing long Russian labels at popup width. Choose horizontal navigation, full-width control rows, and a viewport diagram instead of a decorative hero. This makes the design specific to watching video and changing a site's width. Keep all five groups equally discoverable.

## Interaction contract

- Browser action opens an actual extension popup. No settings control is inserted into the site's header.
- Native switches, radio groups/segmented choices and selects, with keyboard focus and accessible names.
- Immediate local persistence; live propagation to open supported pages. Existing settings remain compatible.
- Never auto-reload a playing page. Explain pending changes and let the user reload the current page explicitly. Other open tabs retain their own pending indicators.
- Settings work away from Rezka too; say they will apply when the user opens the site. Country choices are gathered from visited catalogues.
- Search across all setting groups; visible empty and error states; retain the last selected section when reopening.
- OpenSubtitles sign-in/profile/sign-out in the popup. Subtitle selection stays in the player where it belongs.
- Respect reduced motion; animate only control changes. Review actual rendered popup screenshots and narrow layouts before handoff.

## Rendered critique

The first screenshot gave the viewport diagram too much height and placed the catalogue select ahead of everyday toggles. Reduced the diagram to 53px, removed its redundant endpoint captions, and moved appearance/IMDb switches directly below it. This keeps the visual explanation while exposing useful controls in the first viewport. Verified 440px and 320px layouts, keyboard navigation, actual toolbar-popup context creation, and empty/error states.

The account failure screenshot placed the error below the visible fold. Moved the alert above the fields and added a viewport assertion so a failed login immediately explains what happened.

## 0.2.1: native sizing correction

The user's real Chrome screenshot showed a roughly 200 CSS-pixel-wide popup, with wrapped branding and crowded tabs. The original body rule combined `width:440px` with `max-width:100vw`, allowing Chrome's initially narrow viewport to constrain the very content used to size the popup. [Chrome's action documentation](https://developer.chrome.com/docs/extensions/reference/api/action#popup) explains that popup windows are sized from their contents.

Set the root width and minimum width to 440px, remove the viewport maximum on the body, and keep fixed navigation and the footer from shrinking. The content area remains scrollable. Do not compensate by changing the user's browser zoom or display scaling.

The earlier tests missed this because the native test only checked existence and the screenshot test supplied a 440px viewport. The updated regression reads the real popup window using `chrome.extension.getViews({type:'popup'})` from an extension page and checks its dimensions and all five tabs. Narrow-viewport tests now verify intrinsic width instead of asserting that a popup behaves like a mobile page.

On 2026-10-30 the user visually inspected the installed popup in their own Chrome and reported that it now looked normal. Record this as manual user confirmation of the sizing correction. Automated geometry verification remains unexecuted because the browser tool blocked native-window control and declined the local harness origin. The existing screenshots are design references, not evidence of an automated check passing.

## 0.2.2: audit follow-up

The nine findings in [the technical audit](menu-audit-2026-10-30.md) now have implementation changes: contrast, semantic tokens, readable relative type, larger row targets, search destinations, modified keyboard shortcut, status announcements and a stable account form. The form keeps focus and transient values after failed login, scrolls its error into view without moving keyboard focus, and clears the password after success. Actual viewport visibility still requires Chrome verification.

[DESIGN.md](../DESIGN.md) is the extracted current visual authority; `.impeccable/design.json` contains five component specimens. The [follow-up audit](menu-audit-2026-10-30-followup.md) separates source/DOM evidence from outstanding native acceptance. This version preserves the 440px root sizing correction and does not change the user's display scale. Earlier screenshots remain historical references.
