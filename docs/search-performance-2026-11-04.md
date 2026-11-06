# Advanced-search throughput — 2026-11-04

## Reproduction and evidence

The owner reported alternating slow and very fast candidate scanning. The
existing desktop Chrome tab was running a nested query involving genres, IMDb,
country exclusion and voice/translation alternatives on installed 0.9.4 build
`1ac8d782150e78d5c0fa54b3ff97ffc30644c5e9560488001a5194b5a7bdb8ed`.

A passive sample of its ongoing requests captured 97 complete title reads over
38.79 seconds. Peak concurrent detail requests: **1**. Responses ranged from
304 to 731 ms, median 367 ms, mean 383 ms. No filters, presets or results were
changed to obtain this sample. Network observation was disabled afterward; only
aggregate timings were saved locally, without URLs, headers or account data.

`node tools/benchmark-search.mjs --check` reproduced the causes using the actual
search core and synthetic HTML. Before the fix it failed: 24 cold metadata reads
required 24 serial network waves, while the same warmed query required none.
A 240-candidate repeat requested all 240 titles again because the 200-entry
cache evicted records before their next use. Expanding only the cache removed
those repeated requests but left cold-search serialization unchanged.

## Changes and verification

- Up to four independent title reads run concurrently per search. Catalogue
  pages remain sequential. Candidates commit in catalogue order, even if replies
  arrive out of order; later results never jump ahead of an unresolved title.
- Each load owns an abort controller. Stop, route changes or a failed committed
  candidate abort outstanding reads. Failed/cancelled and later candidates stay
  buffered for retry; late responses cannot change results or populate caches.
- HTTP 429/502/503/504 triggers at most two automatic retries per load, after
  5 and 10 seconds (or a longer `Retry-After`, up to 60 seconds). Pending reads
  are cancelled and that search switches to serial requests after pressure.
  Stop cancels the wait. Other failures, longer server cooldowns or exhausted
  retries keep the existing explicit retry action.
- The existing tab/mirror metadata cache retains up to 1000 records, enough for
  one candidate batch, for the same 30-minute TTL. It remains bounded in memory
  and session storage. Updating an existing stored record does not evict another.
- Three-valued filtering, missing-data counts, source routing, request origin
  constraints, retries, ordering and the exact 1000-new-candidate budget remain.

| Deterministic workload | Before | After |
| --- | ---: | ---: |
| 24 cold metadata reads: network waves | 24 | 6 |
| 240 cold metadata reads: network waves | 240 | 60 |
| 240-title repeat: detail requests | 240 | 0 |
| Peak concurrent title reads | 1 | 4 |

The benchmark resolves pending requests in controlled waves. At an assumed
100 ms per response, the 24-title latency component models 2400 ms before and
600 ms after. These are a deterministic latency model, not a measured fourfold
Chrome speedup. Cache hits and candidates decided from listing metadata remain
faster than titles needing a server response; network variability still applies.

Nine new regression checks cover bounded overlap, out-of-order replies,
cancellation, late replies, partial failure/retry, duplicate candidates, budget
boundaries, repeated queries, cache expiry, storage bounds, reload reuse,
temporary/persistent overload, `Retry-After` and cancellation during cooldown.
The existing search suites cover filtering semantics, unknown ratings, redirects,
DOM behavior, focus and stale-route isolation. The loopback redirect test needed
an approved unsandboxed run; it passed there.

The baseline core is retained only in ignored local diagnostics at
`.scratch/search-optimize-2026-11-04/search-core-before.js`. Compare it with
`node tools/benchmark-search.mjs --source .scratch/search-optimize-2026-11-04/search-core-before.js`.
No disposable browser was launched and no native-helper workaround was used.
The first installed 0.9.5 check confirmed peak concurrency four but stopped at
216 candidates after three nearby HTTP 503 responses with no `Retry-After`.
This motivated the bounded cooldown and serial recovery in 0.9.6. The retained
network sample was truncated, so it is not used for a whole-run speed claim.
The agent-created test tab was closed. Final installed verification is recorded
below and in [verification history](verification-history.md).

## Missing title fields — 0.9.7 follow-up

The owner supplied a different parsing error at 208 candidates on installed
0.9.5. After the requested reload, the exact packaged 0.9.6 build resumed from
that point and reproduced it. The failing public title page opened normally:
its metadata table contained genre, release and ratings but no country row.
The parser had incorrectly required both country and genre on every title.

