# Rezka Custom

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the project's owner, watching films and series on Rezka in their everyday desktop Chrome profile. Daily convenience takes priority over introducing the product to a broad audience. Support for a public audience or distribution beyond personal use has not been established.

For MyShows, the primary situation is opening the extension during playback to identify the current episode, understand the credited percentage, and manually count the episode when needed. Investigating failures and reviewing synchronization history remain supporting jobs.

These priorities were confirmed by the user on 2026-11-01.

## Product Purpose

Rezka Custom adapts the site's appearance, player, catalogue and controls to the owner's viewing habits. It is a standalone Chromium extension derived from the owner's existing HDrezka Improvement userscript.

MyShows synchronization removes the routine work of marking individual watched episodes on a second site. Success means the owner can keep watching, understand what progress has been credited, see whether a mark has actually succeeded, and recover from an accidental request or a failure.

## Operating Context

- The toolbar icon opens the browser's persistent side panel alongside the current site. The panel follows the active tab in its window.
- The acceptance environment is the user's existing desktop Chrome at their normal window size and display scale, including the actual toolbar-opened panel. Mobile and deliberately narrowed layouts are outside the default scope.
- The owner sometimes seeks within an episode or resumes from a saved position. Credited progress must account for this established viewing behavior.
- Settings save immediately. An automatic page reload must not interrupt playback; a required reload is an explicit user action.
- Advanced search is a separate site feature for finding films and series. The user removed the redundant country-filter section from the extension menu.
- The current extension is installed locally. Updating its files requires reloading the extension and the affected site page; a package build alone does not update already-running pages.

## Capabilities and Constraints

### Extension scope

The existing panel provides appearance, player and MyShows sections. Advertising switches and comment collapsing are part of appearance. The extension also supplies advanced search and whole-title watched actions on Rezka. MyShows episode marks and Rezka's whole-title watched state are separate concepts.

Preserve the established player and search workflows while improving MyShows. The existing implementation and [development guide](docs/development.md) define supported site contexts and source ownership.

### MyShows workflow

- Connection is opt-in and tied to the user's MyShows account. The existing integration requires MyShows sign-in in the same Chrome profile and access to its scrobbling feature.
- Automatic marks use a completion-threshold slider from 1% to 100% in 1% steps, with 90% as the default.
- Credited progress is the greater of unique played coverage and the furthest player position confirmed by 30 seconds of actual playback after seeking or resuming. A seek alone is insufficient. Pauses and buffering add no confirmation time; another seek restarts that confirmation. Rewinding does not reduce saved progress.
- The credited percentage is not always the percentage of footage actually played. User-facing explanations must preserve that distinction.
- The owner can use **«Засчитать серию»** to request a mark before reaching the threshold, including when automatic marks are off. The request retains the normal account, episode-match and result-verification checks.
- A persistent local queue and history distinguish viewing progress, pending work, problems needing attention, successful marks and cancelled work. Both automatic and manual requests remain understandable in the journal.
- Cancellation stops further synchronization work. It does not undo a mark already applied on MyShows. A request already sent can still finish remotely, so its outcome must not be presented as certainly absent.
- Cancelled work that was not submitted can resume ordinary tracking. An uncertain submitted request must be reconciled before any resend.
- A successful status requires verification of the episode's watched state. Ambiguous matches or uncertain outcomes must remain visible rather than being reported as success.
- Queue and history survive normal browser restarts and remain associated with their original account. The journal is a record of synchronization results, not a live mirror of later manual changes on MyShows.

The [integration reference](docs/myshows-integration.md) owns detailed state transitions, supported players, retry behavior and service limitations. These constraints are established behavior, not authorization to expand the feature set during design work.

### Privacy and storage

Settings and the synchronization journal are local to the extension. The MyShows token is kept separately in extension-origin IndexedDB and must not appear in interface state, logs, source files or screenshots. The product has no added analytics service or cloud backup of its local journal.

## Brand Commitments

The established product name is **Rezka Custom**. Product interface text is Russian, with familiar action labels and explicit outcomes. Preserve technical identifiers, service names and URLs where needed. The existing visual identity is documented separately in [DESIGN.md](DESIGN.md); this product record does not select a replacement identity.

## Evidence on Hand

- The owner's explicit requirements and reported failures establish the need for automatic marks, a queue and history, manual completion, cancellation and seek-aware progress.
- [README.md](README.md) records the existing extension capabilities and installation workflow.
- [MyShows feasibility verification](docs/myshows-verification-2026-11-01.md) and [the live repair investigation](docs/myshows-fix-2026-11-01.md) record real service observations. Their results apply to the specific flows tested, not every later build.
- [Verification history](docs/verification-history.md) separates offline checks from acceptance in the installed browser. Offline check totals and build identities are recorded per release there; current installed-browser acceptance requires reloading and matching the packaged build.
- User-provided screenshots show real use and failure states. They are historical evidence, not proof of the current installed build.

No broader audience research, public adoption claims or service reliability guarantees have been established.

## Product Principles

1. Support daily viewing with minimal interruption and routine manual work.
2. Make the current episode and credited progress understandable during playback.
3. Keep deliberate manual control and recovery available alongside automation.
4. Distinguish requested, uncertain, cancelled and verified outcomes honestly.
5. Preserve account boundaries, local history and existing viewing behavior when changing the interface.

## Open Decisions

The user selected all five critique recommendations on 2026-11-01 and explicitly requested implementation: a unified current-episode context, honest and current status feedback, recovery in place, stable keyboard focus, a live confirmation countdown, and search across the entire journal. Broader distribution and additional product capabilities remain undecided.
