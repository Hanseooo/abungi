# Abungi — Spec 03 Companion: Combat Rules & Validation

Status: proposed contracts and trial tuning, not implemented or balance validated.
Date: 2026-09-08.
Parent: [Roster, Character Integration & Encounter Expansion](2026-09-08-roster-character-encounter-expansion.md).

The parent owns content values, character identities, event outcomes, and delivery scope. This document owns order of operations, lifecycle, save requirements, and validation. Where an effect value is referenced below, use the parent table as its source of truth. Worked examples illustrate those values and must be updated if tuning changes them.

## 1. Vocabulary and boundaries

- **Round:** `BattleState.round`, incremented when the current turn order is exhausted. A once-per-round passive records the round of its actual trigger.
- **Turn:** one unit's opportunity to commit a skill, item, or Guard. Existing automatic enemy turns count too.
- **Action:** one committed command or enemy move. A multi-hit skill remains one action.
- **Hit:** one successful damage calculation against one living target. Misses do not consume one-hit effects.
- **Direct damage:** a hostile skill/move hit against an opposing unit. Protect and Script also cover hostile item/deployable direct hits if such sources exist. They never react to HP costs, damage-over-time ticks, environmental damage, healing, or transferred damage.
- **Offensive mark consumer:** specifically a direct damaging skill by a living ally opposing the marked enemy. Items, deployables, reactions, reflection, transfers, and damage-over-time do not consume Ink Mark or trigger Collaborative Work.

Use explicit damage origin/context at the existing combat resolution seam. Source names, animation names, and `damage` presentation events are not reliable provenance: existing HP sacrifice also emits a damage event.

No new RNG is used for expiry, consumption, transfer, passive triggers, or bonus power. Ordinary accuracy, critical, affinity, and variance rules continue to apply to ordinary hit calculation. Random-target multi-hit actions keep their current seeded target behavior.

## 2. Protect contract

### Targeting and lifecycle

One living source protects at most one other living ally. One recipient has at most one Protect. Self-protection and enemy/deployable targets are illegal. New application replaces the source's prior link instead of adding a second one. Equivalent refresh with no increased lifetime is a no-effect action.

Protect starts when Take Your Seat resolves and ends at the **start of Saq's next turn**, before input becomes available. It is not ticked by the recipient's turn. A fast recipient cannot accidentally expire it. Saq casting Protect does not simultaneously Guard. Under the current turn rules, he cannot cast Protect and then Guard while retaining that same link into another turn.

First qualifying hit consumes Protect only if its computed redirected share is positive. A miss or a hit too small to redirect leaves it active. One multi-hit action may therefore consume it on its first redirectable hit, and subsequent hits are ordinary. An AoE consumes it only for the linked recipient. Other allies, including Saq as a separate AoE target, take their ordinary hits.

If source or recipient is already KO, remove the link. A source KO earlier in the existing AoE target order prevents later interception. Preserve and document the current stable target order, do not aggregate/reorder the whole attack to rescue the link. Revive does not resurrect expired/cleared effects.

### Damage pipeline

For each successful hostile hit against the protected recipient:

1. Determine ordinary attack power and outgoing modifiers, including any eligible offensive mark bonus.
2. Apply defender Guard stat, move affinity, variance, critical, Guard action, Fortified, Exposed, and ordinary outgoing modifiers using existing damage calculation and rounding.
3. Apply existing first-hit relic mitigation, including Cardboard Plate, once to the original target's hit. Call the resulting integer `D`.
4. Evaluate Script against `D`. If eligible, consume it and subtract its prevention, never making damage negative. Call the result `B`.
5. For active Protect, redirected share `R = floor(B / 2)`. Recipient damage is `B - R`.
6. Saq transfer before passive is `ceil(R / 2)`. If Class Monitor is eligible, subtract up to its fixed prevention, down to zero. Consume the passive's round use only when it actually prevents positive transfer damage.
7. Apply both HP losses, clamped at zero. Transfer can KO Saq. Consume the link and grant Ready only when `R > 0` and Saq survives. A dead Saq cannot retain Ready.
8. Emit attributed prevention/transfer/damage/KO events, then continue ordinary move effects and outcome handling.

