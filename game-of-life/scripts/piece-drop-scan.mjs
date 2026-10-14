// How much does the best placement of a piece add to a formation?   node scripts/piece-drop-scan.mjs [formation-id] [piece-id]
// Scans drop spots on our half and rates the formation (with the piece there) against the bot pool,
// next to the same formation with no piece. A big best-spot gain for a cheap piece means it is underpriced.
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';
import { getObject, cellsWithObject, placementOk } from '../src/engine/objects.js';
import { BLUE, RED } from '../src/engine/constants.js';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ME = fileURLToPath(import.meta.url);
const id = process.argv[2] || 'fb-bunch';
const pieceId = process.argv[3] || 'block';
const SEEDS = [301, 302, 303, 304];

if (!isMainThread) {
  const f = FREE_BUILDS.find((b) => b.id === id);
  const obj = getObject(pieceId);
  const out = [];
  for (const drop of workerData.drops) {
    const mine = drop ? cellsWithObject(f, BLUE, obj, drop) : placeFormation(f, BLUE);
    let w = 0; let n = 0;
    for (const opp of FREE_BUILDS) for (const seed of SEEDS) {
      const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
      e.loadTeams([...mine, ...placeFormation(opp, RED, { flip: seed % 2 === 0 })]);
      const r = e.runToEnd(); w += r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0; n++;
    }
    out.push([drop, w / n]);
  }
  parentPort.postMessage(out);
} else {
  const f = FREE_BUILDS.find((b) => b.id === id);
  const obj = getObject(pieceId);
  const drops = [null];
  for (let depth = 2; depth <= 20; depth += 3) for (let lat = -18; lat <= 18; lat += 3) {
    if (placementOk(f, obj, { depth, lat })) drops.push({ depth, lat });
  }
  const W = Math.min(os.cpus().length, 8);
  const slices = Array.from({ length: W }, () => []);
  drops.forEach((d, i) => slices[i % W].push(d));
  const res = (await Promise.all(slices.map((s) => new Promise((ok, no) => { const w = new Worker(ME, { workerData: { drops: s }, argv: process.argv.slice(2) }); w.on('message', ok); w.on('error', no); })))).flat();
  const base = res.find(([d]) => d === null)[1];
  const placed = res.filter(([d]) => d).sort((a, b) => b[1] - a[1]);
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  console.log(`${f.name} with no piece: ${pct(base)}`);
  console.log(`${pieceId}: ${placed.length} legal spots. Best 3:`, placed.slice(0, 3).map(([d, r]) => `depth ${d.depth} lat ${d.lat} -> ${pct(r)}`).join(' | '));
  console.log(`  median ${pct(placed[Math.floor(placed.length / 2)][1])}, worst ${pct(placed[placed.length - 1][1])}`);
}
