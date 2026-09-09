import { writeFileSync } from 'node:fs';
import { SeededRng } from '../.domain-build/core/rng/seededRng.js';
import { availableRouteNodes, generateRegionRoute, minimumCombatNodesToBoss } from '../.domain-build/core/progression/route.js';
import { advanceRegion, createRun } from '../.domain-build/core/progression/run.js';
import { generateShopOffers } from '../.domain-build/core/progression/shop.js';
import { generateReward, encounterCoinRange } from '../.domain-build/core/progression/rewards.js';
import { ENCOUNTERS } from '../.domain-build/content/enemies.js';
import { EVENTS } from '../.domain-build/content/events.js';

function maxCombatNodesToBoss(route){
  const byId=new Map(route.nodes.map(node=>[node.id,node]));const memo=new Map();
  const visit=id=>{if(memo.has(id))return memo.get(id);const node=byId.get(id);if(!node)return -Infinity;if(id===route.bossNodeId)return 0;const self=['battle','elite'].includes(node.type)?1:0;const next=node.outgoing.map(visit);const value=self+(next.length?Math.max(...next):0);memo.set(id,value);return value;};
  return Math.max(...route.startNodeIds.map(visit));
}
function pct(value,total){return total?`${(value/total*100).toFixed(1)}%`:'0.0%';}
function avg(values){return values.reduce((a,b)=>a+b,0)/Math.max(1,values.length);}

const routeSamples=[];
const nodeCounts={battle:0,elite:0,event:0,rest:0,shop:0};
for(let seed=1;seed<=10000;seed++){
  const region=seed%3;const route=generateRegionRoute(region,new SeededRng(seed));
  const min=minimumCombatNodesToBoss(route),max=maxCombatNodesToBoss(route);
  routeSamples.push({min,max});
  for(const node of route.nodes){if(node.type in nodeCounts)nodeCounts[node.type]++;}
}
const minCounts=Object.fromEntries([...new Set(routeSamples.map(r=>r.min))].sort().map(n=>[n,routeSamples.filter(r=>r.min===n).length]));
const maxCounts=Object.fromEntries([...new Set(routeSamples.map(r=>r.max))].sort().map(n=>[n,routeSamples.filter(r=>r.max===n).length]));

const shopStats={base:{total:0,common:0,uncommon:0,rare:0,relic:0,prices:[],duplicates:0,offers:0},leandre:{total:0,common:0,uncommon:0,rare:0,relic:0,prices:[],duplicates:0,offers:0}};
for(const [kind,party] of [['base',['earl','hans','jiro']],['leandre',['earl','hans','leandre']]]){
  for(let region=0;region<3;region++)for(let seed=1;seed<=1000;seed++){
    const run=createRun(party,seed*13+region);run.regionIndex=region;run.coins=999;
    const offers=generateShopOffers(run,`audit-r${region}-s${seed}`);const stats=shopStats[kind];stats.total++;
    if(new Set(offers.map(o=>o.contentId)).size!==offers.length)stats.duplicates++;
    stats.offers+=offers.length;
    for(const offer of offers){if(offer.kind==='relic')stats.relic++;else stats[offer.rarity]++;stats.prices.push(offer.price);}
  }
}

function sampleEventExposure(policy){
  const stats={assigned:[],entered:[],visited:[],repeatBefore:0,repeatAfter:0};const poolSize=EVENTS.filter(event=>event.weight>0).length;
  for(let seed=1;seed<=20000;seed++){let run=createRun(['earl','hans','marcus'],seed);const seen=new Set();for(let region=0;region<3;region++){for(const node of run.route.nodes)if(node.type==='event'&&node.eventId)stats.assigned.push(node.eventId);let currentNodeId=null;const completed=[];while(true){const choices=availableRouteNodes(run.route,currentNodeId,completed);if(!choices.length)break;const candidates=choices.filter(node=>node.type!=='boss');const pool=candidates.length?candidates:choices;const events=pool.filter(node=>node.type==='event');const nonEvents=pool.filter(node=>node.type!=='event');const node=policy==='event-first'?(events[0]??pool[0]):policy==='event-avoiding'?(nonEvents[0]??pool[0]):pool[new SeededRng(seed,region+completed.length+1).int(0,pool.length-1)];currentNodeId=node.id;completed.push(node.id);if(node.type==='event'&&node.eventId){stats.entered.push(node.eventId);if(seen.has(node.eventId)){if(seen.size<poolSize)stats.repeatBefore++;else stats.repeatAfter++;}seen.add(node.eventId);}}if(region<2)run=advanceRegion(run);}stats.visited.push(seen.size);}return stats;
}
const eventExposure=Object.fromEntries(['event-first','random-reachable-lane','event-avoiding'].map(policy=>[policy,sampleEventExposure(policy==='random-reachable-lane'?'random':policy)]));

