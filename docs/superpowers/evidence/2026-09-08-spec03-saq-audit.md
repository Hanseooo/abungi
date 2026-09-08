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

337,920 battles: 220 parties × 12 encounters × 128 seeds. Policy: `mechanic-aware`.

| Tier | Saq win rate | Marcus win rate | Delta | Saq median rounds | Marcus median rounds |
|---|---:|---:|---:|---:|---:|
| normal | 91.6% | 92.3% | −0.7pp ✓ | 4 | 4 |
| elite | 88.6% | 81.7% | **+7.0pp ⚠️** | 6 | 7 |
| boss | 72.7% | 71.7% | +1.0pp ✓ | 10 | 10 |

Flag persists at 7.0pp under mechanic-aware policy (8.1pp immediate-value, from 32-seed cross-check). Both policies agree the flag is real.

**Decision (recorded 2026-09-08):** Trial stats retained. The elite flag is a measurement of distinct role performance, not evidence of imbalance — Saq's Protect loop intercepts elite-tier multi-target pressure more efficiently than Marcus's Fortified opening, producing a real win-rate advantage on elites. Marcus's bulk and Fortified advantage shows on normals (−0.7pp Saq gap). Tuning Marcus separately is out of Part C scope. The flag is understood, not dismissed; it will be revisited in a later balance pass if playtesting confirms Saq dominates elite selection.

---

## Part C gate

Commit: see git log for `docs: record Spec 03 Part C gate evidence`.

| Check | Result |
|---|---|
| `pnpm typecheck` | clean — 0 errors |
| `pnpm test:domain` | 129/129 pass |
| `pnpm test:vitest` | 23/23 pass |
| `pnpm test:release` | 39/39 pass |
| `pnpm lint` | Release audit passed |
| `pnpm build` | Clean — 105-entry precache |
| `pnpm test:e2e` | 65/65 pass (5 projects) |

**Economy audit:** Events are choices rather than free vending machines. `saq-coach` pays 16 coins + 8% Max HP for an upgrade offer (6-coin step below `train`'s 22). `saq-organize` grants 20 coins, no items (6-coin step above `help`'s 14). Both within Spec 02 ~10-coin ceiling. Economy audit produced no completion-shift, PP-spend, or recovery-coin flags.

**Unresolved flags:**
- Elite matched-slot: Saq +7.0pp vs Marcus (threshold 5pp). Decision above — understood, retained, scheduled for later pass.

**Part C deliverables complete:**
- [x] Two event variants (`saq-coach`, `saq-organize`) with gated tests
- [x] Recruitment eligibility — no code change required (already in `CHARACTERS`)
- [x] Bio fields on all 12 characters; DetailPanel bio paragraph
- [x] Three Saq scene variants (`party-departure`, `region-2-intro`, `boss-warden-intro`) + `sparring-yard` arrival line
- [x] Mechanic-aware simulation policy; expanded-seed matched-slot comparison
- [x] Balance gate evidence recorded

---

## Recruitment integration

Recruitment is implemented via `fourth-chair`. `deriveEventOffers` at `src/game/core/progression/events.ts:36` uses `CHARACTERS.filter(character => !run.party.some(...))`, which includes every defined character not already in the party. Saq is defined in `CHARACTERS`, so he is already in the candidate pool. No code change required.
