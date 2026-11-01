# Native Chrome access status

Read this when Windows Computer Use cannot determine the current browser URL confidently. The detailed investigation is [Chrome access diagnosis](chrome-access-diagnosis-2026-10-30.md); its locale hypothesis is plausible, not a confirmed cause of every later failure.

## Latest attempt

- Date: 2026-11-01; local time and timezone omitted.
- Target: the user's existing Chrome, with Rezka and its installed side panel.
- Change tested: the user made the address bar visible and selected the address with Ctrl+L. The page reported no fullscreen element before this attempt.
- Action: the supported native `cua.getApp` window binding.
- Result: the tool again stopped before returning window state because it could not determine the URL confidently. Visible/selected address text did not restore access.
- Browser connector: could read the existing Rezka tab; its page build was 0.6.5 `d6fa78c2`. This does not establish the panel or worker build.
- Installed-panel acceptance: blocked. The authorized disposable Chromium checks passed separately; see [verification history](verification-history.md).
- No helper, language, permission, safety check or browser profile was modified. No supported native attempt has succeeded since the diagnosis.

## Next attempt

1. Read the investigation's confidence limits and this latest result. Compare any known tool/component update with the recorded environment; record unknown versions as unknown.
2. State what changed and what the attempt will establish. An explicit user request can initiate a new supported check; reloading Rezka alone does not establish that native URL detection changed.
3. Use the documented browser/native interfaces and their access checks. If the tool stops the turn, stop as instructed; do not switch controllers to reach the refused surface.
4. Record the result here when work can resume. Keep the version, changed condition and outcome together. Move superseded detail to verification history if needed.
5. Continue authorized offline or disposable-browser work when tool instructions permit it. Distinguish those results from acceptance in the installed profile. A copied diagnostic report establishes state, not visual correctness.

An official native-helper correction or newly available supported diagnostic evidence would justify testing the locale hypothesis again. This project cannot patch the signed helper or certify its internal cause.
