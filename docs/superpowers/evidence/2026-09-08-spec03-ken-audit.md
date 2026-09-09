# Spec 03 Part E — Ken Audit Evidence

## Scope and provenance

- Revision under test: `88a06005d4d436932ac8ea07b61c7742b0b5cbc7` plus the current dirty Part E patch.
- Screening: 32 deterministic seeds, 286 three-character parties from 13 characters, 12 encounters.
- Confirmation: 128 deterministic seeds, 439,296 base battles plus 84,480 Ken/Nathaniel matched pairs.
- Policies run: `immediate-value` and `mechanic-aware`. Party rows share members and are not independent observations.
- Recruitment exists. Candidate offers derive directly from `CHARACTERS`, so Ken and Saq are eligible without a second roster list while the existing slot, HP/PP, upgrade-count and KO-floor contracts remain shared.

## Gate results

| Gate | Measured result | Verdict |
|---|---|---|
| Correctness | Domain tests cover one-time mark consumption, application-action exclusion, Script-before-Protect layering, save effect round-trip, and both Ken event variants. No duplicate/double-mitigation failure observed. | PASS |
| Pacing | Expanded medians: normal 4, elite 5, boss 8. p90: 7, 9, 13. None is more than three rounds above its band ceiling. | PASS |
| Timeouts | Global: normal 19, elite 0, boss 3 among 439,296 battles. Required layered groups had 0–2 timeouts each, below 1%. No indefinite defense loop observed. | PASS |
| Existing roster control | Immediate-value and mechanic-aware audits both completed. Ken/Saq branches are source-ID guarded. No engine rule was duplicated in the simulator. | PASS |
| New-character strength | Expanded Ken vs Nathaniel: normal -7.9pp, elite -7.9pp, boss -21.2pp. The 32-seed flag persisted at 128 seeds. | FLAG |
| Role relevance | Seed 202 trace: Ken used Fresh Ink, later ally Hans consumed it once, and the engine reported 28 added power. Expanded run recorded 413,434 consumed marks and 36,480 Script triggers. | PASS |
| Opportunity cost | Mechanic-aware policy sets a mark only with a later ally, lets other allies cash it, uses Needlework before expiry, and conditionally uses Script outside normal fights. Both policy runs completed. | PASS |
| Layered defense | Saq/Ken/Jiro 65.6% wins with 2 timeouts; Saq/Ken/Nathaniel 66.4% with 0. Both trail several Saq control compositions at 78.3–84.5%. | PASS |

## Required burst checks

| Party | Win rate | Timeouts | Ending HP |
|---|---:|---:|---:|
| Ken / Nathaniel / Leandre | 59.7% | 0 | 32.7% |
| Ken / Greg / Yatords | 86.8% | 0 | 55.0% |
| Ken / Michael / Daboy | 74.5% | 0 | 39.3% |

The groups retain materially different survival and win outcomes. None timed out, and the lower two ending-HP rows retain meaningful defensive risk.

## Tuning decision

Trial production values are retained in Part E. The confirmed Ken/Nathaniel gap is a release flag, but this audit does not silently tune Ken from aggregate win rate alone. A follow-up should first inspect policy/targeting and controlled role traces, then duration/usefulness, PP reserve, base power/prevention, stats, and only then encounters. No existing kit is changed here.

## Part E gate

| Check | Result |
|---|---|
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm test:domain` | PASS — 143 tests |
| `corepack pnpm test:release` | PASS — 39 tests |
| `corepack pnpm test:vitest` | PASS — 25 tests |
| `corepack pnpm lint` | PASS — release audit |
| `corepack pnpm build` | PASS — Vite/PWA build; existing >500 kB chunk warning |
| Targeted storage E2E | PASS — desktop shop and recovery save-failure flows passed together, 2/2. Full five-project suite still requires a fresh run. |

The deterministic economy audit was frozen at `C:\tmp\spec03-economy-baseline.txt` and replayed to `C:\tmp\spec03-economy-after-e.txt`. `Compare-Object` found no differences; the baseline SHA-256 is `4E2BEE602B8079A3BE187857B7971E7BB6D0618415D39CBB79A4FADCA346B0AB`. This proves reproducibility from the current source. It is not a historical pre-Part-E comparison: the current economy harness reports route structure, shops, rewards, and event exposure, but does not simulate character-specific event-choice realization, completion, PP spend, or recovery coin spend.

Focused combat verification is green in the 143-test domain suite. Saq redirects a 40-damage hit, applies Class Monitor once per round, clears a lethal link, and rejects invalid/self/duplicate protection. Ken's Script triggers at the exact threshold before Protect, never retriggers on transferred damage, and Ink Mark is applied without self-consumption, consumed once by allies or Needlework, and never multiplied across a multi-hit action.

## Unresolved flags

- Ken trails Nathaniel beyond the 5-point review threshold at all tiers, confirmed with 128 seeds.
- Full five-project E2E gate has not yet been rerun after the targeted storage fixes.
- Historical pre-Part-E economy deltas remain unverified because that snapshot was never captured and the current structural harness cannot measure realized character-event value.
