# Abungi — Spec 03: Roster, Character Integration & Encounter Expansion

Status: proposed design for review. No gameplay implemented or balance validated by this document.
Date: 2026-09-08.
Scope: revised user draft, checked against the current working tree. Implementation requires a separate request. Proposed type, save, and interface changes remain subject to the project's implementation approval rules.

Companion: [Combat rules and validation](2026-09-08-roster-combat-rules-validation.md). Both documents constitute Spec 03. This document owns content and delivery requirements. The companion owns precise combat semantics and balance gates.

Predecessors:

- [Spec 01: Run Recovery, Economy & Reward Depth](2026-09-08-run-recovery-economy-reward-depth.md).
- [Spec 02: Events, Transformation & Run Variety](2026-09-08-events-transformation-run-variety.md).

## 1. Recommendation and changes to the draft

Keep Saq as a Neutral protector and Ken as a Mystic setup support. Their identities fill useful gaps, but affinity counts alone do not prove balance. Neutral has neither offensive advantage nor defensive weakness. Move affinity, survivability, turn order, and opportunity cost matter more than equal roster counts.

The draft has strong characterization but leaves essential mechanics undecided. An implementation agent would otherwise have to invent Ken's passive, both signatures, mitigation order, mark ownership, PP pricing, and most enemy behavior. This revision selects one initial design for each. Every proposed number is a tuning hypothesis, not a measured result.

| Draft issue | Revised decision | Reason |
|---|---|---|
| Role-based IDs such as `teacher_tank` | Use `saq` and `ken` | Existing characters use stable lowercase name IDs. Display names can still change independently. |
| Event tags as an extension requirement | Use existing `requiresCharacterId` | Spec 02 §9 explicitly rejects tags until multiple characters need a shared variant. |
| Automatic protection of any critically injured ally | Passive improves an explicitly assigned Protect only | Automatic rescue would undermine target selection and make low-HP builds safer without spending an action. |
| Protect may redirect, mitigate, or intercept | One-hit damage split with a bounded transfer discount | A single rule is explainable, testable, and distinct from Fortified. |
| Ken's passive absent | Define Collaborative Work | His four moves must not carry an unspecified fifth source of power. |
| Marks may multiply the next attack | Add fixed move power to one successful hit | Limits interaction with multi-hit moves and avoids multiplying an entire signature. |
| Full Sleeve may grant many different buffs | Apply the same conditional Script to living allies | One defensive tattoo is sufficient. No new buff menu or mark taxonomy. |
| Temporary PP surcharge framed as temporary resource loss | One avoidable +1 PP surcharge, once per enemy per battle | PP is persistent per move. Paying the tax permanently spends one extra use until recovery. |
| Three new enemies are immediately necessary | Build and audit one at a time | Existing AoE, multi-hit attacks, healers, and controllers already pressure the new kits. |
| Optional support enemy and elite | Defer both from the initial release | Existing Medic, Bulwark Bot, Broker, and Warden cover much of that space. |
| Four deterministic seeds and inclusion results implied sufficient | Upgrade policy, pairing, metrics, and run tests before tuning | Current audit undervalues setup and does not model run attrition. |

Alternatives considered: pure damage reduction for Saq is cheaper but overlaps Fortified. Full redirection and a general tattoo framework create more balance and state complexity than these kits need. The selected approach adds only the bounded mechanics necessary for the two identities.

## 2. Verified baseline and predecessor reconciliation

Evidence paths are repository-relative. The working tree contains ongoing Spec 01/02 changes. Historical documents describe earlier snapshots and are not current completion evidence.

