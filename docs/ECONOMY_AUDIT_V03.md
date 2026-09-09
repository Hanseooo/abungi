# Abungi v0.3 Route & Economy Audit

Generated from deterministic engine/configuration data after the v0.2 route, reward, shop, item-rarity and event revisions. This is a structural economy audit rather than a full human run simulator.

## Route pressure

10,000 generated regions were inspected.

- Average minimum pre-boss combats: **2.45**.
- Average maximum pre-boss combats: **3.56**.
- Regions permitting zero pre-boss combat: **0**.
- Regions permitting fewer than two pre-boss combats: **0**.
- Minimum-path distribution: 2 fights = 55.0%, 3 fights = 45.0%.
- Maximum-path distribution: 2 fights = 3.7%, 3 fights = 36.8%, 4 fights = 59.5%.

This means combat cannot be completely skipped, while later route choices can still deliberately trade more combat for more earnings/elite upside. Stage 3 always supplies Rest vs Shop, and stage 6 always supplies a Rest lane against a battle/event/elite lane, so recovery is reachable immediately before every boss without being forced.

### Generated node mix

| Node | Share of non-boss nodes |
|---|---:|
| battle | 42.6% |
| elite | 7.4% |
| event | 13.8% |
| rest | 22.2% |
| shop | 13.9% |

## Normal encounter coin rewards

Rewards now use the actual enemy composition rather than one universal normal-fight range. The table uses 1,000 deterministic reward rolls per encounter.

| Encounter | Configured range | Mean coins | Automatic item drop | Scavenge offered |
|---|---:|---:|---:|---:|
| normal-scrap | 13–21 | 17.0 | 11.5% | 16.3% |
| normal-fastlane | 13–21 | 17.0 | 11.5% | 16.3% |
| normal-smokes | 22–34 | 28.0 | 11.5% | 16.3% |
| normal-machines | 16–24 | 20.0 | 11.5% | 16.3% |
| normal-oddities | 24–37 | 30.5 | 11.5% | 16.3% |
| normal-support | 14–22 | 18.0 | 11.5% | 16.3% |

