# ABUNGI

## Game & Technical Specification v0.1

### 1. Product Summary

**Abungi** is a single-player, offline-capable, mobile-first PWA roguelike built around three-character turn-based party combat.

The game is inspired by the readability and immediacy of classic Pokémon combat UX, but it is not a Pokémon clone. It uses an original three-character JRPG combat system, roguelike run progression, original characters, a small combat-affinity system, persistent HP/PP resource management, shops, relics, items, elites, bosses, and branching routes.

The world is fictional. Filipino influence is subtle and primarily expressed through visual design, physical materials, occasional terminology, humor, and small cultural cues rather than through an explicitly Philippine setting.

Examples of acceptable flavor include a move named **Yosi** or a small amount of vernacular-inspired terminology. The majority of all UI, dialogue, descriptions, tutorial text, menus, and item names must remain English.

The game should feel handcrafted, tactile, playful, challenging, and visually memorable.

---

# 2. Product Principles

## 2.1 Core priorities

In priority order:

1. Fun turn-based gameplay.
2. Strong UI/UX.
3. Cohesive art direction.
4. Responsive animation and satisfying feedback.
5. Enough content for replayability.
6. Offline reliability.
7. Maintainable and replaceable content architecture.
8. Reasonable implementation complexity.
9. YAGNI.

YAGNI applies primarily to unnecessary systems, not presentation quality.

Do not sacrifice:

- animation quality;
- responsive feedback;
- audio;
- visual consistency;
- accessibility;
- usable tablet/desktop layouts;
- enemy variety;
- character identity;

merely to reduce line count.

Do sacrifice systems that do not materially improve the first playable release.

---

# 3. Explicit Non-Goals

Do NOT implement in v0.1:

- multiplayer;
- accounts;
- cloud saves;
- backend APIs;
- leaderboards;
- gacha;
- monster capture;
- breeding;
- equipment slots;
- crafting;
- procedural item generation;
- large skill trees;
- overworld movement;
- real-time combat;
- tactical grids;
- elemental systems with dozens of types;
- dual character affinities;
- complicated accuracy/evasion stages;
- IVs/EVs;
- separate physical/special attack statistics;
- permanent stat-grind meta progression;
- a large narrative campaign;
- microtransactions;
- Vercel-specific application logic.

Abungi should remain deployable as a static web application.

---

# 4. Platform and Technical Baseline

## Runtime

- Node.js: **22.x**, minimum 22.12
- Package manager: **pnpm**
- Record the actual pnpm version used in `packageManager`.
- Commit `pnpm-lock.yaml`.

## Application

- React 19
- TypeScript
- Vite 8
- `vite-plugin-pwa`
- CSS Modules + global design tokens
- Zustand for application/session coordination
- Zod for runtime content/save validation
- Vitest for game-engine/unit tests
- Playwright for critical UI flows
- optional lightweight animation library only where it improves maintainability; otherwise CSS/WAAPI
- no large game engine such as Phaser or Unity-in-WebGL

### Rendering philosophy

Use DOM + CSS + SVG.

Do not use canvas for the main interface.

Turn-based combat does not require a canvas engine, and DOM rendering provides better responsiveness, accessibility, maintainability, and adaptive layout support.

---

# 5. Deployment

Primary deployment target: **Vercel**.

The project must remain provider-portable.

`package.json`:

```json
{
  "engines": {
    "node": "22.x"
  }
}

```

Expected workflow:

```bash
pnpm install
pnpm dev
pnpm test
pnpm build

```

Vercel should build the static Vite application and serve `dist/`.

No Vercel Functions are necessary.

Use appropriate cache rules so:

- fingerprinted Vite assets can cache aggressively;
- `sw.js` does not receive an unsafe long immutable cache;
- the web manifest remains updateable.

---

# 6. PWA and Offline Requirements

Abungi must remain playable offline after the initial successful installation/load.

Use `vite-plugin-pwa` with generated Workbox service worker rather than implementing a custom service worker unless an actual requirement forces it.

Precache:

- app shell;
- bundled fonts;
- game data;
- required character artwork;
- enemy artwork;
- battle backgrounds;
- icons;
- essential SFX;
- essential music.

Never require remote CDN resources at runtime.

No Google Fonts CDN.

No remote image URLs in gameplay content.

When a new app version is available:

- do not force a reload during combat;
- show a non-blocking update notice;
- apply the update when the user deliberately reloads or returns to a safe screen.

Offline UX must include a small, tasteful indication when connectivity is unavailable, without making offline use feel like an error state.

---

# 7. Responsive Strategy

## Canonical layout

Portrait mobile is the primary design target.

Primary reference viewport:

**390 × 844**

Support smaller phones down to approximately:

**360 × 640**

without clipped primary actions.

## Tablet and desktop

Tablet and desktop are first-class supported experiences, not merely a stretched phone frame.

