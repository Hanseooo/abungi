# Abungi v0.3 — Mobile, Color, Balance, Content & Animation Polish

Status: approved design (brainstorm complete). Implements as one spec across five phased
workstreams. All balance/economy numbers marked *(proposal)* are starting values validated by
re-running the existing deterministic audits before they are locked.

## Goals

1. Make the game legible and playable on short/small phones (375×667 and down), not just the
   canonical 390×844.
2. Fix concrete color problems: unreadable START NEW RUN button; add exclusive per-character
   accents for Earl (pink) and Hans (maroon) inside a system that stays uniform for everyone else.
3. Reduce the boss death-spiral: revive KO'd allies at region completion, plus a modest boss ease.
4. Nudge balance outliers without new encounters; re-validate against the audits.
5. Fill content gaps with a few net-new items/relics/events and one new post-battle reward option.
6. Add a curated set of animations within the existing motion budget.

## Non-goals

- No new enemies or bosses (tuning only).
- No character-kit reworks (outlier nudges only).
- No new run currency or new screens.
- No new dependency, schema-breaking change, or Node version change.
- Per-character accents beyond Earl/Hans (the mechanism is general, but only those two override).

---

## WS1 — Mobile / UX

Source of problems: `src/styles.css` battle section (lines ~261–439) and `BattleScreen.tsx`.

1. **Phase banner overlap.** The "ASSEMBLE" phase banner overlaps and truncates the combat
   message (enemy-move text). Reposition the banner so it never covers `.combat-message`, and let
   the message fit two lines (raise `min-height`, allow wrap) instead of clipping to one ellipsised
   line. The enemy-move name after commitment must stay fully readable.
2. **Stop hiding info on short screens.** The `@media (max-height:700px) and (max-width:599px)`
   block (styles.css:432) currently hides `.status-strip` and `.skill-button > small`. DESIGN.md
   principle 1 requires status to stay scannable. Replace hiding with: tighter spacing, a
   scrollable `.action-tray`, and keeping status + skill name + PP visible at all heights. Skill
   description may collapse behind a tap/expand, but not silently vanish.
3. **Legibility floor.** HUD/label fonts are `.46–.57rem` (~7–9px). Establish a ~10px (`.62rem`)
   floor for labels and bump `.combat-message strong` on compact. Keep the condensed theatre type.
4. **Touch targets to 44px** (DESIGN.md "~44×44 when space permits", `--touch` already = 44px):
   `.action-tabs button` 38→44, `.battle-utility button` 28px→44px tap area, `.target-hint button`
   30→44. Prefer enlarging tap area (padding/min-height) over shrinking labels.
5. **Enemy count badge.** Style the "×N" count as a proper positioned badge consistent with
   `.target-corner` (border, ink, fixed corner) instead of inline text.

Validation: Playwright at the four required viewports (390×844, 768×1024, 1024×768, 1440×900)
plus a manual check at 375×667. No horizontal scroll; status + skill name/PP visible; message
untruncated.

---

## WS2 — Color

1. **START NEW RUN button.** The default `.paper-button` sets no `color`, so on `.title-screen`
   (which sets `color: var(--paper)`) it renders near-white text on cream `--paper-2`. Fix: the
   primary title CTA gets **mustard fill `#c9962e` + ink text**. Implement as an explicit color on
   that button (variant or inline), not a global `.paper-button` change (other screens rely on the
   default). CONTINUE RUN keeps its ink variant.
2. **Per-character accents (Earl + Hans only).**
   - Add optional `accentColor?: string` to `CharacterDefinition` (`src/game/core/types.ts` +
     `characters.ts`). Set only Earl = **`#C77B94`** (dusty theatre pink) and Hans = **`#7A2E2E`**
     (maroon). All others leave it undefined.
   - Rendering: components that show a character emit `style={{ '--char-accent': accentColor ?? affinityColor }}`
     on the roster card, unit label bar, turn flag, and actor ticket. CSS uses `var(--char-accent)`
     for a single accent detail per surface (e.g. name-bar underline / ticket edge). Because the
     var defaults to the affinity color, the system renders identically for all 11 characters;
     Earl and Hans only change the hue. Affinity letter-mark and label are unchanged (DESIGN.md:
     affinity never relies on color alone).
   - Pink is not in the base palette; `#C77B94` is deliberately muted/desaturated to sit with the
     cardboard theatre rather than a neon pink.

Validation: visual check that Earl/Hans read as pink/maroon on all four surfaces; the other nine
still match their affinity color; contrast of ink text on mustard CTA passes.

---

## WS3 — Balance + Region Revive

### Region revive
File: `src/game/core/progression/rewards.ts` (bossRecovery block, line ~84) and
`src/game/balance/constants.ts`.

