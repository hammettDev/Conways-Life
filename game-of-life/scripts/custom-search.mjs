// How strong can a custom formation get?   node scripts/custom-search.mjs [generations] [seed]
// Hill-climbs two kinds of design against the bot pool under the shipped rules:
//   units - the designer as built (placed units from a fixed list), and
//   cells - free-form painting of single cells, plus extra still lifes the unit list lacks.
// Both must pass the same legality rules as the built-in formations (inert alone, the
// 60-tile budget, own half, at most 50 cells). The best design of each kind is then
// re-measured on seeds the search never saw, next to the built-in formations.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { FREE_BUILDS, BOSS_BUILDS, TARGET_TILES, footprintOf } from '../src/engine/library.js';
import { placeFormation, validateDraft, BLUE_LOS_X, CENTER_Y } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { checkCustom, buildCustom, CUSTOM_SHAPES, footprintOk } from '../src/engine/custom.js';
import { reserveUnits } from '../src/engine/builds/helpers.js';
import { SHAPES } from '../src/engine/shapes.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';
import { BLUE, RED, MAX_DRAFT, MAX_CUSTOM_UNITS } from '../src/engine/constants.js';

const ME = fileURLToPath(import.meta.url);
const toTeam = (cells) => cells.map(([d, l]) => ({ x: BLUE_LOS_X - d, y: CENTER_Y + l, team: BLUE }));

// ---- worker: legality + score ------------------------------------------------------
function soloTiles(teamCells) {
  const e = createEngine({ seed: 1, freezeUnderworld: true });
  e.loadTeams(teamCells);
  const r = e.runToEnd();
  return r.status === 'stable' && r.ticks <= 4 ? r.score.blue : -1;
}

function realise(task) {
  if (task.mode === 'units') {
    const spec = { id: 'x', name: 'x', players: task.units };
    if (!checkCustom(spec).ok) return null;
    return placeFormation(buildCustom(spec), BLUE);
  }
  if (task.mode === 'build') {
    const b = [...FREE_BUILDS, ...BOSS_BUILDS].find((x) => x.id === task.id);
    return placeFormation(b, BLUE);
  }
  // cells: free-form
  const cells = task.cells;
  if (cells.length > MAX_DRAFT || cells.some(([d, l]) => d < 0 || d > 20 || l < -20 || l > 19)) return null;
  if (new Set(cells.map(([d, l]) => d * 100 + l)).size !== cells.length) return null;
  const mine = toTeam(cells);
  const tiles = soloTiles(mine);
  if (!footprintOk(tiles)) return null;
  const reserves = placeFormation({ players: reserveUnits(TARGET_TILES - tiles) }, BLUE);
  const all = [...mine, ...reserves];
  return validateDraft(all, BLUE).ok && validateDraft(all.map((c) => ({ ...c, y: 2 * CENTER_Y - 1 - c.y })), BLUE).ok ? all : null;
}

