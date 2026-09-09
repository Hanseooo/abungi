import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (...parts) => readFileSync(join(fileURLToPath(root), ...parts), 'utf8');

test('settings and guide are global overlays rather than destructive screen navigation', () => {
  const app = read('src/app/App.tsx');
  const store = read('src/app/appStore.ts');
  assert.match(app, /GlobalOverlay/);
  assert.match(app, /SceneOverlay/);
  assert.doesNotMatch(store, /previousScreen/);
  assert.match(store, /overlay:/);
  assert.match(store, /openSettings/);
  assert.match(store, /closeOverlay/);
});

test('v0.2 theatre and combat readability classes have concrete responsive styling', () => {
  const css = read('src/styles.css');
  for (const selector of [
    '.global-overlay', '.scene-overlay', '.guide-panel', '.detail-panel',
    '.deployable-field', '.deployable-piece.sentry', '.deployable-piece.repair-drone',
    '.status-aura', '.has-blind', '.has-weaken', '.has-haste', '.has-fortified',
    '.battle-vfx-layer', '.choreo-ranged', '.choreo-smoke', '.choreo-multi-hit',
    '.shop-counter-scene', '.event-theatre', '.spoils-section', '.enemy-action-ticket'
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing styles for ${selector}`);
  assert.match(css, /@media\s*\(min-width:\s*768px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('save validation preserves v0.2 pending reward spoils choices while remaining v1-compatible', () => {
  const schema = read('src/services/save/schema.ts');
  assert.match(schema, /spoilsChoices/);
  assert.match(schema, /default\(\[\]\)/);
  assert.match(schema, /coinBonus/);
});

test('battle deployable field uses the real BattleState type instead of any', () => {
  const battle = read('src/features/battle/BattleScreen.tsx');
  assert.match(battle, /BattleState/);
  assert.doesNotMatch(battle, /DeployableField\(\{battle,events\}:\{battle:[^\n]*\bany\b/);
});


test('scene overlay stages canonical cutout art for boss and relationship beats', () => {
  const scene = read('src/features/scenes/SceneOverlay.tsx');
  assert.match(scene, /CutoutArt/);
  assert.match(scene, /focusAssetId/);
  assert.match(scene, /companionAssetId/);
  assert.match(scene, /scene-figures/);
});

test('store stages contextual elite and event arrivals without replacing the destination screen',()=>{
  const store=read('src/app/appStore.ts');
  assert.match(store,/enqueueScene\('elite-intro'[\s\S]*encounterId/);
  assert.match(store,/enqueueScene\('event-arrival'[\s\S]*eventId/);
  assert.match(store,/set\(\{screen:node\.type\}\)/);
});

test('Playwright contract covers v0.2 scenes, overlay return, guide details and named enemy actions',()=>{
  const e2e=read('tests/e2e/abungi.spec.ts');
  assert.match(e2e,/dismissScenes/);
  assert.match(e2e,/party selection.*settings|settings.*party selection/is);
  assert.match(e2e,/Field Guide|GUIDE/i);
  assert.match(e2e,/enemy.*target/is);
  for(const size of ['390, height: 844','768, height: 1024','1024, height: 768','1440, height: 900'])assert.match(e2e,new RegExp(size.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('event arrival cutscenes have event-specific visual themes rather than one generic transition',()=>{
  const css=read('src/styles.css');
  for(const selector of ['.scene-theme-rain','.scene-theme-game','.scene-theme-shrine','.scene-theme-alley','.scene-theme-repair']){
    assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`missing scene visual ${selector}`);
  }
});

test('battle item UI derives disabled and target states from domain legality',()=>{
  const battle=read('src/features/battle/BattleScreen.tsx');
  assert.match(battle,/validatePlayerCommand/);
  assert.match(battle,/itemLegality/);
  assert.match(battle,/itemTargetLegal/);
  assert.doesNotMatch(battle,/const itemReason=\(item:[^\n]+=>item\.escape/);
});

test('combat director separates move announcement from impact resolution',()=>{
  const director=read('src/features/battle/combatDirector.ts');
  assert.match(director,/phase:\s*'announce'/);
  assert.match(director,/phase:\s*'resolve'/);
  assert.match(director,/action\?\.side===['"]enemy['"]/);
});

test('release metadata identifies the polished v0.2 build and ships its audit docs',()=>{
  const pkg=JSON.parse(read('package.json'));
  const readme=read('README.md');
  assert.equal(pkg.version,'0.2.0');
  assert.match(readme,/v0\.2|Combat & UX Polish/i);
  assert.doesNotMatch(readme,/current v0\.1 bundle/i);
  for(const path of ['docs/BALANCE_AUDIT_V02.md','docs/ECONOMY_AUDIT_V02.md','docs/superpowers/plans/2026-09-07-abungi-v02-polish.md','docs/superpowers/specs/2026-09-07-abungi-v02-combat-ux-design.md'])assert.ok(read(path).length>100,`missing ${path}`);
});