- Current: `if(member.hp>0)` heals survivors +30% Max HP and +25% missing PP. KO'd allies stay
  dead for the rest of the run (Revive Kit is battle-only).
- Change: on region clear (post-boss), **revive KO'd allies to `regionReviveHpPercent` of Max HP
  (proposal: 0.25)**, then apply the existing survivor heal to living allies and +25% missing PP
  to all (including revived). Revived allies enter the next region alive but low.
- New constant: `regionReviveHpPercent: 0.25`.
- Emit `revive` + `heal` events so the revive rise animation (WS5) can play if this ever surfaces
  in-scene; the reward screen shows the recovered party state.

### Outlier nudges (no new encounters)
Re-validated by the 7,920-battle character audit; final values are whatever brings outliers
toward the ~82% mean band without pushing leaders past it.

- **Michael** (76.8%, weakest): *(proposal)* Max HP 96→104; Suppressing Fire power 55→60.
- **Bosses** (62.5% win, 9.26 rounds, 29% ending HP): *(proposal, modest)* trim boss all-target
  signature powers ~10% (Table Flip 58, Enforcement Burst 60, Night Swell 50) and/or
  `enemyTierHpMultiplier.boss` 1.55→1.50. Pick the smaller set of changes that hits target.
- **Weak-vs-boss** (Yeeho 47%, Daboy 52%, Leandre 54%): *(proposal)* light single touches only,
  guided by the re-sim; do not rework kits.

Guardrail: after edits, re-run `pnpm test` (deterministic domain) and the balance/economy audit
scripts; record before/after deltas in `docs/BALANCE_AUDIT_V02.md` (or a v03 successor). No change
ships if it pushes a leader above the prior max or leaves an outlier unchanged.

---

## WS4 — Content (fill gaps + a few net-new)

All new content data-only in `src/game/content/*`, re-checked against the economy audit.

- **Items** (`items.ts`): add a **party-PP restore** item (PP attrition has no all-party answer)
  and a **throwable single-target damage** item (gives buff/support characters a way to contribute
  damage). Priced/rarity-slotted into the existing curve.
- **Reward** (`rewards.ts` spoils): add a **PP Cache** spoils option (restore a small % of party
  PP) alongside Cash / Patch Up / Scavenge, since PP is the real sustain pressure.
- **Relics** (`relics.ts`): add ~2 filling current gaps — e.g. a **battle-start party-PP** relic
  and a **death/crit-economy** relic. Exact effects finalized in the plan; must reuse existing
  `mechanicId` wiring patterns.
- **Events** (`events.ts`): add 1–2 with new themes, each a real choice (cost/risk/opportunity),
  matching the existing decision-tension table.

Validation: content structure tests (`pnpm test`), then re-run the economy audit; confirm no shelf
duplication, capacity checks hold, and the reward mix stays a greed-vs-sustain choice.

---

## WS5 — Animation (curated, within existing motion budget)

Current motion: lunge/hit/heal/KO/shake, number-pop, scan, 1×/2×/3× scaling, reduced-motion.
Add, all honoring `prefers-reduced-motion` and the in-game Reduced Motion toggle:

1. **Status-apply stamp** — brief flash/stamp when a status lands (statuses currently just appear
   in the strip).
2. **Guard pose** — a short brace animation when a unit Guards (Guard has no distinct feedback).
3. **Revive rise** — reverse-KO "stand back up" for region revive and Revive Kit.
4. **Boss signature flourish** — use the ~900ms signature budget specifically for boss signature
   moves.
5. **Reward/coin pop** — a coin/reward pop on the reward/results screen.

Validation: manual check at 1×/2×/3× and with Reduced Motion on (strong transforms removed, state
still readable). Deterministic resolution unchanged — animation is presentation only.

---

## Cross-cutting constraints

- Domain logic stays pure and deterministic; React/CSS remains presentation (ARCHITECTURE_INVARIANTS).
- Save schema unchanged where possible; if `regionReviveHpPercent` needs no persisted field, add
  none. New content ids must not collide with save-referenced ids.
- Re-run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and the four Playwright viewports
  before completion.

## Implementation phasing (for the plan)

1. WS1 mobile/UX (highest visible impact; unblocks screenshots).
2. WS2 color (small, isolated).
3. WS3 revive + balance (coupled; needs audit re-run).
4. WS4 content (needs economy audit re-run).
5. WS5 animation (last; presentation-only polish).

## Open items resolved in brainstorm

- START NEW RUN → mustard + ink.
- Boss handling → region revive AND modest boss ease, both validated by sim.
- Per-character color → Earl + Hans only, uniform mechanism, others default to affinity.
- Balance depth → nudge outliers + tune existing, no new encounters.
- Content → fill gaps + a few net-new.
- Animation → curated set above.
