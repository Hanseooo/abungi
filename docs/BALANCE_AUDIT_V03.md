# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 7,920 battles: all 165 three-character parties × 12 encounters × 4 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

## Global pacing

| Tier | Win rate | Avg rounds | Avg survivors | Ending HP |
|---|---:|---:|---:|---:|
| normal | 92.8% | 4.02 | 2.47 | 62.6% |
| elite | 82.3% | 6.09 | 1.87 | 43.1% |
| boss | 69.4% | 8.89 | 1.51 | 33.5% |

Overall: 84.3% wins, 5.75 average rounds.

## Character inclusion results

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

## Interpretation

- Mean character-inclusion win rate: 84.3%.
- Directionally high (>4.5 percentage points above mean): Greg, Yatords, Nathaniel.
- Directionally low (>4.5 percentage points below mean): none.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