However, portrait remains the canonical composition for v0.1.

The architecture must allow a future release to make portrait and landscape equally canonical without rewriting gameplay components.

### Layout architecture

Battle UI exposes semantic regions:

- `enemyStage`
- `allyStage`
- `battleHUD`
- `actionTray`
- `combatMessage`
- `utilityControls`

Individual battle components must not know where those regions appear.

CSS grid/container-query layouts decide placement.

Suggested responsive modes:

### Compact

`< 600px`

Portrait-focused stacked composition.

### Medium

`600–1023px`

Larger battlefield and more breathing room. Controls may use additional horizontal space.

### Wide

`>= 1024px`

Battlefield and command region may sit in a wider composition rather than remaining an enlarged phone.

Do not detect phones/tablets via user-agent.

Do not orientation-lock the application.

Respect safe-area insets.

Minimum interactive target size: approximately 44×44 CSS pixels.

Desktop must support keyboard focus and useful hover states.

Future landscape support must be achievable mostly through layout definitions, not rewriting battle state or components.

---

# 8. Visual Direction

## Concept

**Handcrafted cardboard battle theatre.**

Characters and enemies look like illustrated cardboard/paper cutouts placed into layered tabletop scenes.

UI elements feel assembled rather than digitally generic.

Materials can evoke:

- printed cardboard;
- paper labels;
- rough ink;
- stickers;
- tape;
- stamped markings;
- subtle woven geometry;
- hand-painted signage;
- worn game pieces.

The result should remain controlled and readable.

Do not turn the interface into an overloaded scrapbook.

---

# 9. Anti-AI-Slop Rules

Abungi must not resemble:

- SaaS dashboards;
- generic AI landing pages;
- shadcn demos;
- glassmorphism;
- purple/blue gradient products;
- nested-card dashboards;
- arbitrary rounded rectangles;
- large hero marketing pages;
- stock icon grids;
- emoji-based game art.

Avoid:

- excessive pills;
- excessive border radius;
- gradients used merely because empty space exists;
- icon inside rounded square inside another card;
- giant whitespace inappropriate for a game;
- generic white cards on gray backgrounds;
- uniform 12px/16px corner rounding everywhere;
- decorative blur;
- fake “premium” glass effects.

Do not use shadcn/ui.

Do not use a generic web dashboard template.

---

# 10. Design Tokens

Use a small token system.

Suggested material palette:

- Paper: `#F2E7D5`
- Cardboard: `#C7A679`
- Ink: `#1E1A17`
- Deep Red: `#A9463B`
- Teal: `#247B78`
- Mustard: `#C9962E`
- Muted Green: `#6E7B4B`
- Mystic Purple: `#6C4A78`

Exact values may be adjusted for accessibility and visual cohesion.

Affinity colors should work as supporting signals rather than becoming the entire visual identity.

Typography should use locally bundled open-source fonts.

Use a distinctive display treatment for battle labels/headings and an extremely readable sans-serif for descriptions, values, and buttons.

---

# 11. Motion Language

Static illustrations must feel alive.

Characters can:

- lean;
- recoil;
- lunge;
- tilt;
- wobble;
- squash slightly;
- slide;
- bounce subtly;
- cast animated shadows.

Combat should use:

- hit-stop;
- damage-number pops;
- projectile movement;
- status VFX;
- smoke;
- particles;
- healing bursts;
- impact shake;
- cardboard wobble;
- defeat drop/fall;
- summon assembly animation.

Typical durations:

- button feedback: \~100–150 ms
- menu transition: \~160–220 ms
- character attack motion: \~250–450 ms
- strong signature sequence: \~500–900 ms

Do not make routine combat animations unnecessarily long.

Provide:

- 1×
- 2×
- 3×

battle animation speed.

Respect `prefers-reduced-motion`.

Reduced-motion mode must eliminate strong screen shake and reduce large transformations.

---

# 12. Audio

Include:

- UI click;
- confirm;
- cancel;
- error;
- hit;
- heavy hit;
- heal;
- status;
- coin;
- dice/scatter;
- summon;
- victory;
- defeat;
- shop;
- battle music;
- boss music.

Use local files.

Prefer CC0 supporting audio.

Provide:

- master mute;
- music volume;
- SFX volume.

Audio must unlock safely after user interaction on mobile browsers.

Failure to load or initialize audio must never make the game unplayable.

---

# 13. Run Structure

A run begins by choosing exactly **3 characters from 11**.

No duplicate characters.

All 11 are available in v0.1 so the full roster can be tested.

A successful run consists of three regions.

Each region has a branching node route terminating in a boss.

Node types:

- Battle
- Elite
- Rest
- Shop
- Event
- Boss

A region should generally contain approximately 5–7 meaningful nodes on the selected path before its boss.

Generated routes must obey safety constraints:

