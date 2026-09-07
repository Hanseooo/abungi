import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const path = (...parts) => join(fileURLToPath(root), ...parts);
const read = (...parts) => readFileSync(path(...parts), 'utf8');

const requiredFiles = [
  'index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','playwright.config.ts','vercel.json',
  'src/main.tsx','src/app/App.tsx','src/styles.css','src/vite-env.d.ts',
  'README.md','DESIGN.md','ARCHITECTURE_INVARIANTS.md',
  'docs/ABUNGI_SPEC.md','docs/ART_BIBLE.md','docs/ASSET_GENERATION_GUIDE.md','docs/ASSET_MANIFEST.md',
  'scripts/assets/fetch_assets.py','scripts/release-audit.mjs','tests/e2e/abungi.spec.ts',
];

test('release contains the required integration, PWA, docs and QA files', () => {
  for (const file of requiredFiles) assert.equal(existsSync(path(file)), true, `missing ${file}`);
});

test('App routes all required game screens, with Settings hosted safely in the global overlay', () => {
  const app = read('src/app/App.tsx');
  const overlay = read('src/ui/overlays/GlobalOverlay.tsx');
  for (const screen of ['TitleScreen','PartySelectScreen','RouteScreen','BattleScreen','RewardScreen','ShopScreen','RestScreen','EventScreen','ResultsScreen']) {
    assert.match(app, new RegExp(screen));
  }
  assert.match(overlay, /SettingsScreen/);
  assert.match(app, /GlobalOverlay/);
  assert.doesNotMatch(app, /pricing|testimonials|newsletter|hero section/i);
});

test('PWA config defines install metadata, local precache patterns and update prompting', () => {
  const config = read('vite.config.ts');
  assert.match(config, /VitePWA/);
  assert.match(config, /registerType:\s*['"]prompt['"]/);
  assert.match(config, /Abungi/);
  assert.match(config, /assets\/\*\*\/\*/);
  assert.match(config, /audio\/\*\*\/\*/);
});

test('local identity/audio assets cover the full playable cast and required sound families', () => {
  const cutouts = readdirSync(path('public/assets/cutouts')).filter(name => name.endsWith('.svg'));
  const characters = cutouts.filter(name => name.startsWith('character-'));
  const enemies = cutouts.filter(name => name.startsWith('enemy-'));
  const elites = cutouts.filter(name => name.startsWith('elite-'));
  const bosses = cutouts.filter(name => name.startsWith('boss-'));
  assert.equal(characters.length, 11);
  assert.equal(enemies.length, 10);
  assert.equal(elites.length, 3);
  assert.equal(bosses.length, 3);
  const audio = new Set(readdirSync(path('public/audio')));
  for (const sound of ['ui-click.wav','confirm.wav','cancel.wav','error.wav','hit.wav','heavy-hit.wav','heal.wav','status.wav','coin.wav','dice.wav','summon.wav','victory.wav','defeat.wav','shop.wav','battle-music.wav','boss-music.wav']) assert.equal(audio.has(sound), true, `missing ${sound}`);
});

test('battle presentation exposes real 1x, 2x and 3x animation-speed hooks plus reduced-motion CSS', () => {
  const battle = read('src/features/battle/BattleScreen.tsx');
  const css = read('src/styles.css');
  assert.match(battle, /speed-\$\{settings\.animationSpeed\}x/);
  assert.match(css, /\.battle-screen\.speed-2x\s*\{[^}]*--anim-scale:\s*\.5/s);
  assert.match(css, /\.battle-screen\.speed-3x\s*\{[^}]*--anim-scale:\s*\.333/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('TSX style typing does not rely on an unimported React namespace', () => {
  for (const file of ['src/features/battle/BattleScreen.tsx','src/features/route/RouteScreen.tsx']) {
    const source = read(file);
    assert.doesNotMatch(source, /as React\.CSSProperties/, `${file} uses React.CSSProperties without a React namespace import`);
  }
});

test('battle utility settings control is locked while an action resolves', () => {
  const battle = read('src/features/battle/BattleScreen.tsx');
  assert.match(battle, /<button[^>]*disabled=\{isResolving\}[^>]*>SETTINGS<\/button>/);
});

test('pnpm lock importer classifies dependencies the same way as package.json', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = read('pnpm-lock.yaml');
  const dependenciesBlock = lock.match(/\n    dependencies:\n([\s\S]*?)\n    devDependencies:/)?.[1] ?? '';
  const devDependenciesBlock = lock.match(/\n    devDependencies:\n([\s\S]*)$/)?.[1] ?? '';
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    assert.match(dependenciesBlock, new RegExp(`(^|\\n)      ['\"]?${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}['\"]?:`, 'm'), `${name} missing from lock dependencies`);
  }
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    assert.match(devDependenciesBlock, new RegExp(`(^|\\n)      ['\"]?${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}['\"]?:`, 'm'), `${name} missing from lock devDependencies`);
    assert.doesNotMatch(dependenciesBlock, new RegExp(`(^|\\n)      ['\"]?${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}['\"]?:`, 'm'), `${name} incorrectly listed as a production dependency`);
  }
});
