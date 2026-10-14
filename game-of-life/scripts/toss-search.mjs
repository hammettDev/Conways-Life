// Find a rock-paper-scissors triple of formations for the coin toss.   node scripts/toss-search.mjs [seeds=8]
// A beats B, B beats C and C beats A, as decisively as possible, so picking and guessing matters.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE, RED } from '../src/engine/constants.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';

const ME = fileURLToPath(import.meta.url);
const SEEDS = Number(process.argv[2] || 8);
if (!isMainThread) {
  const byId = new Map(FREE_BUILDS.map((b) => [b.id, b]));
  const out = [];
  for (const [a, b, seed] of workerData.tasks) {
    const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
    e.loadTeams([...placeFormation(byId.get(a), BLUE), ...placeFormation(byId.get(b), RED, { flip: seed % 2 === 0 })]);
    const r = e.runToEnd();
    out.push([a, b, r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0]);
  }
  parentPort.postMessage(out);
} else {
  const ids = FREE_BUILDS.filter((b) => b.sport === 'football').map((b) => b.id);
  const tasks = [];
  let seed = 100;
  for (const a of ids) for (const b of ids) if (a !== b) for (let k = 0; k < SEEDS; k++) tasks.push([a, b, seed++]);
  const W = Math.min(os.cpus().length, 8);
  const slices = Array.from({ length: W }, () => []);
  tasks.forEach((t, i) => slices[i % W].push(t));
  console.log(`${tasks.length} matches on ${W} workers`);
  const parts = await Promise.all(slices.map((s) => new Promise((ok, no) => { const w = new Worker(ME, { workerData: { tasks: s } }); w.on('message', ok); w.on('error', no); })));
  const sum = new Map(); const cnt = new Map();
  for (const [a, b, v] of parts.flat()) { const k = `${a}|${b}`; sum.set(k, (sum.get(k) || 0) + v); cnt.set(k, (cnt.get(k) || 0) + 1); }
  const wr = (a, b) => sum.get(`${a}|${b}`) / cnt.get(`${a}|${b}`);
  const best = [];
  for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) for (let k = 0; k < ids.length; k++) {
    if (i >= j || i >= k || j === k) continue;
    const [a, b, c] = [ids[i], ids[j], ids[k]];
    // cyclic: a>b, b>c, c>a
    const m = Math.min(wr(a, b), wr(b, c), wr(c, a));
    best.push([m, a, b, c]);
  }
  best.sort((x, y) => y[0] - x[0]);
  console.log('best cycles (a beats b, b beats c, c beats a): min win rate');
  for (const [m, a, b, c] of best.slice(0, 8)) console.log(m.toFixed(2), a, '>', b, '>', c, '>', a, ` [${wr(a, b).toFixed(2)} ${wr(b, c).toFixed(2)} ${wr(c, a).toFixed(2)}]`);
}