The split is calculated from incoming damage, not capped by the recipient's current HP before splitting. Consequently Saq cannot make an arbitrarily large lethal blow harmless. Track actual HP loss separately from computed damage and overkill.

Transferred damage receives **no second** Guard-stat, affinity, Guard-action, Fortified, Exposed, Script, Cardboard Plate, or Protect pass. It cannot recurse or cause a fresh on-hit/drain/critical reward. Existing KO consequences still fire once for a transferred KO. Do not suppress real KO bookkeeping by treating transfer as an invisible heal/cost.

Example with `D = 40`, no Script, Class Monitor available: recipient loses 20, `R = 20`, Saq transfer is 10 minus 5 = 5. Total party damage is 25. Recipient damage avoided is 20, but party damage prevented is only 15. Report those as different metrics.

Layered example: `D = 40` and Script qualifies. Script prevents 10, leaving `B = 30`. Recipient loses 15. `R = 15`, transfer before passive is 8, then 3. Total party loss is 18. The original hit's Guard/Fortified factors must not be applied again to that 3.

No blanket global mitigation ceiling is added. The post-defense split bounds the new contribution without retuning existing defense builds. The original recipient always retains at least half of positive post-Script damage. Tiny hits may cause zero transfer cost to Saq, but do not eliminate the recipient's entire hit.

### Secondary effects and Ready

Debuffs carried by the attack still target the original recipient under existing effect rules, not Saq. Protect is not a cleanse, status shield, or taunt. Protect and Script do not reduce Double Down, All In, Abyssal Pact, event injuries, or any other HP cost.

Ready expires after Saq completes his next turn following the trigger, including if he Guards or uses an item. It survives the start of that turn so Dismissed can use it. Successful interception on an earlier round and on a later round never stacks Ready. Expiry must not depend on animation completion or wall-clock time.

For future drain attacks hitting a protected recipient, new routing must not duplicate an existing damage-dependent callback. Preserve the existing callback's single invocation basis unless separately approved. The current engine uses computed hit damage for drain, which may include overkill. Do not silently claim this existing behavior is actual-HP-loss healing or use it to estimate net sustain. Log the basis in the audit.

## 3. Ink Mark, Script, and Ken's passive

### State and duration

One Ink Mark per enemy and one Script per allied recipient. They are different effects on different sides. Each records effect ID, source battle-unit ID, target battle-unit ID, and exact expiry boundary. Source IDs must be battle-instance IDs, not only roster IDs.

Both last until the **start of Ken's second subsequent turn**. If cast on turn K0, they remain at K1 and expire before input at K2. Reapplication refreshes to the new K2 boundary and does not stack magnitude or trigger count. Turn-speed changes do not change this source-turn definition. No engine-wide ordinary-status timing change.

Ken's KO clears his remaining marks/scripts. A recipient KO clears effects on it. Revive restores neither. Battle victory, defeat, and escape clear all new temporary state from exported party state. Source-turn expiry cannot be left waiting forever on a dead source.

Ordinary buff-duration bonuses from Jiro/Daboy/Sticky Label do not extend these effects. They have explicit lifecycle, not generic positive-duration semantics. No effect persists through recruitment or region transition.

### Offensive consumption