Normal victories additionally offer two small Spoils choices: one greed option (Cash for +5 coins, or Scavenge for one common item when rolled and inventory permits) paired with one sustain option (Patch Up for 5% party Max HP, or PP Cache for 2 PP on each ally's most-drained move). Drawing one from each pool keeps fighting rewarding while forcing a greed-versus-sustain choice rather than refunding all attrition.

## Shop distribution

Each group below samples 3,000 shops across all three regions. Duplicate content is forbidden within one shelf.

| Party | Avg offers | Common | Uncommon | Rare item | Relic | Avg price | Duplicate shelves |
|---|---:|---:|---:|---:|---:|---:|---:|
| Without Leandre | 4.0 | 51.1% | 47.3% | 1.6% | 0.0% | 22.0 | 0 |
| With Leandre | 5.0 | 48.3% | 49.7% | 2.0% | 0.0% | 21.8 | 0 |

Leandre's fifth shelf is therefore real run-level utility rather than a combat-stat bonus. Rare Revive Kits remain possible but uncommon enough that a player cannot route around attrition assuming one will appear.

## Event decision audit

| Event | Strategic tension |
|---|---|
| Swap Meet | Two visible outcomes. |
| The Press | Two visible outcomes. |
| Sparring Yard | Two visible outcomes. |
| The Fourth Chair | Two visible outcomes. |
| Rain on the Stall | Item capacity versus small HP recovery. |
| Loose Crate | PP consumable versus guaranteed 12 coins. |
| Folded Tokens | 22% missing-PP recovery versus 16-coin relic purchase; relic choice is disabled if unaffordable or exhausted. |
| Night Cart | Spend 8 coins for 16% party healing versus keep coins; paid heal is disabled at full HP. |
| Shortcut? | Take a real Fast Lane fight for its full battle rewards versus avoid damage and receive nothing. |
| Old Locker | Trade 5% party HP for a Field Ration versus leave safely; risky choice is disabled with a full pack. |
| Cardboard Wheel | Cardboard Wheel offers Small (+1.7 EV), Medium (+1.2), Large (+1.5) and Yeeho (+5) stakes. EV alone does not establish balance. |
| Repair Bench | 25% missing-PP restoration versus Energy Drink if pack capacity allows. |
| Quiet Corner | Small HP+PP sustain versus 9 coins. |
| Bulk Deal | 20 coins for two consumables versus 14 coins for none; the paid branch is disabled when coins are short or the pack is full. |
| Live Wire | 9% party HP for 30% missing-PP restoration versus a risk-free 7 coins. The HP cost cannot kill; it floors at 1. |

## Event definitions

All 15 event definitions are listed from the live content table. Recruitment is an anchored zero-weight event; the other weights are ordinary weighted-pool inputs. Arrival themes: swap, press, training, recruitment, rain, crate, shrine, food, alley, locker, game, repair, quiet, market, danger.

| Event | Weight | Theme | Category |
|---|---:|---|---|
| swap-meet | 1 | swap | transmutation |
| the-press | 0.5 | press | transmutation |
| sparring-yard | 0.5 | training | trade |
| fourth-chair | 0 | recruitment | recruitment |
| rain-stall | 1 | rain | recovery |
| loose-crate | 1 | crate | trade |
| paper-shrine | 1 | shrine | trade |
| night-cart | 1 | food | recovery |
| shortcut | 1 | alley | combat |
| old-locker | 1 | locker | sacrifice |
| street-game | 1 | game | gamble |
| repair-bench | 1 | repair | recovery |
| quiet-corner | 1 | quiet | recovery |
| bulk-deal | 1 | market | trade |
| live-wire | 1 | danger | sacrifice |

## Event variety exposure

20,000 fixed seeds were replayed through all three regions under legal-path policies. Assigned nodes are structural route data; entered nodes are policy outcomes, not human behavior. Recruitment offered means its anchor was reached. New runs avoid ordinary repeats until the weighted pool is exhausted.

| Policy | Assigned events | Entered events | Recruit generated | Recruit reached | Avg distinct visited | Repeats before exhaustion | Repeats after exhaustion |
|---|---:|---:|---:|---:|---:|---:|---:|
| event-first | 99689 | 57470 | 17208 | 11457 | 2.87 | 0 | 0 |
| random-reachable-lane | 99689 | 53358 | 17208 | 7512 | 2.67 | 0 | 0 |
| event-avoiding | 99689 | 30931 | 17208 | 7620 | 1.55 | 0 | 0 |

## Assessment

- **Fight avoidance is no longer a dominant route strategy:** every region forces at least two pre-boss combats, compared with the earlier build where some routes allowed none.
- **Optional combat has an economic reason to exist:** encounter-specific coin ranges and Spoils reward harder compositions instead of paying all normal fights roughly the same.
- **Recovery is deliberately partial:** fight rewards never erase PP attrition, and Patch Up is only 5% Max HP. Rest remains much more efficient recovery.
- **Events are choices rather than free vending machines:** high-value outcomes now carry cost, risk, opportunity cost, capacity checks, or a competing sustain option.
- **Shops are more reliable without being guaranteed solutions:** three category anchors prevent all-junk shelves, while rarity/relic rolls retain uncertainty.
- **No new currency was introduced.** HP, PP, Coins and Items remain the only run resources.

### Remaining human-playtest watchpoints

1. Whether +5 Cash is chosen disproportionately over 5% Patch Up in real runs.
2. Whether a neutral-expectation Three Cups wager is still engaging enough to justify its route slot.
3. Whether Revive Kit availability feels exciting rather than required.
4. Whether mandatory two-fight pressure feels fair with low-sustain parties across all three regions.
