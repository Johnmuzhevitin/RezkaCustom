# MyShows rejected submissions and cancellation

## Reproduction and cause

An installed 0.6.1 journal showed one episode first rejected by MyShows, followed by repeated history checks and a page-unavailable message. the cancelled episode had the same rejection and was subsequently cancelled by the user. The current-episode panel still described that cancelled episode as already synchronizing.

A same-origin request in the user's existing signed-in Chrome reproduced the original payload's HTTP 400 response: `{"error":"validation failed: map[sourceApp:len]"}`. The source identifier was 51 characters long. The worker had saved submission intent before the request but failed to clear it on definite rejection; retries therefore searched for a record the API had never accepted. Waiting for complete tab loading also rejected usable documents whose unrelated resources were still loading.

The actual maximum source length was not established. The new format uses 28 characters, preserving all UUID bits, and was accepted by the live API.

## Regression checks

The initial focused command was:

```powershell
node --test --test-name-pattern='generated source fits|definite validation rejection|ready content scripts' tests/myshows.test.mjs
```

All three checks failed before the fix: a generated source reached attention instead of done, a rejected request retained `submittedAt`, and a ready content script could not proceed while the tab was loading. All passed after the changes. Additional checks cover full UUID preservation and legacy recovery without resending cancelled or uncertain records.

Cancellation checks reproduce stopping an in-flight POST, restoring measured tracking after a cancelled manual request, and the misleading current-episode label. The fixed worker preserves cancellation across late success, rejection, rate-limit and history-check responses. The UI offers tracking recovery only for unsent entries. The focused MyShows and panel suites passed all 50 checks before packaging.

## Live repair and limits

In the user's existing Chrome, the corrected payload for the affected episode returned HTTP 200 with `action=scrobble`, `match=exact`, `objectType=episode`. The actual revised site adapter then clicked that unique source's native confirmation button automatically. On a freshly opened episode page, the same adapter returned `watched:true`, and the visible page showed the viewing date. Only after verification was the local affected-episode journal entry set to done, preserving its earlier transition history. the cancelled episode remained cancelled and was not submitted again.

This was a live API and revised-adapter check, using a targeted diagnostic invocation while Chrome still had 0.6.1 installed. It is not acceptance of the packaged 0.6.2 worker or side-panel controls. Those require reloading the extension and site, matching the final package build ID, and checking the actual Chrome side panel. Native Chrome management access was unavailable because computer control could not reliably identify the browser URL. No disposable browser was used.

Tokens were used only in the existing MyShows context and were not printed or saved in project files. No diagnostic instrumentation was added to shipped scripts. The final package result is recorded in [verification history](verification-history.md).

Fresh MyShows episode page after automatic confirmation (local-only evidence)