- no unavoidable chain of multiple elites;
- at least one useful recovery opportunity before a region boss;
- every route remains connected;
- no unreachable nodes;
- boss always reachable;
- no impossible shop/rest placement;
- seed determines route generation.

---

# 14. Primary Resources

Only four run resources:

1. HP
2. PP
3. Coins
4. Items

Do not introduce additional energy/stamina currencies.

HP and PP persist between battles.

Coins persist through the run.

Items are consumable.

---

# 15. Battle Model

Battle size:

- 3 player characters;
- 1–3 enemies normally;
- boss encounters may include summons.

All three player characters are simultaneously active.

No bench switching during combat.

Each living unit acts once per round.

At the start of every round, action order is calculated from Speed.

Changes to Speed during a round affect the next round, not the already-established current round.

On a player turn:

- Skill
- Item
- Guard

are available.

Guard consumes no PP.

Guard reduces incoming damage by approximately 40% until that character's next turn.

Enemy turns resolve automatically.

---

# 16. Enemy Information

Enemies DO NOT reveal upcoming moves.

Never show:

- next attack;
- intent icon;
- predicted damage;
- target forecast.

The player may see:

- enemy HP;
- affinity;
- active statuses;
- visible phase changes;
- current buffs/debuffs.

Enemy behavior must still be learnable rather than arbitrary.

Use deterministic/weighted behavior state machines and sensible repetition constraints.

A boss must not repeatedly select its strongest signature purely because RNG allowed it unless that repetition is explicitly part of the boss design.

---

# 17. Combat Affinities

Five affinities:

- Might
- Tech
- Trick
- Mystic
- Neutral

Relationship:

**Might → Trick → Mystic → Tech → Might**

Neutral has no strengths or weaknesses.

Examples:

- Might attacking Trick: strong
- Trick attacking Might: resisted
- Might attacking Mystic: normal

Default multipliers:

- Advantage: `1.5×`
- Resistance: `0.75×`
- Normal: `1.0×`

No immunity.

No dual affinities.

No STAB mechanic in v0.1.

When selecting a move, the UI may communicate:

- ADVANTAGE
- NORMAL
- RESISTED

for valid targets.

That does not count as revealing enemy moves.

---

# 18. Core Stats

Only:

- Max HP
- Power
- Guard
- Speed

No separate Special Attack/Special Defense.

No Evasion stat.

Baseline damage concept:

```text
raw = movePower × attackerPower / 100
mitigated = raw × 100 / (100 + defenderGuard)
final = mitigated × affinity × variance × modifiers

```

Damage variance should remain small, approximately:

`0.95–1.05`

Base critical chance:

approximately `5%`

Critical multiplier:

approximately `1.5×`

Keep all multipliers centralized in balance configuration.

---

# 19. Accuracy and Statuses

Moves contain simple accuracy values such as:

- 100
- 95
- 90

Do not implement stat stages.

Canonical reusable statuses:

- Strength
- Weaken
- Haste
- Slow
- Blind
- Fortified
- Exposed

Suggested effects:

- Strength: +25% Power
- Weaken: -25% Power
- Haste: +25% Speed
- Slow: -25% Speed
- Blind: ×0.75 hit chance
- Fortified: -30% incoming damage
- Exposed: +20% incoming damage

Durations use a consistent turn-based rule and are visible in the UI.

---

# 20. Character Roster

Display names must be content data rather than identifiers.

Renaming Michael to Japhet later must require only a content edit.

Similarly, shop names and ability copy must never be hardwired into engine logic.

## Earl — Trick

Role: healer / smoke debuffer / bruiser

Stats:

- HP 110
- Power 92
- Guard 95
- Speed 88

Passive — **First Responder**
The first heal Earl performs each battle is 20% stronger.

Moves:

**Knuckle Up**

- Might
- 18 PP
- 70 power
- reliable single-target attack

**Yosi**

- Trick
- 8 PP
- 45 power
- 90 accuracy
- applies Blind for 2 turns

**Patch Up**

- Neutral
- 6 PP
- heals one ally for 30% Max HP

**Adrenaline**

- Neutral
- 4 PP
- Earl gains Strength for 2 turns
- heals Earl for 12% Max HP

---

## Greg — Might

Role: pirate attacker / plunder

Stats:

- HP 108
- Power 108
- Guard 88
- Speed 92

Passive — **Spoils**
First KO Greg scores each battle grants 5 bonus coins.

**Cutlass**

- Might
- 18 PP
- 75 power

**Broadside**

- Tech
- 7 PP
- 55 power
- hits every enemy

**Plunder**

- Trick
- 6 PP
- 60 power
- KO grants 12 bonus coins

**Boarding Rush**

- Might
- 5 PP
- 90 power
- deals 25% extra damage against targets below half HP

---

## Michael — Tech

Role: soldier / reliable ranged damage

Stats:

- HP 96
- Power 110
- Guard 84
- Speed 100

