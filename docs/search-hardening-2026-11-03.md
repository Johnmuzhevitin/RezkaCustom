# Search validation and ordering follow-up — 0.8.8

The owner requested both remaining changes from the 0.8.7 critique: protect entry into complex conditions from invalid common fields, and distinguish future title-search ordering from the currently displayed results.

## Changes

- Both `Сложные условия` and the applied expression's `Изменить` action run the same common-field validator as search submission. Invalid native year bounds/steps, an inverted range or an invalid country focus and report the offending field before the modal opens. Validation runs on raw form values before normalization can discard an invalid year.
- A rejected opening leaves the applied URL, results, current title and additional-filter drafts intact. After correcting the common fields, the existing expression opens normally and additional conditions can be applied. Modal cancellation retains its established meaning: discard edits made inside that modal.
- An unapplied title changes the existing ordering explanation to `После поиска по названию будет применён порядок HDrezka. Сейчас показаны результаты предыдущего поиска.` Applying the title or restoring the applied title returns the ordinary explanation. Clearing the title restores the catalogue ordering control. The existing accessible description remains attached to the visible combobox.

The established layout, typography, colors, saved sets and catalogue ordering behavior are preserved.

## Offline verification

- Focused search suites: **63/63 passing**. Two added behavioral regressions cover both editor entry points, native and custom common-field errors, recovery with retained drafts, and the title-draft/apply/revert/reset ordering explanations.
- `npm run package`: **219/219 Node checks passed**, all shipped JavaScript parsed, no skips and no browser launched. The initial restricted run passed 218 checks but could not start Git's MSYS shell for the hook contract (`NtCreateDirectoryObject`, access denied). The approved ordinary Windows rerun passed the complete gate.
- Build: **0.8.8 / `f67dd50a90100918bcada4b29d5c86e13932f399cf0338c0c63ca86eea544b15`**.
- Archive: `dist/rezka-custom-0.8.8.zip`; all **41 entries** independently matched the shipped files by SHA-256.
- The Impeccable detector reported no findings for the two changed UI scripts. Source review and the whitespace check (respecting the existing CRLF source format) passed.

## Installed Chrome verification

After the owner reloaded the extension, a fresh tab in the existing Chrome reported the exact packaged **0.8.8 / `f67dd50a90100918bcada4b29d5c86e13932f399cf0338c0c63ca86eea544b15`** build. The normal viewport was **2560 × 1271 CSS px, DPR 1.5**, in the current dark theme. No disposable browser, viewport override or theme change was used.

1. Entered From 2000 and To 1990, then opened `Сложные условия`. The modal stayed closed, focus moved to `До`, and the native message read `Год «До» должен быть не меньше года «От».` The applied URL remained unchanged and the existing results stayed visible.
2. Corrected To to 2020 and entered `Матрица`. The modal opened with the draft title and correct common range. Adding IMDb ≥ 7 and applying closed the modal, returned focus to the opener and applied the title, range and expression. The search completed with two matches from nine checked titles.
3. Set To back to 1990 and used the applied expression's `Изменить` action. It likewise stayed outside the modal and focused `До`, without changing the applied URL or expression. Correcting the year reopened the existing IMDb ≥ 7 condition intact.
4. Entered `Интерстеллар` without submitting. The new future-order explanation appeared above the existing Matrix results, with `aria-describedby="sort-note"` on the visible order combobox. The applied URL, chips and two cards remained unchanged. Restoring `Матрица` returned the ordinary explanation; applying `Интерстеллар` did the same for the newly applied search.
5. Cleared the title: the explanation hid and catalogue ordering became enabled. Reset the test filters and closed the verification tab. Saved sets, viewing state, settings and unrelated tabs were not changed.

Screenshot inspection confirmed readable feedback, visible focus and no overlap at the normal size: [validation before opening](screenshots/search-088-validation-2026-11-03.png), [unapplied title and previous results](screenshots/search-088-title-draft-2026-11-03.png).

The fresh tab log contained two site-script fetch errors from `/j/andt.js`, with no extension-source warning or error in the returned log. Actual screen-reader speech was not exercised. The unchanged native panel/worker remain unverified under [the recorded access limitation](chrome-access-status.md); no unchanged native retry was made. The earlier read-only inspection of an existing tab's 0.8.5 build was historical and is not the acceptance evidence for this update.