| Finding | Evidence | Consequence |
|---|---|---|
| Eleven characters, four abilities each | `src/game/content/characters.ts`, `CHARACTERS`, `ABILITIES` | Counts in the draft are correct: Trick 4, Tech 3, Might 2, Neutral 1, Mystic 1. |
| Exactly three unique characters per battle | `src/game/core/combat/battleEngine.ts`, `createBattle` | Unordered parties: 165 before, 220 after Saq, 286 after Ken. Slot order can still affect deterministic ties. |
| One PP spent from the selected ability per skill | `battleEngine.ts`, `resolveBattleCommand`; `actions.ts`, `validatePlayerCommand` | `maxPP` is a reserve of uses, not a shared mana cost. |
| Guard stat and Guard action are different | `damage.ts`, `status.ts`, `constants.ts` | Stat mitigation is `100 / (100 + guard)`. Guard action multiplies incoming damage by 0.6, Fortified by 0.7. |
| Standard statuses contain only ID and remaining duration | `src/game/core/types.ts`, `StatusInstance` | Source-linked Protect/marks cannot be inserted as ordinary duration-only statuses without defining their additional state. |
| Existing statuses tick after the affected unit acts | `battleEngine.ts`, `tickOnlyExisting` | Source-turn expiry needs an explicit rule. Do not assume a generic duration of 1 means “until Saq's next turn.” |
| Enemy target selection favors lowest HP percentage 65% of the time, otherwise random | `src/game/core/combat/enemyAi.ts`, `chooseEnemyTargets` | Protection is predictive without revealing intent. Equal-HP targeting makes party-slot audits relevant. |
| Nathaniel gains 20% Power below 40% HP | `status.ts`, `effectivePower` | Protect must not cancel HP sacrifice or provide automatic low-HP rescue. |
| Jiro and Daboy extend positive statuses they themselves apply | `battleEngine.ts`, `statusDuration` | Their presence does not extend Saq's Protect or Ken's marks. |
| Backstreet Medic heals, Bulwark Bot buffs, Klyde multi-hits, Wisp and bosses use AoE | `src/game/content/enemies.ts` | Test these existing counters before adding encounter pressure. |
| Current event hook is `requiresCharacterId?: string` | `src/game/content/events.ts`; `src/game/core/progression/events.ts` | New variants are content entries, not a new tag framework. |
| `fourth-chair` is proposed in Spec 02 but absent from inspected event definitions | Same event files, Spec 02 §8 | Recruitment integration is conditional on its actual implementation. Do not claim it exists yet. |
| Save version is already 2 with V1 migration | `src/game/core/save/saveFormat.ts`; `src/services/save/schema.ts` | Do not follow older prose that still calls V2 a future change. New structured battle state needs coordinated version handling. |
| Active battles persist, battle export carries only HP, PP, upgrades | `types.ts`, `RunState`; `battleEngine.ts`, `exportPartyFromBattle` | Save in-battle effects, clear them between encounters. |
| Audit enumerates parties dynamically but prints hardcoded 165/12 counts | `scripts/balance-audit.mjs` | Fix report provenance before relying on expanded-roster results. |
| Audit uses four party-dependent seeds, fresh HP/PP, no relics/items, one heuristic | Same script | Not a fair paired replacement experiment, nor a run-completion audit. |

Existing audit context only: `docs/BALANCE_AUDIT_V03.md` reports 92.8% normal wins at 4.02 mean rounds, 82.3% elite wins at 6.09, and 69.4% boss wins at 8.89. These were not rerun for this spec and do not certify the current dirty working tree. Nathaniel was already directionally strong in that report, so Ken should not be benchmarked solely against his burst.

## 3. Acceptance criteria and scope