Passive — **Steady Aim**
Michael's first damaging skill each battle cannot miss and deals 10% extra damage.

**Rifle Burst**

- Tech
- 16 PP
- 72 power

**Grenade**

- Tech
- 7 PP
- 50 power
- all enemies

**Suppressing Fire**

- Tech
- 7 PP
- 55 power
- 95 accuracy
- Slow for 2 turns

**Rally**

- Neutral
- 5 PP
- all allies gain Strength for 2 turns

The display name may later be changed from Michael to Japhet without changing any ID or combat code.

---

## Marcus — Tech

Role: navy-themed defensive controller

Stats:

- HP 122
- Power 88
- Guard 115
- Speed 70

Passive — **Bulkhead**
Marcus begins each battle Fortified for 1 turn.

**Deck Gun**

- Tech
- 16 PP
- 68 power

**Brace**

- Neutral
- 8 PP
- target ally becomes Fortified for 2 turns

**Signal Flare**

- Trick
- 6 PP
- applies Weaken to all enemies for 2 turns

**Full Cover**

- Neutral
- 4 PP
- entire party becomes Fortified for 1 turn

---

## Hans — Tech

Role: inventor / deployable summoner

Stats:

- HP 92
- Power 98
- Guard 80
- Speed 94

Passive — **Spare Parts**
Hans's first deployable each battle lasts one additional turn.

Maximum two deployables active.

**Sidearm**

- Tech
- 18 PP
- 65 power

**Sentry Unit**

- Tech
- 7 PP
- deploys a turret for 3 turns
- turret attacks a random enemy after Hans acts

**Repair Drone**

- Tech
- 6 PP
- deploys for 3 turns
- heals the lowest-HP ally after Hans acts

**Overclock**

- Tech
- 4 PP
- enhances currently active deployables and extends them by one turn
- if none exist, Hans gains Haste for 2 turns

---

## Yeeho — Trick

Role: gambler / calculated risk

Stats:

- HP 90
- Power 104
- Guard 78
- Speed 108

Passive — **House Edge**
The first poor Double Down outcome each battle refunds 1 PP.

**Loaded Dice**

- Trick
- 16 PP
- variable 55–90 power result

**Double Down**

- Trick
- 7 PP
- 60%: strong 110-power result
- 40%: 55-power result and Yeeho loses 12% Max HP

The odds must be visible before use.

**Safe Bet**

- Neutral
- 7 PP
- 60 power
- cannot miss
- Yeeho becomes Fortified for 1 turn

**All In**

- Trick
- 3 PP
- Yeeho sacrifices 20% current HP
- 125 power
- cannot reduce Yeeho below 1 HP through the sacrifice

---

## Jiro — Neutral

Role: chef / healing and sustained buffs

Stats:

- HP 106
- Power 82
- Guard 92
- Speed 84

Passive — **Mise en Place**
Positive statuses Jiro applies to allies last one additional turn.

**Pan Smack**

- Might
- 18 PP
- 62 power

**Hot Meal**

- Neutral
- 7 PP
- heals target for 25% Max HP
- grants Strength for 1 turn

**Full Plate**

- Neutral
- 6 PP
- target gains Strength and Fortified for 2 turns

**Chef's Table**

- Neutral
- 3 PP
- heals entire party for 16% Max HP
- removes one negative status from each ally

---

## Nathaniel — Mystic

Role: dark entity / health-risk caster

Stats:

- HP 88
- Power 116
- Guard 76
- Speed 96

Passive — **Dark Hunger**
Nathaniel gains 20% Power while below 40% HP.

**Shade Touch**

- Mystic
- 18 PP
- 72 power

**Hex**

- Mystic
- 8 PP
- 45 power
- applies Weaken for 2 turns

**Life Drain**

- Mystic
- 6 PP
- 70 power
- heals Nathaniel for 40% of damage dealt

**Abyssal Pact**

- Mystic
- 3 PP
- costs 15% Max HP
- damages all enemies
- sacrifice cannot reduce Nathaniel below 1 HP

---

## Yatords — Might

Role: cyclist/biker / speed and momentum

Stats:

- HP 94
- Power 98
- Guard 82
- Speed 120

Passive — **Momentum**
Whenever Yatords acts before at least one living enemy, gain 1 Momentum, maximum 3.

Each Momentum provides +8% damage.

**Pedal Strike**

- Might
- 18 PP
- 65 power
- +15% damage when Yatords is faster than target

**Draft**

- Neutral
- 8 PP
- Yatords and one ally gain Haste for 2 turns

**Drive-By**

- Trick
- 6 PP
- three 22-power hits

**Breakaway**

- Might
- 4 PP
- base 80 power
- gains +25 power per Momentum
- consumes all Momentum

---

## Daboy — Trick

Role: bartender / temporary buff and debuff specialist

Stats:

- HP 104
- Power 90
- Guard 96
- Speed 86

Passive — **Regulars Only**
Positive statuses Daboy applies to allies last one additional turn.

**Bottle Tap**

- Might
- 18 PP
- 65 power

**House Pour**

- Trick
- 7 PP
- target ally gains Strength for 2 turns

Flavor:
“Don't ask what's in it.”

**On the Rocks**

- Trick
- 7 PP
- 50 power
- Slow for 2 turns

**Last Call**

- Trick
- 3 PP
- all enemies receive Weaken for 2 turns

---

## Leandre — Trick

Role: merchant / opportunistic economy utility

Stats:

- HP 100
- Power 92
- Guard 88
- Speed 98

Passive — **Good Business**
When Leandre is in the party, shops offer one additional inventory choice.

**Scatter**

- Trick
- 16 PP
- four random 20-power hits
- if only one enemy is alive, all four hit it

**Markup**

- Trick
- 8 PP
- applies Exposed for 2 turns

**Cashback**

- Neutral
- 6 PP
- 60 power
- KO grants 15 coins

**Clearance Sale**

- Trick
- 3 PP
- costs 15 coins
- entire party gains Strength and Haste for 2 turns
- disabled with a clear explanation if funds are insufficient

---

# 21. PP Design

PP persists through encounters.

Approximate bands:

- common attacks: 16–20 PP
- strong attacks: 6–10 PP
- high-value support: 4–8 PP
- signature skills: 3–5 PP

Do not restore all PP after ordinary battles.

Resource attrition is intentional.

---

# 22. Encounters and Difficulty

Normal combat target:

**3–6 rounds**

Elite target:

**4–7 rounds**

Boss target:

**6–10 rounds**

Do not create challenge using huge HP pools.

Difficulty should come from:

- enemy compositions;
- target priority;
- affinity matchups;
- resource attrition;
- status pressure;
- PP conservation;
- healing decisions;
- elite-risk decisions;
- route decisions.

A player should usually understand why they lost.

---

# 23. Enemies

Minimum normal archetypes:

1. Scrapper — Might bruiser
2. Road Dog — fast Might attacker
3. Cutpurse — Trick debuffer
4. Smokehead — Trick/Blind specialist
5. Hexling — Mystic weaken/drain
6. Wisp — fragile Mystic attacker
7. Dronelet — fast Tech attacker
8. Bulwark Bot — Tech defensive support
9. Backstreet Medic — Neutral healer
10. Tin Brute — Neutral high-HP tank

Build enemy behavior from reusable AI rules such as:

- attack lowest HP;
- attack random;
- heal injured ally;
- buff ally;
- apply debuff;
- prefer offensive move below threshold;
- summon once;
- weighted selection.

Do not create ten bespoke AI engines.

---

# 24. Elites

At minimum:

### The Broker

Trick affinity.
Uses debuffs and economic pressure.

### Ironclad

Tech affinity.
Heavy defense and high-impact attacks.

### Night Maw

Mystic affinity.
Sustain/life-drain pressure.

Elites should reward substantially more than normal battles.

---

# 25. Bosses

## Jonlow, the Glutton

Identity: sustain/escalation boss.

Core themes:

- eating;
- healing;
- becoming stronger;
- punishing excessively passive play.

At lower HP, offensive pressure increases.

Do not reveal upcoming moves.

---

## Klyde, the Psycho

Identity: unstable-looking offensive boss.

Behavior should feel unpredictable but remain bounded.

Use weighted patterns and repetition limits.

Klyde can:

- multi-hit;
- self-buff;
- inflict status;
- switch attack styles.

Randomness must never mean unrestricted consecutive signature attacks.

---

## The Warden

Final boss for v0.1.

Tech-oriented controller.

Simple two-phase structure:

- phase 1: defensive control;
- once-only Dronelet summon near 60% HP;
- phase 2 below approximately 35% HP: gains Haste and becomes more aggressive.

Display name and theme are content data and may be renamed later without modifying boss logic.

---

# 26. Shops

Default shop display name:

**Lara's Shop**

The name must live in content/configuration.

Changing it to **Leandre's Shop** later must not require component edits.

Shop offers:

- healing consumables;
- PP recovery;
- temporary battle consumables;
- occasional relics.

Leandre's passive adds one offer.

No selling system in v0.1 unless implementation remains trivial after all required features are complete.

---

# 27. Rest Nodes

Offer exactly two primary choices:

### Recover

Restore approximately 35% Max HP to each living party member.

### Refresh

Restore approximately 30% of missing PP across the party.

Do not add complicated camping systems.

---

# 28. Items

Initial set should remain small.

Examples:

- Patch Kit — restore HP
- PP Tonic — restore PP to one move
- Field Ration — moderate party HP recovery
- Energy Drink — temporary Haste
- Smoke Bomb — escape a non-elite, non-boss battle
- Cleanser — remove negative statuses

