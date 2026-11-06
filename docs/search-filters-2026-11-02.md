# Search filters — 2026-11-02

## Packaged implementation

- Version: **0.8.0**.
- Build ID: `cf05d6904583ccc2c4cdd9ee9a474efad6933e3eda1d10d24db888a53028cf6c`.
- Package: `dist/rezka-custom-0.8.0.zip` (41 files, all verified byte-for-byte against the extension directory).
- Optional voice/translation-kind filters and separate IMDb, Kinopoisk and HDrezka score/vote conditions.
- Modal nested all/any/negated groups, common-filter context, collapsed summaries, validation and keyboard focus management.
- Independently stored named filter sets; title text is never saved in a set or replaced when one is selected.
- Versioned fragment links, legacy-link support, detail reuse and three-valued evaluation without guessing missing scores or translation kinds.
- Full visible voice names preserve cut labels and language flags even when translator IDs coincide.

## Offline verification

`npm run package` passed all **189 Node checks**, including **40 search checks** (21 existing and 19 advanced-search cases). All shipped JavaScript files parsed successfully. Archive verification found no missing or differing shipped files.

The added cases cover nested alternatives and exclusions, missing ratings under negation, numeric boundaries, secondary country proofs, avoiding unsafe route narrowing, detail reuse, retriable unreadable metadata, malformed links/caches, separate preset records, preset create/rename/update/delete, storage failures, dialog apply/cancel, keyboard trapping, preserving typed values during tree edits and highlighting incomplete compact rules.

The first package attempt ran 186 of 187 then-current tests successfully but Git's `sh.exe` could not create its MSYS object under the execution restrictions. Running the unchanged package gate with the required Windows process access passed. The final gate includes two additional passing UI/error cases; no test was disabled or weakened.

The modified search-page file retains its original CRLF endings. `git -c core.whitespace=cr-at-eol diff --check` passed. The design sidecar was refreshed from the existing `DESIGN.md`; its extracted narrative and component specimens were unchanged.

## Installed Chrome verification

During planning, the existing Chrome and installed extension rendered the original search page at the user's normal desktop window size. The live Matrix detail page exposed all three rating values and vote counts, the translation list, duplicate translator IDs for different cuts, and explicit translation-kind labels. That inspection established source availability, not acceptance of the new build.

After the user's final extension reload, the verification tab exposed version **0.8.0** and the exact packaged build ID above on `html`. The existing Chrome profile was used at its unchanged desktop viewport of **2560 × 1215 CSS pixels** and current display scale. No disposable browser or fixed-size preview was launched.

The installed-page checks passed:

- Searching for `Матрица` with IMDb ≥ 7 returned 3 of 9 candidates and displayed the source's score and vote count.
- A nested query combined common IMDb ≥ 7 with **Kinopoisk ≥ 8 OR (either of two voices AND year ≥ 2000 AND NOT year ≥ 2020)**. It returned `Матрица` and `Матрица: Перезагрузка`, preserving both alternatives and showing the matching voices and ratings.
- Voice suggestions supplied distinct `Дубляж` and `Украинский дубляж` entries, and both could be selected together.
- An unfinished numeric row and an empty nested group prevented application and displayed their respective errors. Cancel preserved the applied query and restored focus to the editor trigger. Tab from the last action wrapped to the first dialog action; Escape closed the editor. Nested exclusion and collapse displayed a readable summary.
- A verification-only set was created, renamed, updated from IMDb ≥ 7 to ≥ 7.1 and recovered after reloading. Selecting it preserved the current title text and left the old results unchanged until application. The set was then deleted through the UI; the list was confirmed empty afterward.
- Reload restored the structured fragment query. Back/Forward restored the corresponding title and filter values. Opening `Матрица: Перезагрузка` and returning restored its filtered result.
- Adding HDrezka ≥ 7 displayed all three sources on that card: IMDb 7.2 / 679,080 votes, Kinopoisk 7.75 / 294,127 votes and HDrezka 9.29 / 7,280 votes.
- Both themes rendered the search page and nested editor. The original dark theme was restored. Verification filters were reset and the agent-created tab was closed; the user's existing draft tab was left untouched.

Representative screenshots: [dark editor](screenshots/search-conditions-dark-2026-11-02.jpg), [light editor](screenshots/search-conditions-light-2026-11-02.jpg).

The verification tab's console contained only the site's `https://rezka.fi/j/andt.js` failed-fetch messages; no extension-script error was observed. This is page-log evidence, not inspection of Chrome's extension error history.

**Remaining limitation:** the actual toolbar panel and its worker/panel build comparison remain unverified because of the existing native URL-confidence blocker documented in `chrome-access-status.md`. The page build was verified directly; worker and panel identity were not inferred from it. No native-controller workaround was attempted. Offline checks cover the remaining cancellation, retry, candidate-budget and unknown-data edge cases; these were not artificially induced against the live site.

## Design-hook follow-up

The side-tab finding on the advanced-condition summary was confirmed as introduced by this release. Its 3 px accent border was removed; the existing inset background and heading retain the grouping. No ignores were added and no reported design finding was left standing. The package gate passed all 189 tests again. The final installed search page was verified as described above.