1. A skill action can consume only marks that existed before that action began. Fresh Ink's newly applied mark cannot trigger from its own setup hit.
2. After a successful accuracy check, before damage calculation, consume the target's eligible Ink Mark and add its fixed power to this one hit.
3. If the consumer is another ally and Ken is alive, add Collaborative Work's power when its per-round use is available. Mark the passive used in that round. Ken cannot trigger his own passive.
4. If Needlework is the consumer, add its conditional power to that same consuming hit. This is once per action, not an increase to every hit.
5. Run the ordinary damage formula once with the resulting power. Use the consuming skill's affinity, attacker's effective Power, and ordinary hit modifiers. No extra critical roll or bonus damage packet.
6. Attribute damage/KO to the acting attacker. Mark contribution is diagnostic attribution to Ken, not a second KO/reward/drain owner.

Example: an unupgraded Needlework consumes a mark on its first successful hit. Its hit powers are **52, 20, 20** if all hit: first hit combines base 20, mark 20, and Needlework payoff 12. Ken's passive does not apply to himself. A missed first hit consumes nothing, and the next successful hit can receive the bonus.

An unupgraded Drive-By consuming Ken's mark with Collaborative Work available has hit powers **50, 22, 22**, not three enhanced hits. Existing Momentum and affinity still modify those hits normally.

Fresh Ink may consume an older mark and replace it only if its target survives the successful hit. If the attack misses, it neither consumes nor applies. If it KOs, the consumed mark can be recorded as spent but there is no new mark on the corpse. A nominal “applied” count must not include that nonexistent replacement.

For a multi-target skill, each marked target may lose its own mark once. Collaborative Work remains once per round across all targets, using existing stable resolution order. This release has no mass offensive-mark application. Random-target multi-hit attacks may consume different enemies' preexisting marks but never the same mark twice.

### Script consumption and overlap

Script checks `D >= ceil(0.20 * target.maxHp)` using damage after normal defenses and existing relic mitigation, before Protect. This is per hit, not the sum of an action. It consumes on the first eligible hit and reduces that hit by its fixed prevention up to `D`.

Examples: at 100 Max HP, a 19-damage hit leaves Script intact and a 20-damage hit consumes it. Three 12-damage hits do not trigger it. Healing the recipient does not change the threshold because it uses Max HP. Script cannot trigger on Saq's transfer.

Full Sleeve applies the same Script to each living ally, including Ken. Existing scripts refresh but do not stack. Disable casting if no recipient would gain a new Script or a later expiry. Protective Script uses the same no-waste validation for its selected target. A skill with a damage component remains usable even if its conditional setup payoff is unavailable.

### Cleansing and disruption

Ink Mark is a negative removable effect for cleansing purposes. Existing negative-status cleanses remove existing ordinary negatives first in their current order, then Ink Mark if a removal remains. Do not grant every enemy a cleanse solely because marks exist.

Script is an eligible positive removable effect for Peel Away. Protect and Ready are source-linked stance/payoff state, outside that removal list. Explain these distinctions in effect details. No release enemy globally clears all marks or all buffs.

## 4. Enemy effect contracts

### Peel Away

Resolve its damage, including Script/Protect reactions, then remove one eligible effect if the original target remains alive and the damage hit succeeded. A miss does not strip. Remove the first present effect in this fixed priority: **Fortified, Strength, Haste, Script**. Removing Script clears that recipient's script record only. If none remain, the move is an ordinary damage hit, not an error.

The engine's `cooldown: 2` means this enemy cannot choose Peel Away while it appears in its last two moves. It can therefore appear no more frequently than every third enemy turn. No probabilistic bypass, extra effect, or buff-count damage scaling.

### Pry Open

For its hit only, replace the Guard-action multiplier with the weaker factor in the parent. Do not mutate `guardActive`, base Guard, or future hits. Fortified and other ordinary defenses still apply. The mechanic affects any guarding opponent and never checks for Marcus or Saq.

Guard remains beneficial against this attack. This enemy tests reliance on Guard actions, not all forms of protection. If observed players rarely Guard, document that the candidate failed to add a meaningful decision instead of broadening it into total defense penetration.

### Taxed

