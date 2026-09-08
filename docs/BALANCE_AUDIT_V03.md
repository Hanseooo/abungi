# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 84,480 battles: all 220 three-character parties from 12 characters × 12 encounters × 32 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

Provenance: revision `53d0241223d0e8706e62f23d2ad8163c90c07897`, working tree `unrecorded`, seeds `101,202,303,404,505,606,707,808,909,1010,1111,1212,1313,1414,1515,1616,1717,1818,1919,2020,2121,2222,2323,2424,2525,2626,2727,2828,2929,3030,3131,3232`, policy `mechanic-aware`, timeout cap 30 rounds / 180 commands. Party rows share members, so they are not independent observations.

## Global pacing

| Tier | Win rate | Avg rounds | Median rounds | p90 rounds | Avg survivors | Ending HP | Timeouts | Defeats |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| normal | 91.4% | 4.32 | 4 | 7 | 2.43 | 61.5% | 0 | 3627 |
| elite | 83.0% | 6.50 | 6 | 10 | 1.89 | 42.8% | 0 | 3598 |
| boss | 68.0% | 9.39 | 8 | 13 | 1.50 | 32.8% | 1 | 6762 |

Overall: 83.4% wins, 6.13 average rounds.

## Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Yatords | 90.0% | 96.3% | 92.3% | 75.2% | 4.91 | 56.8% |
| Greg | 89.4% | 95.4% | 89.0% | 77.6% | 5.08 | 53.8% |
| Nathaniel | 88.6% | 93.4% | 87.2% | 80.4% | 5.53 | 51.2% |
| Earl | 84.2% | 91.4% | 88.4% | 65.5% | 6.17 | 49.2% |
| Jiro | 82.8% | 90.4% | 82.0% | 68.2% | 7.03 | 53.3% |
| Hans | 82.6% | 86.6% | 76.7% | 80.7% | 6.94 | 56.1% |
| Leandre | 81.9% | 91.3% | 84.5% | 60.6% | 5.95 | 45.4% |
| Michael | 81.3% | 88.6% | 79.2% | 68.7% | 5.85 | 46.4% |
| Yeeho | 80.5% | 94.4% | 78.9% | 54.5% | 5.56 | 43.4% |
| Saq | 80.5% | 88.3% | 81.6% | 63.7% | 7.21 | 47.2% |
| Marcus | 79.9% | 89.8% | 76.8% | 63.3% | 7.05 | 46.9% |
| Daboy | 79.5% | 91.0% | 78.8% | 57.4% | 6.31 | 46.3% |

## Interpretation

- Mean character-inclusion win rate: 83.4%.
- Directionally high (>4.5 percentage points above mean): Yatords, Greg, Nathaniel.
- Directionally low (>4.5 percentage points below mean): none.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

## Protect diagnostics (Saq-inclusive parties, 21120 battles)

| Metric | Count |
|---|---:|
| Protect casts | 54570 |
| Protect triggered (consumed) | 36038 |
| Protect expired unused | 14754 |
| HP transferred to Saq | 142195 |
| Class Monitor prevented | 170300 |
| Ready granted | 36033 |
| Ready spent | 33654 |

Note: recipient avoids the full intercepted hit; Saq pays transfer cost; party saves monitorPrevented. These are not the same number.

## Matched-slot replacement: Saq vs Marcus (17280 matched pairs)

_Same pair of teammates, same encounter, same seed. RNG diverges after turn 1. These are practical sample sizes, not a statistical guarantee._

| Tier | Saq win rate | Marcus win rate | Delta | Saq median rounds | Marcus median rounds |
|---|---:|---:|---:|---:|---:|
| normal | 91.3% | 92.1% | -0.7pp | 4 | 4 |
| elite | 88.2% | 81.5% | 6.7pp ⚠️ | 6 | 7 |
| boss | 73.0% | 71.7% | 1.3pp | 10 | 10 |

