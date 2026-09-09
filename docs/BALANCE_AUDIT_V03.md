# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 109,824 battles: all 286 three-character parties from 13 characters × 12 encounters × 32 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

Provenance: revision `unrecorded`, working tree `unrecorded`, seeds `101,202,303,404,505,606,707,808,909,1010,1111,1212,1313,1414,1515,1616,1717,1818,1919,2020,2121,2222,2323,2424,2525,2626,2727,2828,2929,3030,3131,3232`, policy `heuristic-v1`, timeout cap 30 rounds / 180 commands. Party rows share members, so they are not independent observations.

## Global pacing

| Tier | Win rate | Avg rounds | Median rounds | p90 rounds | Avg survivors | Ending HP | Timeouts | Defeats |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| normal | 96.4% | 3.71 | 3 | 6 | 2.70 | 71.1% | 1 | 1969 |
| elite | 92.9% | 5.76 | 5 | 9 | 2.40 | 58.3% | 0 | 1961 |
| boss | 78.4% | 8.44 | 7 | 12 | 1.91 | 43.8% | 0 | 5928 |

Overall: 91.0% wins, 5.41 average rounds.

## Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Jiro | 95.6% | 98.5% | 97.3% | 88.1% | 6.10 | 75.6% |
| Nathaniel | 93.7% | 97.5% | 91.4% | 88.4% | 5.06 | 60.6% |
| Greg | 93.4% | 98.6% | 96.0% | 80.4% | 4.55 | 62.6% |
| Marcus | 92.8% | 96.4% | 94.6% | 83.7% | 6.11 | 62.5% |
| Yatords | 92.4% | 98.7% | 96.3% | 75.8% | 4.48 | 63.6% |
| Earl | 91.7% | 96.7% | 95.9% | 77.5% | 5.57 | 61.7% |
| Hans | 90.7% | 93.4% | 88.9% | 86.9% | 6.22 | 68.8% |
| Michael | 90.6% | 94.2% | 92.3% | 81.6% | 5.06 | 58.2% |
| Saq | 89.3% | 94.5% | 91.0% | 77.2% | 6.45 | 58.9% |
| Daboy | 88.7% | 96.3% | 90.8% | 71.4% | 5.50 | 57.8% |
| Leandre | 88.7% | 96.8% | 92.3% | 68.8% | 5.33 | 56.2% |
| Yeeho | 88.2% | 97.8% | 91.5% | 65.8% | 4.89 | 53.2% |
| Ken | 87.5% | 93.9% | 88.7% | 73.7% | 4.95 | 54.7% |

## Interpretation

- Mean character-inclusion win rate: 91.0%.
- Directionally high (>4.5 percentage points above mean): Jiro.
- Directionally low (>4.5 percentage points below mean): none.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

## Protect diagnostics (Saq-inclusive parties, 25344 battles)

| Metric | Count |
|---|---:|
| Protect casts | 47137 |
| Protect triggered (consumed) | 37070 |
| Protect expired unused | 3688 |
| HP transferred to Saq | 52957 |
| Class Monitor prevented | 231863 |
| Ready granted | 37070 |
| Ready spent | 33606 |

Note: recipient avoids the full intercepted hit; Saq pays transfer cost; party saves monitorPrevented. These are not the same number.

## Matched-slot replacement: Saq vs Marcus (21120 matched pairs)

_Same pair of teammates, same encounter, same seed. RNG diverges after turn 1. These are practical sample sizes, not a statistical guarantee._

| Tier | Saq win rate | Marcus win rate | Delta | Saq median rounds | Marcus median rounds |
|---|---:|---:|---:|---:|---:|
| normal | 96.5% | 97.5% | -1.1pp | 4 | 3 |
| elite | 94.8% | 96.4% | -1.6pp | 6 | 6 |
| boss | 81.6% | 87.2% | -5.6pp ⚠️ | 9 | 8 |

## Ink diagnostics (Ken-inclusive parties, 25344 battles)

| Metric | Value |
|---|---:|
| Marks applied | 91769 |
| Marks consumed | 90138 |
| Marks expired | 535 |
| Marks cleared | 1096 |
| Mark payoff messages | 90138 |
| Added mark damage % | 5395610 |
| Median setup-to-payoff delay | 0 rounds |

## Script diagnostics

| Metric | Value |
|---|---:|
| Script applied | 7657 |
| Script triggered | 5797 |
| Script expired | 356 |
| Damage prevented | 98420 |

## Matched-slot replacement: Ken vs Nathaniel (21120 matched pairs)

| Tier | Ken win rate | Nathaniel win rate | Delta |
|---|---:|---:|---:|
| normal | 93.8% | 97.5% | -3.7pp |
| elite | 90.6% | 90.6% | -0.0pp |
| boss | 74.6% | 86.3% | -11.7pp |
## Layered defense

| Party | Win rate | Timeouts | Ending HP |
|---|---:|---:|---:|
| saq / ken / jiro | 93.0% | 0 | 65.7% |
| saq / ken / nathaniel | 82.3% | 0 | 53.4% |
| saq / marcus / jiro | 89.6% | 0 | 73.4% |
| saq / marcus / hans | 97.9% | 0 | 87.9% |
| saq / earl / jiro | 96.4% | 0 | 80.2% |
| saq / nathaniel / earl | 89.3% | 0 | 53.9% |

## Burst checks

| Party | Win rate | Timeouts | Ending HP |
|---|---:|---:|---:|
| ken / nathaniel / leandre | 73.2% | 0 | 41.7% |
| ken / greg / yatords | 89.3% | 0 | 61.2% |
| ken / michael / daboy | 86.5% | 0 | 51.2% |