One nonstacking negative effect, ID `taxed`, source Toll Hexer, on the selected living ally. Apply with ordinary status accuracy affected by Blind, no damage hit and no automatic PP removal. The effect expires after the recipient's next completed turn or on battle end/recipient KO. Source KO does not cancel an already applied tax.

While active, **every skill choice costs 2 PP from that skill's own reserve**. At least two PP are required. Legality and UI share the authoritative cost calculation. One remaining PP is insufficient. Guard and item use cost no extra PP and end the recipient's turn, expiring the tax. Invalid commands spend nothing and do not expire it. A committed skill consumes Taxed even on a miss.

Cleanse removes Taxed after ordinary negatives and Ink Mark if its removal count reaches it. Tax cannot stack or refresh an existing active Taxed effect. The once-per-enemy-battle limit and one-tax-enemy encounter limit cap a normal encounter at **one extra PP spent**. Taxing Hex's already-used flag survives reload. A rejected/no-effect attempt must not generate a refund loop or extra action.

This release uses the existing target-selection rule. It may hit an exhausted character and force a Guard/item choice. Guard is always available. Do not add a one-move disable subsystem, direct PP deletion, or +2 surcharge as an alternate implementation.

## 5. Save and architecture requirements

Current `StatusInstance` cannot represent source/target ownership. Recommended implementation shape is a small typed optional collection of battle effects on `BattleState`, plus bounded passive/payoff counters. Exact TypeScript names must be specified at implementation review. These are proposed additions, not existing exports.

Store only authoritative facts: effect ID, source/target battle-unit IDs, expiry/remaining source-turn boundaries, and consumed passive round/once flags. Trigger count is one by definition. UI descriptions and icons come from content. Do not persist computed damage previews, duplicated status labels, or a second shadow representation of the same effect in both flags and statuses.

Reuse a single collection/lifecycle seam for these few new structured effects if needed, with narrow effect IDs. Existing duration-only statuses stay on their existing path. Do not migrate all statuses, deployables, or passives into a new engine merely to support this expansion.

The current V2 Zod parser enumerates fields and ordinary status IDs. JSON serialization alone is not enough: undeclared structured fields can be stripped or rejected on parsing. Update the domain type, runtime validator, envelope migration, and round-trip coverage together.

Recommended compatibility policy: the first released structured-effect state uses **save envelope V3**, with V1 → V2 → V3 migration and an empty collection/default unused flags for older battles. Reserve only the effect kinds this spec needs. Saq and Ken should share that schema when delivered in one release. If the actual release sequence differs, re-evaluate versioning at that slice rather than silently treating unsupported gameplay state as old-compatible V2.

New build must load V1/V2 saves without changing existing party HP/PP, upgrades, items, route, rewards, or RNG. Existing active battles gain no free Protect/marks. A resumed V3 battle retains exact source IDs, expiry, Ready, used passive rounds, and used Taxing Hex flag. Do not reapply an already resolved effect when replaying animation.

Unknown future versions are rejected clearly without overwriting the stored save. Invalid source/target references and invalid new-mechanic state must produce friendly recovery information, preserve the original save, and avoid silently deleting a harmful effect or inventing a successful run. Offer existing supported recovery/reset controls with confirmation. Content IDs are checked against registries in addition to structural validation. Old deployments are not required to run new mechanics.

Committed battle state and RNG own the truth. Saving/loading during presentation cannot reroll, refresh duration, revive a source, repay PP, or duplicate KO rewards. Autosave failure must remain visible while in-memory progress follows existing application behavior.

## 6. Simulation design

### Establish a usable baseline

Before tuning either character, run the existing diagnostics on the stabilized predecessor code. Record revision, relevant uncommitted-diff identity if present, seed list, policy version, fixture state, character/encounter IDs, region scaling, and content parameters. Preserve historical audit outputs or clearly date their replacement during an authorized implementation task.

