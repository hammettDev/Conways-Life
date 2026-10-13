// Round-robin balance sweep.
//   node scripts/balance.mjs [--frozen] [--seeds N] [--roster file.json] [--json out.json]
// Free builds play every other free build; premium and arsenal builds play the
// whole free pool (as Blue and as Red). A push counts as half a win.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { CANDIDATES } from '../src/engine/library.js';
import { ROSTER } from '../src/engine/roster.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE, RED } from '../src/engine/constants.js';

const ME = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const frozen = flag('--frozen');
const seedsPer = Number(opt('--seeds', 1));

if (!isMainThread) {
  const byId = new Map(CANDIDATES.map((b) => [b.id, b]));
  const out = [];
  for (const [blueId, redId, seed] of workerData.tasks) {
    const e = createEngine({ seed, freezeUnderworld: frozen });
    e.loadTeams([...placeFormation(byId.get(blueId), BLUE), ...placeFormation(byId.get(redId), RED)]);
    const r = e.runToEnd();
    out.push([blueId, redId, r.outcome, r.ticks, r.status]);
  }
  parentPort.postMessage(out);
} else {
  const roster = opt('--roster') ? JSON.parse(readFileSync(opt('--roster'), 'utf8')) : ROSTER;
  const free = roster.free;
  const rated = [...roster.premium, ...roster.arsenal];
  const tasks = [];
  let seed = 1;
  const add = (a, b) => { for (let k = 0; k < seedsPer; k++) tasks.push([a, b, seed++]); };
  for (const a of free) for (const b of free) if (a !== b) add(a, b);
  for (const w of rated) for (const b of free) { add(w, b); add(b, w); }

  const n = Math.min(os.cpus().length, 8);
  const slices = Array.from({ length: n }, () => []);
  tasks.forEach((t, i) => slices[i % n].push(t));
  const t0 = Date.now();
  const results = (await Promise.all(slices.map((s) => new Promise((res, rej) => {
    const w = new Worker(ME, { workerData: { tasks: s }, argv });
    w.on('message', res);
    w.on('error', rej);
  })))).flat();

  const stat = new Map([...free, ...rated].map((id) => [id, { pts: 0, games: 0, ticks: 0, caps: 0 }]));
  const give = (id, pts, ticks, status) => {
    const s = stat.get(id);
    s.pts += pts; s.games++; s.ticks += ticks; if (status === 'cap') s.caps++;
  };
  for (const [blueId, redId, outcome, ticks, status] of results) {
    const bp = outcome === 'win' ? 1 : outcome === 'push' ? 0.5 : 0;
    give(blueId, bp, ticks, status);
    give(redId, 1 - bp, ticks, status);
  }
  const rows = [...stat].map(([id, s]) => ({
    id, rate: s.pts / s.games, ticks: s.ticks / s.games, caps: s.caps / s.games, games: s.games,
  }));
  rows.sort((a, b) => b.rate - a.rate);

  if (opt('--json')) {
    writeFileSync(opt('--json'), JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, r.rate]))));
  }
  if (!flag('--quiet')) {
    console.log(`${tasks.length} matches, ${((Date.now() - t0) / 1000).toFixed(0)}s${frozen ? ' (frozen underworld)' : ''}`);
    const sport = new Map(CANDIDATES.map((b) => [b.id, b.sport]));
    for (const r of rows) {
      console.log(`${(r.rate * 100).toFixed(1).padStart(5)}%  ${sport.get(r.id).padEnd(10)} ${r.id.padEnd(22)} ticks ${r.ticks.toFixed(0).padStart(3)} caps ${(r.caps * 100).toFixed(0)}%`);
    }
  }
}
