---
name: Rezka Custom
description: Compact extension controls and site-integrated search, catalogue cards and viewing states.
colors:
  canvas: "#f2f4f8"
  surface: "#ffffff"
  ink: "#222a3b"
  muted: "#58657a"
  accent: "#4b5fc5"
  accent-hover: "#3d4fae"
  line: "#dfe4ed"
  control-border: "#77839a"
  control-off: "#77839a"
  subtle-surface: "#e6eaf1"
  hover-surface: "#e4e8f1"
  success: "#30735e"
  notice-ink: "#38497e"
  notice-surface: "#e8edf9"
  error-ink: "#9a3139"
  error-surface: "#fce9ec"
  site-surface: "#fff"
  site-inset: "#f3f5f7"
  site-ink: "#222a30"
  site-muted: "#53616a"
  site-line: "#d6dce1"
  site-control: "#7a8791"
  site-accent: "#315b86"
  site-accent-hover: "#244565"
  site-on-accent: "#fff"
  site-error-surface: "#fff0ee"
  site-error-ink: "#9d2820"
  site-dark-surface: "#08171d"
  site-dark-inset: "#1e2d34"
  site-dark-ink: "#edf2f4"
  site-dark-muted: "#a6b7bf"
  site-dark-line: "#34464f"
  site-dark-control: "#70848e"
  site-dark-accent: "#a7cce6"
  site-dark-accent-hover: "#c3e0f2"
  site-dark-on-accent: "#102530"
  site-dark-error-surface: "#372123"
  site-dark-error-ink: "#ffb8b1"
  help-canvas: "#171a1c"
  help-ink: "#e5e8e9"
  help-muted: "#bbc3c7"
  help-accent: "#87d9c6"
  help-on-accent: "#122720"
typography:
  headline:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.275
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.46
  supporting:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  brand:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "1.0625rem"
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  site-headline:
    fontFamily: "inherit"
    fontSize: "1.75em"
    fontWeight: 600
    lineHeight: 1.25
  site-body:
    fontFamily: "inherit"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  site-compact-control:
    fontFamily: "inherit"
    fontSize: "0.875em"
    fontWeight: 400
    lineHeight: 1.5
  catalogue-title:
    fontFamily: "inherit"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  catalogue-meta:
    fontFamily: "inherit"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  catalogue-type:
    fontFamily: "inherit"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  help-body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "17px"
    lineHeight: 1.65
rounded:
  shortcut: "3px"
  keyboard-key: "4px"
  inset: "5px"
  notice-action: "6px"
  field: "7px"
  control: "8px"
  navigation: "10px"
  panel: "11px"
  switch-track: "20px"
  poster: "5px"
  site-control: "6px"
  site-dialog: "10px"
spacing:
  edge: "22px"
  catalogue-poster-gap: "12px"
  catalogue-text-gap: "6px"
  catalogue-column-gap: "16px"
  catalogue-row-gap: "28px"
components:
  button-reload:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    padding: "7px 10px"
    rounded: "{rounded.notice-action}"
  button-reload-hover:
    backgroundColor: "{colors.accent-hover}"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  navigation:
    backgroundColor: "{colors.subtle-surface}"
    textColor: "{colors.muted}"
    padding: "3px"
  navigation-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
  site-button-primary:
    backgroundColor: "{colors.site-accent}"
    textColor: "{colors.site-on-accent}"
    rounded: "{rounded.site-control}"
    padding: "9px 16px"
  site-button-primary-hover:
    backgroundColor: "{colors.site-accent-hover}"
  site-button-primary-dark:
    backgroundColor: "{colors.site-dark-accent}"
    textColor: "{colors.site-dark-on-accent}"
    rounded: "{rounded.site-control}"
    padding: "9px 16px"
  site-input:
    backgroundColor: "{colors.site-surface}"
    textColor: "{colors.site-ink}"
    rounded: "{rounded.site-control}"
    padding: "9px 11px"
  site-preset-select:
    backgroundColor: "{colors.site-surface}"
    textColor: "{colors.site-ink}"
    typography: "{typography.site-compact-control}"
    rounded: "{rounded.site-control}"
    padding: "9px 44px 9px 11px"
  site-preset-select-dark:
    backgroundColor: "{colors.site-dark-surface}"
    textColor: "{colors.site-dark-ink}"
    typography: "{typography.site-compact-control}"
    rounded: "{rounded.site-control}"
    padding: "9px 44px 9px 11px"
  site-filter-chip:
    backgroundColor: "{colors.site-inset}"
    textColor: "{colors.site-ink}"
    rounded: "{rounded.site-control}"
    padding: "7px 10px"
  catalogue-poster:
    rounded: "{rounded.poster}"