The existing balance script has a heuristic score for damage/heals/statuses/deployables and no Protect or mark decision model. A bot that never protects or wastes marks cannot justify buffs. Add legal, deterministic policy decisions for threatened-ally protection, Ready spending, mark follow-up, conditional Script, refresh avoidance, tax cost, and enemy target priority. Validate decision traces against hand-reviewed scenarios first.

Policies may inspect current HP, buffs, order, and learned enemy definitions, but not future RNG, selected hidden moves/targets, or precomputed future damage. Do not duplicate the combat engine inside scoring code. Policy weights are diagnostic assumptions and must be reported.

Use at least two documented policies: an immediate-value baseline and a mechanic-aware policy. Run a targeted defensive/stall stress policy on the risky compositions rather than inventing a large search/AI framework. Policy disagreement is uncertainty to investigate, not a reason to average away a bad result.

### Party and scenario coverage

| Checkpoint | Unique parties | New-character party subsets |
|---|---:|---|
| Baseline: 11 characters | 165 | Existing roster control |
| Saq: 12 characters | 220 | 55 include Saq |
| Ken: 13 characters | 286 | 66 include Ken, 66 include Saq, 11 include both |

At each checkpoint, cover all current normal/elite/boss encounter definitions. Normal and elite definitions are tested at every region scaling they can reach. Bosses use their real region and every existing affinity form over the seed suite. If natural seed coverage misses a boss form, add recorded seeds that reach it rather than changing its runtime odds.

Use a fixed public list of **32 seeds for broad screening**. Expand flagged matchup/policy groups to **128 seeds** before accepting a disputed balance conclusion. These are proposed practical sample sizes, not a guarantee of statistical precision. Print actual case counts derived from arrays and report confidence/uncertainty grouped by seed and encounter. Party rows sharing members are not independent observations.

Use the same encounter seed and start-state family across replacement comparisons, with no hash of party IDs in the seed. Different action sequences naturally diverge in RNG use; these are matched scenarios, not claims of identical random rolls on each turn.

For new-character inclusion, hold two teammates fixed and compare the third slot with eligible alternatives on the same scenarios. Compare Saq especially against Marcus and Ken against Nathaniel, but also against the rest of the roster. Report encounter-specific tradeoffs. Inclusion averages alone confound party composition.

Run all six party-slot permutations for focused protection, low-HP ties, Saq+Ken, and mark/passive attribution scenarios. Broad all-party enumeration can use canonical slot order if that limitation is disclosed.

### Start states and run economy

Broad isolated fights start full HP/PP with current encounter-audit coin assumptions stated. They establish a repeatable combat control, not expected run difficulty.

Separately capture injured, low-PP, upgraded, and relic-bearing starting states from actual deterministic run traces. Preserve the relevant payload and seed. Do not invent “representative” inventories or recovery histories and call them measured fixtures. Deliberately constructed mathematical edge cases are allowed, labeled as such.

Run all 286 parties through at least **16 complete-run seeds** using legal route/reward/rest/shop/event/field-item decisions, with persistent HP, per-move PP, inventory, coins, upgrades, and relics. Use Spec 01/02 behavior actually implemented, including recruitment only if present. Also stress representative defense and Mystic-burst parties with event-seeking and combat-seeking route choices. If the harness cannot model a subsystem, extend the existing script in scope or report that the run gate is unverified. Do not substitute fresh battles and call them complete runs.

Required sustain combinations include Saq/Earl/Jiro, Saq/Marcus/Jiro, Saq/Marcus/Hans, Saq/Ken/Jiro, Saq/Ken/Nathaniel, and Saq/Nathaniel/Earl. Required burst checks include Ken/Nathaniel/Leandre, Ken/Greg/Yatords, and Ken/Michael/Daboy. Exercise relevant existing relics such as Cardboard Plate, First-Aid Tape, Pressed Flower, Violet Thread, Sticky Label, Bike Bearing, Blue Tonic Cap, and Jumper Cable in reachable run traces.

### Metrics

