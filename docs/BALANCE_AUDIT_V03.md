# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 7,920 battles: all 165 three-character parties × 12 encounters × 4 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

## Global pacing

| Tier | Win rate | Avg rounds | Avg survivors | Ending HP |
|---|---:|---:|---:|---:|
| normal | 92.7% | 3.94 | 2.46 | 62.6% |
| elite | 80.8% | 6.05 | 1.83 | 42.4% |
| boss | 62.5% | 9.26 | 1.34 | 29.1% |

Overall: 82.2% wins, 5.80 average rounds.

## Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Nathaniel | 90.0% | 95.9% | 88.3% | 80.0% | 5.12 | 53.5% |
| Yatords | 88.4% | 96.8% | 89.4% | 70.7% | 4.81 | 55.9% |
| Greg | 88.3% | 96.3% | 87.8% | 72.8% | 4.91 | 53.9% |
| Earl | 82.6% | 92.0% | 87.4% | 58.9% | 5.95 | 49.1% |
| Hans | 81.1% | 88.1% | 74.1% | 73.9% | 6.73 | 53.3% |
| Jiro | 80.5% | 91.2% | 80.0% | 59.4% | 6.75 | 51.3% |
| Leandre | 80.1% | 92.6% | 81.5% | 53.7% | 5.72 | 44.9% |
| Marcus | 79.8% | 91.7% | 75.4% | 60.6% | 6.73 | 47.2% |
| Daboy | 78.6% | 92.6% | 77.2% | 51.9% | 6.02 | 46.2% |
| Yeeho | 77.8% | 94.5% | 74.8% | 47.2% | 5.37 | 41.8% |
| Michael | 76.8% | 88.0% | 73.0% | 58.1% | 5.66 | 44.2% |

## Interpretation

- Mean character-inclusion win rate: 82.2%.
- Directionally high (>4.5 percentage points above mean): Nathaniel, Yatords, Greg.
- Directionally low (>4.5 percentage points below mean): Michael.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

