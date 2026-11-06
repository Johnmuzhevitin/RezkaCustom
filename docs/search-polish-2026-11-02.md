# Search critique follow-up — 0.8.3

The owner requested all three priority fixes and the small copy improvements from the 2026-11-02 search critique. This pass preserves the on-site font, both themes, nested column alignment, saved-query semantics and 1000-candidate batch budget.

## Changes

- Rule validation identifies the relevant value, upper range boundary or empty-group action. Inline messages reference that control through `aria-describedby` and `aria-invalid`; focus moves to it. Invalid collapsed groups open, and valid edits or condition removal clear obsolete feedback. Independent loading errors remain visible.
- Compact voice entry spans the filter width; its add button sits below. Dropdowns remain anchored to the input. A disclosure explains collected suggestions, exact language/version names and the absence of episode-level guarantees.
- Field menus group title metadata, translation and ratings/votes. The save action explicitly names filter sets and previews conditions plus stored catalogue ordering, excluding the title query.
- Title search displays `Порядок HDrezka` without overwriting the catalogue sort selection. The draft hint uses the exact `Применить фильтры` button label. README search capabilities and batch limits now agree with the implemented search.

## Offline verification

`npm run package` passed all **194 Node checks** and parsed every shipped JavaScript file. Focused search tests cover value focus and accessible error associations, invalid and corrected range bounds, collapsed empty-group recovery, voice-help preservation, error removal, independent network failures, preset scope and title-search sorting. The archive's **41 files** were independently compared byte-for-byte with the installed source directory.

- Version: **0.8.3**
- Build: `4ba297ae0a576e63187926ef226c997dfb4f752688877306e32e8053d6d15530`
- Archive: `dist/rezka-custom-0.8.3.zip`

## Installed-browser verification

After the owner's reload on 2026-11-02, the existing Chrome page reported the exact build above. The viewport was **2560×1271 CSS px**, DPR **1.5**, with no viewport or zoom override.

- Empty compact IMDb validation focused `Рейтинг IMDb: Значение`, supplied `aria-invalid` and a matching description ID, and showed its explanation inside the visible viewport (y≈488–527). Entering 7 cleared the message and invalid marker; removing a newly invalid filter left no stale global error.
- Compact voice input width increased from approximately 129 to **205.33 CSS px**, matching the filter's full width. The add action is below and right-aligned; the selected language variant remains readable in its chip. The contextual disclosure opens normally.
- The save dialog showed the current voice condition and catalogue ordering, explicitly excluding the typed title. Escape returned focus to `Сохранить набор фильтров`. No preset was created or changed.
- Empty modal values focus the value input. A 7–6 range focuses `Рейтинг IMDb: До`; changing it to 9 clears the message. Submitting a collapsed empty group expands it and focuses `+ Условие`; adding a rule keeps it expanded.
- Nested operator/value axes remain **x=1049 / x≈1306.33**, with modal client/scroll width **1079/1079**. Tab from Apply wraps to Close, and Shift+Tab wraps back. Applying the valid title-bound query closed the modal and completed all nine candidates without an extension error.
- The editor was visually inspected in both light and dark themes. Cancelling restored the opener; the initial dark theme was restored before cleanup. Clearing the title restored the displayed catalogue ordering and enabled its control.
- The fresh console contained two `Failed to fetch` records from the site's `j/andt.js`; no extension error was observed in the captured log. Network-failure preservation was covered by offline tests, not by manipulating the real connection. Screen-reader speech was not tested.

Evidence: [inline error](screenshots/search-polish-2026-11-02-inline-error.jpg), [voice entry](screenshots/search-polish-2026-11-02-voice.jpg), [save scope](screenshots/search-polish-2026-11-02-save-scope.jpg), [dark editor](screenshots/search-polish-2026-11-02-editor-dark.jpg), [light editor](screenshots/search-polish-2026-11-02-editor-light.jpg).

The agent-created tab was closed. User tabs, saved sets and watched state were not changed. The historical native toolbar-access limitation is recorded in `chrome-access-status.md`; this follow-up changes the on-site search surface only. No disposable browser was used.
