# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 109,824 battles: all 286 three-character parties from 13 characters × 12 encounters × 32 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

Provenance: revision `unrecorded`, working tree `unrecorded`, seeds `101,202,303,404,505,606,707,808,909,1010,1111,1212,1313,1414,1515,1616,1717,1818,1919,2020,2121,2222,2323,2424,2525,2626,2727,2828,2929,3030,3131,3232`, policy `heuristic-v1`, timeout cap 30 rounds / 180 commands. Party rows share members, so they are not independent observations.

## Global pacing

| Tier | Win rate | Avg rounds | Median rounds | p90 rounds | Avg survivors | Ending HP | Timeouts | Defeats |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| normal | 94.5% | 3.77 | 3 | 6 | 2.60 | 67.8% | 0 | 3028 |
| elite | 88.9% | 5.94 | 5 | 9 | 2.22 | 53.1% | 0 | 3037 |
| boss | 75.3% | 8.81 | 8 | 12 | 1.78 | 39.6% | 0 | 6795 |

Overall: 88.3% wins, 5.57 average rounds.

## Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Jiro | 94.6% | 97.7% | 96.3% | 86.6% | 6.31 | 73.4% |
| Greg | 92.9% | 97.7% | 94.0% | 82.3% | 4.65 | 60.3% |
| Yatords | 92.0% | 98.1% | 94.7% | 77.4% | 4.61 | 61.5% |
| Nathaniel | 91.4% | 95.9% | 89.1% | 84.5% | 5.15 | 57.8% |
| Earl | 89.8% | 95.2% | 93.5% | 75.2% | 5.68 | 58.9% |
| Marcus | 88.9% | 93.3% | 89.3% | 79.8% | 6.04 | 56.4% |
| Michael | 88.5% | 92.6% | 88.4% | 80.6% | 5.17 | 55.2% |
| Leandre | 86.6% | 94.7% | 88.9% | 68.1% | 5.45 | 53.0% |
| Hans | 85.8% | 89.9% | 81.9% | 81.2% | 6.39 | 59.8% |
| Saq | 85.2% | 92.2% | 85.9% | 70.2% | 6.69 | 53.7% |
| Yeeho | 84.9% | 96.1% | 85.4% | 61.9% | 5.11 | 48.8% |
| Daboy | 84.8% | 94.6% | 86.1% | 64.0% | 5.84 | 53.0% |
| Ken | 82.4% | 90.3% | 82.7% | 66.3% | 5.35 | 49.8% |

## Interpretation

- Mean character-inclusion win rate: 88.3%.
- Directionally high (>4.5 percentage points above mean): Jiro, Greg.
- Directionally low (>4.5 percentage points below mean): Ken.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

## Protect diagnostics (Saq-inclusive parties, 25344 battles)

| Metric | Count |
|---|---:|
| Protect casts | 57824 |
| Protect triggered (consumed) | 37032 |
| Protect expired unused | 15939 |
| HP transferred to Saq | 140211 |
| Class Monitor prevented | 173296 |
| Ready granted | 37024 |
| Ready spent | 33899 |

Note: recipient avoids the full intercepted hit; Saq pays transfer cost; party saves monitorPrevented. These are not the same number.

## Matched-slot replacement: Saq vs Marcus (21120 matched pairs)

_Same pair of teammates, same encounter, same seed. RNG diverges after turn 1. These are practical sample sizes, not a statistical guarantee._

| Tier | Saq win rate | Marcus win rate | Delta | Saq median rounds | Marcus median rounds |
|---|---:|---:|---:|---:|---:|
| normal | 94.7% | 94.6% | 0.1pp | 4 | 3 |
| elite | 91.3% | 92.2% | -0.9pp | 6 | 6 |
| boss | 77.6% | 84.8% | -7.3pp ⚠️ | 9 | 8 |

## Ink diagnostics (Ken-inclusive parties, 25344 battles)

| Metric | Value |
|---|---:|
| Marks applied | 97470 |
| Marks consumed | 95434 |
| Marks expired | 661 |
| Marks cleared | 1375 |
| Mark payoff messages | 95434 |
| Added mark damage % | 4759760 |
| Median setup-to-payoff delay | 0 rounds |

## Script diagnostics

| Metric | Value |
|---|---:|
| Script applied | 9255 |
| Script triggered | 6934 |
| Script expired | 629 |
| Damage prevented | 99157 |

## Matched-slot replacement: Ken vs Nathaniel (21120 matched pairs)

| Tier | Ken win rate | Nathaniel win rate | Delta |
|---|---:|---:|---:|
| normal | 90.6% | 96.1% | -5.6pp |
| elite | 85.5% | 89.0% | -3.5pp |
| boss | 67.4% | 82.9% | -15.5pp |
## Layered defense

| Party | Win rate | Timeouts | Ending HP |
|---|---:|---:|---:|
| saq / ken / jiro | 84.9% | 0 | 57.5% |
| saq / ken / nathaniel | 76.3% | 0 | 47.9% |
| saq / marcus / jiro | 89.8% | 0 | 72.6% |
| saq / marcus / hans | 84.6% | 0 | 68.1% |
| saq / earl / jiro | 96.1% | 0 | 79.9% |
| saq / nathaniel / earl | 86.2% | 0 | 52.2% |

## Burst checks

| Party | Win rate | Timeouts | Ending HP |
|---|---:|---:|---:|
| ken / nathaniel / leandre | 69.8% | 0 | 39.7% |
| ken / greg / yatords | 89.8% | 0 | 59.7% |
| ken / michael / daboy | 77.9% | 0 | 44.6% |

