# Spec 03 Baseline

Date: 2026-09-08
Revision: b5f55bbbc7b4b9a51ce9d32279b092e7325c2d2b
Working tree: dirty — pre-existing uncommitted changes to README.md, docs/ECONOMY_AUDIT_V03.md, scripts/economy-audit.mjs, src/app/appStore.ts, src/features/*, src/game/*, src/styles.css, src/ui/*, tests/*, and several untracked plan/spec files. No Spec 03 files exist yet.

## Suite results

### typecheck
Exit code: 0 — PASS

### test:domain
Exit code: 0 — PASS
tests 100 / pass 100 / fail 0 / duration_ms ~1569ms

### test:release
Exit code: 1 — 1 PRE-EXISTING FAILURE (CSS font-size floor audit, unrelated to Spec 03)
tests 39 / pass 38 / fail 1
Failing test: 'every declared font size sits at or above the .62rem label floor' (v03-ui.test.mjs:41)
Lines 879/893/894 in styles.css below 0.62rem floor. This is a pre-existing defect.

### test:vitest
Exit code: 0 — PASS
Test Files 6 passed (6) / Tests 16 passed (16)

## Balance audit (seeds 101,202,303,404; 11 characters; 165 parties; 12 encounters)

### Global pacing

| Tier | Win rate | Avg rounds | Avg survivors | Ending HP |
|---|---:|---:|---:|---:|
| normal | 92.8% | 4.02 | 2.47 | 62.6% |
| elite | 82.3% | 6.09 | 1.87 | 43.1% |
| boss | 69.4% | 8.89 | 1.51 | 33.5% |

Overall: 84.3% wins, 5.75 average rounds.

### Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Greg | 90.0% | 96.5% | 88.9% | 78.3% | 4.88 | 54.7% |
| Yatords | 90.0% | 96.9% | 91.1% | 75.0% | 4.78 | 57.0% |
| Nathaniel | 89.8% | 95.2% | 87.0% | 81.9% | 5.29 | 52.5% |
| Earl | 84.2% | 92.6% | 88.0% | 63.7% | 5.87 | 50.1% |
| Hans | 83.5% | 88.2% | 75.9% | 81.7% | 6.63 | 55.0% |
| Leandre | 82.6% | 92.4% | 83.9% | 61.7% | 5.66 | 46.1% |
| Jiro | 82.5% | 90.9% | 80.7% | 67.6% | 6.67 | 52.6% |
| Marcus | 81.8% | 91.5% | 76.1% | 68.0% | 6.69 | 48.1% |
| Michael | 81.4% | 89.1% | 78.9% | 68.5% | 5.57 | 47.0% |
| Daboy | 81.0% | 92.7% | 77.8% | 60.7% | 5.97 | 47.5% |
| Yeeho | 81.0% | 94.9% | 77.2% | 56.9% | 5.27 | 44.1% |

## Economy audit

- Fight avoidance is no longer a dominant route strategy.
- Optional combat has economic reason to exist (Spoils reward harder compositions).
- Recovery is deliberately partial (Patch Up 5% Max HP only).
- Events are choices rather than free vending machines.
- Shops reliable without being guaranteed (3 category anchors).
- No new currency. HP, PP, Coins, Items remain the only run resources.

Event variety (20,000 seeds, 3 regions):
| Policy | Assigned events | Entered events | Avg distinct visited |
|---|---:|---:|---:|
| event-first | 119891 | 73234 | 3.66 |
| random-reachable-lane | 119891 | 59887 | 2.99 |
| event-avoiding | 119891 | 46630 | 2.33 |

## Known provenance defect
scripts/balance-audit.mjs prints a hardcoded "165 three-character parties x 12 encounters"
string in its markdown header while enumerating parties dynamically. Part C Task 1 fixes it.
