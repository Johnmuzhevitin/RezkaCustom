# Local backup and restore

Version 0.10.0 adds **«Резервная копия»** beside Help in the existing settings side panel. It works without an open Rezka page or a network request. The native dialog follows the panel's light colors, Segoe UI typography, existing control radii and focus outline. Export and restore share one vertically scrolling surface; the three main navigation tabs are unchanged.

## Included data

- All 18 active appearance/player/search settings, including their effective defaults when no value has been saved. Version 0.12.1 adds the search candidate limit; older backups without it leave the current preference unchanged.
- Favorite voice IDs whose local record is `true`.
- Named version-2 search filter sets, including their sort choice and nested conditions. The title query is not part of a saved set.

MyShows credentials, configuration, account, queue, progress and journal are excluded, as are Rezka viewing history, title exclusions added in 0.11.0, cached data, panel navigation preferences, retired settings and the hidden legacy country-filter controls. The exporter never opens the credential database and projects only the supported fields from local storage. Saved-set validation also removes unrelated properties from exported records.

## Restore behavior

Choosing a file only reads and validates it. The preview shows its name, creation date, extension version and the available section counts. Nonempty sections start selected; missing/empty sections cannot be selected. **«Восстановить выбранное»** is disabled until a nonempty section is selected.

Selected settings present in the file overwrite their current values. Favorite voices are added. Filter sets with an existing ID are updated; other sets are added. A matching display name with a different ID is a separate set. Nothing absent from the selected data is deleted, and unselected sections stay untouched. Repeating the import is idempotent. This is a merge, not a factory reset or an exact replacement of every local record.

The worker validates the complete file again before writing. Import shares the normal settings-write queue and commits all selected keys with one `storage.local.set`; it never calls `clear` or removes unrelated keys. Export waits behind queued settings changes too. Storage errors keep the preview available for retry; disconnected replies do not claim a confirmed restore. Closing the panel cannot cancel an already submitted worker operation.

Existing site pages receive settings and voice changes through their storage listeners. Open advanced-search pages refresh the saved-set selector without changing typed filters or starting a search. Reload-only settings wait for the existing explicit **«Обновить страницу»** action; restore does not reload tabs or interrupt playback.

## File contract

The JSON envelope uses `format: "rezka-custom-backup"`, `version: 1`, an ISO `exportedAt`, the numeric `extensionVersion`, and `sections`. Supported section names are `settings` (setting name to allowed value), `voiceFavorites` (numeric string IDs), and `searchPresets` (validated version-2 saved records). At least one section must be present; sections may be empty. The import limit is 2 MiB of UTF-8, 1000 voice IDs and 500 filter sets. Existing search-rule depth, field, range and node limits apply.

Malformed JSON, unsupported versions/sections/settings, invalid values and duplicate IDs reject the whole import before storage changes. Filenames and metadata render as text. Both preview and import are restricted to the same-extension `popup.html` sender. The browser saves an `application/json` Blob using a temporary download link; no new extension permission, dependency, remote service or credential access is added.

Chrome contracts were checked against the official [extension samples](https://github.com/GoogleChrome/chrome-extensions-samples) through GitMCP, then the official [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) and [message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) documentation. The listener returns literal `true` for compatibility with the project's minimum Chrome version.

## Verification

Offline contracts cover secret exclusion, default/false values, round-trip validation, selective merging, repeated imports, malformed/oversized files, sender boundaries, write ordering and failures. DOM checks cover preview, section selection, empty states, escaped filenames, stale replies, modal key isolation, focus return, download Blob contents and retry. They do not establish actual Chrome rendering, OS file selection or a completed browser download.

Installed-toolbar acceptance remains subject to the [known native Chrome access limitation](chrome-access-status.md). No separate browser/profile is authorized for this task. The packaged version and final offline result are recorded in [verification-history.md](verification-history.md).