Report per party, encounter, tier, region, policy, and seed group:

- Win, defeat, escape, and timeout separately. Timeout is failure to complete in the audit, not a victory or silent dropped row.
- Rounds: median, mean, p90, and victory-only distribution. Report defeated/timed-out durations separately to avoid survivorship confusion.
- Survivors, actual HP loss, ending HP, overkill, healing including overheal, and KO causes.
- PP spent and ending PP **per ability**, recovery received, taxed extra PP, Guard/item frequency, recovery purchases, and run completion.
- Protect casts, misses/expiry, triggers, recipient damage avoided, actual transfer HP loss, party prevention, Class Monitor prevention, Ready consumption/waste, and locally prevented lethal hits.
- Ink applications, consumed marks, expired/cleansed/KO-cleared marks, overkill consumption, consumer identity, added damage contribution, Collaborative Work use, and setup-to-payoff delay.
- Script applications, useful triggers, prevention, expiry, stripped/KO-cleared scripts, and overlap with Protect/Fortified.
- Enemy disruption frequency, effects removed, extra tax actually paid versus avoided, and target-priority choices.
- Event variant exposure and realized incremental benefit, not just availability in the pool.

Compute mark contribution with the same already-drawn variance/critical and modifiers, comparing the hit with and without added power in diagnostic arithmetic. Do not rerun RNG or emit another hit. A “save” is locally lethal without that defense, not proof that the whole battle would have been lost.

## 7. Proposed balance gates

These gates are trial acceptance thresholds. They require a baseline and reviewed policy. They are not measured claims about the proposed stats.

| Gate | Acceptance / escalation rule |
|---|---|
| Correctness | No recursive interception, duplicate mark consumption, negative PP, repeated reward callback, illegal paid no-op, or save round-trip divergence in relevant checks. Any occurrence blocks release. |
| Pacing | For each encounter at legal scaling under mechanic-aware play, victory median lies in parent tier band. Flag p90 above the band's upper edge by more than 3 rounds. Review every flagged group, do not hide it in global means. |
| Timeouts | Audit cap: 30 rounds or 180 player commands, whichever first. Flag timeout rate above 1% for any tested party/encounter group. An introduced reproducible indefinite defense loop blocks release. This cap is diagnostic, not a new player-facing battle limit. |
| Existing roster control | On unchanged encounters, same old-party commands/seed should retain behavior when new mechanics are absent. Explain any changed result before tuning content. |
| New-character strength | Flag matched-slot win-rate shifts greater than 5 percentage points in either direction, especially when consistent across policies and encounter tiers. Confirm with expanded seeds. Do not auto-nerf a beneficial specialist matchup. |
| Role relevance | Demonstrate at least one repeatable focused-pressure niche where Saq helps and one sustained/AoE niche where Marcus helps. Demonstrate team-follow-up value for Ken and immediate burst value for Nathaniel in controlled traces. |
| Opportunity cost | Mark-aware play must show a useful payoff over blindly repeating Fresh Ink in at least one normal and one boss/elite matchup. Protect must demonstrably avert a local KO in a legal scenario without requiring hidden intent. If not, investigate policy, speed, duration, then values. |
| Enemy fairness | Compare each new encounter with its closest old role/size counterpart. Flag >5 percentage-point old-roster win loss or >1 median extra round. Verify Guard, buff use, and tax avoidance remain viable in traces. |
| Complete-run economy | Flag >5 percentage-point completion shift, >10% total extra PP spent, or >10% recovery coin spending relative to matched baseline route-policy scenarios. Explain shifts and require explicit acceptance if retained. |
| Event value | Each new variant stays within Spec 02's roughly ten-coin or one modest-effect-step ceiling. Combined realized event value must not make the pair a dominant route-economy choice. |

Threshold breaches require investigation and a recorded decision. A release report must list unresolved flags and cannot say “balanced” while leaving them unexplained. Do not insist every party has equal win rate, or tune weak old characters as incidental scope. If an old-kit change is needed, propose it separately.

