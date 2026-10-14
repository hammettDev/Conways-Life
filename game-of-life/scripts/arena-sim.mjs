// Is the 4-player arena fair between its four seats, and how long and busy are its matches?   node scripts/arena-sim.mjs [matches]
// Each match gives the four seats random free formations and counts who wins. Fair seats win about a quarter each.
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngineN } from '../src/engine/engineN.js';
import { G4 } from '../src/engine/geometry.js';
import { arenaCells } from '../src/engine/arena.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';
import { createRng } from '../src/engine/rng.js';
import { BLUE, RED } from '../src/engine/constants.js';

const N = Number(process.argv[2] || 80);
const same = process.argv.includes('--same'); // every seat gets the same formation
const wins = [0, 0, 0, 0, 0]; let pushes = 0; let ticks = 0; let crashes = 0; const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const rng = createRng(1000 + i);
  const pick = () => FREE_BUILDS[Math.floor(rng() * FREE_BUILDS.length)];
  const f = [pick(), pick(), pick(), pick()];
  if (same) f[1] = f[2] = f[3] = f[0];
  const flip = [rng() < 0.5, rng() < 0.5, rng() < 0.5, rng() < 0.5];
  const mine = placeFormation(f[0], BLUE, { flip: flip[0] });
  const cells = [...mine, ...[1, 2, 3].flatMap((k) => arenaCells(placeFormation(f[k], RED, { flip: flip[k] }), k + 1))];
  const e = createEngineN({ seed: 77 + i * 31, geometry: G4, fortune: DEFAULT_FORTUNE_RULES });
  e.loadTeams(cells);
  const r = e.runToEnd();
  if (r.winners.length > 1) pushes++; else wins[r.winners[0]]++;
  ticks += r.ticks; crashes += r.fortune.crashes.total;
}
console.log(`${N} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s${same ? ' (same formation in every seat)' : ''}`);
console.log('seat wins: you', wins[1], 'red', wins[2], 'lime', wins[3], 'violet', wins[4], 'pushes', pushes);
console.log('average ticks', (ticks / N).toFixed(0), 'average topples', (crashes / N).toFixed(1));
