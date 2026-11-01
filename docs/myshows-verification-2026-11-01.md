# MyShows single-episode verification

This privacy-safe summary retains the integration findings from the authorized feasibility check. Account details, media titles, episode identifiers, viewing dates, record IDs, request payloads and screenshots are excluded.

## Result

The official Scrobble API accepted an exact episode match but left the history record pending. Activating the native confirmation control for that exact record saved the final watched mark. Both the approved record and watched checkbox survived reloads.

The probe establishes a two-step route through an authenticated MyShows page. It does not establish that the personal API token alone can call internal website endpoints, or that every media type and matching case works.

## Extension requirements

- Treat API submission, pending approval, approval and verified watched state as separate states.
- Match a unique source, account, media type and object before using the native confirmation control.
- Reconcile interrupted requests before resending them; do not alter unrelated records.
- Use synthetic records in regression fixtures. Keep credentials in extension-owned storage, outside repository files and diagnostics.

The observed website handler used `scrobble.SetStatus`. This is an internal website operation, not a documented public Scrobble API contract. The production adapter uses the site's native control and verifies the resulting watch state.

See [MyShows integration](myshows-integration.md) for the implementation and its limits, and the [official API documentation](https://myshowsme.github.io/myshows-scrobbler-api/llms-full.txt) for public request contracts.
