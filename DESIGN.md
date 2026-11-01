---
name: Rezka Custom
description: Compact, readable settings for the Rezka browser extension.
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
  round: "50%"
spacing:
  edge: "22px"
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
---

# Design System: Rezka Custom

## Overview

This records the existing light settings interface, moved to a full-height side panel in 0.3.0. Version 0.6.3 has four sections: appearance, player, hiding blocks and MyShows. The country-filter section was removed at the user's request; catalogue selection remains available through advanced search. Its authority is the shipped interface, the user's request to preserve its appearance, and the menu design notes. It preserves the established identity; no new brand metaphor or unconfirmed aesthetic preference is introduced.

Short Russian labels, familiar Windows typography, cool neutral surfaces and one indigo accent make controls easy to scan. The logo and four-section navigation distinguish the interface. Setting rows carry most content; a white panel groups the numeric width choices. The decorative width preview was removed in 0.3.2 at the user's request.

## Colors

### Primary

Indigo identifies selection, primary actions, links, the caret and keyboard focus. Its darker hover variant belongs to filled actions. Selected tabs also change surface; switch position supplies a second state cue beyond color.

### Neutral

The cool canvas surrounds white controls and panels. Ink carries names; muted text carries explanations, navigation and metadata. The subtle surface groups tabs and radio choices. Quiet lines divide content; stronger control borders identify editable fields and switch tracks. These borders have different accessibility responsibilities.

### Feedback

Success green marks connection and saved-state icons. Information and errors have paired surface/text tokens and explicit messages. Source calculations verify 4.5:1 text and 3:1 essential control boundaries; disabled controls are intentionally subdued.

## Typography

One local Segoe stack serves all roles, including keyboard hints. No web fonts are downloaded. Regular and semibold (400/600) provide the hierarchy; intermediate weights can collapse unpredictably in the static fallback.

At the default browser base the scale is 22px for section headings, 16px for card/empty headings, 13px for settings and values, 12px for explanations/navigation/status, and 17px for the brand. The brand combines regular and semibold. Dense controls with short labels justify this compact scale; this is not a long-reading surface. The root remains 100%, and role sizes use rem to respect text preferences.

Descriptions use 1.5 line spacing and a maximum measure of 270px within the flexible content column. Headings may balance and explanatory text may use pretty wrapping as progressive enhancement. Long identifiers, country names and errors may wrap within words. Numeric choices and width outputs use tabular numerals.

## Layout

The toolbar icon opens a persistent native side panel. Its document uses **100%** of the panel width and **100dvh** height. Chrome owns the dimensions and lets the user resize the panel. The former 440×600 popup constraint no longer applies. Preserve the visual tokens and control proportions while allowing the content to fit the available width.

Header, search, navigation, notices and footer sit outside the scrolling content area. Content has zero minimum height and its own scrolling. Below 480px available height, vertical spacing decreases without shrinking text or hiding controls. Tabs, radio choices, notices and the footer may wrap when text grows. Fields use minimum heights rather than fixed text boxes. This is a desktop extension surface, not a mobile page.

Whole switch rows are clickable labels at least 57px high. Help, search-clear and reload actions have at least 44px target height; help is also 44px wide. Coarse-pointer input raises fields and radio buttons to at least 44px. The visible switch track stays compact inside its larger row target.

## Elevation & Depth

Tonal surfaces and quiet dividers provide separation. A small, soft downward shadow marks selected navigation and radio choices; it is not general card elevation. Keyboard focus uses a solid outline rather than decorative glow. Exact shadow and motion values live in `.impeccable/design.json`.

## Shapes

Controls have gently rounded edges, with smaller radii inside segmented rails. Panels use the panel radius. The extracted scale includes the incumbent keyboard hints and notice action; those specialized values are not alternative radii for general controls. The switch track and thumb are rounded. Authored SVG icons share a stroke style.

## Components

### Navigation and search

Four tabs use icons, Russian text and explicit selected state. Arrows, Home and End navigate tabs/radio choices. Search finds settings across all sections. Results identify their own heading and region. Ctrl+F (Command+F on Mac) focuses search even with a Russian keyboard layout. Escape clears a query and restores search focus. Printable keys do not trigger global menu shortcuts. Result announcements wait until typing pauses and live outside the changing results. A stored selection of the removed subtitle section falls back to appearance.

### MyShows during playback

The current episode is the first task block after a compact connection summary. Its section heading and current status share a row above one white, quietly bordered panel. Keep its identity, credited percentage, threshold, confirmation countdown and available actions together in that panel. The credited percentage uses the heading size beside its small label; a native progress bar shows the same value, with a short vertical threshold marker. Never infer 100% from a successful mark: manual completion and measured progress are distinct. Connection/automation parameters live in a native disclosure below it, with a trailing chevron. The journal follows, with lightweight underline filters and counts. Entry titles and episode codes share one line with an icon group; supporting text and recovery actions use the small role. A search spans the entire account journal and temporarily replaces the filter rail with an explicit results scope.

Retain the same Segoe stack and semantic colors. The current episode name uses the title role; percentages and confirmation seconds use tabular numerals. The confirmation area reserves room for wrapping pause/buffering text, without animating values. Journal rows and controls persist across updates so focus and open information remain stable. Announce significant outcomes, not every second or percentage change.

Completed journal entries occupy one compact row: title, episode/movie label and three icon controls for status/details, MyShows and local reset. The status/details icon uses a circled check and the success color for completed entries, with explicit status in its tooltip and accessible name. Truncate long titles visually; retain the complete title in its tooltip, accessible text and details. All icon controls have Russian accessible labels, native tooltips and visible keyboard focus.

Replace per-row history disclosures with one native, nonmodal popover containing the selected entry's status, date, manual origin, guidance and event history. Close it with its button, Escape or native outside dismissal. Closing explicitly returns focus to its opener; disappearing or filtered-out records close the popover and use the normal list focus fallback. Errors, cancellation warnings, reset recovery and active progress stay visible in the row. Account changes must never leave another account's information open.

### Setting rows and fields

A binary row is one native label containing the name, description and switch checkbox. Accessible names and descriptions are separate. Avoid nested labels or click handlers that toggle twice. Nonbinary settings use native selects, labeled radio groups or a range input for a continuous numeric choice. The MyShows threshold uses a native slider from 1% to 100% in 1% steps, with a stable-width percentage alongside it. Its visible and accessible values update during dragging; save only the committed value, preserving the draft across background progress updates. Focus stays visible and native semantics remain intact.

### Save and connection feedback

Settings save immediately. Saving, search and page-reload notices have separate persistent live regions. Connection state follows the active tab in the panel's window; stale replies cannot restore an old tab's notices. Page reload always requires an explicit click, targets the current page and keeps the panel open. Failure messages explain recovery; an icon never substitutes for the message.

### Motion

Only switch state has a short transition. The width preview updates directly instead of animating layout. Reduced-motion preference removes transitions while retaining every state change. Avoid decorative entrances in this utility surface.

## Do's and Don'ts

- Do use semantic tokens and verify actual text/background and control/background pairs.
- Do fill the available panel height and verify the real side panel in the user's existing Chrome at their current display scale.
- Do keep labels, keyboard operation, long-content wrapping and recovery paths.
- Do distinguish source/DOM checks from rendered layout, screen-reader and real-service acceptance.
- Don't introduce a new type family, dark theme or brand metaphor during routine polishing.
- Don't clear the active search or move focus when the browser tab changes.
- Don't accept a fixed-size preview or disposable profile as acceptance in the user's installed Chrome.
