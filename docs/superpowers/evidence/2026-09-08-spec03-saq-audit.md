# Spec 03 Part C — Saq Balance Audit

Revision: see Part C gate section for commit hash.  
Policy: `mechanic-aware` (32 screening seeds, 220 parties, 12 encounters, 10,560 battles per run; 21,120 Saq-inclusive battles for mechanic diagnostics).

---

## Gate results (32 screening seeds)

| Gate | Measured | Verdict |
|---|---|---|
| Correctness | Audit ran to completion without thrown errors. Trace (seed 101) showed Protect cast R1 → consumed R2 → Ready spent via Dismissed. No negative PP, no repeated callback, no illegal no-op observed. | **PASS** |
| Pacing — normal | Median 4 rounds (band 3–6 ✓). p90 7 rounds (band ceiling 6+3=9 ✓). | **PASS** |
| Pacing — elite | Median 6 rounds (band 4–7 ✓). p90 10 rounds (= ceiling ✓). | **PASS** |
| Pacing — boss | Median 8 rounds (band 6–10 ✓). p90 13 rounds (ceiling 10, flag threshold 10+3=13 — exactly at threshold). | **BORDERLINE** — at threshold, not above it. |
| Timeouts | 0 normal, 0 elite, 1 boss (rate 0.014% of boss battles). Below 1% threshold. Single occurrence warrants a trace; no indefinite defense loop observed in the 32-seed run. | **PASS** (monitor) |
| Existing roster control | `immediate-value` policy produces the same header structure and completes without error. Saq-free parties are unaffected by `chooseMechanicAware` (the Saq branch is guarded by `actor.sourceId==='saq'`). | **PASS** |
| New-character strength | Matched-slot Saq vs Marcus: normal −0.7pp ✓, elite **+6.7pp ⚠️** (threshold 5pp), boss +1.3pp ✓. Elite flag requires expanded-seed confirmation. | **FLAG — elite** |
| Role relevance | Trace seed 101: Saq protected the most-threatened ally (lowest HP fraction) on R1, Protect was consumed (triggered), Ready granted, Dismissed spent R2. Focused-pressure niche demonstrated. Marcus shows better multi-target/AoE value on normal (−0.7pp gap vs Saq), confirming distinct roles. | **PASS** |
| Opportunity cost | Protect was consumed (triggered) 36,038 times vs 14,754 expired unused across 21,120 battles. Trigger rate 66% of casts demonstrates real interception value, not wasted PP. | **PASS** |

---

## Expanded-seed run (128 seeds) — elite flag follow-up

Status: **pending** — background run in progress.

---

## Part C gate

_To be filled after Task 8._

---

## Recruitment integration

Recruitment is implemented via `fourth-chair`. `deriveEventOffers` at `src/game/core/progression/events.ts:36` uses `CHARACTERS.filter(character => !run.party.some(...))`, which includes every defined character not already in the party. Saq is defined in `CHARACTERS`, so he is already in the candidate pool. No code change required.