---

# Design System: Rezka Custom

## Overview

Rezka Custom preserves two established interface families: a light, full-height extension panel and controls integrated into Rezka's catalogue and advanced search. The panel has three sections: appearance, player and MyShows. Advertising switches and comment collapsing are in appearance. On-site features inherit the site's chosen font and theme. Neither family supplies a replacement brand for the other. This record preserves the accepted visual decisions; no new metaphor or aesthetic direction is introduced.

Short Russian labels, familiar typography, restrained borders and clear state feedback make the controls easy to scan. The panel uses cool neutral surfaces and an indigo accent; on-site search uses slate blue in the light theme and pale blue on deep teal in the dark theme. Catalogue posters remain the main visual content. The owner-selected bronze-gold treatment identifies incomplete viewing through the poster itself, while the existing subdued treatment identifies completed titles.

**Key Characteristics:**

- Compact controls with explicit Russian labels and visible keyboard focus.
- Separate panel and site typography, palettes and layout proportions.
- Shared catalogue/search caption roles and three distinct viewing states.
- Flat content surfaces; depth reserved for selection and transient controls.

The sources are `extension/popup.css` and `myshows.css` for the panel, `search.css` for search, `cards.css` for shared captions/layout, and `watched.css` plus `watched.js` for viewing states. `extension/help.css` owns the separate dark help/diagnostics page. Unprefixed tokens below belong to the panel; `site-*`, `catalogue-*` and `help-*` names identify their respective scopes. Generated `search-style.js` bundles the source styles and is not a separate design authority.

## Colors

### Primary

Indigo identifies selection, primary actions, links, the caret and keyboard focus. Its darker hover variant belongs to filled actions. Selected tabs also change surface; switch position supplies a second state cue beyond color.

Slate blue serves the same action and focus roles in light on-site search. Pale blue serves them in dark search, paired with dark text inside filled buttons. Theme-specific foreground/background pairs travel together; do not reuse the panel accent or its white foreground indiscriminately on the site. Mint marks links and actions on the independent help page.

### Neutral

The cool canvas surrounds white controls and panels. Ink carries names; muted text carries explanations, navigation and metadata. The subtle surface groups tabs and radio choices. Quiet lines divide content; stronger control borders identify editable fields and switch tracks. These borders have different accessibility responsibilities.

Search uses white and cool-gray surfaces in its light theme, deep teal and slate inset surfaces in its dark theme. Shared catalogue titles and metadata use the matching site ink and muted colors. The help page uses charcoal, pale text and muted supporting copy. Keep poster captions on the surrounding page surface, without a card-shaped background behind the entire item.

### Feedback

Success green marks connection and saved-state icons. Information and errors have paired surface/text tokens and explicit messages. On-site errors use their own light/dark pairs. Source contrast checks for ordinary controls are distinct from the intentional completed-card dimming described below; this document does not claim all content at 10% opacity is readable at rest.

Bronze is a poster-processing state, not a general accent or a single flat color token. Its channel mapping belongs to the viewing-state component. Do not use it to recolor titles, metadata, buttons or the surrounding layout.

## Typography

One local Segoe stack serves the panel, including keyboard hints. The extension does not download a typeface for these surfaces. Regular and semibold (400/600) provide the hierarchy; intermediate weights can collapse unpredictably in the static fallback.

At the default browser base the scale is 22px for section headings, 16px for card/empty headings, 13px for settings and values, 12px for explanations/navigation/status, and 17px for the brand. The brand combines regular and semibold. Dense controls with short labels justify this compact scale; this is not a long-reading surface. The root remains 100%, and role sizes use rem to respect text preferences.