1. Thirteen selectable characters, exactly four abilities and one passive each. No third addition.
2. Saq meaningfully protects one chosen ally. Marcus retains sustained party mitigation and control.
3. Ken provides visible setup and team follow-through. Nathaniel retains immediate Mystic damage, sacrifice, and drain.
4. Protect, Ink Mark, Script, and Taxed follow the companion's exact trigger, expiry, stacking, and save rules.
5. New effects neither refund PP nor heal. Existing recovery remains subject to Spec 01's run budget.
6. Two event variants per new character use existing events and the Spec 02 hook. Every offered cost/reward is explicit, deterministic, and revalidated on commit.
7. Three normal-enemy candidates are evaluated sequentially. Ship each only if it adds a measured target-priority decision without invalidating defensive builds.
8. Existing bosses, three regions, route length, and economic reward layers remain unchanged.
9. All-party simulations and targeted human checks meet the companion's release gates. Raw personal damage and marginal inclusion win rate are not sufficient judgments.
10. Full save/resume preserves mechanic state and deterministic outcomes. Old saves migrate without lost party/resources. New assets and UI work offline and at existing required viewports.

No tattoo inventory, equipment, crafting, new currency, permanent marks, permanent stacking meter, taunt, new target-selection subsystem, new difficulty mode, or blanket enemy HP increase. Additional lore relationships, a support enemy, and an elite are deferred because their need is not demonstrated.

## 4. Saq: character identity

Stable character ID `saq`. Display name **Saq**. Neutral affinity. Role **Teacher / Protector / Interceptor**. Asset ID `character-saq`.

Saq notices danger and steps between it and someone else. He is responsible, stern, dryly funny, sometimes exhausted by reckless people, and capable of warmth. Teaching is his profession, not the subject of every joke. Avoid repeating “Class dismissed,” homework, and grades as his entire vocabulary.

Visual direction: sturdy stance and shoes, messenger bag, folder or book, pointer or chalk. His silhouette must read as a teacher who can take an impact, not an armored knight. A folding board or broad folder can catch a hit. Interception moves his cutout briefly between attacker and ally.

Initial base stats: **116 HP / 84 Power / 104 Guard / 94 Speed**. Marcus currently has 122/88/115/70. Saq trades some bulk for timely protection. He should not be the slowest defender when his main skill must precede danger. No artificial turn priority is added.

### Kit

All skills cost the normal one PP per use. Reserve values below are separate per move. Attack accuracy is 100 before existing Blind and other applicable rules.

| ID / name | Affinity / target | Max PP | Initial effect | One upgrade |
|---|---|---:|---|---|
| `corrective-action` / Corrective Action | Neutral / one enemy | 18 | 60 power. Add 12 power if the target currently has Weaken, Slow, Blind, Exposed, or Ink Mark. Multiple negatives grant no extra bonus. | Base power 60 → 70. |
| `take-your-seat` / Take Your Seat | Neutral / one other living ally | 8 | Assign Protect until the start of Saq's next turn. First qualifying hit splits damage with Saq. | Max PP 8 → 9. |
| `pop-quiz` / Pop Quiz | Neutral / one enemy | 7 | 40 power and Weaken for 2 target turns. Damage/status share one hit check. | Base power 40 → 50. |
| `dismissed` / Dismissed | Neutral / one enemy | 4 | 70 power. Consume Ready to add 35 power for this use. Usable without Ready. | Base power 70 → 80. |

**Passive — Class Monitor (`class-monitor`).** Once per battle round, when Saq's assigned Protect actually redirects positive damage, reduce Saq's transferred damage by up to 5 HP. It never creates protection on an unassigned ally and never triggers from self-costs. All successful Protect activations grant Ready independently of the passive's round limit.

**Ready** is a binary payoff, not a meter. It lasts through the end of Saq's next completed turn after activation. It is consumed when Dismissed commits, even on a miss. Reapplication refreshes that one window without stacking. Choosing another skill can forfeit the payoff. KO clears it. No damage-absorbed scaling: players should not deliberately take larger hits to charge a stronger signature.

The companion defines Protect's split and timing. Player summary: “Protect one ally until your next turn. On the first direct hit, they take half; Saq takes a reduced share. Gain Ready for a stronger Dismissed.” Detailed copy states exact rounding and amounts.

### Strengths, weaknesses, and synergy

Strengths: focused-pressure survival, reliable Neutral coverage, useful Weaken when protection is unnecessary, a simple defensive payoff, good protection of Hans or fragile attackers.

