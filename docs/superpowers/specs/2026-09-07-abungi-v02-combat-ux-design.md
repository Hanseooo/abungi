# Abungi v0.2 Combat, Roguelite & Theatre Polish Design

## Goal
Turn the existing v0.1 into a more expressive, strategic roguelite without replacing its clean TypeScript engine or adding unnecessary currencies/systems.

## Principles
- Preserve the four run resources: HP, PP, Coins, Items.
- Combat remains deterministic/seeded and enemy intent remains hidden until an enemy acts.
- Presentation must prove mechanics happened: named move callouts, deployable triggers, status overlays, multi-hit timing, boss phase beats.
- Cutscenes are short, skippable, mobile-safe, and replay-friendly. Repeat runs get seeded dialogue variants rather than longer mandatory scenes.
- All lore/relationships/dialogue remain content data keyed by stable IDs.
- Same status does not stack intensity; reapplication refreshes/extends duration according to the current max-duration rule. Different statuses may coexist.
- Secret boss affinity is selected from a small boss-specific pool and revealed only when the boss battle begins; move affinities remain authored.

## Information UX
Create a reusable overlay system for Settings, Field Guide, move details, status details, character details, item details and visible enemy details. Overlays sit above the active game screen so closing them returns exactly where the user was. The guide covers affinities, Guard, PP persistence, duration semantics, statuses, characters, items/rarity and discovered enemies/relics.

## Combat Director
The engine continues to resolve synchronously into `CombatEvent[]`, but the UI consumes those events sequentially through a presentation director. Events receive enough metadata to identify move/choreography/source. Player/enemy/deployable actions display action names after commitment, then animate hit/heal/status results before the next action is shown. 1x/2x/3x compress timing but preserve order. Reduced motion replaces large movement/shake with opacity/highlight cues.

## Choreography
Use reusable content metadata families: melee, ranged, multi-hit, explosive, smoke, mystic, drain, buff, defense, summon, deployable-shot, deployable-heal, heavy. Individual moves may vary intensity/direction/audio without bespoke frame sheets.

## Hans
Do not raw-buff Hans initially. Make active Sentry/Repair Drone visible on the battlefield regardless of current actor. Add explicit deployable-trigger events with target/value. Sentry swivels/fires; drone rotates/sends a heal beam. Overclock gets a distinct visual state.

## Statuses
Keep text chips and add subtle battlefield overlays. Hover/focus on desktop and tap on touch opens exact status information. New application gets a short stronger animation; persistent effect remains restrained. Expiration receives a small dissipating cue. Duration decrements only after the affected unit completes a turn; a newly-applied two-turn effect remains at 2 immediately after application.

## Boss affinities
Seeded per run and saved in battle state:
- Jonlow: Might or Trick
- Klyde: Trick or Mystic
- Warden: Tech or Might
The affinity is secret until the boss battle intro/reveal. Defensive affinity changes; authored move affinities do not.

## Routes & rewards
Revise route topology so every region has meaningful combat before the boss while retaining branches/recovery. Target at least two unavoidable normal combat opportunities before the boss, never unavoidable elite chains, and at least one recovery/economy opportunity. Harder encounters pay more by summing enemy reward ranges rather than a generic normal-fight range.

Normal combat should be worth taking without self-healing every fight. Keep coins and occasional item drops, plus a small post-fight spoils choice where appropriate (cash / small patch-up / scavenge) with restrained values. Elite/boss rewards remain meaningfully stronger.

## Events
Events become authored mini-scenes with distinct visual themes and clearer up-front consequences. Remove dominant/free-value choices: relic outcomes require a cost/risk, wagers become seeded probabilities with visible odds, and combat-event choices pay better than safe avoidance. Event screens may use different compositions but share a common accessible shell.

## Shops & items
Shops use curated unique shelves: recovery, PP/resource, tactical, wildcard, plus Leandre bonus slot. No duplicate offers. Use configured seeded price variance, region-weighted rarity, and a non-guaranteed relic chance.

Item rarity: Common / Uncommon / Rare. Add:
- Power Snack (Uncommon): Strength 2 turns
- Guard Patch (Uncommon): Fortified 2 turns
- Revive Kit (Rare): revive one KO ally around 30% Max HP; cannot be used after total-party defeat
Existing Haste item remains. Same-status buffs never stack intensity.

## Character balance
Do not rebalance solely from perception before economy/presentation changes. After v0.2 systems land, run deterministic simulations across all 165 parties and encounter tiers. Hans is currently treated as a presentation/readability issue first. Pay particular attention to Greg/Nathaniel/Yatords high performance, Daboy identity/value, Leandre after shop improvements, Yeeho variance, and Marcus encounter length.

## Theatre / lore layer
Create data-defined short scene beats:
- post-party-selection departure
- first entry into each region
- elite entrance
- boss entrance + secret affinity reveal
- shop arrival/exit flavor
- event arrival/result flavor where appropriate
- region-complete transition
- final victory/defeat epilogue accent

Scene dialogue variants are seeded by run/scene ID. Relationship-aware variants may trigger when relevant party members are present. Canonical examples:
- Jonlow is Jiro's brother; Jonlow lines may include “I can't live without my brother”, “Cook for me”, or “Bring my brother home”.
- Klyde is Earl's brother; their shared presence can unlock alternate intro/reaction lines.

These relationships change dialogue only in v0.2, not combat stats. Scenes are short, skippable, and do not repeatedly block controls after the player has seen them during the same run.

## Responsive UX
390x844 remains canonical. Overlays become full-screen sheets on compact devices, centered theatre sheets on tablet/desktop. Battle director never depends on fixed coordinates; effects anchor to semantic unit/deployable elements. Wide layouts may use more horizontal staging without scaling the phone UI upward.

## Testing
TDD/domain tests cover status duration semantics, boss affinity determinism/pools, route minimum-combat constraints, encounter-scaled rewards, curated shop uniqueness/rarity, new items/revive legality, non-stacking buffs, event costs/odds, deployable trigger events and scene-variant determinism. Browser tests cover overlay return behavior, Guide access, move/status info, cutscene skip/continue, named enemy action presentation, Hans deployables and responsive viewports.
