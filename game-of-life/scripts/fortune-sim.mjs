// Compare the old rules with the fortune layer (tower crashes + Hot Spot board)
// on the balanced pool.   node scripts/fortune-sim.mjs
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE, RED } from '../src/engine/constants.js';

const ME = fileURLToPath(import.meta.url);
const MODES = [
  { name: 'old rules', f: null },
  { name: 'CONTROL: old rules, new seeds', f: null, seedShift: 100000 },
  { name: 'CONTROL 2: old rules, new seeds', f: null, seedShift: 200000 },
  { name: 'fortune, fences ON  T25', f: { threshold: 25, cooldown: 8, maxCrashes: 4, unit: 5 } },
  { name: 'fortune, fences OFF T25 bigger', f: { threshold: 25, cooldown: 8, maxCrashes: 4, unit: 1, fence: false, hotValue: 25, restValue: 5 } },
];
const o2n = (o) => (o === 'win' ? 1 : o === 'push' ? 0.5 : 0);

if (!isMainThread) {
  const byId = new Map(FREE_BUILDS.map((b) => [b.id, b]));
  const out = [];
  for (const [m, a, b, seed] of workerData.tasks) {
    const e = createEngine({ seed: seed + (MODES[m].seedShift || 0), fortune: MODES[m].f });
    e.loadTeams([...placeFormation(byId.get(a), BLUE), ...placeFormation(byId.get(b), RED)]);
    const r = e.runToEnd();
    out.push([m, a, b, o2n(r.outcome), r.ticks, r.status, o2n(r.tileOutcome ?? r.outcome),
      r.fortune ? r.fortune.crashes.blue + r.fortune.crashes.red : 0,
      r.fortune ? Math.abs(r.fortune.blue - r.fortune.red) : 0]);
  }
  parentPort.postMessage(out);
} else {
  const ids = FREE_BUILDS.map((b) => b.id);
  const tasks = [];
  let seed = 1;
  for (const a of ids) for (const b of ids) if (a !== b) {
    const s = seed++;
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
  for (const [m, a, b, v, ticks, status, tileV, crashes, lead] of res) byMode[m].set(`${a}|${b}`, { v, ticks, status, tileV, crashes, lead });
  const rating = (m, key = 'v') => {
    const pts = new Map(ids.map((i) => [i, { p: 0, g: 0 }]));
    for (const [k, r] of byMode[m]) {
      const [a, b] = k.split('|');
      pts.get(a).p += r[key]; pts.get(a).g++;
      pts.get(b).p += 1 - r[key]; pts.get(b).g++;
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
  console.log('mode'.padEnd(28), 'ticks  crashes  |lead|  Board1-alone agrees w/ old   fortune flips result   final corr w/ old  sd     in 40-60');
  MODES.forEach((mode, m) => {
    const rs = [...byMode[m]];
    const avg = (f) => rs.reduce((s, [, r]) => s + f(r), 0) / rs.length;
    let tileAgree = 0; let flips = 0;
    for (const [k, r] of rs) {
      if (r.tileV === byMode[0].get(k).v) tileAgree++;
      if (r.tileV !== r.v) flips++;
    }
    const rt = rating(m);
    console.log(
      mode.name.padEnd(28), avg((r) => r.ticks).toFixed(0).padStart(4), avg((r) => r.crashes).toFixed(1).padStart(7),
      avg((r) => r.lead).toFixed(1).padStart(7), `${(100 * tileAgree / rs.length).toFixed(0)}%`.padStart(20),
      `${(100 * flips / rs.length).toFixed(0)}%`.padStart(24), pearson(base, rt).toFixed(2).padStart(17),
      sd(rt).toFixed(3).padStart(8), String(rt.filter((x) => x >= 0.4 && x <= 0.6).length).padStart(8),
    );
  });
}
