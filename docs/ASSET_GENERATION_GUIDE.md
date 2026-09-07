# Abungi Asset Generation Guide

Use this guide when replacing the temporary vector cutouts with final bespoke art. Keep the stable filenames/asset IDs so no game code changes are needed.

## Shared style prompt

> Hand-illustrated cardboard and layered-paper character standee for a tactile tabletop battle theatre; rough ink contours; printed fiber/cardboard texture; slightly exaggerated proportions; strong readable silhouette; limited expressive shading; restrained hand-painted sign influence; coherent warm material palette; three-quarter game-combat pose; isolated transparent background; no text; no UI; no watermark; readable at mobile size; consistent camera angle and rendering density with the supplied approved Abungi reference characters.

### Negative constraints

No photorealism, glossy 3D render, anime screenshot look, generic mobile-game avatar circle, emoji, glass UI, neon purple-blue AI gradient, embedded labels, watermark, logo, busy scenery, random national symbols, weapons pointed toward camera in a way that destroys silhouette readability, or mismatched rendering style.

## Delivery format

- Identity cutouts: square 1024×1024 working generation; export trimmed transparent PNG/WebP around the figure. Keep ~8–12% transparent breathing room.
- Bosses: 1280×1280 working generation if additional silhouette detail is needed.
- Backgrounds: 1600×1067 or similar 3:2 landscape; no baked-in UI or characters.
- Final in-game export should be sized for realistic display, not giant source resolution. Keep originals outside the runtime bundle if they are substantially larger.

## Consistency workflow

1. Establish 2–3 approved playable-character references first.
2. Supply those approved images as visual references for every subsequent generation.
3. Generate a small batch, reject style drift aggressively, and only promote accepted art.
4. Replace the local file matching the existing asset ID (for example `public/assets/cutouts/character-hans.*`).
5. Inspect title/party/battle screens at 390×844 and 1440×900 before accepting.
6. Update `docs/ASSET_MANIFEST.md` with source/tool/license/provenance notes.

## Character prompts

Append one identity clause to the shared prompt:

- Earl: practical first-responder bruiser, taped knuckles, small smoke/yosi cue, sturdy stance.
- Greg: playful pirate attacker, cutlass, compact broadside motif, worn utility layers.
- Michael: reliable soldier, rifle, disciplined balanced stance, simple field gear.
- Marcus: broad navy defensive controller, deck-gun/cover geometry, heavy planted stance.
- Hans: inventor, tool harness, small sentry and repair-drone components, alert engineering pose.
- Yeeho: calculated gambler, loaded dice and tokens/cards, agile risky stance.
- Jiro: chef support, pan and serving kit, warm grounded posture.
- Nathaniel: dark mystic entity, torn layered-paper wisps, eerie negative space, restrained menace.
- Yatords: cyclist/biker, wheel and handlebar motifs, forward lean, speed silhouette.
- Daboy: bartender controller, bottle/shaker props, relaxed but deliberate stance.
- Leandre: merchant opportunist, coin pouch/tags/receipt props, quick calculating pose.

## Enemy prompts

Use the shared prompt plus: Scrapper (Might street bruiser, scrap gauntlets); Road Dog (fast aggressive runner, wheel/road cues); Cutpurse (nimble Trick thief, hooked pouch); Smokehead (smoke-mask Trick debuffer); Hexling (small Mystic hex figure); Wisp (fragile torn-paper spectral spark); Dronelet (small fast Tech drone); Bulwark Bot (blocky Tech shield support); Backstreet Medic (Neutral field healer); Tin Brute (large Neutral improvised tin/cardboard tank).

## Elite prompts

- The Broker: sharp contract/tag shapes, coin pressure, sly asymmetry, Trick accent.
- Ironclad: thick layered card armor, rivets, high-mass defensive silhouette, Tech accent.
- Night Maw: torn-paper maw/void, layered dark folds, sustain/drain visual cue, Mystic accent.

## Boss prompts

- Jonlow, the Glutton: oversized layered silhouette built around plates/food-container shapes; can visually escalate; threatening but handmade.
- Klyde, the Psycho: angular unstable-looking pose, mismatched attack implements, intentionally chaotic silhouette while retaining coherent style.
- The Warden: imposing modular Tech controller, broad command silhouette, detachable drone motif, clear phase-ready pose.

## Background prompts

Use the same cardboard/tabletop material language, quiet center-stage values, layered depth planes, subtle sign-painted geometry, no characters/text/UI. Region 1 is warmer street-cardboard; Region 2 introduces darker industrial paper; Region 3 is stricter Tech/Warden geometry. The title scene should feel like a theatre opening, not a marketing hero banner.
