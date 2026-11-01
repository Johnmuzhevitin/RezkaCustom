# Third-party notices

## HDrezka Improvement 2.1.8

- Author recorded in the supplied source: **rub4ek**.
- Source: https://greasyfork.org/scripts/425494-hdrezka-improvement
- The baseline was supplied by the user from their installed Tampermonkey script.
- The source metadata declares **MIT**. The license text is included in `licenses/HDrezka-Improvement-MIT.txt`.
- Adaptations: extension API compatibility, a fixed player-command bridge, a hostname guard, removal of the userscript-update entry point, and the version 0.2 browser-popup settings interface. Feature implementations and stored option values are retained; popup labels are rewritten for clarity.

## Bundled R4 libraries

These files were downloaded from the exact pinned `@require` URLs in that baseline:

| Library | Version | Source |
| --- | --- | --- |
| R4 Fonts | 1.6.0 | https://update.greasyfork.org/scripts/482037/1298684/R4%20Fonts.js |
| R4 Images | 1.0.0 | https://update.greasyfork.org/scripts/482042/1298685/R4%20Images.js |
| R4 Utils | 1.0.1 | https://update.greasyfork.org/scripts/482597/1301960/R4%20Utils.js |
| R4 Settings | 1.4.10 | https://update.greasyfork.org/scripts/482052/1854095/R4%20Settings.js |

The library headers do not declare a license. The R4 Images and R4 Settings listing pages show their author as **Oleksii Smith** and their license as **N/A**. This project does **not** claim that the main userscript's MIT declaration automatically licenses those separate libraries or their embedded font/image assets. Clarify their redistribution terms before publishing or distributing this bundle to other users. They are included here to reproduce the user's existing local installation.

The unused `executeLocation` implementation is removed from the shipped R4 Utils copy. The unused subtitle icon is removed from the shipped R4 Images copy. R4 Settings is instrumented with a configuration registry and lifecycle state so the side panel can reuse existing feature callbacks. Its legacy UI remains detached from the site. Unmodified copies of all four dependencies and their hashes remain in the project under `upstream/`.

## External services

OpenSubtitles integration and its application key are not included in the shipped extension as of 0.3.1. They remain only in the pinned upstream input for provenance. The extension has no affiliation with HDrezka, Tampermonkey or IMDb.
