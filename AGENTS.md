# Interface scope

- Target desktop Chrome at the user's normal window size and current display scale, including the extension's normal popup/side panel.
- Mobile and deliberately narrowed browser layouts are opt-in: implement, test or audit them only when the user explicitly requests this scope. Exclude them from default audit scores, release criteria and lists of unverified work.

# Browser verification

- For source ownership, build/packaging changes or verification after an extension update, read [docs/development.md](docs/development.md).
- For a native Chrome URL-confidence failure, read [the known blocker and latest attempt](docs/chrome-access-status.md) before planning another attempt.

- Test the interface in the user's existing Chrome browser and installed extension, including the real toolbar popup at the user's current display scale.
- Do not substitute a disposable browser profile or a fixed-size preview for this acceptance check. Existing fixture-based browser tests are supplementary and may only be run with the user's explicit permission to use a separate browser.
- Offline build, syntax and Node contract checks may run normally. If browser access is blocked, complete the code work and report which browser checks remain unverified.