Weaknesses: no passive rescue, no healing, modest damage, finite protection uses, a one-hit limit, exposure to opening fast enemies, and partial protection against AoE or multi-hit sequences. Protect can save the ally and KO Saq. Repeated protection sacrifices his attack turns.

| Combination | Intended benefit | Required risk check |
|---|---|---|
| Earl + Saq | Heal the unit that absorbed pressure, enable conditional attack via Blind | Remaining party HP and run PP, not just survival in one fight |
| Jiro + Saq | Sustain and safe offensive buffs | Long fights, recovery efficiency, no accidental extension of Protect |
| Marcus + Saq | Fortified plus one-target protection | No second mitigation pass on transfer, no indefinite defense loop |
| Nathaniel + Saq | Protect a deliberately fragile damage dealer | Below-40% uptime, unavoidable sacrifice, protector mortality |
| Yeeho + Saq | Survive enemy retaliation after taking risks | Double Down and All In HP costs remain fully payable |
| Hans + Saq | Keep deployables' owner alive | Repair Drone creates sustain not captured by healer-only checks |
| Ken + Saq | Layer two finite defenses | Shared prevention order and small-hit consumption in companion |

## 5. Ken: character identity

Stable character ID `ken`. Display name **Ken**. Mystic affinity. Role **Tattoo Artist / Setup Support**. Asset ID `character-ken`.

Ken is observant, confident in his craft, creative, and thoughtful about permanence and identity. He can look intimidating without acting like a generic mysterious occultist. Dry criticism of poor workmanship and attention to unnoticed details are useful recurring traits.

Visual direction: tattoo machine or marker, gloves, stencil paper, sketchbook, and a visible tattoo at mobile scale. Effects use drawn strokes, ink blots, stencils, and paper overlays. Avoid generic glowing purple circles. Offensive marks and defensive scripts use distinct shapes and labels.

Initial base stats: **98 HP / 90 Power / 84 Guard / 102 Speed**. His speed enables Michael, Nathaniel, Greg, and slower allies to follow up in the same round under ordinary turn order. Faster Yatords and Yeeho may consume a surviving mark on the next round. Speed is a meaningful synergy constraint.

### Kit

| ID / name | Affinity / target | Max PP | Initial effect | One upgrade |
|---|---|---:|---|---|
| `fresh-ink` / Fresh Ink | Mystic / one enemy | 16 | 45 power. A successful hit applies Ink Mark if the target survives. May consume an older mark, then apply one new mark. | Base power 45 → 53. |
| `protective-script` / Protective Script | Neutral / one living ally, including self | 6 | Apply one Script. A qualifying large direct hit consumes it to prevent up to 10 HP. | Max PP 6 → 7. |
| `needlework` / Needlework | Mystic / one enemy | 6 | Three 20-power hits. If this action consumes Ink Mark, add another 12 power to that same hit, once. | Each hit 20 → 23. |
| `full-sleeve` / Full Sleeve | Neutral / all living allies | 3 | Apply Script to each living ally using exactly Protective Script's rule. No heal, ordinary buffs, or offensive marks. | Max PP 3 → 4. |

**Ink Mark (`ink-mark`).** The next successful direct damaging skill hit adds **20 move power**, then consumes the mark. The added power takes that hit's affinity, not automatically Mystic affinity. It is processed through ordinary defense and modifiers once. This is ink enabling someone else's technique. It creates no separate damage packet or RNG roll.

**Passive — Collaborative Work (`collaborative-work`).** Once per battle round, when another living ally consumes Ken's Ink Mark with a skill, add **8 additional move power** to that same hit. Ken's own consumption does not trigger it. His source must still be alive, and deployables/items do not qualify. No PP refund or healing.