A reduced synthetic fixture reproduced the same error before the fix. The
parser now records country/genre completeness independently. Missing or empty
fields remain unknown, including under exclusion and group negation. Known
metadata can still determine the result, and an undecidable candidate increments
the existing insufficient-data count instead of stopping the search. Both flags
are validated and retained through cache reuse; older complete records remain
compatible. Login/service pages without either metadata row still fail and
leave the candidate available for retry.

Four new contracts cover the observed structure, unknown/exclusion semantics,
continued scanning, repeated searches, cache reload, empty/missing fields,
invalid pages and invalid cached flags. All four failed before the fix, and
all 46 focused advanced-search, throughput and partial-metadata checks pass
afterward. The throughput benchmark still reports six waves for 24 cold reads
and zero requests for a repeated 240-title query.

After reload, the exact installed 0.9.7 build passed the original failure and
completed 1000 additional candidates in the owner's existing desktop Chrome.
The status advanced from 208 to 1208, with 33 results, 35 insufficient-data
candidates and no error banner. The continuation action remained available.
The complete network sample captured 763 title reads: 760 HTTP 200, two HTTP
503 and one cancellation. Peak concurrency four dropped to one after cooldown,
and the search recovered automatically. The request span was 290.41 seconds,
including recovery. This is a different workload from the earlier baseline;
it confirms correctness and overload recovery, not a fourfold live speedup.
All 253 offline checks passed in the final package gate.

## Adaptive concurrency — 0.9.8

The owner requested an adaptive ceiling of 32 after the fixed-four live run.
Each new search starts at four concurrent title reads. A window accumulates
at least three eligible batches, two seconds of work and twice the current
limit in uncached reads. Only full candidate batches with at least half their
positions requiring a network read contribute; cache-only/sparse batches,
page tails, catalogue fetches, cooldowns and background-tab timing do not drive
calibration. Timing includes metadata parsing and result commits, using the
monotonic browser clock.

The next level is a doubling probe, up to 32. It is retained only if uncached
throughput improves by at least 10%; otherwise the previous level is restored
and further probing waits 15 seconds. A sustained 20% throughput drop at an
accepted level halves the limit and uses the same hold. These margins reduce
reaction to small fluctuations; they are tuning choices, not server guarantees.

HTTP 429/502/503/504 still honors the bounded 5/10-second retry policy and
`Retry-After`. Outstanding reads are aborted and the limit becomes one. After
cooldown, the search waits at least 15 seconds before trying 2, 4, 8, 16 and 32
again through the same throughput checks. At most two automatic retries remain
available per load, even after successful ramp-up; exhausted failures retain
manual continuation. Stop/continuation discards an unverified wider probe.
New searches and restored snapshots recalibrate rather than persist old timing.

Eight new deterministic contracts exercise ramp-up to 32, useful versus
saturated throughput, subsequent slowdown, cooldown and recovery, repeated
pressure, cache-heavy and 45-card pages, hidden tabs, ordering, exact budget
boundaries and cancellation of a 32-request batch. The original six scenarios
failed against the fixed-four implementation before the controller was added.

The benchmark now advances the same virtual 100 ms clock used by the
controller, removing machine CPU speed from its adaptation decisions:

| Deterministic workload | Fixed four (0.9.7) | Adaptive (0.9.8) |
| --- | ---: | ---: |
| 24 cold reads: network waves | 6 | 6 |
| 240 cold reads: network waves | 60 | 40 |
| 1000 cold reads: network waves | 250 | 74 |
| 1000 cold reads: peak concurrency | 4 | 32 |
| 1000-title repeat: detail requests | 0 | 0 |

The 1000-title latency model is 25,000 ms versus 7400 ms. It assumes independent
responses and synthetic HTML; this is not a real-site speed claim. Compare the
ignored baseline with `node tools/benchmark-search.mjs --source .scratch/search-optimize-2026-11-04/search-core-097.js`.

All 261 offline checks passed in the final package gate. Installed Chrome
reported the exact packaged 0.9.8 build. The user changed the query during the
initial observation, preventing a whole-run comparison. A stable-query tail
then stopped at 948 candidates after exhausted HTTP 503 retries, including a
503 with only one active request. After a pause and the existing manual retry,
the same query advanced from 948 to 1125 candidates with 123 HTTP 200 responses
and one request cancelled by the agent's Stop action. Active concurrency rose
from one initially to a measured peak of 12; the request span was 22.3 seconds.
The trace was complete and not truncated. Results remained resumable without
an error banner. This confirms growth after recovery; it does not establish
that the real site can sustain 32 requests or eliminate server failures.
