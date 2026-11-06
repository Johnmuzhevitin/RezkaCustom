# Player voice selection

## Interaction

The owner approved a compact current-voice control above the player, an equivalent fullscreen entry, search, and global local favorites. The menu inherits the dark player surface. Opening, searching and favoriting do not change playback. A check identifies the current voice; an independent star identifies a favorite. The menu lists the current title's native voice entries; entries marked disabled by the site remain visible but cannot be selected. Favorites precede the remaining voices without appearing again in the second group, preserving native order within each group. No automatic voice selection is performed.

The menu uses a nonmodal native popover, a bounded scrolling list, explicit empty/error feedback and keyboard focus. Search matches names and language labels without case sensitivity, treating Russian е/ё equivalently. Escape closes the menu; arrow keys navigate voice choices without reaching player shortcuts. Favorite records use independent `chrome.storage.local` keys `rezka:voice-favorite:<translator_id>` and update across tabs. A studio's variants share its favorite preference while each variant remains a separate selectable voice.

## Integration boundary

- `voice-menu.js` runs in the isolated content-script world. It owns rendering, favorites and bounded request/result messages. Raw stream URLs never cross this message boundary.
- `voice-switch.js` runs in the MAIN world and owns native integration. It reads the current post, translator and episode from native DOM/initializer metadata, without evaluating fetched code.
- A series change first requests `get_episodes` on the current origin's `ajax/get_cdn_series/`, with the requested translator and current season/episode. The response must contain that exact episode. A separate `get_stream` request obtains that episode's stream. Failed, restricted, missing or stale responses leave the player untouched.
- Movies use the native `get_movie` request, including the chosen camrip/ads/director variant flags.
- The commit invokes the site's native translator click handler so its private translator/episode, autosave and next-episode state stay coherent. For the duration of that synchronous click only, a narrowly matched `sof.ajax` call receives the already validated response. Both temporary method wrappers are restored in `finally`. No remote script is executed or persistent native method hook installed.
- The observed native series handler selects the first returned episode. The adapter supplies the validated current episode first during that synchronous commit, then restores natural season/episode order before the next paint. Returned controls are rebuilt as inert numeric DOM controls rather than inserting arbitrary server markup.
- Playback position and playing/paused state are sampled immediately before commit. PlayerJS `play`, `seek`, `pause` and the matching getters restore them. A paused stream is started muted while metadata/seek completes, then paused and its original mute state restored. Position is bounded by the new stream's duration. Alternate edits can have different scene timing even at the same timestamp.
- Requests are serialized and bounded. A context change during preflight invalidates the response. Post-commit playback failure is reported honestly rather than claiming the old stream is still active.

The public PlayerJS command reference is [Commands and requests JS API](https://playerjs.com/docs/en=apicommands). Rezka's native handler contract was inspected on 2026-11-03 in the user's existing Chrome. It is site-owned behavior and may require adaptation if Rezka changes its implementation.

## Verification

Offline checks cover absent episodes, exact episode/time/play-pause preservation, stale responses, concurrent requests, restricted/malformed responses, inert markup, search/favorites/focus, and in-place errors. These are behavior/DOM checks, not rendering or real-media guarantees.

Live development verification used the user's existing desktop Chrome, its installed extension context and actual player. The adapter preserved the selected season/episode and ~410-second position during paused and playing switches. A voice without the current episode left the original selection and paused position unchanged. Test favorites were removed and the original voice restored. Fullscreen placement uses the observed `#oframecdnplayer` fullscreen element and keeps the menu inside that element. Packaged/installed build acceptance is recorded separately in `verification-history.md`.
