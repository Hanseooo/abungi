# Abungi v0.3 Character Balance Audit

Generated from the deterministic game engine with 337,920 battles: all 220 three-character parties from 12 characters × 12 encounters × 128 deterministic seeds. The policy is a conservative heuristic that uses healing, statuses, deployables, multi-target attacks and signatures; it is diagnostic, not a substitute for human playtesting. No consumable items or relics are injected, and Leandre begins encounters with 30 coins so Clearance Sale can be represented without unlimited economy.

Provenance: revision `unrecorded`, working tree `unrecorded`, seeds `101,202,303,404,505,606,707,808,909,1010,1111,1212,1313,1414,1515,1616,1717,1818,1919,2020,2121,2222,2323,2424,2525,2626,2727,2828,2929,3030,3131,3232,4000,4037,4074,4111,4148,4185,4222,4259,4296,4333,4370,4407,4444,4481,4518,4555,4592,4629,4666,4703,4740,4777,4814,4851,4888,4925,4962,4999,5036,5073,5110,5147,5184,5221,5258,5295,5332,5369,5406,5443,5480,5517,5554,5591,5628,5665,5702,5739,5776,5813,5850,5887,5924,5961,5998,6035,6072,6109,6146,6183,6220,6257,6294,6331,6368,6405,6442,6479,6516,6553,6590,6627,6664,6701,6738,6775,6812,6849,6886,6923,6960,6997,7034,7071,7108,7145,7182,7219,7256,7293,7330,7367,7404,7441,7478,7515`, policy `heuristic-v1`, timeout cap 30 rounds / 180 commands. Party rows share members, so they are not independent observations.

## Global pacing

| Tier | Win rate | Avg rounds | Median rounds | p90 rounds | Avg survivors | Ending HP | Timeouts | Defeats |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| normal | 91.6% | 4.32 | 4 | 7 | 2.44 | 61.6% | 6 | 14199 |
| elite | 82.9% | 6.50 | 6 | 10 | 1.89 | 42.9% | 0 | 14474 |
| boss | 68.2% | 9.38 | 8 | 13 | 1.51 | 33.0% | 2 | 26844 |

Overall: 83.6% wins, 6.13 average rounds.

## Character inclusion results

| Character | Overall win | Normal | Elite | Boss | Avg rounds | Ending HP |
|---|---:|---:|---:|---:|---:|---:|
| Yatords | 90.0% | 96.4% | 92.1% | 75.3% | 4.90 | 56.8% |
| Greg | 89.3% | 95.6% | 88.3% | 77.9% | 5.08 | 53.9% |
| Nathaniel | 88.7% | 93.7% | 87.4% | 80.3% | 5.53 | 51.3% |
| Earl | 84.4% | 91.7% | 88.7% | 65.6% | 6.16 | 49.5% |
| Jiro | 82.9% | 90.7% | 81.7% | 68.6% | 7.02 | 53.6% |
| Hans | 82.8% | 86.7% | 76.7% | 81.3% | 6.94 | 56.1% |
| Leandre | 81.7% | 91.4% | 83.9% | 60.3% | 5.95 | 45.5% |
| Michael | 81.6% | 88.8% | 79.6% | 69.1% | 5.84 | 46.5% |
| Saq | 80.6% | 88.5% | 81.4% | 64.1% | 7.22 | 47.2% |
| Yeeho | 80.5% | 94.4% | 78.7% | 54.7% | 5.56 | 43.4% |
| Marcus | 80.1% | 90.0% | 76.6% | 63.7% | 7.04 | 47.0% |
| Daboy | 79.9% | 91.3% | 79.1% | 57.8% | 6.32 | 46.6% |

## Interpretation

- Mean character-inclusion win rate: 83.6%.
- Directionally high (>4.5 percentage points above mean): Yatords, Greg, Nathaniel.
- Directionally low (>4.5 percentage points below mean): none.
- Do not tune from this table alone. Economy utility, player mastery, party synergy, consumables and route decisions are intentionally underrepresented.
- Hans should be judged especially on boss/elite performance after the new deployable presentation is visible; perceived impact was a UX problem in v0.1.
- Leandre's run-level value is undercounted because this encounter audit cannot price his extra shop offer.

## Protect diagnostics (Saq-inclusive parties, 84480 battles)

| Metric | Count |
|---|---:|
| Protect casts | 218737 |
| Protect triggered (consumed) | 144770 |
| Protect expired unused | 58892 |
| HP transferred to Saq | 570977 |
| Class Monitor prevented | 684455 |
| Ready granted | 144759 |
| Ready spent | 135105 |

Note: recipient avoids the full intercepted hit; Saq pays transfer cost; party saves monitorPrevented. These are not the same number.

## Matched-slot replacement: Saq vs Marcus (69120 matched pairs)

_Same pair of teammates, same encounter, same seed. RNG diverges after turn 1. These are practical sample sizes, not a statistical guarantee._

| Tier | Saq win rate | Marcus win rate | Delta | Saq median rounds | Marcus median rounds |
|---|---:|---:|---:|---:|---:|
| normal | 91.6% | 92.3% | -0.7pp | 4 | 4 |
| elite | 88.6% | 81.7% | 7.0pp ⚠️ | 6 | 7 |
| boss | 72.7% | 71.7% | 1.0pp | 10 | 10 |


