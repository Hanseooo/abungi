# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 7,920 battles: all 165 three-character parties × 12 encounters × 4 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

## Global pacing

| Tier | Win rate | Avg rounds | Avg survivors | Ending HP |
|---|---:|---:|---:|---:|
| normal | 93.2% | 3.95 | 2.48 | 63.1% |
| elite | 82.6% | 6.03 | 1.88 | 43.3% |
| boss | 63.7% | 9.20 | 1.37 | 29.7% |

Overall: 83.1% wins, 5.78 average rounds.

## Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Nathaniel | 90.7% | 96.5% | 89.1% | 80.7% | 5.11 | 54.1% |
| Yatords | 89.0% | 97.1% | 90.9% | 70.7% | 4.80 | 56.3% |
| Greg | 88.6% | 96.6% | 88.7% | 72.6% | 4.89 | 54.1% |
| Earl | 82.9% | 92.4% | 88.1% | 58.7% | 5.93 | 49.4% |
| Hans | 82.3% | 88.6% | 76.5% | 75.6% | 6.71 | 54.0% |
| Leandre | 81.1% | 92.9% | 83.5% | 55.0% | 5.71 | 45.3% |
| Jiro | 81.0% | 91.4% | 80.7% | 60.4% | 6.73 | 51.8% |
| Marcus | 80.5% | 92.0% | 76.7% | 61.3% | 6.72 | 47.5% |
| Michael | 80.3% | 89.6% | 79.4% | 62.6% | 5.61 | 46.3% |
| Daboy | 79.5% | 92.9% | 78.3% | 54.1% | 6.02 | 46.7% |
| Yeeho | 78.7% | 94.7% | 76.3% | 48.9% | 5.37 | 42.1% |

## Interpretation

- Mean character-inclusion win rate: 83.1%.
- Directionally high (>4.5 percentage points above mean): Nathaniel, Yatords, Greg.
- Directionally low (>4.5 percentage points below mean): none.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

