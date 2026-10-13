// Compare the old stabilization rules with tower-crash ("avalanche") rules on
// the balanced pool.   node scripts/avalanche-sim.mjs
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE, RED } from '../src/engine/constants.js';

const ME = fileURLToPath(import.meta.url);
const MODES = [
  { name: 'old rules (stabilize)', av: null },
  { name: 'T=100 first to 3, cd 15', av: { threshold: 100, target: 3, cooldown: 15 } },
  { name: 'T=60  first to 3, cd 15', av: { threshold: 60, target: 3, cooldown: 15 } },
  { name: 'T=100 first to 6, cd 15', av: { threshold: 100, target: 6, cooldown: 15 } },
  { name: 'T=200 first to 4, cd 30', av: { threshold: 200, target: 4, cooldown: 30 } },
];

if (!isMainThread) {
  const byId = new Map(FREE_BUILDS.map((b) => [b.id, b]));
  const out = [];
  for (const [m, a, b, seed] of workerData.tasks) {
    const e = createEngine({ seed, avalanche: MODES[m].av });
    e.loadTeams([...placeFormation(byId.get(a), BLUE), ...placeFormation(byId.get(b), RED)]);
    const r = e.runToEnd();
    out.push([m, a, b, r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0, r.ticks, r.status, r.banked ? r.banked.blue + r.banked.red : 0]);
  }
  parentPort.postMessage(out);
} else {
  const ids = FREE_BUILDS.map((b) => b.id);
  const tasks = [];
  let seed = 1;
  const seeds = new Map();
  for (const a of ids) for (const b of ids) if (a !== b) {
    const s = seed++;
    seeds.set(`${a}|${b}`, s);
    for (let m = 0; m < MODES.length; m++) tasks.push([m, a, b, s]);
  }
  const n = Math.min(os.cpus().length, 8);
  const slices = Array.from({ length: n }, () => []);
  tasks.forEach((t, i) => slices[i % n].push(t));
  const t0 = Date.now();
  const res = (await Promise.all(slices.map((s) => new Promise((ok, no) => {
    const w = new Worker(ME, { workerData: { tasks: s } });
    w.on('message', ok); w.on('error', no);
  })))).flat();
  console.log(`${tasks.length} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);

  const byMode = MODES.map(() => new Map());
  for (const [m, a, b, v, ticks, status, banked] of res) byMode[m].set(`${a}|${b}`, { v, ticks, status, banked });
  const rating = (m) => {
    const pts = new Map(ids.map((i) => [i, { p: 0, g: 0 }]));
    for (const [k, r] of byMode[m]) {
      const [a, b] = k.split('|');
      pts.get(a).p += r.v; pts.get(a).g++;
      pts.get(b).p += 1 - r.v; pts.get(b).g++;
    }
    return ids.map((i) => pts.get(i).p / pts.get(i).g);
  };
  const base = rating(0);
  const pearson = (x, y) => {
    const mx = x.reduce((s, v) => s + v, 0) / x.length; const my = y.reduce((s, v) => s + v, 0) / y.length;
    let sxy = 0; let sxx = 0; let syy = 0;
    x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
    return sxy / Math.sqrt(sxx * syy);
  };
  const sd = (x) => { const m = x.reduce((s, v) => s + v, 0) / x.length; return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / x.length); };
  console.log('mode'.padEnd(26), 'avgTicks  ended: target/cap/extinct/stable   crashes/match  agree w/ old  rating corr  rating sd  in40-60');
  MODES.forEach((mode, m) => {
    const rs = [...byMode[m].values()];
    const avg = (f) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
    const share = (st) => (100 * rs.filter((r) => r.status === st).length / rs.length).toFixed(0).padStart(3);
    let agree = 0;
    for (const [k, r] of byMode[m]) if (r.v === byMode[0].get(k).v) agree++;
    const rt = rating(m);
    console.log(
      mode.name.padEnd(26), avg((r) => r.ticks).toFixed(0).padStart(7),
      `   ${share('target')}% /${share('cap')}% /${share('extinct')}% /${share('stable')}%`.padEnd(30),
      avg((r) => r.banked).toFixed(1).padStart(8), `       ${(100 * agree / rs.length).toFixed(0)}%`.padEnd(14),
      pearson(base, rt).toFixed(2).padStart(8), sd(rt).toFixed(3).padStart(10), String(rt.filter((x) => x >= 0.4 && x <= 0.6).length).padStart(7),
    );
  });
}
