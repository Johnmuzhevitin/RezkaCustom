# Historical verification records

This publication summary omits personal browser sessions, viewing-history details, account-specific requests and screenshots. See [development.md](development.md) for the current workflow.

## Watched-card request latency — 2026-11-02

Version 0.7.2, build `dc3fab91580fb25e8697e1ff72ab571b0203d4567f2c6b908578bd5a4b25db91`, passed all 170 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`.

## Multipart-film watched action — 2026-11-02

Version 0.7.2, build `a5949e18f57f6890ac08e1ba1b8a950cb540b11dfdf621903ffbca1da265cb64`, passed all 167 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The focused watched suites passed all 25 checks.

## Keep completed history readable — 2026-11-02

Version 0.7.2, build `a6903231fe33d0c2d14c6ea9bb4731eb0deb62b4fae0a2ca01510632d7263bfe`, passed all 166 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`.

## Watching and completed history tabs — 2026-11-02

Version 0.7.2, build `39a0c13261f5ef6f3dce7e0b4126f2d4da34f36126a647322c9108f59ff5c983`, passed all 166 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The focused watched-state suite passed all 17 checks.

## MyShows journal icon controls — 2026-11-02

Version 0.7.2, build `b95710608335fdd23e363ed5f7b69fd119ce2418ddfc95080c4385f40c4254d3`, passed all 162 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. All 31 panel checks also passed separately.

## Compact MyShows journal — 2026-11-02

Version 0.7.2, build `2503920c56d2b1efd1dfa2b58290f745abab7480fdfa3170c3973e245b3edc5e`, passed all 161 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The existing 30 panel checks also passed separately, including retained history disclosure, keyboard focus, movie/episode links, reset controls and recovery.

## MyShows threshold slider — 2026-11-02

Version 0.7.2, build `a151b782b011b76de3d7ea51b4bf4741e43317d55516bd2f5651437a50c43872`, passed all 161 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The first restricted run passed 160 checks but could not start the Git hook shell (`NtCreateDirectoryObject` access denied); the approved ordinary Windows run passed the full gate without skips.

## Local MyShows record reset — 2026-11-02

Version 0.7.2, build `367551226c8ac6254df8ba251c391d326ccb7d0e7150ef413bbcde890fff78f1`, passed all 157 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.2.zip`. The approved ordinary Windows runner also passed the Git hook check; no test was skipped and no browser process was launched.

## MyShows native movie card repair — 2026-11-02

Version 0.7.1, build `fb9b106b452610e8353dc4b258bd1cf7357ec23c4d1e85c61325bea3f00bacd9`, passed all 152 offline tests and shipped-JavaScript syntax checks through `npm run package` in the approved ordinary Windows execution environment. Archive: `dist/rezka-custom-0.7.1.zip`. No checks were skipped and no disposable browser was launched.

## MyShows movies — 2026-11-02

Version 0.7.0, build `f3fa28f5ebb2a5a939fde4a2feb34a38fc867726b7a486ec0535ac4b6724df77`, passed all 148 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.7.0.zip`. The first restricted pass passed 147 tests but the Git for Windows hook process failed to start (`NtCreateDirectoryObject` access denied). The approved ordinary Windows packaging pass then passed the entire gate with no skipped checks.

## MyShows composition refinement — 2026-11-01

Version 0.6.7, build `7f3348d94356fc96a628724a75e35c536dc18682db60babd8b7cb206e9aa0036`, passed all 137 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.6.7.zip`. As in 0.6.6, the Git hook test could not start the Git for Windows shell in the restricted runner; the complete gate passed in the approved ordinary Windows execution environment, with no skipped checks.

## Retrospective improvements and support diagnostics — 2026-11-01

Version 0.6.6, build `84115a7feb829a174ca38b2cc6cce8db65e3604d3fb49d78ac98665e6f988f15`, passed all 137 offline tests and shipped-JavaScript syntax checks through `npm run package`. Archive: `dist/rezka-custom-0.6.6.zip`.

## MyShows panel during playback — 2026-11-01

Version 0.6.5, build `d6fa78c25b96d81d4ce1e8767c27300b48e6c0f2814e31b0e744ef84837602f8`, passed all 131 offline checks and the JavaScript syntax gate through `npm run package`. The archive is `dist/rezka-custom-0.6.5.zip`.

## MyShows progress after seeking — 2026-11-01

Version 0.6.4, build `efeae075727a05f34ebd9968a4cbbfe61e7be8eee3a5911f5c156561f679dcd8`, passed all 122 offline checks and the JavaScript syntax gate through `npm run package`. The archive is `dist/rezka-custom-0.6.4.zip`.

## Remove the filter menu section — 2026-11-01

Version 0.6.3, build `3fc5acdce6f40ace9cd16dc81b45d57a57b203f164e221e341bdaf7b2a621e28`, passed all 116 offline checks and the JavaScript syntax gate through `npm run package`. The archive is `dist/rezka-custom-0.6.3.zip`.

## MyShows rejection recovery and cancellation — 2026-11-01

Version 0.6.2, build `6a57b0bf1e695ac80cd143f887aa98e273325e79f578c044f2d833f9ec46a9d0`, passed all 115 offline checks and the JavaScript syntax gate through `npm run package`. The resulting archive is `dist/rezka-custom-0.6.2.zip`. Regression checks cover the real source-length rejection, safe retry after definite rejection, ready content scripts in still-loading tabs, legacy recovery, preserved UUID identity, cancellation during network/history work, tracking recovery without manual completion, and the cancelled current-episode UI.

## MyShows manual episode marks — 2026-11-01

Version 0.6.1, build `97f77f9c3c99f063b7697bee0972a96314bbc7ab9cf2a9ddd5ba26ef9d403620`, passed all 106 offline checks and the JavaScript syntax gate through `npm run package`. The resulting archive is `dist/rezka-custom-0.6.1.zip`. New checks cover current-episode reads before playback, manual threshold bypass with automatic sync off, preserving measured progress, independent queue processing, repeated clicks, stale episode/tab rejection, account isolation, cancelled-entry recovery, uncertain-write protection and manual control states.

## Development workflow improvements — 2026-10-31

Version 0.5.2, build `1889e5bc61e51c4f4777af1fb2af2ac0184e9d710ce7cf0b908f4bbf3c5fa376`, passed 79 offline checks through the package gate. The archive's build identity matched the verified directory. The gate's integration check confirmed that a deliberately failing test or invalid shipped JavaScript preserves an existing archive, and that an empty suite fails.

## Verification boundary

Offline tests and source checks do not establish acceptance in the installed Chrome extension. Native toolbar/panel verification remains subject to the [recorded access blocker](chrome-access-status.md). Account-specific evidence is retained only outside version control.
