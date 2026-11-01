# MyShows integration feasibility

Checked: 2026-11-01. The initial research below was read-only. A later, separately authorized single-episode experiment created a token and changed the selected episode's mark; see the live result immediately below. No extension implementation or specification was created.

## Subsequent live verification

The [authorized single-episode test](myshows-verification-2026-11-01.md) confirmed that the official Scrobble API alone leaves the record pending even when `/stop` returns `action: scrobble` and `match: exact`. A script then activated the native confirmation control for that exact record in the signed-in MyShows page. The website saved it through its internal `scrobble.SetStatus` operation; the approved record and final episode checkmark both survived reloads. The selected episode was left watched, as requested.

Thus **a two-step automatic flow is feasible through an authenticated MyShows page**. A token-only, tab-free implementation is not established, and this is not yet an installed Rezka Custom feature. Sections below preserve the initial research and its then-unverified observations; the linked live test supersedes those observations for the one tested account and episode.

## Finding

MyShows now publishes an official **Scrobble API** specifically for players and third-party plugins. It is a credible route for sending HDrezka episode playback from this extension. Its documented authentication is a user-supplied personal token, so a new OAuth application and an embedded client secret are not prerequisites for this route. The official clients include both a desktop application and a Lampa plugin. [API introduction](https://myshowsme.github.io/myshows-scrobbler-api/en/start/introduction), [authentication](https://myshowsme.github.io/myshows-scrobbler-api/en/start/authentication), [official desktop client](https://github.com/myshowsme/myshows-scrobbler).

Two practical qualifications matter. MyShows presents scrobbling as a **PRO feature**. More importantly, the current integration settings in the user's existing Chrome explicitly say that incoming views enter the pending queue and that each must be accepted or rejected. This agrees with the initial 17 June 2026 announcement, while the API quickstart promises a watched mark without describing that confirmation step. **Automatic submission of viewing history is supported; fully automatic watched checkboxes must not be promised from the Scrobble API alone.** [Current product overview](https://myshows.me/about/), [launch announcement](https://myshows.me/news/12495/scrobbler/), [API quickstart](https://myshowsme.github.io/myshows-scrobbler-api/en/start/quickstart), [integration settings, inspected read-only](https://myshows.me/profile/watch-history/).

## Access and authentication

- Every API request uses `Authorization: Bearer <token>`. The user obtains the token from [profile / watch history](https://myshows.me/profile/watch-history/) and enters it in the client. It is account-bound and has no time expiry according to the documentation. No OAuth redirect, PKCE exchange, client registration, client ID, or client secret appears in the documented flow. [Authentication](https://myshowsme.github.io/myshows-scrobbler-api/en/start/authentication).
- `GET https://myshows.me/scrobble/check` verifies the token. The endpoint documentation says to rely on the HTTP status rather than the response body. A `401` means an invalid or revoked token. [Endpoints](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/endpoints), [errors](https://myshowsme.github.io/myshows-scrobbler-api/en/rules/errors).
- The docs require ASCII validation, no token logging, and masking after storage. Their instruction to keep credentials server-side concerns client-server applications; the documented Lampa client is a separate example of a local plugin architecture. For this extension, keeping the token in the trusted extension context and never sending it into the HDrezka page is an architectural recommendation, not a quoted MyShows storage specification. [Authentication](https://myshowsme.github.io/myshows-scrobbler-api/en/start/authentication), [official client README](https://github.com/myshowsme/myshows-scrobbler).
- The product overview places scrobbling under PRO, and the launch announcement says it is included with PRO. The reviewed API docs publish no separate per-request price. The current integration page showed a token-creation control with no visible PRO gate, but it was not activated. Actual token availability on a free account, behavior after PRO expiry, precise token permissions, rotation, and the current subscription price were not established. No free access should be promised. [Product overview](https://myshows.me/about/), [announcement](https://myshows.me/news/12495/scrobbler/), [integration settings, inspected read-only](https://myshows.me/profile/watch-history/).
- CORS response headers and requests from this installed Chrome extension were not tested. The API documentation does not specify a browser-origin policy or a special OAuth flow for browser extensions. This is a live transport check for a later authorized implementation, not evidence that a backend is required.

## Confirmed API surface

Base URL: `https://myshows.me/scrobble`. The four documented endpoints are below; all require the token. [Endpoint reference](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/endpoints).

| Endpoint | Documented purpose |
| --- | --- |
| `GET /check` | Validate the personal token. |
| `POST /start` | Open a viewing session with the current playback progress. |
| `POST /pause` | Update playback progress, including during continued playback. |
| `POST /stop` | Close the session and mark the view when progress is sufficient. |

The three POST endpoints accept the same payload shape. For a TV episode, it contains `progress` as a percentage from 0 to 100, a `show` object, and an `episode` object. `source_app` and `app_version` identify the integration and are required in practice by the usage guidance. [Request body](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/request), [usage rules](https://myshowsme.github.io/myshows-scrobbler-api/en/rules/limits).

The response documents `action` (`start`, `pause`, `scrobble`, or `checkin`), playback record `id`, registered `progress`, recognized title/episode data, and `watched_at` for `action: "scrobble"`. Therefore an HTTP success alone is weaker evidence than a recognized episode plus the documented scrobble result. This is a proposed verification criterion; actual server responses were not obtained. [Response body](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/response).

The Scrobble API does **not** document standalone catalogue search, full episode-list retrieval, readback of the user's watched history, or an undo operation. Its compatibility page explicitly says that bulk history import is absent. Do not infer a MyShows batch-history endpoint from generic Trakt/Simkl DTOs in the shared reference client. [Endpoint reference](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/endpoints), [compatibility / bulk import](https://myshowsme.github.io/myshows-scrobbler-api/en/rules/trakt-simkl).

## Recognition and episode identity

MyShows performs matching on the server. The documented IDs include `myshow` (singular, numeric, internal MyShows ID), `imdb` (`tt...` string), `tmdb` and `tvdb` (strings), numeric `kinopoisk`, and anime identifiers such as `shikimori`, `mal`, `anilist`, and `anidb`. IDs can identify the show and, where available, the episode. The ordinary episode payload uses `episode.season` plus `episode.number`. [Identifiers](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/ids), [request body](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/request).

The identifiers page explicitly permits `title` plus `year`, with season and episode for series, when no IDs exist; it calls this less reliable. There is a documentation inconsistency: the request table calls `show.ids` mandatory, while the matching guide permits a title-only fallback. The exact accepted fallback payload should therefore be tested instead of assumed. Prefer a stable ID when HDrezka provides one. A successful response exposes the recognized content, which can be checked for mismatches. [Identifiers](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/ids), [request body](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/request), [response body](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/response).

Anime needs separate attention: season boundaries can differ between catalogues. The docs accept an absolute `episode.number` without a season, advise sending available anime IDs, and discourage locally inventing a season/episode conversion. They also state that IMDb wins if IDs conflict. Specials and split seasons remain cases for representative live matching checks. [Anime matching](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/anime).

## Completion, traffic, and retries

The recommended client lifecycle is `/start`, progress updates through `/pause`, then one `/stop` once completion is reached. The recommended default is **80%**; the documentation suggests a configurable 50–95% range. If playback stops below the threshold, do not send `/stop`; the session expires by itself. After a successful stop, send nothing more for that session. The documentation does not fully define server behavior for every configurable threshold. [Lifecycle](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/lifecycle).

Progress updates should normally be 10–30 seconds apart, with no more than one `/pause` per 10 seconds per active session, and unchanged progress should be skipped. The lifecycle page also requests immediate updates on seek/pause, without resolving how those immediate events interact with the 10-second limit; an integration should avoid bursts. Send actual player progress, not an artificially inflated percentage. [Lifecycle](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/lifecycle), [usage rules](https://myshowsme.github.io/myshows-scrobbler-api/en/rules/limits).

The docs prescribe a five-second timeout and up to three attempts for network errors or `5xx`, with 1- and 2-second backoff, and no retries for `4xx`. A failed `/stop` must not be treated as success; the docs say to keep updating the session and retry stop on a later tick. No comprehensive daily quota, `429` policy, idempotency key, or duplicate-stop guarantee was found in the reviewed pages. A timeout after the server accepted a stop is therefore an unresolved duplicate/retry case. [Errors](https://myshowsme.github.io/myshows-scrobbler-api/en/rules/errors), [lifecycle](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/lifecycle).

The API accepts playback position, not a proof of how much unique footage was watched. Seeking to 80% and naturally watching 80% are different product choices for this extension. The docs do not provide an anti-seek contract; the extension should define its own completion rule while reporting honest progress. This is an inference from the request fields and lifecycle, not a confirmed MyShows guarantee.

## Important qualification: automatic marking versus pending confirmation

The current quickstart explicitly states that the episode is marked watched after its stop example, and the current response documentation describes a scrobble action with a watch timestamp. Conversely, the official 17 June 2026 announcement says the initial alpha asks users to accept, reject, or correct proposed matches, with automatic marking planned for a subsequent version. A source timestamp could not be established for the current documentation, and no later official release announcement resolving that transition was found in this research. [Quickstart](https://myshowsme.github.io/myshows-scrobbler-api/en/start/quickstart), [response](https://myshowsme.github.io/myshows-scrobbler-api/en/scrobbling/response), [announcement](https://myshows.me/news/12495/scrobbler/).

The parent agent then inspected the current integration page in the user's existing Chrome. It showed an empty token field and a token-creation button, which was not pressed. Its setup instructions explicitly say views arrive under the pending tab and require acceptance or rejection. It also links third-party players directly to the official Scrobble API documentation. This is current read-only UI evidence of the confirmation step; no token value or watch-history entries were read. [Integration settings](https://myshows.me/profile/watch-history/).

Accordingly, describe the result as **automatic submission to MyShows viewing history is feasible; the currently advertised flow still asks the user to confirm watched entries**. A fully automatic checkbox feature would need a separately verified, authorized completion mechanism or a confirmed MyShows setting/API change. Neither legacy access nor an additional site adapter was proven in this research. A later authorized live check must inspect the actual result in `/my/`, not merely an accepted HTTP request or a playback-history entry.

## Legacy API note

Older third-party integrations refer to an OAuth-based JSON-RPC API. A historical response from the official MyShows account on its support forum says API access was no longer being issued. That older response must not be treated as a ban on the separately documented current Scrobble API. This research does not recommend relying on legacy OAuth registration, undocumented website login endpoints, extracted browser sessions, or a hard-coded client secret. Legacy catalogue/write method names were not independently verified and are intentionally omitted. [Official support response](https://myshows.userecho.ru/communities/1/topics/19366-myshows-api), [current Scrobble API introduction](https://myshowsme.github.io/myshows-scrobbler-api/en/start/introduction).

## Fit with Rezka Custom

The existing extension already exposes much of the required playback information:

- `extension/page-bridge.js` permits the `time` and `duration` player commands, and `extension/player-client.js` forwards those fixed operations across the page/extension boundary.
- `extension/improvement.js` reads the original title and active season/episode. Its playback listener handles progress and source changes, and its next-episode feature already handles an `ended` event. These generated features originate in the pinned userscript and patches in `tools/build.mjs`; see [source ownership](development.md).
- A read-only observation of the existing Chrome Rezka tab confirmed numeric `data-id`, `data-season_id`, and `data-episode_id` on the active episode, `data-tab_id` on the active season, an original title, an IMDb link wrapped in a site redirect, and accessible video duration/current-time/paused properties. This validates useful inputs on one normal series page, not every mirror or player mode. Playback was not changed.
- PlayerJS officially documents `time` and `duration` getters and progress/source-change/completion events. Its current event reference calls completion `end`, whereas this extension handles the site's `ended` message; the actual event payloads and source must be checked when implementing the detector. [Commands](https://playerjs.com/docs/en=apicommands), [events](https://playerjs.com/docs/en=api).

The current watched-card feature is not an episode tracker. `extension/watched.js` and `extension/watched-site.js` act on explicit whole-title marks in Rezka's account history, deliberately without inferring completion from playback. That data cannot reliably reconstruct which individual episodes were watched. Automatic tracking of future playback and importing old history are separate capabilities; this research covers the former.

Network integration also requires deliberate changes. `extension/network-policy.js` and the worker's declarative rules currently permit the relevant Rezka origin and IMDb only. The generic request bridge accepts only content-type/accept headers and does not attach an external account token. A future MyShows integration needs a narrowly scoped worker operation that adds authentication internally, plus appropriate destination rules. Sending arbitrary authenticated URLs or exposing the token to the Rezka page would be unnecessary. The current storage and settings design should be reviewed before adding a credential.

## Engineering assessment, not an implementation specification

For the current desktop Chrome scope, playback collection plus submission to the official API is a **moderate extension feature**, with no evidence that a separate hosted server is necessary. Stable identifiers on ordinary series pages and MyShows-side matching reduce the amount of local catalogue work. The remaining effort is chiefly session tracking, safe token handling, transport checks, reporting failures, and reliable retries.

The difficult cases are seeking near the end, resuming on another day, switching episodes or translations while a response is pending, multiple tabs, specials/anime numbering, failed matching, lost network responses, and repeated views. A persisted retry must preserve the original account and episode identity. Existing whole-title dimming must retain its current meaning.

Two delivery paths differ materially:

| Path | User-visible result | Feasibility and limitation |
| --- | --- | --- |
| Official Scrobble API | Future playback automatically appears in MyShows history; the currently described site flow asks for confirmation. | Documented and a good technical fit, subject to token/PRO access and a live transport check. Does not yet establish the user's desired zero-click final checkboxes. |
| Additional automation of the signed-in MyShows interface, or a separately confirmed supported marking mechanism | Intended to complete the watched checkbox without a manual step. | Plausible engineering route, not validated here. A site adapter adds session-expiry, DOM-change and exact-episode/readback concerns; it may require a MyShows tab. Its reliability must be demonstrated before committing to this path. |

A rough engineering estimate for ordinary series, assuming working token access, is **1–2 working days for an official-API prototype and about 4–7 working days for a robust personal-use feature with focused checks**. These are judgment estimates, not measured work or delivery commitments. They exclude bulk historical import, resolving service-side access restrictions, and guaranteeing full automatic checkboxes through an untested adapter. The latter needs its own feasibility check before a useful estimate can be given.

The highest-value next investigation would be a controlled end-to-end check of one explicitly selected episode: establish token access, confirm recognition, and distinguish a pending history record from the final watched state. Account changes and implementation were not requested for this research and were not performed.

## Research provenance and limits

Research started with GitMCP. Its library mapping did not find MyShows, and its documentation/code search did not index the new documentation repository. Official web search located the MyShows-owned repositories; GitMCP successfully retrieved the reference client README, source files, individual documentation pages, and the full [published documentation text](https://myshowsme.github.io/myshows-scrobbler-api/llms-full.txt). The documentation repository identifies the desktop client as the reference implementation. [Documentation repository](https://github.com/myshowsme/myshows-scrobbler-api).

MyShows product-page evidence was available through web search, while some direct page opens returned 502 errors. The private `/my/` URL and legacy API documentation could not be fetched by the web tool. The parent agent inspected the integration settings UI read-only in the existing Chrome, as recorded above. No token, live authenticated API request, installed-extension request, or watched-state modification was used. The report records documented contracts, a current UI observation, and explicitly labeled inferences, not an end-to-end acceptance test.