Tune in this order: legality/policy → duration and usefulness → PP reserve → base power/prevention → base stats → encounter composition. Change one category at a time and rerun affected comparisons. Enemy expansion must not conceal an overpowered new player kit.

## 8. Verification and human playtests

Use the existing test infrastructure. For nontrivial behavior, demonstrate the intended failing path before implementation passes it. Prefer extending relevant tests. Group one main path and one critical failure path per behavior, parameterizing related boundary values where useful. Captured save/run fixtures come from actual engine payloads. Arithmetic boundary cases below are intentionally constructed specifications, not purported production fixtures.

Required behavior coverage:

| Behavior | Main path | Critical failure/boundary family |
|---|---|---|
| Protect | Known hit split, attributed transfer and Ready | Multi-hit/AoE source KO, no recursive defense or HP-cost interception |
| Lifecycle | Source-turn expiry and passive round reset | Fast/slow order, skipped KO source, revive and reload cannot refresh |
| Ink | Another ally consumes once with correct added power | Miss, random multi-hit, setup action cannot consume its own new mark |
| Script | Threshold hit prevents fixed HP then consumes | Below threshold and self-cost do not trigger, layering does not double-mitigate |
| Taxed | Paid two-PP skill expires tax | One-PP skill rejected without mutation, Guard waits it out |
| Disruptor | Hit removes one eligible effect after damage | Miss cannot strip, cooldown cannot repeat early |
| Save | Real active snapshot resumes with identical next outcome/RNG | Old version defaults and malformed source references handled safely |
| Events/recruitment | Eligible variant or implemented recruit preserves contracts | Absent character/full pack/no available upgrade cannot spend resources |

Use current commands from `package.json` at implementation time: `pnpm test:domain`, `pnpm test:vitest`, `pnpm test:release`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and relevant `pnpm test:e2e`. Existing audit entry points are `node scripts/balance-audit.mjs` and `node scripts/economy-audit.mjs`; they consume compiled `.domain-build` modules, so run the current domain compilation/test step first. They write reports. No fictional `test:balance` command is assumed.

Focused human checks:

- First-time player can identify whom Saq protects, what expires, and why Saq lost HP after one explanation in game.
- Saq has a worthwhile attack/control option when no ally needs protection. Player can distinguish his role from Marcus.
- Player deliberately sets a mark and consumes it with an ally, then explains why Needlework did not multiply it three times.
- Player distinguishes Script from Fortified and understands why repeated small hits did not trigger it.
- Player sees the taxed skill's total cost before confirming, can wait it out, and is not trapped at zero PP.
- A defense-heavy party can win without tedious repetitive guarding or endless healing. Burst parties retain meaningful defensive risk.
- Mobile, tablet, and desktop layouts keep HP, marks, status explanations, and deployables readable. Keyboard/focus and reduced motion work at existing configured test viewports.
- Save/reload during presentation resolves to one committed outcome. New local assets load offline. New scenes are skippable and do not eclipse existing relationship content.

Report number of playtesters, familiarity, scenarios, observed confusion, and changes made. A simulated win-rate improvement cannot substitute for a failed comprehension check.

## 9. Completion evidence

A future implementation handoff must include commands actually run, pass/fail counts, failure output, skipped checks, audit provenance, changed tuning values, unresolved balance flags, and the decision on each enemy candidate. Print actual roster and encounter counts from runtime content. Full-scope candidate delivery would mean 13 characters, 52 abilities, 19 enemies, and 15 encounters, with no added elite or boss. If a candidate is deferred, derive the corresponding totals instead of retaining these numbers blindly.

This specification task supplies design and repository evidence only. Gameplay tests, balance simulations, and human playtests are skipped because the proposed content is not implemented. Review the parent and companion together before starting the Saq slice.