if (!isMainThread) {
  const out = [];
  for (const task of workerData.tasks) {
    const mine = realise(task);
    if (!mine) { out.push([task.key, -1]); continue; }
    let pts = 0; let n = 0;
    for (const opp of FREE_BUILDS) {
      for (const seed of task.seeds) {
        const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
        e.loadTeams([...mine, ...placeFormation(opp, RED)]);
        const r = e.runToEnd();
        pts += r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0;
        n++;
      }
    }
    out.push([task.key, pts / n]);
  }
  parentPort.postMessage(out);
} else {
  const GENS = Number(process.argv[2] || 20);
  let rs = Number(process.argv[3] || 7);
  const rand = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 2 ** 32; };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const ri = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const W = Math.min(os.cpus().length, 8);
  const SEARCH_SEEDS = [11, 12];
  const HELD_SEEDS = [101, 102, 103, 104, 105, 106];

  const evaluate = async (tasks) => {
    tasks.forEach((t, i) => { t.key = i; });
    const slices = Array.from({ length: W }, () => []);
    tasks.forEach((t, i) => slices[i % W].push(t));
    const parts = await Promise.all(slices.map((s) => new Promise((ok, no) => {
      const w = new Worker(ME, { workerData: { tasks: s } });
      w.on('message', ok); w.on('error', no);
    })));
    const score = new Array(tasks.length).fill(-1);
    for (const [k, v] of parts.flat()) score[k] = v;
    return score;
  };

  // extra still lifes the unit list does not offer (cells as [depth, lat] offsets)
  const EXTRA = {
    ship: [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [2, 2]],
    snake: [[0, 0], [0, 1], [0, 3], [1, 0], [1, 2], [1, 3]],
    pond: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 0], [2, 3], [3, 1], [3, 2]],
    barge: [[0, 1], [1, 0], [1, 2], [2, 1], [2, 3], [3, 2]],
    ...Object.fromEntries(['block', 'tub', 'boat', 'hive', 'loaf', 'bar', 'toad', 'beacon'].map((s) => [s, SHAPES[s].map(([a, b]) => [a, b])])),
  };
  const asCells = (units) => units.flatMap((u) => SHAPES[u.shape].map(([du, dv]) => [u.depth + du, u.lat + dv]));

  const mutateUnits = (units) => {
    const u = units.map((x) => ({ ...x }));
    const op = rand();
    if (op < 0.45 && u.length) { const x = pick(u); x.depth += ri(-3, 3); x.lat += ri(-4, 4); }
    else if (op < 0.6 && u.length) pick(u).shape = pick(CUSTOM_SHAPES);
    else if (op < 0.75 && u.length < MAX_CUSTOM_UNITS) u.push({ shape: pick(CUSTOM_SHAPES), depth: ri(0, 14), lat: ri(-19, 17) });
    else if (op < 0.88 && u.length > 1) u.splice(ri(0, u.length - 1), 1);
    else if (u.length > 1) { const a = pick(u); const b = pick(u); [a.depth, b.depth, a.lat, b.lat] = [b.depth, a.depth, b.lat, a.lat]; }
    return u;
  };
  const mutateCells = (cells) => {
    let c = cells.map(([d, l]) => [d, l]);
    const op = rand();
    if (op < 0.3 && c.length) { const [d, l] = pick(c); c.push([d + ri(-2, 2), l + ri(-2, 2)]); } // one more cell nearby
    else if (op < 0.5 && c.length > 4) c.splice(ri(0, c.length - 1), 1); // one less
    else if (op < 0.65 && c.length) { const k = ri(0, c.length - 1); c[k] = [c[k][0] + ri(-2, 2), c[k][1] + ri(-2, 2)]; } // nudge a cell
    else if (op < 0.85) { const pat = EXTRA[pick(Object.keys(EXTRA))]; const d0 = ri(0, 14); const l0 = ri(-19, 16); c = c.concat(pat.map(([d, l]) => [d + d0, l + l0])); } // drop a pattern
    else if (c.length > 6) { const [d, l] = pick(c); c = c.filter(([a, b]) => Math.abs(a - d) > 2 || Math.abs(b - l) > 3); } // remove a region
    return c;
  };

  const search = async (name, start, mutate, mode) => {
    let pop = start.map((s) => ({ design: s.design, score: s.score }));
    for (let g = 1; g <= GENS; g++) {
      const cands = [];
      for (const p of pop) for (let k = 0; k < 10; k++) cands.push(mutate(p.design));
      const tasks = cands.map((d) => ({ mode, [mode === 'units' ? 'units' : 'cells']: d, seeds: SEARCH_SEEDS }));
      const sc = await evaluate(tasks);
      const legal = sc.filter((s) => s >= 0).length;
      const merged = [...pop, ...cands.map((d, i) => ({ design: d, score: sc[i] })).filter((x) => x.score >= 0)];
      merged.sort((a, b) => b.score - a.score);
      pop = merged.slice(0, 4);
      if (g % 5 === 0 || g === GENS) console.log(`  ${name} gen ${g}: best ${(pop[0].score * 100).toFixed(0)}%, ${legal}/${cands.length} mutants legal`);
    }
    return pop[0];
  };

  const heldout = async (tasks) => (await evaluate(tasks.map((t) => ({ ...t, seeds: HELD_SEEDS }))));

  // baselines: every built-in formation on the held-out seeds
  const baseTasks = [...FREE_BUILDS, ...BOSS_BUILDS].map((b) => ({ mode: 'build', id: b.id }));
  const base = await heldout(baseTasks);
  const poolScores = base.slice(0, FREE_BUILDS.length);
  const bossScores = base.slice(FREE_BUILDS.length);
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  console.log(`built-in pool (16): mean ${pct(poolScores.reduce((a, b) => a + b, 0) / poolScores.length)}, best ${pct(Math.max(...poolScores))}, worst ${pct(Math.min(...poolScores))}`);
  console.log(`built-in boss builds: ${bossScores.map(pct).join(', ')}`);

  // starting points: the four strongest pool builds, as units and as cells
  const ranked = FREE_BUILDS.map((b, i) => ({ b, s: poolScores[i] })).sort((a, b) => b.s - a.s).slice(0, 4);
  const unitStart = ranked.map(({ b }) => {
    const players = b.players.filter((p) => p.role !== 'RS').map(({ shape, depth, lat }) => ({ shape, depth, lat }));
    return { design: players, score: 0 };
  });
  const cellStart = unitStart.map((s) => ({ design: asCells(s.design), score: 0 }));
  const s0 = await evaluate(unitStart.map((s) => ({ mode: 'units', units: s.design, seeds: SEARCH_SEEDS })));
  unitStart.forEach((s, i) => { s.score = Math.max(0, s0[i]); });
  const c0 = await evaluate(cellStart.map((s) => ({ mode: 'cells', cells: s.design, seeds: SEARCH_SEEDS })));
  cellStart.forEach((s, i) => { s.score = Math.max(0, c0[i]); });
  console.log(`starts: units ${unitStart.map((s) => pct(s.score)).join(' ')} | cells ${cellStart.map((s) => pct(s.score)).join(' ')} (${cellStart.filter((s, i) => c0[i] < 0).length} cell starts illegal)`);

  const bestU = await search('units', unitStart, mutateUnits, 'units');
  const bestC = await search('cells', cellStart, mutateCells, 'cells');
  const [hu, hc] = await heldout([{ mode: 'units', units: bestU.design }, { mode: 'cells', cells: bestC.design }]);
  console.log('\nbest found, re-measured on seeds the search never saw:');
  console.log(`  units: search ${pct(bestU.score)} -> held-out ${pct(hu)}  (${bestU.design.length} units, ${footprintOf(bestU.design)} tiles)`);
  console.log(`  cells: search ${pct(bestC.score)} -> held-out ${pct(hc)}  (${bestC.design.length} cells)`);
  const show = (cells) => {
    const set = new Set(cells.map(([d, l]) => `${d},${l}`));
    const ls = cells.map((c) => c[1]); const ds = cells.map((c) => c[0]);
    const rows = [];
    for (let d = Math.min(...ds); d <= Math.max(...ds); d++) {
      let r = '';
      for (let l = Math.min(...ls); l <= Math.max(...ls); l++) r += set.has(`${d},${l}`) ? '#' : '.';
      rows.push(r);
    }
    return rows.join('\n');
  };
  console.log('\nbest unit design (line of scrimmage on top):\n' + show(asCells(bestU.design)));
  console.log('\nbest cell design:\n' + show(bestC.design));
}