**Script (`protective-script`).** If incoming direct-hit damage after ordinary defenses and existing relic mitigation is at least 20% of the recipient's Max HP, consume Script and prevent up to 10 HP. Lower damage leaves it intact. Expires at the start of Ken's second subsequent turn. Cannot revive or react to HP sacrifice. Full Sleeve uses this same effect, not a stronger parallel implementation.

Both marks expire at the start of Ken's second subsequent turn. This gives setup one full intervening Ken turn plus opportunities for faster allies without indefinite upkeep. A fresh mark can be consumed only by a later skill action. Neither marks nor passive power stack by hit count.

Full Sleeve is a deliberate revision of the draft: broad preparation using a conditional one-use defense. It differs from Marcus's Fortified, which mitigates every hit during its duration. If Full Sleeve wins every defensive decision, lower its reserve or prevention value before adding more tattoo types.

### Strengths, weaknesses, and synergy

Strengths: setup that still deals modest immediate damage, flexible teammate follow-up, Mystic coverage, preparatory defense against larger hits, useful decisions across short and long fights.

Weaknesses: lower immediate Power than Nathaniel, marks wasted by KO/expiry/poor sequencing, no healer role, setup requires an action and PP, small-hit sequences bypass Script's threshold, and another ally may consume a mark on a weaker move than intended.

Ken is not guaranteed special multi-hit synergy. Marks add a bounded amount once, so fast follow-up and target coordination are his strengths. Needlework's extra 12 power provides his own payoff without making Drive-By or Scatter multiply the bonus.

| Combination | Intended benefit | Required risk check |
|---|---|---|
| Nathaniel + Ken | Same-target Mystic pressure | Tech bosses, Dark Hunger, Life Drain must not count mark damage twice |
| Greg + Ken | Enable a finisher | Boarding Rush and KO rewards resolve once, no separate mark KO ownership |
| Yatords + Ken | Fast next-round follow-up | Momentum, Haste, multi-hit cap, expiration order |
| Michael + Ken | Same-round follow-up at base speeds | Steady Aim, first-skill criticals, Tech versus Mystic coverage |
| Leandre + Ken | Exposed plus setup | Scatter target RNG, one passive per round, no repeated mark triggers |
| Daboy/Jiro + Ken | Strength boosts the follow-up | Their passives extend only their own ordinary buffs |
| Hans + Ken | Keep an artist or builder alive | Turret must not steal offensive marks or trigger the passive |
| Marcus/Saq + Ken | Prepared defense | Prevention budgets, pacing, no recovery generated by either new kit |

## 6. Events, lore, and availability

Add Saq and Ken to initial party selection when their combat checkpoint passes. No unlock grind or new account/profile system. Content-driven selection, guide, usage reporting, upgrade rewards, and PP initialization must recognize them.

If Spec 02 recruitment exists by implementation time, include each in its existing eligible candidate pool. Preserve duplicate exclusion, outgoing slot, HP/PP percentage and upgrade-count transfer, and its stated KO floor. New characters must not enter with full reserves when replacing an exhausted member. Recruitment is not built as part of this spec if still absent.

### Event contract

Ship **two variants each**, on existing events. Add choices carrying `requiresCharacterId: 'saq'` or `'ken'`. Reuse `canChooseEvent`, `applyEventChoice`, and derived offers. No runtime event tags. The draft's protective/teacher/artist/mystic vocabulary remains editorial characterization only.

Keep the currently implemented membership rule, including KO party membership, consistent across all characters. Do not add a new “must be alive” rule for only these two. Arrival dialogue must not imply a KO character has been revived.