Inventory capacity should be limited enough that item choices matter.

Approximately 6 slots is sufficient.

---

# 29. Relics

Create at least 12 meaningful relics.

Relics should primarily modify existing rules rather than introduce new subsystems.

Examples:

- first damage received each battle reduced;
- Might damage +10%;
- Tech damage +10%;
- Mystic damage +10%;
- Trick duration +1 under a constrained condition;
- first heal each battle stronger;
- +10% Speed;
- shop prices slightly reduced;
- small heal after elite victory;
- Hans deployables last one additional turn;
- first critical hit grants coins;
- PP restoration effects slightly stronger.

Avoid relics requiring large bespoke interfaces.

---

# 30. Skill Upgrades

Every skill can be upgraded at most once during a run.

Display upgraded skills with `+`.

Examples:

- more power;
- +1 status duration;
- +1 or +2 Max PP;
- stronger heal;
- reduced coin cost;
- stronger summon;
- improved secondary effect.

Upgrade data belongs inside ability definitions.

Do not hardcode upgrades in battle components.

---

# 31. Rewards

Normal battles:

- coins;
- occasional consumable.

Elites:

- stronger coin reward;
- choose 1 of 3 relics;
- skill upgrade opportunity.

Boss:

- meaningful recovery;
- rare relic or strong reward;
- skill upgrade opportunity;
- transition to next region.

Run progression should make the team stronger while resource pressure remains relevant.

---

# 32. Meta Progression

No permanent raw-stat upgrades in v0.1.

Store:

- runs started;
- wins;
- best score;
- bosses defeated;
- discovered relics;
- discovered enemies;
- character usage.

All 11 characters remain available.

Future progression can unlock options rather than permanent raw power.

---

# 33. Events

Implement at least 8 simple data-defined events.

Each event should present:

- short situation;
- 2–3 choices;
- clear result.

Possible outcomes:

- HP trade;
- PP restoration;
- item;
- coins;
- relic;
- temporary status;
- combat encounter.

Events must use the same content/effect system wherever possible.

Avoid custom event minigames.

---

# 34. Save Architecture

Local-first only.

Use IndexedDB through a small repository abstraction.

Persist:

- settings;
- profile;
- active run;
- route state;
- party;
- current HP/PP;
- inventory;
- relics;
- skill upgrades;
- RNG state;
- active combat state if combat is underway.

Autosave after every committed gameplay action or meaningful state transition.

Game logic must never depend directly on IndexedDB.

Use:

```text
SaveRepository

```

interface with an IndexedDB adapter.

All saves contain:

- schema version;
- timestamp;
- revision;
- payload.

Validate loads with Zod.

Implement save migration infrastructure starting at version 1.

A corrupt save should show a friendly recovery option rather than crash the application.

---

# 35. Deterministic Randomness

Do not use `Math.random()` directly inside game-domain logic.

Create a serializable seeded PRNG.

Persist its state.

Route generation, rewards, enemy random decisions, and combat random results use that PRNG.

This prevents reloading the browser from rerolling outcomes and improves reproducible tests.

---

# 36. Architecture

Use **Clean Architecture Lite**, not ceremony-heavy Clean Architecture.

Core rule:

**Game rules must be pure TypeScript and independent from React.**

Suggested structure:

```text
src/
  app/
    App.tsx
    appStore.ts
    appState.ts

  game/
    core/
      combat/
      rng/
      effects/
      statuses/
      progression/
      types/

    balance/
      constants.ts
      formulas.ts

    content/
      characters/
      enemies/
      bosses/
      abilities/
      items/
      relics/
      events/
      shops/
      contentRegistry.ts
      schemas.ts

  features/
    title/
    party-select/
    route/
    battle/
    reward/
    shop/
    rest/
    event/
    results/
    settings/

  services/
    save/
    audio/
    assets/

  ui/
    components/
    layout/
    tokens/

assets/
  characters/
  enemies/
  elites/
  bosses/
  backgrounds/
  icons/
  vfx/
  audio/
  fonts/

scripts/
  assets/
    fetch_assets.py

docs/
  ABUNGI_SPEC.md
  DESIGN.md
  ART_BIBLE.md
  ARCHITECTURE_INVARIANTS.md
  ASSET_GENERATION_GUIDE.md
  ASSET_MANIFEST.md

```

Keep files focused.

Avoid giant files containing all game content.

---

# 37. Content Architecture

Stable IDs must differ from display copy.

Example:

```ts
{
  id: "soldier",
  displayName: "Michael"
}

```

Do not use:

```ts
if (character.name === "Earl")

```

inside generic combat code.

Abilities should compose generic effects such as:

- damage;
- heal;
- status;
- cleanse;
- multiHit;
- spendCoins;
- grantCoins;
- summon;
- restorePP;
- sacrificeHP.

