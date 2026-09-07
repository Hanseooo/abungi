# Abungi v0.3 Route & Economy Audit

Generated from deterministic engine/configuration data after the v0.2 route, reward, shop, item-rarity and event revisions. This is a structural economy audit rather than a full human run simulator.

## Route pressure

10,000 generated regions were inspected.

- Average minimum pre-boss combats: **2.88**.
- Average maximum pre-boss combats: **3.78**.
- Regions permitting zero pre-boss combat: **0**.
- Regions permitting fewer than two pre-boss combats: **0**.
- Minimum-path distribution: 2 fights = 31.0%, 3 fights = 49.5%, 4 fights = 19.5%.
- Maximum-path distribution: 2 fights = 1.3%, 3 fights = 19.7%, 4 fights = 79.0%.

This means combat cannot be completely skipped, while later route choices can still deliberately trade more combat for more earnings/elite upside. Stage 3 always supplies Rest vs Shop, preserving a pre-boss recovery/economy decision.

### Generated node mix

| Node | Share of non-boss nodes |
|---|---:|
| battle | 46.2% |
| elite | 9.3% |
| event | 16.8% |
| rest | 13.9% |
| shop | 13.8% |

## Normal encounter coin rewards

Rewards now use the actual enemy composition rather than one universal normal-fight range. The table uses 1,000 deterministic reward rolls per encounter.

| Encounter | Configured range | Mean coins | Automatic item drop | Scavenge offered |
|---|---:|---:|---:|---:|
| normal-scrap | 13–21 | 17.0 | 11.5% | 21.8% |
| normal-fastlane | 13–21 | 17.0 | 11.5% | 21.8% |
| normal-smokes | 22–34 | 28.0 | 11.5% | 21.8% |
| normal-machines | 16–24 | 20.0 | 11.5% | 21.8% |
| normal-oddities | 24–37 | 30.5 | 11.5% | 21.8% |
| normal-support | 14–22 | 18.0 | 11.5% | 21.8% |

Normal victories additionally offer two small Spoils choices drawn from Cash (+5 coins), Patch Up (5% party Max HP), and—when rolled and inventory permits—Scavenge (one common item). This keeps fighting rewarding while forcing a greed-versus-sustain choice rather than refunding all attrition.

## Shop distribution

Each group below samples 3,000 shops across all three regions. Duplicate content is forbidden within one shelf.

| Party | Avg offers | Common | Uncommon | Rare item | Relic | Avg price | Duplicate shelves |
|---|---:|---:|---:|---:|---:|---:|---:|
| Without Leandre | 4.0 | 50.9% | 43.1% | 0.4% | 5.5% | 20.1 | 0 |
| With Leandre | 5.0 | 46.8% | 47.9% | 0.9% | 4.4% | 20.0 | 0 |

Leandre's fifth shelf is therefore real run-level utility rather than a combat-stat bonus. Rare Revive Kits remain possible but uncommon enough that a player cannot route around attrition assuming one will appear.

## Event decision audit

| Event | Strategic tension |
|---|---|
| Rain on the Stall | Item capacity versus small HP recovery. |
| Loose Crate | PP consumable versus guaranteed 12 coins. |
| Folded Tokens | 22% missing-PP recovery versus 16-coin relic purchase; relic choice is disabled if unaffordable or exhausted. |
| Night Cart | Spend 8 coins for 16% party healing versus keep coins; paid heal is disabled at full HP. |
| Shortcut? | Take a real Fast Lane fight for its full battle rewards versus avoid damage and receive nothing. |
| Old Locker | Trade 5% party HP for a Field Ration versus leave safely; risky choice is disabled with a full pack. |
| Three Cups | 5-coin wager: 50% wins 10 coins after paying the wager, 50% loses 5. Expected net is neutral; outcome is seeded and cannot be reload-rerolled. |
| Repair Bench | 25% missing-PP restoration versus Energy Drink if pack capacity allows. |
| Quiet Corner | Small HP+PP sustain versus 9 coins. |

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