| Event / new choice ID | Choice and exact initial outcome | Difference from base |
|---|---|---|
| `sparring-yard` / `saq-coach` | **Coach the session**: pay 16 coins and 8% Max HP from living allies, select one existing seeded upgrade offer | Six-coin saving versus Train. Same injury, offers, eligibility, and HP floor. |
| `bulk-deal` / `saq-organize` | **Organize the pickup**: gain 20 coins, no items | Six more coins than helping pack. Gives up buying the crate. |
| `paper-shrine` / `ken-read-work` | **Read the work**: pay 10 coins for the same eligible random unowned relic | Six-coin saving. Preserve existing rarity restrictions and exhausted-pool gating. |
| `old-locker` / `ken-trace-latch` | **Trace the latch**: lose 3% Max HP from each living ally, receive one Field Ration | Two percentage points less injury than Force. Still requires pack room, still costs HP. |

The coin-only helpers are not free bonus payouts layered over other choices. Choosing one resolves the node and forfeits alternatives. Ken's locker improvement is the one modest effect tier allowed by Spec 02. Evaluate total realized event benefit per run, not just each variant separately.

When Saq and Leandre, or Ken and Greg, are present together, show their eligible choices as alternatives. Do not combine discounts or rewards. Every event retains its existing free exit. No hidden probability or consequence may become visible only because a character is present, since current event hints already disclose outcomes.

The draft's Street Dispute, Lost Travellers, Tattoo Booth, and Damaged Artwork are future themes, not additional event definitions in this release. Existing-event variants keep Spec 02's content budget intact.

### Required writing inventory

Per character: one character-detail biography of 50–80 words, one departure variant, one region-transition variant, the two event results above, and one selected boss/elite reaction. Each repeatable scene is at most two short lines per speaker, skippable, with deterministic selection through `src/game/content/scenes.ts`.

Examples of voice:

- Saq, departure: “Keep close. You can argue when we're somewhere safer.”
- Saq, successful protection: “I've got this. Watch the other one.”
- Saq, Warden: “Order should protect people.”
- Ken, departure: “Give me a moment. I want to get the lines right.”
- Ken, event: “See the second stroke? Someone changed the original.”
- Ken, region transition: “Different paper. Same bad workmanship.”

Do not invent family ties or history with bosses. Preserve existing Jonlow/Jiro and Klyde/Earl relationship variants' priority. When both new characters qualify for a scene, use stable authored precedence or the existing seeded choice mechanism, never duplicate scenes or consume run RNG for dialogue.

## 7. Enemy expansion

Introduce one candidate per audit step. Numbers below are unscaled content stats, processed through existing tier/region multipliers. Do not copy already-scaled encounter HP into definitions. New content must not inspect party character names or IDs to choose counters.

### Candidate definitions

| Stable ID / display / affinity | HP / Power / Guard / Speed | Moves | AI / coins / asset |
|---|---|---|---|
| `paste-scraper` / Paste Scraper / Trick | 76 / 80 / 68 / 88 | **Scrape** (`scraper-scrape`): 48 Trick power, weight 5. **Peel Away** (`peel-away`): 36 Trick power, then remove one eligible positive effect on hit, weight 3, cooldown 2. Both enemy-one. | controller / 7–11 / `enemy-paste-scraper` |
| `prybar-bruiser` / Prybar Bruiser / Might | 96 / 90 / 82 / 68 | **Bar Swing** (`bar-swing`): 60 Might power, weight 5. **Pry Open** (`pry-open`): 60 Might power with partial Guard-action penetration, weight 3, cooldown 2. Both enemy-one. | aggressive / 8–12 / `enemy-prybar-bruiser` |
| `toll-hexer` / Toll Hexer / Mystic | 72 / 78 / 62 / 86 | **Stamp** (`toll-stamp`): 44 Mystic power, weight 5. **Taxing Hex** (`taxing-hex`): no damage, apply Taxed to one enemy, weight 4, once per battle. Both enemy-one. | controller / 7–11 / `enemy-toll-hexer` |

These definitions and their mechanic IDs do not exist yet. Reuse existing weighted profiles, cooldowns, once flags, and target selection. No new scripted AI profile or target-intent UI. Both damage-plus-disruption effects share a hit check. Full rules are in the companion.

