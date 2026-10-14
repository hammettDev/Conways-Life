// Pick the balanced pool by search.   node scripts/pool.mjs [size] [seeds] [sport] [--write]
// Win rates in this game depend on who else is in the pool (it is rock-paper-scissors
// by design), so retiring the worst build one at a time never settles. Instead this
// measures every ordered pairing once under the shipped rules, then searches subsets
// of the candidates for the pool whose members all score close to 50% against it.
// The weakest builds left over become the tutorial tier, the strongest the boss tier.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { CANDIDATES } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE, RED } from '../src/engine/constants.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';

const ME = fileURLToPath(import.meta.url);
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SIZE = Number(args[0] || 18);
const SEEDS = Number(args[1] || 4);
const SPORT = args[2] || 'football';
const WRITE = process.argv.includes('--write');

if (!isMainThread) {
  const byId = new Map(CANDIDATES.map((b) => [b.id, b]));
  const out = [];
  for (const [a, b, seed] of workerData.tasks) {
    const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
    e.loadTeams([...placeFormation(byId.get(a), BLUE), ...placeFormation(byId.get(b), RED)]);
    const r = e.runToEnd();
    out.push([a, b, r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0]);
  }
  parentPort.postMessage(out);
} else {
  const ids = CANDIDATES.filter((b) => b.sport === SPORT).map((b) => b.id);
  const n = ids.length;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const tasks = [];
  let seed = 1;
  for (const a of ids) for (const b of ids) if (a !== b) for (let k = 0; k < SEEDS; k++) tasks.push([a, b, seed++]);
  const w = Math.min(os.cpus().length, 8);
  const slices = Array.from({ length: w }, () => []);
  tasks.forEach((t, i) => slices[i % w].push(t));
  const res = (await Promise.all(slices.map((s) => new Promise((ok, no) => {
    const wk = new Worker(ME, { workerData: { tasks: s } });
    wk.on('message', ok); wk.on('error', no);
  })))).flat();
  // P[i][j]: how often i beats j, averaged over both colours
  const sum = Array.from({ length: n }, () => new Float64Array(n));
  const cnt = Array.from({ length: n }, () => new Float64Array(n));
  for (const [a, b, v] of res) {
    const i = idx.get(a); const j = idx.get(b);
    sum[i][j] += v; cnt[i][j]++;
    sum[j][i] += 1 - v; cnt[j][i]++;
  }
  const P = sum.map((row, i) => row.map((s, j) => (cnt[i][j] ? s / cnt[i][j] : 0.5)));
  const rateIn = (i, set) => { let s = 0; let c = 0; for (const j of set) if (j !== i) { s += P[i][j]; c++; } return c ? s / c : 0.5; };
  const cost = (set) => { let worst = 0; let sq = 0; for (const i of set) { const d = Math.abs(rateIn(i, set) - 0.5); worst = Math.max(worst, d); sq += d * d; } return worst * 10 + sq; };

  // simulated annealing over subsets of fixed size
  let rng = 12345;
  const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 2 ** 32; };
  let best = null;
  for (let restart = 0; restart < 40; restart++) {
    const all = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    let cur = new Set(all.slice(0, SIZE));
    let curCost = cost(cur);
    let temp = 0.05;
    for (let step = 0; step < 6000; step++, temp *= 0.9992) {
      const out = [...cur][Math.floor(rand() * cur.size)];
      const inn = all.filter((x) => !cur.has(x))[Math.floor(rand() * (n - cur.size))];
      const nxt = new Set(cur); nxt.delete(out); nxt.add(inn);
      const c = cost(nxt);
      if (c < curCost || rand() < Math.exp((curCost - c) / temp)) { cur = nxt; curCost = c; }
      if (!best || curCost < best.cost) best = { cost: curCost, set: new Set(cur) };
    }
  }
  const pool = [...best.set];
  const rest = [...Array(n).keys()].filter((i) => !best.set.has(i));
  const rows = rest.map((i) => ({ i, rate: rateIn(i, pool) })).sort((a, b) => a.rate - b.rate);
  const tutorial = rows.filter((r) => r.rate >= 0.25 && r.rate <= 0.42).slice(-3).map((r) => r.i); // weak but not hopeless
  const boss = rows.filter((r) => r.rate >= 0.6).slice(-8).sort((a, b) => a.rate - b.rate).slice(0, 8).map((r) => r.i);
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  console.log(`${res.length} matches. pool of ${pool.length}, worst distance from 50%: ${pct(Math.sqrt(0) + Math.max(...pool.map((i) => Math.abs(rateIn(i, pool) - 0.5))))}`);
  for (const i of pool.sort((a, b) => rateIn(b, pool) - rateIn(a, pool))) console.log('  pool    ', pct(rateIn(i, pool)).padStart(4), ids[i]);
  for (const r of rows) console.log(`  ${tutorial.includes(r.i) ? 'tutorial' : boss.includes(r.i) ? 'boss    ' : 'unused  '} ${pct(r.rate).padStart(4)} ${ids[r.i]}`);

  if (WRITE) {
    const names = (xs) => xs.map((i) => `'${ids[i]}'`).join(', ');
    writeFileSync(new URL('../src/engine/roster.js', import.meta.url),
      `// Generated by scripts/pool.mjs - do not edit by hand.\n// free: the balanced pool the bot draws from. tutorial: weak showcase builds\n// for learning the game. boss: strong builds reserved for boss fights.\nexport const ROSTER = {\n  free: [${names(pool)}],\n  tutorial: [${names(tutorial)}],\n  boss: [${names(boss)}],\n};\n`);
    const all = [...pool, ...tutorial, ...boss];
    const body = all.map((i) => [ids[i], rateIn(i, pool)]).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, r]) => `  '${id}': ${r.toFixed(3)},`).join('\n');
    writeFileSync(new URL('../src/engine/ratings.js', import.meta.url),
      `// Generated by scripts/pool.mjs - do not edit by hand.\nexport const RATINGS = {\n${body}\n};\n`);
    console.log('wrote roster.js and ratings.js');
  }
}
