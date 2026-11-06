# Search control alignment — 2026-11-02

## Scope and spatial direction

This is a narrow refinement of the existing Operate surface. Preserve the site's font, themes, search behavior, labels and desktop dimensions. The task path remains common filters → optional condition editor → apply → results. Group nesting stays visible through indentation, while repeated operator/value controls share stable column lines. Related controls use 12px spacing; sibling conditions and group actions use 16px separation. Compact sidebar filters retain their established width.

The independent layout assessment used the current dark/light screenshots and source before the mechanical scan. Reading order and overall density were sound; local geometry was not. The initial layout scan returned no findings, demonstrating that it did not capture the visible alignment defects.

## Reproduced causes

The installed 0.8.0 build `cf05d6904583` was inspected in the existing Chrome. For root, child and grandchild conditions, operator starts were **1048.7 / 1061.5 / 1074.3 CSS px** and value starts were **1305.6 / 1313.8 / 1321.9 px**. Each nested row independently recomputed its fractional columns after indentation.

Voice chips preceded the input, lowering the actual value control relative to the field/operator controls. Compact remove buttons extended **6px** beyond the sidebar filter edge because of an absolute negative right offset. Group-mode controls used intrinsic widths and were disconnected from condition columns.

## Changes

- Share column tracks through the editor's existing nested wrappers, including group headers. Indentation is absorbed by the first column; the operator, value and remove-action axes stay common. This follows native [CSS subgrid alignment](https://drafts.csswg.org/css-grid-2/#subgrids); there is a usable independent-grid fallback for Chrome 116.
- Put the voice input and Add action before its selected-value chips, preserving DOM/tab order. Anchor suggestions to the input row so wrapped chips do not displace the popup.
- Use a normal two-column grid for compact labels/remove actions. Their right edge now belongs to the same layout as the controls below; remove actions have transparent resting backgrounds in both themes.
- Replace accumulated row/group margins with explicit gaps. Keep the distinction between 44px form controls and 36px group-add actions.

## Build and checks

- Version: **0.8.1**.
- Build ID: `1c4c911cea06d89db3392c79817fcff79e472feabf23c7b2b14f63d3d84cefb9`.
- Archive: `dist/rezka-custom-0.8.1.zip`.
- `npm run package`: **189 passing Node checks**, all shipped JavaScript parsed, normal generated outputs rebuilt. All **41 archive entries** matched the shipped files by SHA-256. No additional dependency or browser profile was added.
- Final Impeccable layout scan: no findings. No suppression was added.
- `git -c core.whitespace=cr-at-eol diff --check`: passed.

## Installed-browser verification

After the user's reload, the installed page reported the exact **0.8.1 / 1c4c911cea06** packaged identity. The existing Chrome viewport remained **2560 × 1215 CSS pixels**, with no viewport override or display-scale change.

- All four condition rows, across three levels, now start their operator column at **1049.0px** and value column at **1306.3px**. Group-mode select ends share **1037.0px**; the group checkboxes/actions follow the same column lines. Visible first-column indentation preserves nesting.
- Numeric inputs, selects, the voice input and its Add button measure **44px** high and share the row's top edge. The selected voices sit underneath. Rating-absence helper text aligns with the control row.
- Compact filter rows, selects and remove-button right edges match at **742.7px**. The former 6px protrusion is gone. The sidebar was inspected separately at its normal scroll position.
- A long temporary voice name produced an **86.3px** chip area without horizontal overflow. Suggestions retained the input's left/right boundaries and opened **4px** below the input, independent of chip height. The temporary draft was cancelled.
- A 12-group chain retained a **160px** minimum field width and produced vertical scrolling only: dialog `scrollWidth` and `clientWidth` both measured **1063px**. No horizontal overflow occurred. The ordinary three-level query was restored afterward.
- Group collapse displayed its summary. Tab from Apply wrapped to Close; Escape cancelled and returned focus to Edit. No layout change reordered keyboard controls relative to their visible sequence.
- Dark and light editor captures were inspected. The same hierarchy, gaps, field boundaries and wrapping held in both themes; the original dark theme was restored.
- The page console exposed only the site's `andt.js` failed-fetch messages, with no extension-script error observed. This does not inspect Chrome's stored extension-error history.

Evidence: [before](screenshots/search-alignment-before-2026-11-02.jpg), [dark after](screenshots/search-alignment-dark-2026-11-02.jpg), [light after](screenshots/search-alignment-light-2026-11-02.jpg), [sidebar after](screenshots/search-alignment-sidebar-2026-11-02.jpg).

Mobile and deliberately narrowed windows are outside this task. The Chrome 116 fallback was reviewed in source but not run in an older browser. The unchanged toolbar panel remains outside the available native browser access described in `chrome-access-status.md`.