Descriptions use 1.5 line spacing and a maximum measure of 270px within the flexible content column. Headings may balance and explanatory text may use pretty wrapping as progressive enhancement. Long identifiers, country names and errors may wrap within words. Numeric choices and width outputs use tabular numerals.

Catalogue and search inherit the site's selected typeface; Arial was observed in the accepted desktop rendering. `inherit` is intentional in their typography tokens: do not force the panel's Segoe stack onto them. Search starts from the site-body role, with a larger page heading, semibold result headings and smaller filter labels. Shared title, metadata and type roles keep native cards and search cards consistent. Titles wrap naturally rather than being forced into a fixed two-line height; ratings and episode metadata retain separate roles. The help page uses its own system stack and longer-reading measure.

## Layout

The toolbar icon opens a persistent native side panel. Its document uses **100%** of the panel width and **100dvh** height. Chrome owns the dimensions and lets the user resize the panel. The former 440×600 popup constraint no longer applies. Preserve the visual tokens and control proportions while allowing the content to fit the available width.

Header, search, navigation, notices and footer sit outside the scrolling content area. Content has zero minimum height and its own scrolling. Below 480px available height, vertical spacing decreases without shrinking text or hiding controls. Tabs, radio choices, notices and the footer may wrap when text grows. Fields use minimum heights rather than fixed text boxes. This is a desktop extension surface, not a mobile page.

Whole switch rows are clickable labels at least 57px high. Help, search-clear and reload actions have at least 44px target height; help is also 44px wide. Coarse-pointer input raises fields and radio buttons to at least 44px. The visible switch track stays compact inside its larger row target.

Catalogue rows use flexible tracks with a native minimum width of 166px. Search results use a 150px minimum track and 2:3 posters. Both use the shared catalogue spacing tokens; `cards.css` supplies the final row/column gaps after the search stylesheet. Preserve the native episode strip on the poster, with the type and title beneath it. The site's separate slider is outside this shared caption system.

At the normal desktop size, search puts a 230px filter column beside flexible results, separated by a 36px column gap and a quiet divider. The query spans both columns. Fields and main actions have a 44px minimum height; applied-filter chips wrap. The condition editor is a native dialog capped at 1080px, with 32px clearance from each viewport edge. Nested condition groups share column tracks; indentation belongs to the first column, so operator and value controls stay aligned. The preset dialog is capped at 480px.

The saved-set selector follows the filter fields' width rather than the full sidebar track. Derive it from the shared column width minus the filter inset and divider: 230px minus 24px minus 1px at the normal desktop size. This yields 205px, subject to subpixel border rounding in adjacent controls. Keep the selector's leading edge on the query and filter axis; its neighboring save action remains in the same wrapping row.

Existing search fallbacks at 1000px, 700px and 400px are recorded in the sidecar as implementation facts, not an expansion of acceptance scope. Verify at the owner's normal desktop size and display scale. The help page uses a 700px reading container and 24px horizontal padding.

## Elevation & Depth

Tonal surfaces and quiet dividers provide separation. A small, soft downward shadow marks selected panel navigation and radio choices; it is not general card elevation. Search value suggestions use a downward shadow to separate the floating list, while ordinary pickers rely on a border. The search dialog dims its backdrop. MyShows details use a bordered native nonmodal popover. Keyboard focus uses a solid outline rather than decorative glow. Exact shadow and motion values live in `.impeccable/design.json`.

## Shapes

Controls have gently rounded edges, with smaller radii inside segmented rails. Panels use the panel radius. The extracted scale includes the incumbent keyboard hints and notice action; those specialized values are not alternative radii for general controls. The switch track and thumb are rounded. Authored SVG icons share a stroke style.

Percentage-based geometry, such as circular thumbs and full-width posters, stays in component CSS rather than the frontmatter's dimension scale.

Site controls, posters and dialogs use their separately named radii. Poster images clip at their own edge; their captions do not sit inside a rounded container. Underline history tabs are square and flat. Journal icon controls remain compact, with explicit tooltips and accessible names.

## Components

### Navigation and search