Paste Scraper carries a wide paint scraper and peeling labels. Prybar Bruiser has a bent prybar and low, braced stance. Toll Hexer carries a ticket roll and stamp. Use local cardboard cutouts. Explicit choreography: Scrape/Bar Swing melee, Peel Away utility, Pry Open heavy, Stamp/Taxing Hex mystic.

### Mechanics and counterplay

- **Peel Away** removes only one effect after damage. Eligible: Strength, Haste, Fortified, or Script. It cannot remove Protect, Ready, or an enemy's negative Ink Mark. Stable priority is defined in the companion. Buffing remains useful because ordinary attacks do not strip and disruption has two intervening enemy turns of cooldown.
- **Pry Open** changes the Guard action's multiplier from 0.6 to 0.8 for that hit only. Base Guard stat, Fortified, Protect, and Script remain functional. An unguarded target receives an ordinary 60-power hit. No added Exposed or buff removal.
- **Taxing Hex** makes the target's next skill cost two PP instead of one, expiring after its next completed turn. Guard or an item waits it out. Only one application by that enemy per battle, no stacking or refund. It must be described as an avoidable persistent PP expense.

### Encounter content

Add one two-enemy encounter per shipped candidate, preserving the existing six normal encounter IDs:

| ID / name | Composition | Choice tested |
|---|---|---|
| `normal-peeling` / Peeling Paint | Paste Scraper + Scrapper | Remove disruption or immediate damage first |
| `normal-pry-clinic` / Forced Entry | Prybar Bruiser + Backstreet Medic | Pressure versus recovery |
| `normal-toll-road` / Toll Road | Toll Hexer + Road Dog | Spend extra PP to remove fast pressure or wait out the tax |

At most one new archetype per normal encounter in this release. No duplicate tax enemies, no new three-counter composition, no new archetypes inserted into existing boss fights. Route selection must keep old encounters reachable and within existing region/tier rules. Record actual exposure after pool growth. If a candidate fails its value or fairness gate, omit that candidate and its encounter together and report the reduced count.

Keep normal pacing at 3–6 rounds, elite at 4–7, boss at 6–10, interpreted statistically in the companion. Increasing the encounter pool changes exposure even if rewards per fight stay constant. Recheck complete-run HP/PP and rewards.

### Optional content decision

No additional support enemy initially: Medic and Bulwark Bot already create support priority. No elite initially: Headmaster risks overlap with Warden's discipline/control identity and Broker's pressure. Inkbound risks turning one player's mark rules into a new enemy mechanic before players know them.

After all release gates, a separate proposal may justify **one** elite with evidence of a missing encounter role, distinct pattern, region placement, and pacing. Neither working name is a commitment. No fourth region or boss.

## 8. Presentation and accessibility

Protect resolution communicates: original target → Saq interposes → ally loss and Saq loss separately → Ready indication → return to positions. Ken communicates: setup hit → mark stamp → later consumption → one enhanced hit. Script communicates the large-hit trigger and prevented amount. Taxed prints “Next skill costs 2 PP; expires after your turn.”

Show persistent icon plus text access for Protect, Ready, Ink Mark, Script, and Taxed. Detail sheets identify source, duration anchor, trigger, and values. A label such as “until Ken's next turn” must match the current expiry countdown. Do not display source IDs as player copy.

Use existing `StatusStrip`, `DetailPanel`, `CutoutArt`, and combat director seams. Additional combat events need source and recipient attribution. React renders resolved facts and never recomputes authoritative damage. Enemy attacks are named after commitment, never previewed as future intent.

Reduced motion uses static outlines, a connecting line, and immediate labeled HP changes. All animation speeds produce identical final state. Marks cannot cover HP, status icons, target controls, or Hans's deployables. Do not use color alone. Give Saq and Ken character accents with sufficient contrast in the existing accent system.

