# Abungi v0.3 Balance Deltas

Baseline: `docs/BALANCE_AUDIT_V02.md` (7,920 battles). Result: `docs/BALANCE_AUDIT_V03.md` (same 7,920-battle harness, same seeds).

## Changes shipped

| Change | From | To | Rationale |
|---|---|---|---|
| Region revive (`regionReviveHpPercent`) | — | 0.25 | KO'd allies rejoin the run after a boss instead of staying dead |
| Michael Max HP | 96 | 104 | Weakest character at 76.8% |
| Suppressing Fire power | 55 | 60 | Same |
| `enemyTierHpMultiplier.boss` | 1.55 | 1.45 | Boss tier at 62.5% wins and 29.1% ending HP |
| Table Flip power | 58 | 52 | Same |
| Enforcement Burst power | 60 | 54 | Same |
| Night Swell power | 50 | 45 | Same |
| Yeeho Max HP | 90 | 96 | 47.2% vs bosses after the boss ease |
| On the Rocks power | 50 | unchanged | Daboy cleared the boss gate after the boss ease |
| Scatter power per hit | 20 | unchanged | Leandre cleared the boss gate after the boss ease |
| Nathaniel power | 116 | 101 | Minimal leader-ceiling correction after the required boss ease |
| Greg power | 108 | 105 | Minimal leader-ceiling correction after the required boss ease |
| Yatords power | 98 | 97 | Minimal leader-ceiling correction after the required boss ease |

## Tier pacing

| Tier | v0.2 win | v0.3 win | v0.2 rounds | v0.3 rounds | v0.2 ending HP | v0.3 ending HP |
|---|---:|---:|---:|---:|---:|---:|
| normal | 92.7% | 92.8% | 3.94 | 4.02 | 62.6% | 62.6% |
| elite | 80.8% | 82.3% | 6.05 | 6.09 | 42.4% | 43.1% |
| boss | 62.5% | 69.4% | 9.26 | 8.89 | 29.1% | 33.5% |

## Character inclusion

| Character | v0.2 overall | v0.3 overall | v0.2 boss | v0.3 boss |
|---|---:|---:|---:|---:|
| Nathaniel | 90.0% | 89.8% | 80.0% | 81.9% |
| Yatords | 88.4% | 90.0% | 70.7% | 75.0% |
| Greg | 88.3% | 90.0% | 72.8% | 78.3% |
| Earl | 82.6% | 84.2% | 58.9% | 63.7% |
| Hans | 81.1% | 83.5% | 73.9% | 81.7% |
| Jiro | 80.5% | 82.5% | 59.4% | 67.6% |
| Leandre | 80.1% | 82.6% | 53.7% | 61.7% |
| Marcus | 79.8% | 81.8% | 60.6% | 68.0% |
| Daboy | 78.6% | 81.0% | 51.9% | 60.7% |
| Yeeho | 77.8% | 81.0% | 47.2% | 56.9% |
| Michael | 76.8% | 81.4% | 58.1% | 68.5% |

## Gates

| Gate | Target | Result | Pass |
|---|---|---:|---|
| G1 boss win | 68.0%–75.0% | 69.4% | yes |
| G2 boss rounds | ≤ 9.26 | 8.89 | yes |
| G3 boss ending HP | ≥ 33.0% | 33.5% | yes |
| G4 Michael overall | ≥ 79.0% | 81.4% | yes |
| G5 Yeeho boss | ≥ 55.0% | 56.9% | yes |
| G6 Daboy boss | ≥ 57.0% | 60.7% | yes |
| G7 Leandre boss | ≥ 58.0% | 61.7% | yes |
| G8 leader ceiling | ≤ 90.0% | 90.0% | yes |
| G9 normal/elite drift | ±3.0 pp | +0.1 / +1.5 pp | yes |

## Region revive, not covered by this audit

The encounter simulator resolves single battles and never calls `claimReward`, so the revive does not appear in any figure above. Its effect is run-level: a party that loses a member before a boss now enters the next region three-strong at low HP instead of two-strong. Verified by `tests/domain/v03.test.mjs`; it needs human playtesting to judge feel.