The header includes a labelled backup icon beside Help. Its native dialog keeps export and selective restore together in a single scrolling surface, using existing panel colors, typography and controls. File preview shows section counts; empty sections are disabled. A quiet note explains merge behavior before the explicit restore action. See [local backup](docs/backup.md).

Three tabs (appearance, player and MyShows) use icons, Russian text and explicit selected state. Arrows, Home and End navigate tabs/radio choices. Search finds settings across all sections. Results identify their own heading and region. Ctrl+F (Command+F on Mac) focuses search even with a Russian keyboard layout. Escape clears a query and restores search focus. Printable keys do not trigger global menu shortcuts. Result announcements wait until typing pauses and live outside the changing results. A stored selection of a removed section, including hiding blocks, falls back to appearance. Advertising switches and comment collapsing belong to appearance.

### On-site search controls

The query, common filters and result count form one continuous workspace. The main search action is filled; supporting actions are bordered or text-only. Filter controls use labeled inputs and theme-matched popups with visible current/selected states. Applied filters appear as removable chips with accessible removal names. Saved filter sets sit under the query. The optional condition editor aligns nested groups on shared columns and shows validation beside the affected condition. Keep source limits, loading, empty and failure states explicit; do not make partial results look complete.

Keep compact text actions for continuation and stopping beside the upper search status, with the existing lower actions after the cards. Both reflect one loading state; upper keyboard focus stays near the status. Removing an applied chip preserves unrelated form drafts, and sorting waits for explicit application when other fields are pending. Show its pending state directly beneath the sort control using the existing helper-text role. Resetting filters retains the entered title. Common-filter recaps use plain labels and year ranges; the condition dialog also states the current title or whole-catalogue scope. Complete formulas remain available for nested expressions. Give nested groups and their controls distinct contextual accessible names without adding visible numbering or changing the column layout.

Saved sets retain a native select, its accessible name and native keyboard behavior. The compact control role also serves extra-filter selectors and bordered filter actions; apply it relative to the site-body base. Use the saved-set component tokens for the label insets, with a decorative 18px SVG chevron centered vertically, 13px from the right edge and drawn with the same 1.5 stroke as the filter pickers. The SVG is hidden from assistive technology and does not intercept pointer events. Long selected names use an ellipsis without expanding the row. Disabled state dims the control and chevron together; keyboard focus retains the site's outline. In forced colors, restore the system select appearance and hide the decorative chevron. Choosing a saved set updates the draft and reveals its management actions; applying filters remains explicit.

### MyShows during playback

The current episode is the first task block after a compact connection summary. Its section heading and current status share a row above one white, quietly bordered panel. Keep its identity, credited percentage, threshold, confirmation countdown and available actions together in that panel. The credited percentage uses the heading size beside its small label; a native progress bar shows the same value, with a short vertical threshold marker. Never infer 100% from a successful mark: manual completion and measured progress are distinct. Connection/automation parameters live in a native disclosure below it, with a trailing chevron. The journal follows, with lightweight underline filters and counts. Entry titles and episode codes share one line with an icon group; supporting text and recovery actions use the small role. A search spans the entire account journal and temporarily replaces the filter rail with an explicit results scope.

Retain the same Segoe stack and semantic colors. The current episode name uses the title role; percentages and confirmation seconds use tabular numerals. The confirmation area reserves room for wrapping pause/buffering text, without animating values. Journal rows and controls persist across updates so focus and open information remain stable. Announce significant outcomes, not every second or percentage change.

All history entries occupy one compact row: title, episode/movie label and icon controls for status/details and available actions. Completed entries retain MyShows and local reset; cancelled unsent entries offer resume, manual completion and deletion. Journal actions use the same icon controls. The status/details icon uses a circled check and the success color for completed entries, with explicit status in its tooltip and accessible name. Truncate long titles visually; retain the complete title in its tooltip, accessible text and details. All icon controls have Russian accessible labels, native tooltips and visible keyboard focus.

Replace per-row history disclosures with one native, nonmodal popover containing the selected entry's status, date, manual origin, guidance and event history. Close it with its button, Escape or native outside dismissal. Closing explicitly returns focus to its opener; disappearing or filtered-out records close the popover and use the normal list focus fallback. Cancellation warnings and reset recovery live in this information view; active progress and attention errors stay visible in their journal rows. Account changes must never leave another account's information open.

