// Search for balance. Builds whose score is far from even get their
// skill-position players nudged (depth/lateral); the variant that scores
// closest to 50% against the pool and is still inert alone is kept.
//   node scripts/jitter.mjs [rounds] [variants] [opponentSample]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { RAW, CANDIDATES, assemble, footprintOf, TARGET_TILES } from '../src/engine/library.js';
import { ROSTER } from '../src/engine/roster.js';
import { TUNING } from '../src/engine/tuning.js';
import { SHAPES } from '../src/engine/shapes.js';
import { placeFormation, validateDraft } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { createRng } from '../src/engine/rng.js';
import { BLUE, RED } from '../src/engine/constants.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';

const ME = fileURLToPath(import.meta.url);

if (!isMainThread) {
  const out = [];
  for (const [tag, blue, red, seed] of workerData.tasks) {
    const fortune = process.env.FORTUNE ? DEFAULT_FORTUNE_RULES : null; // tune under the shipped rules
    const e = createEngine({ seed, freezeUnderworld: !fortune, fortune });
    e.loadTeams([...placeFormation(blue, BLUE), ...placeFormation(red, RED)]);
    const r = e.runToEnd();
    out.push([tag, r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0]);
  }
  parentPort.postMessage(out);
} else {
  const rounds = Number(process.argv[2] || 5);
  const VARIANTS = Number(process.argv[3] || 8);
  const SAMPLE = Number(process.argv[4] || 30);
  const BAND = 0.06;
  const SEEDS = Number(process.env.SEEDS || 1);
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const nWorkers = Math.min(os.cpus().length, 8);

  const evaluate = async (tasks) => {
    const slices = Array.from({ length: nWorkers }, () => []);
    tasks.forEach((t, i) => slices[i % nWorkers].push(t));
    const parts = await Promise.all(slices.map((s) => new Promise((res, rej) => {
      const w = new Worker(ME, { workerData: { tasks: s } });
      w.on('message', res); w.on('error', rej);
    })));
    return parts.flat();
  };

  const inertAlone = (b) => {
    for (const [team, flip] of [[BLUE, false], [BLUE, true], [RED, false], [RED, true]]) {
      if (!validateDraft(placeFormation(b, team, { flip }), team).ok) return false;
    }
    const reach = Math.max(...b.players.filter((p) => p.role !== 'RS').map((p) => p.depth + Math.max(...SHAPES[p.shape].map(([du]) => du))));
    if (reach > 20 || b.players.some((p) => p.role !== 'RS' && p.depth < 0)) return false;
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.loadTeams(placeFormation(b, BLUE));
    const r = e.runToEnd();
    return r.status === 'stable' && r.ticks <= 4 && r.score.blue === TARGET_TILES;
  };

  const tuning = JSON.parse(JSON.stringify(TUNING));
  const rawById = new Map(RAW.map((b) => [b.id, b]));
  const ids = process.env.ROSTER_FILE ? JSON.parse(readFileSync(process.env.ROSTER_FILE, 'utf8')).free : ROSTER.free;
  let rng = createRng(12345);

  for (let round = 1; round <= rounds; round++) {
    const current = new Map(ids.map((id) => [id, assemble(rawById.get(id), tuning[id])]));

    // 1. Score every build against the whole pool (both colours).
    const tasks1 = [];
    for (const a of ids) for (const b of ids) if (a !== b) {
      for (let k = 0; k < SEEDS; k++) tasks1.push([[a, b], current.get(a), current.get(b), tasks1.length + 1]);
    }
    const res1 = await evaluate(tasks1);
    const pts = new Map(ids.map((id) => [id, { p: 0, n: 0 }]));
    for (const [[a, b], v] of res1) {
      pts.get(a).p += v; pts.get(a).n++;
      pts.get(b).p += 1 - v; pts.get(b).n++;
    }
    const rate = new Map(ids.map((id) => [id, pts.get(id).p / pts.get(id).n]));
    const out = ids.filter((id) => Math.abs(rate.get(id) - 0.5) > BAND && (!ONLY || ONLY.includes(id)));
    const inBand = ids.length - out.length;
    console.log(`round ${round}: ${inBand}/${ids.length} in band (+/-${BAND * 100}%), tuning ${out.length}`);
    if (!out.length) break;

    // 2. Variants for each outlier, scored against a sample of the pool.
    const jobs = []; // {id, moves}
    for (const id of out) {
      const raw = rawById.get(id);
      let made = 0; let tries = 0;
      while (made < VARIANTS && tries++ < VARIANTS * 12) {
        const base = tuning[id] || [];
        const moves = base.map((m) => [...m]);
        const k = 1 + Math.floor(rng() * 2);
        for (let j = 0; j < k; j++) {
          const i = Math.floor(rng() * raw.players.length);
          const dd = Math.floor(rng() * 5) - 2; const dl = Math.floor(rng() * 5) - 2;
          if (!dd && !dl) continue;
          const m = moves.find((x) => x[0] === i);
          if (m) { m[1] += dd; m[2] += dl; } else moves.push([i, dd, dl]);
        }
        const variant = assemble(raw, moves);
        if (!inertAlone(variant)) continue;
        jobs.push({ id, moves, build: variant });
        made++;
      }
    }
    const tasks2 = [];
    jobs.forEach((job, ji) => {
      const opp = ids.filter((x) => x !== job.id).sort(() => rng() - 0.5).slice(0, SAMPLE);
      for (const o of opp) {
        for (let k = 0; k < SEEDS; k++) {
          tasks2.push([ji, job.build, current.get(o), tasks2.length + 1]);
          tasks2.push([ji, current.get(o), job.build, tasks2.length + 1]);
        }
      }
    });
    const res2 = await evaluate(tasks2);
    const score = new Map();
    res2.forEach(([ji, v], i) => {
      const t = tasks2[i];
      const isBlue = t[1] === jobs[ji].build;
      const e = score.get(ji) || { p: 0, n: 0 };
      e.p += isBlue ? v : 1 - v; e.n++;
      score.set(ji, e);
    });
    let accepted = 0;
    for (const id of out) {
      const cur = Math.abs(rate.get(id) - 0.5);
      let best = null;
      jobs.forEach((job, ji) => {
        if (job.id !== id) return;
        const e = score.get(ji);
        const d = Math.abs(e.p / e.n - 0.5);
        if (!best || d < best.d) best = { d, moves: job.moves };
      });
      if (best && best.d + 0.02 < cur) { tuning[id] = best.moves; accepted++; }
    }
    console.log(`  accepted ${accepted} of ${out.length}`);
    const body = Object.keys(tuning).sort().map((k) => `  '${k}': ${JSON.stringify(tuning[k])},`).join('\n');
    writeFileSync(new URL('../src/engine/tuning.js', import.meta.url),
      `// Generated by scripts/jitter.mjs - do not edit by hand.\nexport const TUNING = {\n${body}\n};\n`);
  }
}
