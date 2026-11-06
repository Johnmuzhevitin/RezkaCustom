# Search clarity follow-up — 0.8.7

The owner selected all three findings from the repeat critique, with title-preserving reset and the existing visual treatment retained.

## Changes

- Reset clears scalar, additional and complex restrictions, retains the currently entered title, starts that title search without restrictions and returns focus to the title field. An empty title returns to the catalogue; ordering resets to its existing default. Invalid discarded filter values do not block reset.
- When selected catalogue ordering differs from the applied ordering, a helper beneath the sort control says `Применится вместе с фильтрами.` The visible combobox references this status. Application, reversion and reset clear it; a title query suppresses it because native title-search ordering takes precedence. Other draft values remain unapplied until explicit submission.
- The condition dialog's existing context surface now has a separate title-scope line: the current title or `По всему каталогу`, followed by the common filters. The scope is also the dialog's accessible description. It follows the form draft, which application will use, and renders title text safely. Saved filter sets still exclude titles.

No palette, typeface, poster, group-column or loading-control redesign was introduced.

## Offline verification

- Focused search suites: **61/61 passing**. Existing sort/reset checks were extended; two new workflow regressions cover full filter reset with an edited title and title/catalogue context without changing saved-set scope.
- `npm run package`: **217/217 Node checks passed**, all shipped JavaScript parsed, no skips and no browser launched. The ordinary Windows execution environment also passed the Git-hook check.
- Build: **0.8.7 / `2fba6e892781eaa596778ab0a37c2fdd5d5f4c0b015af951eb3774e169093eaa`**.
- Archive: `dist/rezka-custom-0.8.7.zip`. All **41 entries** independently matched the shipped source bytes by SHA-256.
- Source review and whitespace check passed.

## Installed Chrome verification

After the owner reloaded the extension, a new verification tab in the existing Chrome reported the exact packaged build. The normal viewport was **2560×1271 CSS px, DPR 1.5**, in the current dark theme. No viewport, scale or theme override and no disposable browser were used.

1. Applied title `Матрица`, country USA and From 2000. Reset removed country/year, retained the title in both field and URL, retained its applied chip and focused the title. The title search subsequently showed nine results.
2. Opened complex conditions: the dialog displayed `Поиск по названию: Матрица` and `Общие фильтры не заданы.` Its accessible description referenced the scope line.
3. Cleared the title and reset, then drafted From 2000 and Popular ordering. The original applied URL remained unchanged; the local pending message appeared directly beneath the focused sort field and was linked through `aria-describedby`.
4. With no title, the dialog displayed `По всему каталогу` and the draft year. Explicit application added the year/order to the URL and removed the pending message and description.
5. Entered a different title without applying it. The dialog displayed that current draft title; reset retained it, removed the year and returned focus to the title field.

Screenshot inspection confirmed the existing layout and readable local helper placement without overlap: [pending sort](screenshots/search-clarity-2026-11-03-pending-sort.jpg), [title context after reset](screenshots/search-clarity-2026-11-03-title-context.jpg).

The fresh tab log contained only the site's `/j/andt.js` fetch errors, with no extension-source warning or error. The verification tab was closed. Saved sets, watched state, theme and unrelated tabs were not changed. Actual screen-reader speech was not exercised. The unchanged native toolbar/worker remains subject to the documented access limitation in `chrome-access-status.md`.
