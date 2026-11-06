# Native Chrome access status

Read this when Windows Computer Use cannot determine the current browser URL confidently. The detailed investigation is [Chrome access diagnosis](chrome-access-diagnosis-2026-10-30.md); its locale hypothesis is plausible, not a confirmed cause of every later failure.

## Latest attempt

- Date: 2026-11-04; timezone Asia/Novosibirsk; exact local time not recorded.
- Target: the user's existing Chrome, with Rezka and its installed side panel.
- Change tested: the owner reloaded extension 0.9.1 and Rezka, then explicitly requested a new installed-panel check. No native-helper correction was established; its exact installed version is unknown.
- Action: the bundled Computer Use skill (26.1027.51404), using `@oai/sky` in `node_repl`. `sky.list_apps` and `sky.get_window` returned the existing Chrome window; `sky.get_window_state` requested its screenshot and accessibility state.
- Result: state capture stopped the turn before returning either because it could not determine the browser URL confidently. No fallback controller was used after the stop.
- Installed-panel acceptance: a later owner-supplied screenshot shows compact history and footer 0.9.1 `6acba243`, matching the packaged build prefix. The owner confirmed deletion and persistence after reopening the panel. Direct agent interaction, keyboard checks and full panel/worker/page build matching remain unverified. See [verification history](verification-history.md).
- No helper, language, permission, safety check or browser profile was modified. No supported native attempt has succeeded since the diagnosis.

The previous attempt on 2026-11-01 also stopped at URL detection after the owner made the address bar visible and selected its address with Ctrl+L. That browser-connector page read showed build 0.6.5 `d6fa78c2` only; it did not establish the panel or worker build. Neither address selection nor an extension reload is evidence of a native-helper fix.

## Separate browser-connector management check — 2026-11-04

During the 0.9.9 black-video fix, the supported browser connector could inspect and operate the existing Chrome Rezka pages. Opening `chrome://extensions` to load the completed package was denied by the browser URL policy, which permits only HTTP/HTTPS. The owner performed the requested reload; the connector then verified the exact packaged page build `5d60f158d8db0e7083f6e801467d6179b29ea562491c44471f1548c4ff77194a` and restored video. The agent did not try an alternate controller, raw CDP or indirect execution for extension management. This is separate from the native-helper URL-confidence failure above and does not establish a native-helper correction or panel/worker acceptance.

## Next attempt

1. Read the investigation's confidence limits and this latest result. Compare any known tool/component update with the recorded environment; record unknown versions as unknown.
2. State what changed and what the attempt will establish. An explicit user request can initiate a new supported check; reloading Rezka alone does not establish that native URL detection changed.
3. Use the documented browser/native interfaces and their access checks. If the tool stops the turn, stop as instructed; do not switch controllers to reach the refused surface.
4. Record the result here when work can resume. Keep the version, changed condition and outcome together. Move superseded detail to verification history if needed.
5. Continue authorized offline or disposable-browser work when tool instructions permit it. Distinguish those results from acceptance in the installed profile. A copied diagnostic report establishes state, not visual correctness.

An official native-helper correction or newly available supported diagnostic evidence would justify testing the locale hypothesis again. This project cannot patch the signed helper or certify its internal cause.
