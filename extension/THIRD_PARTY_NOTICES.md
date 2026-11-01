# Third-party notices

## HDrezka Improvement 2.1.8

- Author recorded in the supplied source: **rub4ek**.
- Source: https://greasyfork.org/scripts/425494-hdrezka-improvement
- The baseline was supplied by the user from their installed Tampermonkey script.
- The source metadata declares **MIT**. The license text is included in `licenses/HDrezka-Improvement-MIT.txt`.
- Adaptations: extension API compatibility, a fixed player-command bridge, a hostname guard, and removal of the userscript-update entry point. Original feature code and wording are otherwise retained.

## Bundled R4 libraries

These files were downloaded from the exact pinned `@require` URLs in that baseline:

| Library | Version | Source |
| --- | --- | --- |
| R4 Fonts | 1.6.0 | https://update.greasyfork.org/scripts/482037/1298684/R4%20Fonts.js |
| R4 Images | 1.0.0 | https://update.greasyfork.org/scripts/482042/1298685/R4%20Images.js |
| R4 Utils | 1.0.1 | https://update.greasyfork.org/scripts/482597/1301960/R4%20Utils.js |
| R4 Settings | 1.4.10 | https://update.greasyfork.org/scripts/482052/1854095/R4%20Settings.js |

The library headers do not declare a license. The R4 Images and R4 Settings listing pages show their author as **Oleksii Smith** and their license as **N/A**. This project does **not** claim that the main userscript's MIT declaration automatically licenses those separate libraries or their embedded font/image assets. Clarify their redistribution terms before publishing or distributing this bundle to other users. They are included here to reproduce the user's existing local installation.

The unused `executeLocation` implementation is removed from the shipped R4 Utils copy. Unmodified copies of all four dependencies and their hashes remain in the project under `upstream/`.

## External services

OpenSubtitles integration retains the application key embedded in the supplied public script, for parity with that installation. It is not a user password. No claim is made to ownership of that key. A separate registered application/key should be arranged for an independently distributed release. The extension has no affiliation with HDrezka, Tampermonkey, IMDb or OpenSubtitles.
