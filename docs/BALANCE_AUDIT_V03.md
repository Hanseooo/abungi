# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 10,560 battles: all 220 three-character parties from 12 characters × 12 encounters × 4 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

Provenance: revision `6515a891407f96827be3d17e0c22664b7b427214`, working tree `unrecorded`, seeds `101,202,303,404`, policy `heuristic-v1`, timeout cap 30 rounds / 180 commands. Party rows share members, so they are not independent observations.

## Global pacing

| Tier | Win rate | Avg rounds | Median rounds | p90 rounds | Avg survivors | Ending HP | Timeouts | Defeats |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| normal | 92.0% | 4.21 | 4 | 7 | 2.44 | 61.9% | 0 | 425 |
| elite | 82.2% | 6.34 | 5 | 9 | 1.87 | 42.8% | 0 | 471 |
| boss | 67.9% | 9.19 | 8 | 13 | 1.49 | 33.1% | 0 | 848 |

Overall: 83.5% wins, 5.99 average rounds.

## Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Greg | 89.6% | 95.8% | 89.7% | 77.3% | 5.00 | 54.2% |
| Yatords | 89.5% | 96.7% | 91.1% | 73.5% | 4.88 | 57.0% |
| Nathaniel | 88.7% | 94.7% | 85.8% | 79.7% | 5.43 | 51.7% |
| Earl | 83.7% | 91.8% | 88.0% | 63.2% | 6.08 | 49.3% |
| Hans | 83.2% | 87.3% | 76.5% | 81.8% | 6.82 | 55.7% |
| Jiro | 82.2% | 90.2% | 81.2% | 67.0% | 6.90 | 52.7% |
| Leandre | 81.9% | 92.0% | 82.7% | 60.9% | 5.84 | 45.6% |
| Marcus | 81.0% | 90.7% | 75.9% | 66.7% | 6.89 | 47.5% |
| Saq | 80.9% | 89.4% | 81.7% | 63.2% | 6.69 | 48.3% |
| Michael | 80.9% | 88.5% | 79.1% | 67.6% | 5.72 | 46.7% |
| Yeeho | 80.4% | 94.6% | 76.7% | 55.6% | 5.42 | 43.6% |
| Daboy | 79.8% | 91.7% | 77.6% | 58.2% | 6.18 | 46.7% |

## Interpretation

- Mean character-inclusion win rate: 83.5%.
- Directionally high (>4.5 percentage points above mean): Greg, Yatords, Nathaniel.
- Directionally low (>4.5 percentage points below mean): none.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

