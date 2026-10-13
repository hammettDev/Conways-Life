// Does the fortune layer keep strategy intact?   node scripts/fortune-balance.mjs [seedsPerPair]
// Plays the balanced pool under the old rules and several fortune settings and
// reports how much a "right matchup" still wins.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE, RED } from '../src/engine/constants.js';

const ME = fileURLToPath(import.meta.url);
const K = Number(process.argv[2] || 3);
const MODES = [
  { name: 'old rules', f: null },
  { name: 'A  fences ON  T25 max6 unit5', f: { threshold: 25, cooldown: 8, maxCrashes: 6, unit: 5 } },
  { name: 'B  fences ON  T40 max4 unit5', f: { threshold: 40, cooldown: 10, maxCrashes: 4, unit: 5 } },
  { name: 'C  fences OFF T25 max6 unit3', f: { threshold: 25, cooldown: 8, maxCrashes: 6, unit: 3, fence: false } },
  { name: 'D  fences ON  T25 max6 unit3', f: { threshold: 25, cooldown: 8, maxCrashes: 6, unit: 3 } },
  { name: 'E  fences ON  T60 max3 unit5', f: { threshold: 60, cooldown: 12, maxCrashes: 3, unit: 5 } },
];
const o2n = (o) => (o === 'win' ? 1 : o === 'push' ? 0.5 : 0);

if (!isMainThread) {
  const byId = new Map(FREE_BUILDS.map((b) => [b.id, b]));
  const out = [];
  for (const [m, a, b, seed] of workerData.tasks) {
    const e = createEngine({ seed, fortune: MODES[m].f });
    e.loadTeams([...placeFormation(byId.get(a), BLUE), ...placeFormation(byId.get(b), RED)]);
    const r = e.runToEnd();
    out.push([m, a, b, seed, o2n(r.outcome), o2n(r.tileOutcome ?? r.outcome), r.ticks,
      r.fortune ? r.fortune.crashes.total : 0, r.fortune ? Math.abs(r.fortune.blue - r.fortune.red) : 0]);
  }
  parentPort.postMessage(out);
} else {
  const ids = FREE_BUILDS.map((b) => b.id);
  const tasks = [];
  let base = 1;
  for (const a of ids) for (const b of ids) if (a !== b) {
    for (let m = 0; m < MODES.length; m++) {
      const reps = m === 0 ? 1 : K;
      for (let k = 0; k < reps; k++) tasks.push([m, a, b, base + k * 7919]);
    }
    base++;
  }
  const n = Math.min(os.cpus().length, 8);
  const slices = Array.from({ length: n }, () => []);
  tasks.forEach((t, i) => slices[i % n].push(t));
  const t0 = Date.now();
  const res = (await Promise.all(slices.map((s) => new Promise((ok, no) => {
    const w = new Worker(ME, { workerData: { tasks: s } });
    w.on('message', ok); w.on('error', no);
  })))).flat();
  console.log(`${tasks.length} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${K} seeds per pairing\n`);

  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  // per mode, per ordered pair: list of outcomes
  const by = MODES.map(() => new Map());
  for (const [m, a, b, , v, tv, ticks, cr, lead] of res) {
    const k = `${a}|${b}`;
    if (!by[m].has(k)) by[m].set(k, []);
    by[m].get(k).push({ v, tv, ticks, cr, lead });
  }
  const old = by[0];
  const oldV = (a, b) => old.get(`${a}|${b}`)[0].v;
  // the right matchup for each opponent b: the player build that did best against it under the old rules
  const best = ids.map((b) => ids.filter((a) => a !== b).sort((x, y) => oldV(y, b) - oldV(x, b) || (x < y ? -1 : 1))[0]);
  const top3 = ids.map((b) => ids.filter((a) => a !== b).sort((x, y) => oldV(y, b) - oldV(x, b) || (x < y ? -1 : 1)).slice(0, 3));
  const pNew = (m, a, b) => mean(by[m].get(`${a}|${b}`).map((r) => r.v));

  const pearson = (x, y) => {
    const mx = mean(x); const my = mean(y);
    let sxy = 0; let sxx = 0; let syy = 0;
    x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
    return sxy / Math.sqrt(sxx * syy);
  };
  const rating = (m) => ids.map((i) => {
    const ps = [];
    for (const j of ids) if (j !== i) { ps.push(pNew(m, i, j)); ps.push(1 - pNew(m, j, i)); }
    return mean(ps);
  });
  const sd = (x) => Math.sqrt(mean(x.map((v) => (v - mean(x)) ** 2)));
  const base0 = rating(0);

  const wins = []; const losses = [];
  for (const a of ids) for (const b of ids) if (a !== b) { const v = oldV(a, b); if (v === 1) wins.push([a, b]); if (v === 0) losses.push([a, b]); }

  console.log('old-rule decisive pairings:', wins.length, 'wins /', losses.length, 'losses of', ids.length * (ids.length - 1), '\n');
  console.log('mode'.padEnd(32), 'ticks crash  win-stays-win  loss-stays-loss  best-counter  top3-counter  RNG(pairs vary)  B2 flips  corr   in40-60');
  MODES.forEach((mode, m) => {
    const all = [...by[m].values()].flat();
    const stayWin = mean(wins.map(([a, b]) => pNew(m, a, b)));
    const stayLoss = 1 - mean(losses.map(([a, b]) => pNew(m, a, b)));
    const bestC = mean(ids.map((b, i) => pNew(m, best[i], b)));
    const top3C = mean(ids.map((b, i) => mean(top3[i].map((a) => pNew(m, a, b)))));
    const varying = mean([...by[m].values()].map((rs) => (new Set(rs.map((r) => r.v)).size > 1 ? 1 : 0)));
    const flips = mean(all.map((r) => (r.tv !== r.v ? 1 : 0)));
    const rt = rating(m);
    console.log(
      mode.name.padEnd(32), mean(all.map((r) => r.ticks)).toFixed(0).padStart(4), mean(all.map((r) => r.cr)).toFixed(1).padStart(5),
      `${(100 * stayWin).toFixed(0)}%`.padStart(12), `${(100 * stayLoss).toFixed(0)}%`.padStart(15),
      `${(100 * bestC).toFixed(0)}%`.padStart(13), `${(100 * top3C).toFixed(0)}%`.padStart(13),
      `${(100 * varying).toFixed(0)}%`.padStart(16), `${(100 * flips).toFixed(0)}%`.padStart(9),
      pearson(base0, rt).toFixed(2).padStart(6), String(rt.filter((x) => x >= 0.4 && x <= 0.6).length).padStart(7),
    );
  });
}
