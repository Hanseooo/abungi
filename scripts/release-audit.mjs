import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
const ok = message => console.log(`OK   ${message}`);
const fail = message => { failures.push(message); console.error(`FAIL ${message}`); };
const read = file => readFileSync(join(root, file), 'utf8');

const required = [
  'README.md','DESIGN.md','ARCHITECTURE_INVARIANTS.md','docs/ABUNGI_SPEC.md','docs/ART_BIBLE.md','docs/ASSET_GENERATION_GUIDE.md','docs/ASSET_MANIFEST.md',
  'docs/superpowers/plans/2026-09-07-abungi-implementation.md','scripts/assets/fetch_assets.py','src/main.tsx','src/app/App.tsx','src/styles.css','vite.config.ts','vercel.json','pnpm-lock.yaml',
];
for (const file of required) existsSync(join(root,file)) ? ok(`required file ${file}`) : fail(`missing required file ${file}`);

const pkg = JSON.parse(read('package.json'));
pkg.engines?.node === '22.x' ? ok('Node engine is 22.x') : fail('package.json engines.node must be 22.x');
String(pkg.packageManager ?? '').startsWith('pnpm@') ? ok(`package manager pinned: ${pkg.packageManager}`) : fail('packageManager must pin pnpm');
for (const dep of ['react','react-dom','vite-plugin-pwa','zod','zustand']) (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) ? ok(`dependency ${dep}`) : fail(`missing dependency ${dep}`);

function walk(dir) {
  const output = [];
  for (const name of readdirSync(dir)) {
    if (['node_modules','.git','.domain-build','dist','test-results','playwright-report'].includes(name)) continue;
    const full = join(dir,name);
    if (statSync(full).isDirectory()) output.push(...walk(full)); else output.push(full);
  }
  return output;
}
const sourceFiles = walk(join(root,'src')).filter(file => /\.(?:ts|tsx|css)$/.test(file));
const releaseFiles = [...sourceFiles, ...walk(join(root,'scripts')).filter(file => /\.(?:js|mjs|py)$/.test(file))];
for (const file of releaseFiles) {
  const text = readFileSync(file,'utf8');
  const rel = relative(root,file);
  const unfinished = ['TO'+'DO','T'+'BD','FIX'+'ME'];
  if (unfinished.some(marker => text.includes(marker))) fail(`${rel} contains unfinished marker`);
}
if (!failures.some(item => item.includes('unfinished marker'))) ok('no unfinished markers in release source');

const gameFiles = walk(join(root,'src/game')).filter(file => file.endsWith('.ts'));
for (const file of gameFiles) if (/Math\.random\s*\(/.test(readFileSync(file,'utf8'))) fail(`${relative(root,file)} uses Math.random()`);
if (!failures.some(item => item.includes('Math.random'))) ok('domain uses no Math.random()');

const componentText = walk(join(root,'src')).filter(file => file.endsWith('.tsx')).map(file => readFileSync(file,'utf8')).join('\n');
componentText.includes("Lara's Shop") ? fail("shop display name is hard-coded in a component") : ok('shop display name remains content-driven');
/if\s*\([^)]*(?:displayName|\.name)\s*===/.test(componentText) ? fail('component branches on display name') : ok('no display-name branching in components');

const runtimeText = sourceFiles.map(file => readFileSync(file,'utf8')).join('\n');
/https?:\/\//.test(runtimeText) ? fail('runtime source contains remote URL; gameplay must be local') : ok('runtime source contains no remote asset URL');

const forbidden = [
  ['shadcn/ui', /shadcn/i], ['glassmorphism', /glassmorphism/i], ['Phaser', /from\s+['"]phaser['"]/i]
];
for (const [label,pattern] of forbidden) pattern.test(runtimeText) ? fail(`runtime references forbidden ${label}`) : ok(`runtime avoids ${label}`);

const characters = (read('src/game/content/characters.ts').match(/\{ id:'[^']+', displayName:/g) ?? []).length;
const abilities = (read('src/game/content/characters.ts').match(/ability\(\{ id:/g) ?? []).length;
characters === 12 ? ok('12 playable characters defined') : fail(`expected 12 playable characters, found ${characters}`);
abilities === 48 ? ok('48 playable abilities defined') : fail(`expected 48 playable abilities, found ${abilities}`);

const cutouts = readdirSync(join(root,'public/assets/cutouts'));
for (const [prefix,count] of [['character-',12],['enemy-',10],['elite-',3],['boss-',3]]) {
  const found = cutouts.filter(name => name.startsWith(prefix) && name.endsWith('.svg')).length;
  found === count ? ok(`${count} ${prefix} cutouts`) : fail(`expected ${count} ${prefix} cutouts, found ${found}`);
}
const audio = readdirSync(join(root,'public/audio')).filter(name=>name.endsWith('.wav'));
audio.length >= 16 ? ok(`${audio.length} local audio files`) : fail(`expected at least 16 local audio files, found ${audio.length}`);

const lock = read('pnpm-lock.yaml');
lock.includes("lockfileVersion: '9.0'") ? ok('pnpm lockfile present') : fail('unexpected/missing pnpm lockfile version');

if (failures.length) {
  console.error(`\nRelease audit failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log('\nRelease audit passed.');
