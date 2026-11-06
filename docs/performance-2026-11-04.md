# Watched-state DOM work — 2026-11-04

## Confirmed bottleneck

In the owner's existing desktop Chrome, the installed 0.9.3 build
`eedf9c6cfe5b5bc813ebd547df3e52cfddb341453d787023b939d1a5e6cb20c5`
displayed 1000 search results. The viewport was 2560 × 1215 CSS pixels at
devicePixelRatio 1.5; no viewport override or separate profile was used.

Entering `С`, `СШ`, `США`, then clearing the country field caused four full
watched-control passes. A temporary observer restricted to `aria-busy` on the
result cards counted 1000 writes after each input, 4000 total. The country draft
was restored to its original empty value, the dropdown closed, and the observer
and its temporary page property removed. No search was submitted or account
mark changed. CPU profiling was unavailable through the connected protocol
(`Profiler.enable` was unsupported); these are DOM work counts, not INP, frame
time or CPU-profile results.

The watched-state observer treated every child-list mutation as relevant,
including text replacement and rebuilding filter options. Each debounced pass
scanned all registered roots, parsed title links and rewrote every card action.

## Change

`extension/watched.js` now checks added and removed subtrees for title links,
cards, franchise/history rows, account controls and title headings. Unrelated
text and option changes do not schedule a full pass. Removed extension controls,
watching descriptions and history tabs still request repair; inserting those
decorations does not itself request another pass. Existing URL and native
watched/current-class handling stays active.

The visual system, account requests and MyShows panel are unchanged.

## Repeatable offline measurement

Run `node tools/benchmark-watched.mjs`. An optional source-file argument compares
a saved implementation with the same workload. The local baseline is retained
in the ignored `.scratch/optimize-2026-11-04/watched-before.js`.

The synthetic fixture has 1000 shadow-root result cards and 20 independent
progress-text / filter-option updates. All network calls are stubbed; the
60 ms scan debounce is drained deterministically. Timing includes jsdom DOM
work, excludes real timer waiting, and does not measure Chrome layout or paint.

| Measurement | Before | After |
| --- | ---: | ---: |
| Full scheduled scans | 20 | 0 |
| Card `aria-busy` writes | 20,000 | 0 |
| Time inside scan callbacks | 3424.48 ms | 0 ms |
| Total synthetic workload | 3538.31 ms | 16.31 ms |

Times are one local run per implementation, not a browser speedup claim or a
test threshold. The deterministic work counts are the regression criterion.

The focused watched suite passed 30 tests. Added contracts cover unrelated
main-document/shadow-root updates, retained focus, new results, restoration of
removed controls/filter/descriptions, replaced title links, native history
control replacement, late nested links, history-tab repair and signed-out
cleanup. Existing tests cover real state changes, pagination, failed writes,
duplicate actions and account boundaries.

## Installed-build acceptance

After the owner reloaded the extension, the previously claimed search tab still
reported 0.9.3. Reloading that tab loaded the exact packaged 0.9.4 build
`1ac8d782150e78d5c0fa54b3ff97ffc30644c5e9560488001a5194b5a7bdb8ed`
and restored its 1000 cached results. The viewport remained 2560 × 1215 CSS
pixels at devicePixelRatio 1.5.

Repeating the same four country edits (`С`, `СШ`, `США`, empty), allowing 120 ms
after each edit for the 60 ms debounce, produced **zero** `aria-busy` writes,
compared with 4000 on 0.9.3. Card identities, watched/watching classes, action
states and accessible descriptions matched their pre-input snapshot for all
1000 cards. All 1000 watched actions remained present and none was busy.

The country field was restored to empty, Escape closed the dropdown and focus
remained on the field. No search was submitted or account mark changed. The
temporary observer and page property were removed. No warning/error entries
were captured during the measurement interval. A local, ignored screenshot
records the installed result at `.scratch/optimize-2026-11-04/installed-094.png`.

This verifies the specific search-input regression in the installed desktop
Chrome. It does not establish INP, frame-rate or network-speed improvements, or
native toolbar-panel interaction and panel/worker build matching. See
[verification history](verification-history.md) and the unchanged
[native Chrome access limitation](chrome-access-status.md).
