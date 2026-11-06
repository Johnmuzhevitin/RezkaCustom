# Title exclusions

Since 0.12.0, advanced search can explicitly include **Мой список → Исключённые**. Matching exclusions become visible only in that search root, where the card action restores them. Native lists continue hiding excluded titles, and clearing the condition restores normal search hiding. See [search.md](search.md) for conditions and live updates.

Version 0.11.0 adds a red cross immediately left of the watched action on native catalogue and advanced-search cards. Hover or keyboard focus reveals both controls. Signed-out cards retain the cross. Excluding a title hides all its supported list appearances, including later DOM insertions and search shadow-root results, without changing Rezka history or MyShows marks. Direct title navigation and playback remain available.

The page notice offers **«Отменить»** and remains until dismissed or replaced by the next result. Since 0.11.1, management lives on Rezka under **«Настройки профиля → Исключения»**, beside **«Настройки сайта и плеера»**. The extension panel no longer exposes the list. The tab offers title search, a visible count and a **«Вернуть»** action for each title. Empty, loading and storage-failure states are explicit, including an in-place retry. Keyboard focus moves to Undo after the selected card disappears and to the next recovery action when a list row is restored.

## Storage and boundaries

`exclusions.js` owns independent `rc-excluded:v1:<title-id>` records in `chrome.storage.local`. Each record contains only version, numeric title ID and a bounded display title. Separate keys avoid losing unrelated additions from concurrent tabs. `storage.onChanged` updates loaded pages and the profile tab; changes received during the initial read override its snapshot. Names are rendered as text. No new permissions or remote requests are added. The implementation follows the official [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

Exclusions are local to this extension installation, shared across its supported mirrors and available without a site account. The profile tab requires access to the site's own settings screen; moving the interface there does not store the records on Rezka's servers or introduce account/device synchronization. Existing records retain their exact keys and values, without migration. They persist across page/browser restarts, but uninstalling the extension removes them. The current settings-backup format does not include them; the backup dialog states this boundary.

`exclusions-profile.js` recognizes the native owner-settings form and navigation rather than a particular numeric user URL. `/settings/` and `/settings/personality/` may redirect to `/user/<id>/…`. The extra link uses `#rc-exclusions=1`, supports direct navigation/reload and Back/Forward, and temporarily hides only the native form content. Its list and search are outside the native POST form; restoring a title never submits profile settings. Returning through the previously active native tab preserves unsaved form values. Other native tabs retain their normal navigation. Public profiles without that settings structure remain unchanged.

`exclusions-site.js` hides recognized card/list containers and falls back to individual title links. It rechecks URL changes, inserted content and removed controls, ignoring unrelated player clock changes. `watched.js` excludes these titles from visible history-tab counts. Advanced search retains its candidates/cache so restoring a title can reveal it immediately, but excludes hidden titles from the result count and empty-state calculation. Native site pagination remains unchanged and may show fewer cards on a page.

## Direction contract

THESIS: Extend existing catalogue actions with a persistent, reversible exclusion.

OWN-WORLD: Preserve native posters, typography, 26px actions and site feedback colors. The red cross expresses removal; profile recovery inherits native settings navigation and the light/dark site palette.

STORY: Exclude once, stop encountering the title in lists, recover mistakes immediately or later in the site's profile settings.

FIRST VIEWPORT: The cross sits beside the existing check at the poster's upper-right edge. The result notice sits at the lower right. Profile settings gain an Exclusions tab immediately after site/player settings, with a heading, scope description, search, count and flat list of title/restore rows. The extension panel keeps its three existing tabs.

FORM: Local extension of established Operate surfaces; no visual-world change or concept roll.

FINISH: Offline DOM/storage checks and packaging must pass. Installed-Chrome acceptance covers the native profile tab after the owner reloads the completed build; report unavailable checks explicitly.

## Current verification — 0.11.1, 2026-11-06

- Packaged 0.11.1, build `887ca0cda5cfb24b046b6ad7df1179b3782bd96bd4683d7b9650708246e093c0`. The final package gate passed all 293 Node tests and shipped-JavaScript syntax checks; no disposable browser was launched.
- Focused DOM contracts cover the native settings structure, placement outside the POST form, preservation of unsaved native values, direct hash navigation and Back/Forward, search/recovery, read failure and retry, and the absence of controls on ordinary public profiles. The panel contract verifies removal of the old list while retaining existing exclusion records.
- Independent source and documentation review found no material regression. The existing design-system files were preserved.
- The owner confirmed that only management should move to the site, while storage remains local, and reloaded the installed extension. The existing Chrome profile-settings page then reported the exact full packaged build ID. Its native Exclusions tab appeared beside site/player settings and displayed all four existing owner records.
- At the owner's normal desktop size and display scale, the dark-theme list had no horizontal overflow; recovery controls measured 44 CSS pixels high, and the existing long title wrapped without overlapping its button. The representative screenshot was inspected inline in the verification chat. Search covered matching and empty results; native-tab switching, Back/Forward and a reload with the exclusion hash all displayed the expected view.
- A temporary catalogue tab in the same installed Chrome profile excluded a previously visible title using Space. The profile list immediately changed from four to five records and retained the extra record after reload. Case-insensitive search found it; Enter on its recovery button restored the catalogue card without a catalogue reload and moved focus to the profile search field. The final list exactly matched the original four record IDs. The search was cleared and the temporary catalogue tab closed; native profile settings were not submitted.
- The five recent captured page errors were site-owned `j/andt.js` fetch failures. No extension error appeared in that bounded capture; Chrome's extension error history was not inspected. Native toolbar removal/build matching, light-theme rendering and real screen-reader announcements remain unverified in installed Chrome; their source/DOM coverage is supplementary evidence only.

## Previous verification — 0.11.0, 2026-11-06

- Packaged 0.11.0, build `f71fb3d4dcdc0fad90d707f34acde4cf2460b3364f101fae97b7a0f36f3643fd`. The final package gate passed all 290 Node tests and shipped-JavaScript syntax checks; no disposable browser was launched.
- Independent source review resolved activation-key isolation from player shortcuts, close-button focus recovery, persistent live-region placement and inherited toast typography. The existing design-system files were preserved.
- After the owner reloaded the extension, the existing Chrome catalogue page was reloaded and its full build ID matched the package. Normal desktop size/display scale were preserved. Both actions measured 26×26 CSS pixels, with the cross immediately left of the checkmark. The final screenshot was inspected inline in the verification chat.
- A temporary exclusion was activated with Space on a visible catalogue title. The title disappeared from the catalogue and another existing catalogue tab. A temporary advanced-search tab showed the excluded title with `display:none`, kept a distinct matching title visible, and reported one visible result. Reloading this search tab preserved the exclusion. Enter on the original page's Undo restored the title in catalogue and search and changed the search count to two. Closing the notice returned focus to a visible card; Shift+Tab exposed both actions. The temporary exclusion was removed, the verification tab was closed, and unrelated owner exclusions were preserved.
- The captured page console contained site-owned `j/andt.js` fetch errors, including pre-reload records; no extension error appeared in that captured log. Chrome's extension error history was not inspected.
- Remaining acceptance limits: the actual toolbar panel and its recovery controls, panel/worker build matching, real screen-reader announcements, and the full range of native list routes were not directly verified. The documented native-panel access blocker remains in effect; no workaround or disposable profile was used.