Selection supports keyboard navigation, visible focus, Enter on explicit selection, Escape/Back to cancel, accessible control names, and focus return. Invalid self-target for Protect is disabled with a reason. Script refresh with no benefit and Full Sleeve with no eligible improvement are disabled. Damage skills remain legal without their conditional bonus. Loading/resolution locks, empty/dead-target states, asset fallback, and save failure all retain usable explanations and exits where appropriate.

Ship a local cutout for each new character/enemy, stable asset registration, all move/passive/upgrade descriptions, guide entries, and offline inclusion. No art-generation dependency or remote runtime asset service is needed by this specification.

## 9. Delivery sequence and existing seams

No gameplay work is authorized by this documentation change. Before each future implementation slice, trace the then-current code, state acceptance criteria, identify exact type/interface changes, and apply the project's scope approval gates. Do not implement this whole spec as a single multi-module change.

| Phase | Deliverable | Gate before next phase |
|---|---|---|
| 0 | Freeze the stabilized Spec 01/02 baseline, record repository revision plus dirty-diff provenance, run existing diagnostics, make simulator ready to evaluate protection | Reproducible baseline, no guessed predecessor completion |
| A | Saq core kit, minimum readable UI/assets, save support, upgrades and selection | Combat contracts and save checks pass |
| B | Saq all-party and targeted audit | 220 parties, survival/pacing/PP gates, human protection check |
| C | Saq event variants and required lore | No generic event-core character branches or economy inflation |
| D | Ken kit, minimum readable UI/assets, mark-aware simulation, coordinated save update if needed | Mark contracts pass, 13-character content complete |
| E | Ken and Saq+Ken audit | 286 parties, setup usefulness, burst and layered-defense gates |
| F | Ken event variants and required lore | Same event gates as Saq |
| G1–G3 | One enemy and one encounter at a time | Old-roster comparison, new-roster pacing, counterplay and exposure checks each step |
| H | Final encounter and complete-run audit, responsive/offline/save checks | All release criteria supported by fresh evidence |
| I | Record whether a separate elite proposal is justified | Default decision: defer |

Existing integration seams, not a mandate to edit every listed file:

- Content: `src/game/content/characters.ts`, `enemies.ts`, `events.ts`, `scenes.ts`, `guide.ts`, `contentRegistry.ts`.
- Combat rules: `src/game/core/types.ts`, `combat/battleEngine.ts`, `combat/actions.ts`, `combat/damage.ts`, `combat/status.ts`, `combat/enemyAi.ts`, `src/game/balance/constants.ts`.
- Persistence: `src/game/core/save/saveFormat.ts`, `src/services/save/schema.ts`, current save repository flow.
- Presentation: `src/features/battle/BattleScreen.tsx`, `combatDirector.ts`, party selection, `src/ui/components/StatusStrip.tsx`, `src/ui/overlays/DetailPanel.tsx`, `src/ui/charAccent.ts`, `src/services/assets/assetRegistry.ts`.
- Evidence: `scripts/balance-audit.mjs`, `scripts/economy-audit.mjs`, existing domain/Vitest/release/Playwright suites.

Proposed structured mechanic state and any added effects/events are not existing exports. Name and review their exact types during the relevant implementation slice. Do not build a general plugin, reaction, or status scripting engine.

## 10. Specification review evidence and next decision

This review inspected character definitions, damage/status/action/turn code, enemy content/AI, save envelope and Zod validation, event definitions and extension logic, scene hooks, balance constants, historical balance report, audit script, README, architecture invariants, and relevant predecessor sections. No balance simulation or human playtest was performed for unimplemented mechanics.

The initial sandboxed read failed with `helper_unknown_error: apply deny-read ACLs`. Authorized read-only inspection outside that failing sandbox succeeded. No secrets were read. Existing gameplay and predecessor-document changes were preserved.

Next decision: review this proposed kit and the companion's numerical trial values before requesting implementation. The recommended first implementation slice is Saq plus his bounded Protect state, readable presentation, save compatibility, and a simulator that can actually use him.
