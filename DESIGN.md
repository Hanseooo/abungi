# Abungi Design System

Abungi is a game surface, not an application dashboard. The visual language is a **handcrafted cardboard battle theatre**: layered paper, cut cardboard, rough ink, printed labels, tape, stamped markings, physical-looking shadows, and small controlled irregularities. Filipino influence stays subtle through sign-painting cadence, restrained geometric cues, and occasional vernacular flavor rather than literal flag/iconography.

## Principles

1. **Battle readability before decoration.** HP, PP, affinity, status, targets, current actor, and disabled reasons must remain scannable on a 390×844 viewport.
2. **Tactile, not glossy.** Hard ink borders, small asymmetries, paper/cardboard fills, and offset shadows replace glass blur, SaaS cards, or synthetic gradients.
3. **Every interaction answers back.** Pressed states move physically, target selection is visibly armed, disabled actions state why, battle resolution locks input, and combat events animate the cutouts.
4. **Identity comes from silhouette.** Character/enemy art uses stable asset IDs and distinct props. UI never uses emoji or generic avatar circles as identity art.
5. **Responsive composition, shared mechanics.** Semantic battle regions are rearranged by CSS. Components and domain logic do not inspect orientation or user agent.

## Core tokens

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F2E7D5` | primary paper surface |
| Cardboard | `#C7A679` | assembled panels/cutouts |
| Ink | `#1E1A17` | borders, type, hard contrast |
| Deep Red | `#A9463B` | danger and Might accents |
| Teal | `#247B78` | selection/focus/Tech support |
| Mustard | `#C9962E` | tape, active turn, Trick support |
| Muted Green | `#6E7B4B` | recovery/positive state |
| Mystic Purple | `#6C4A78` | Mystic/boss accents |

Affinity never relies on color alone: every affinity includes a letter mark and text label.

## Typography

Use robust system-local condensed/display fallbacks for large game labels and a system sans stack for readable copy. No font CDN is allowed. If approved redistributable font files are added later, keep them local under `public/assets/fonts/` and preserve these fallback stacks.

## Shape and material rules

- Corners are small and irregular rather than uniformly rounded.
- Primary controls use 2–3 px dark borders and offset physical shadows.
- Dashed rules imply printed/cut paper seams.
- Do not nest generic cards inside generic cards.
- Avoid decorative blur, glass, giant empty hero space, and purple/blue product gradients.
- Touch controls target at least ~44×44 CSS px when space permits.

## Battle composition

The battle UI exposes six semantic regions: `enemyStage`, `allyStage`, `battleHUD`, `actionTray`, `combatMessage`, and `utilityControls`.

Compact (<600 px) stacks them vertically. Medium (600–1023 px) increases battlefield breathing room and control density. Wide (≥1024 px) places battlefield and command information side by side while retaining the same components. No orientation lock exists.

Four skills remain visible as a 2×2 tray. First tap selects a targeted move; second tap on a valid unit commits it. Items follow the same pattern. Guard is always visible, uses 0 PP, and remains available when skills are exhausted.

## Motion language

Normal feedback is short and physical: ~100–150 ms button response, ~250–450 ms common combat motion, and only signature feedback approaches ~900 ms. Cutouts lunge, wobble, recoil, bob on healing, and fall/tilt on KO. Damage numbers pop over the physical figure. Heavy hits may briefly shake the full stage.

`prefers-reduced-motion` and the in-game Reduced Motion option remove strong shake and large transforms while preserving readable state changes. Battle animation speed changes presentation delay only; deterministic rule resolution is unchanged.