### Catalogue viewing states

Catalogue cards inherit Rezka's selected font, light/dark surfaces and poster geometry rather than the side panel's Segoe styling. The owner selected a bronze-gold treatment for incomplete viewing on 2026-11-02 in a local simulation with real posters. Apply it only to posters: map grayscale luminance in sRGB from RGB `(0.10, 0.055, 0.018)` to `(0.98, 0.78, 0.32)`, then apply brightness `0.7`, at full strength. No badge, outline, title tint or additional visible element accompanies the state. Retain an accessible status description on the links.

The state comes from an incomplete record in Rezka's «Досмотреть». An explicit watched mark takes precedence and keeps the existing 10% opacity/grayscale behavior with hover/focus restoration. A title absent from the available history retains its ordinary appearance. The shared appearance setting disables both treatments immediately. MyShows episode marks are independent. The same poster treatment applies inside advanced search, with the SVG filter defined in each document/shadow root that uses it.

The 26px watched action appears on hover or visible keyboard focus. Keep it independent of the faded content so it remains usable; focusing the action alone must not undo its own visible result. Its pending state shows a small spinner, and failure uses an explicit error notice. Completed entries in the dedicated history tab remain fully readable at rest because that tab already separates their status. History tabs use an underline and text, without panel-style segmented backgrounds.

Franchise-list actions retain a 26px target but use an 18px outlined circle on the page surface instead of the poster action's square background. An unmarked title has an empty circle; hover or keyboard focus previews its checkmark, and a confirmed watched title has an accent-filled circle with a contrasting check. Use the light/dark site control and accent pairs, a subtle circular hover surface and a solid focus outline. The pending spinner replaces both the circle and check. Keep this treatment in the trailing action column; native cells and card actions retain their existing styling.

### Setting rows and fields

A binary row is one native label containing the name, description and switch checkbox. Accessible names and descriptions are separate. Avoid nested labels or click handlers that toggle twice. Nonbinary settings use native selects, labeled radio groups or a range input for a continuous numeric choice. The MyShows threshold uses a native slider from 1% to 100% in 1% steps, with a stable-width percentage alongside it. Its visible and accessible values update during dragging; save only the committed value, preserving the draft across background progress updates. Focus stays visible and native semantics remain intact.

### Save and connection feedback

Settings save immediately. Saving, search and page-reload notices have separate persistent live regions. Connection state follows the active tab in the panel's window; stale replies cannot restore an old tab's notices. Page reload always requires an explicit click, targets the current page and keeps the panel open. Failure messages explain recovery; an icon never substitutes for the message.

### Motion

The panel switch transitions for 150ms. Search buttons move down by 1px while pressed; reduced motion removes that displacement. A pending watched action uses an 800ms linear spinner, which becomes static under reduced motion. Poster-state changes and progress values update directly. Avoid decorative entrances or animated layout in these utility surfaces.

## Do's and Don'ts

- Do use semantic tokens and verify actual text/background and control/background pairs.
- Do fill the available panel height and verify the real side panel in the user's existing Chrome at their current display scale.
- Do keep labels, keyboard operation, long-content wrapping and recovery paths.
- Do preserve the site's selected font and theme for catalogue and advanced search.
- Do share caption roles and spacing between native cards and search results.
- Do align the saved-set selector with the filter fields, including its text inset and chevron geometry.
- Do apply the selected bronze treatment only to the poster and retain an accessible viewing-status description.
- Do keep completed history readable and the watched action independent of card dimming.
- Do distinguish source/DOM checks from rendered layout, screen-reader and real-service acceptance.
- Don't introduce a new panel type family, panel dark theme or brand metaphor during routine polishing.
- Don't replace the site's existing dark theme with the panel's light palette.
- Don't add a visible badge, outline or title tint to the selected watching treatment.
- Don't clear the active search or move focus when the browser tab changes.
- Don't accept a fixed-size preview or disposable profile as acceptance in the user's installed Chrome.