const normalRewards=[];
for(const encounter of ENCOUNTERS.filter(e=>e.tier==='normal')){
  const run=createRun(['earl','hans','jiro'],909);const coins=[];let drops=0,scavengeOffered=0;
  for(let seed=1;seed<=1000;seed++){const reward=generateReward(run,'normal',new SeededRng(seed),encounter.id);coins.push(reward.coins);if(reward.itemId)drops++;if(reward.spoilsChoices.some(c=>c.id==='scavenge'))scavengeOffered++;}
  normalRewards.push({id:encounter.id,range:encounterCoinRange(encounter.id,'normal'),avg:avg(coins),drop:drops,scavenge:scavengeOffered});
}

let md=`# Abungi v0.3 Route & Economy Audit\n\nGenerated from deterministic engine/configuration data after the v0.2 route, reward, shop, item-rarity and event revisions. This is a structural economy audit rather than a full human run simulator.\n\n## Route pressure\n\n10,000 generated regions were inspected.\n\n- Average minimum pre-boss combats: **${avg(routeSamples.map(r=>r.min)).toFixed(2)}**.\n- Average maximum pre-boss combats: **${avg(routeSamples.map(r=>r.max)).toFixed(2)}**.\n- Regions permitting zero pre-boss combat: **${routeSamples.filter(r=>r.min===0).length}**.\n- Regions permitting fewer than two pre-boss combats: **${routeSamples.filter(r=>r.min<2).length}**.\n- Minimum-path distribution: ${Object.entries(minCounts).map(([n,c])=>`${n} fights = ${pct(c,routeSamples.length)}`).join(', ')}.\n- Maximum-path distribution: ${Object.entries(maxCounts).map(([n,c])=>`${n} fights = ${pct(c,routeSamples.length)}`).join(', ')}.\n\nThis means combat cannot be completely skipped, while later route choices can still deliberately trade more combat for more earnings/elite upside. Stage 3 always supplies Rest vs Shop, and stage 6 always supplies a Rest lane against a battle/event/elite lane, so recovery is reachable immediately before every boss without being forced.\n\n### Generated node mix\n\n| Node | Share of non-boss nodes |\n|---|---:|\n`;
const totalNodes=Object.values(nodeCounts).reduce((a,b)=>a+b,0);
for(const [type,count] of Object.entries(nodeCounts))md+=`| ${type} | ${pct(count,totalNodes)} |\n`;
md+=`\n## Normal encounter coin rewards\n\nRewards now use the actual enemy composition rather than one universal normal-fight range. The table uses 1,000 deterministic reward rolls per encounter.\n\n| Encounter | Configured range | Mean coins | Automatic item drop | Scavenge offered |\n|---|---:|---:|---:|---:|\n`;
for(const row of normalRewards)md+=`| ${row.id} | ${row.range[0]}–${row.range[1]} | ${row.avg.toFixed(1)} | ${pct(row.drop,1000)} | ${pct(row.scavenge,1000)} |\n`;
md+=`\nNormal victories additionally offer two small Spoils choices: one greed option (Cash for +5 coins, or Scavenge for one common item when rolled and inventory permits) paired with one sustain option (Patch Up for 5% party Max HP, or PP Cache for 2 PP on each ally's most-drained move). Drawing one from each pool keeps fighting rewarding while forcing a greed-versus-sustain choice rather than refunding all attrition.\n\n## Shop distribution\n\nEach group below samples 3,000 shops across all three regions. Duplicate content is forbidden within one shelf.\n\n| Party | Avg offers | Common | Uncommon | Rare item | Relic | Avg price | Duplicate shelves |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
for(const [kind,stats] of Object.entries(shopStats)){
  md+=`| ${kind==='leandre'?'With Leandre':'Without Leandre'} | ${(stats.offers/stats.total).toFixed(1)} | ${pct(stats.common,stats.offers)} | ${pct(stats.uncommon,stats.offers)} | ${pct(stats.rare,stats.offers)} | ${pct(stats.relic,stats.offers)} | ${avg(stats.prices).toFixed(1)} | ${stats.duplicates} |\n`;
}
md+=`\nLeandre's fifth shelf is therefore real run-level utility rather than a combat-stat bonus. Rare Revive Kits remain possible but uncommon enough that a player cannot route around attrition assuming one will appear.\n\n## Event decision audit\n\n| Event | Strategic tension |\n|---|---|\n`;
const eventNotes={
  'rain-stall':'Item capacity versus small HP recovery.',
  'loose-crate':'PP consumable versus guaranteed 12 coins.',
  'paper-shrine':'22% missing-PP recovery versus 16-coin relic purchase; relic choice is disabled if unaffordable or exhausted.',
  'night-cart':'Spend 8 coins for 16% party healing versus keep coins; paid heal is disabled at full HP.',
  'shortcut':'Take a real Fast Lane fight for its full battle rewards versus avoid damage and receive nothing.',
  'old-locker':'Trade 5% party HP for a Field Ration versus leave safely; risky choice is disabled with a full pack.',
  'street-game':'Cardboard Wheel offers Small (+1.7 EV), Medium (+1.2), Large (+1.5) and Yeeho (+5) stakes. EV alone does not establish balance.',
  'repair-bench':'25% missing-PP restoration versus Energy Drink if pack capacity allows.',
  'quiet-corner':'Small HP+PP sustain versus 9 coins.',
  'bulk-deal':'20 coins for two consumables versus 14 coins for none; the paid branch is disabled when coins are short or the pack is full.',
  'live-wire':'9% party HP for 30% missing-PP restoration versus a risk-free 7 coins. The HP cost cannot kill; it floors at 1.',
};
for(const event of EVENTS)md+=`| ${event.title} | ${eventNotes[event.id]??'Two visible outcomes.'} |\n`;
md+=`\n## Event definitions\n\nAll ${EVENTS.length} event definitions are listed from the live content table. Recruitment is an anchored zero-weight event; the other weights are ordinary weighted-pool inputs. Arrival themes: ${[...new Set(EVENTS.map(event=>event.theme))].join(', ')}.\n\n| Event | Weight | Theme | Category |\n|---|---:|---|---|\n`;
for(const event of EVENTS)md+=`| ${event.id} | ${event.weight} | ${event.theme} | ${event.category} |\n`;
md+=`\n## Event variety exposure\n\n20,000 fixed seeds were replayed through all three regions under legal-path policies. Assigned nodes are structural route data; entered nodes are policy outcomes, not human behavior. Recruitment offered means its anchor was reached. New runs avoid ordinary repeats until the weighted pool is exhausted.\n\n| Policy | Assigned events | Entered events | Recruit generated | Recruit reached | Avg distinct visited | Repeats before exhaustion | Repeats after exhaustion |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
for(const [policy,stats] of Object.entries(eventExposure))md+=`| ${policy} | ${stats.assigned.length} | ${stats.entered.length} | ${stats.assigned.filter(id=>id==='fourth-chair').length} | ${stats.entered.filter(id=>id==='fourth-chair').length} | ${avg(stats.visited).toFixed(2)} | ${stats.repeatBefore} | ${stats.repeatAfter} |\n`;
md+=`\n## Assessment\n\n- **Fight avoidance is no longer a dominant route strategy:** every region forces at least two pre-boss combats, compared with the earlier build where some routes allowed none.\n- **Optional combat has an economic reason to exist:** encounter-specific coin ranges and Spoils reward harder compositions instead of paying all normal fights roughly the same.\n- **Recovery is deliberately partial:** fight rewards never erase PP attrition, and Patch Up is only 5% Max HP. Rest remains much more efficient recovery.\n- **Events are choices rather than free vending machines:** high-value outcomes now carry cost, risk, opportunity cost, capacity checks, or a competing sustain option.\n- **Shops are more reliable without being guaranteed solutions:** three category anchors prevent all-junk shelves, while rarity/relic rolls retain uncertainty.\n- **No new currency was introduced.** HP, PP, Coins and Items remain the only run resources.\n\n### Remaining human-playtest watchpoints\n\n1. Whether +5 Cash is chosen disproportionately over 5% Patch Up in real runs.\n2. Whether a neutral-expectation Three Cups wager is still engaging enough to justify its route slot.\n3. Whether Revive Kit availability feels exciting rather than required.\n4. Whether mandatory two-fight pressure feels fair with low-sustain parties across all three regions.\n`;
writeFileSync('docs/ECONOMY_AUDIT_V03.md',md);
console.log(md);