Only mechanics that genuinely require special handling receive registered custom effect handlers.

Custom behavior is keyed by effect type or mechanic ID, never by checking human-readable names.

Content must validate at startup/development time.

Failures must identify the offending content ID clearly.

---

# 38. Centralized Balance

Values likely to change frequently belong in central data/configuration.

Examples:

- affinity multipliers;
- damage variance;
- critical rate;
- Guard reduction;
- buff percentages;
- shop prices;
- region scaling;
- elite scaling;
- boss scaling;
- healing percentages;
- reward ranges.

Do not scatter balance literals across components.

---

# 39. Asset Strategy

Use hybrid strategy A.

## Bespoke identity layer

Preferred generated/original art:

- 11 playable characters;
- 10 normal enemy types;
- 3 elites;
- 3 bosses;
- title art;
- approximately 3 environment/background illustrations.

Style must remain consistent.

## Supporting layer

Use selected CC0 assets for:

- generic UI sounds;
- impact sounds;
- coins/dice sounds;
- small generic icons;
- controller/input glyphs;
- non-identity visual effects where appropriate.

Preferred source: Kenney.

OpenGameArt assets require individual license verification.

Default policy: CC0.

Do not combine random art packs merely because they are free.

---

# 40. Asset Manifest

Every external asset must be recorded.

Minimum fields:

```text
id
type
source
sourceUrl
license
licenseUrl
author
destination
sha256
notes

```

External assets are downloaded locally and bundled.

No hotlinking.

---

# 41. Asset Fetch Script

Provide:

```text
scripts/assets/fetch_assets.py

```

The script should:

- read the approved manifest;
- download only explicitly approved URLs;
- create directories safely;
- verify checksum when present;
- avoid overwriting modified files without warning;
- report friendly failures;
- print attribution/license information.

Prefer Python standard library so the script is easy to run.

The game itself must not depend on this script at runtime.

---

# 42. Bespoke Art Bible

All primary illustrations share:

- consistent camera angle;
- consistent rendering density;
- strong silhouette;
- transparent cutout-friendly background;
- limited but expressive shading;
- printed/cardboard texture;
- slightly exaggerated proportions;
- readable poses at mobile size;
- similar outline/edge treatment;
- no embedded text;
- no watermarks;
- no UI baked into art.

Characters should be distinguishable primarily through silhouette, pose, outfit, and prop.

Generated art that does not visually fit the existing canonical set must not be accepted merely because it is technically usable.

---

# 43. Missing Asset Fallback

If bespoke artwork is unavailable during implementation:

- create intentional stylized vector/cardboard silhouettes;
- give each character distinct props/shapes;
- maintain the same cutout presentation;
- never use emoji;
- never use random avatar generators;
- never hotlink unrelated art.

The application must remain visually coherent even before final illustrations are dropped in.

Asset identifiers must make final replacement trivial.

---

# 44. Asset Generation Documentation

Create `ASSET_GENERATION_GUIDE.md`.

It must contain:

- shared style prompt;
- negative constraints;
- image dimensions/aspect recommendations;
- transparent-background requirements;
- character-specific prompts;
- enemy prompts;
- boss prompts;
- workflow for using previously approved images as visual references.

Once the first few approved characters establish a style, subsequent generations should use them as consistency references.

---

# 45. Battle UX

Primary mobile composition:

Upper area:

- enemies;
- enemy HP/status/affinity.

Middle:

- player cutouts;
- party HP/status.

Lower:

- current character;
- actions;
- skill tray.

Skills display:

- name;
- affinity;
- current/max PP;
- useful effect information.

Four moves should be immediately scannable.

Selecting a targeted skill:

1. selects/highlights the move;
2. highlights valid targets;
3. target tap commits action.

Do not execute potentially destructive actions merely from accidental first tap.

Self-target and team-target moves should remain clear and fast.

Input must lock while an action is resolving.

Rapid tapping must never execute two moves.

Disabled moves explain why:

- 0 PP;
- insufficient coins;
- deployment slots full;
- invalid target.

---

# 46. Feedback States

Every interactive action needs:

- idle;
- hover where applicable;
- focus;
- pressed;
- selected;
- disabled;
- loading/resolving where necessary;
- failure/error.

Never leave the player wondering whether a tap registered.

Friendly errors should explain the actual reason.

---

# 47. Animation/Event Separation

Combat engine resolves rules.

Presentation layer animates results.

A combat action should return something conceptually similar to:

```ts
{
  nextState,
  events
}

```

Events can include:

- actionStart;
- lunge;
- projectile;
- hit;
- damage;
- heal;
- statusApplied;
- statusRemoved;
- summon;
- knockout;
- victory.

React components must not contain combat formulas.

Animation failure must never alter game outcome.

---

# 48. Accessibility

Support:

- keyboard focus;
- meaningful buttons;
- touch;
- `prefers-reduced-motion`;
- readable contrast;
- status meaning beyond color alone;
- scalable text;
- muted audio;
- no flashing patterns likely to trigger photosensitivity.

Desktop keyboard enhancements may include:

- 1–4 for skills;
- Escape for back/cancel;
- Enter/Space confirmation.

Touch remains the canonical interaction.

---

# 49. UI Quality Workflow

If Impeccable is available:

1. initialize product/design context;
2. preserve this specification as authoritative;
3. audit the completed UI;
4. critique battle, party selection, route, shop, and settings;
5. adapt tablet/desktop layouts;
6. review animation;
7. polish;
8. harden edge/error states.

Impeccable must refine the Abungi design language, not replace it with its own aesthetic.

Manually inspect actual rendered gameplay even if automated design checks pass.

---

# 50. Testing

## Domain tests

Cover at minimum:

- turn order;
- Speed changes;
- PP consumption;
- 0 PP rejection;
- Guard;
- all affinity relationships;
- status duration;
- Blind;
- healing caps;
- KO;
- multi-hit;
- critical calculation;
- Yeeho risk outcomes under seeded RNG;
- Hans summon limits;
- Yatords Momentum;
- Leandre coin requirements;
- enemy AI legal actions;
- victory/defeat;
- seeded determinism;
- route validity;
- save validation;
- save migrations.

## UI integration tests

Cover:

- new run;
- choose exactly 3 characters;
- battle skill targeting;
- item use;
- Guard;
- disabled PP state;
- battle victory;
- reward;
- route selection;
- shop purchase;
- rest;
- save and continue.

## Responsive checks

Visually inspect approximately:

- 390×844
- 768×1024
- 1024×768
- 1440×900

No clipped controls.

No unreachable actions.

No horizontal scroll except where deliberately designed.

---

# 51. Edge Cases

Explicitly handle:

- app closed during battle;
- app updated with an active save;
- corrupted save;
- 0 PP on every skill;
- insufficient coins;
- all but one ally KO'd;
- all enemies KO'd from multi-hit;
- target dies before later effect resolves;
- heal target reaches Max HP;
- Hans has full summon slots;
- summoned unit expires;
- damage sacrifice would self-KO;
- enemy healer is last remaining enemy;
- player taps repeatedly during animation;
- viewport rotates mid-battle;
- device goes offline mid-run;
- audio permission rejected;
- missing optional asset;
- PWA install unavailable;
- service worker update available mid-battle.

Guard must always give a PP-free legal player action even when all moves are exhausted.

---

# 52. Performance

Prioritize inexpensive DOM animation:

- transform;
- opacity.

Avoid animating expensive layout properties repeatedly.

Lazy-load screens where useful, but do not compromise guaranteed offline availability.

Compress images appropriately.

Use WebP/AVIF where supported by the asset workflow.

Avoid shipping enormous source-resolution artwork when display size is small.

Target smooth interaction on ordinary modern mobile hardware.

---

# 53. Documentation Required in Repository

Create:

```text
README.md
DESIGN.md
ARCHITECTURE_INVARIANTS.md
docs/ABUNGI_SPEC.md
docs/ART_BIBLE.md
docs/ASSET_GENERATION_GUIDE.md
docs/ASSET_MANIFEST.md

```

`ARCHITECTURE_INVARIANTS.md` must include:

1. game rules cannot depend on React;
2. display names cannot be identifiers;
3. content cannot import UI;
4. UI cannot contain battle formulas;
5. balance values live in balance/content configuration;
6. external assets require manifest metadata;
7. no runtime hotlinked gameplay assets;
8. saves are versioned and validated;
9. deterministic game randomness never calls `Math.random()` directly;
10. layouts use semantic battle regions so landscape can evolve independently.

---

# 54. Definition of Done

The release is not complete merely because it builds.

It must:

- run locally with pnpm;
- build successfully;
- install as PWA;
- continue to work offline;
- contain all 11 playable characters;
- allow every character to use all four moves;
- have functioning affinities;
- have persistent HP/PP;
- include route progression;
- include shops;
- include rests;
- include events;
- include relics;
- include items;
- include skill upgrades;
- contain normal enemies;
- contain elites;
- contain Jonlow;
- contain Klyde;
- contain The Warden;
- save and resume runs;
- survive rapid input;
- provide polished mobile UI;
- provide good tablet UI;
- provide good desktop UI;
- contain meaningful animation;
- contain audio with controls;
- contain proper feedback states;
- contain accessible reduced-motion behavior;
- have no obvious placeholder emojis;
- have no generic AI/SaaS visual language;
- pass tests;
- pass production build;
- be manually tested at multiple viewport sizes;
- contain documentation;
- be ready for static Vercel deployment.

The final implementation should be packaged as a ZIP without `node_modules`, temporary build caches, or unrelated artifacts.