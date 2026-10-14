// How often does a player beat each boss, and what is a boss fight worth?   node scripts/boss-sim.mjs [matches]
// The player rotates through the free formations (and, in the second column, also buys a glider);
// payout is the hidden multiplier table, best of the boss's rolls. EV is per 1 unit bet.
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';
import { createRng } from '../src/engine/rng.js';
import { BOSSES, pickBossSetup, withItem, rollMultiplier } from '../src/game/bosses.js';
import { getObject, cellsWithObject, placementOk } from '../src/engine/objects.js';
import { BLUE, BOSS_MULTIPLIERS } from '../src/engine/constants.js';

const N = Number(process.argv[2] || 150);
const glider = getObject('glider');
const mineWith = (f, seed) => {
  const rng = createRng(seed ^ 0xabc);
  for (let k = 0; k < 40; k++) {
    const drop = { depth: 6 + Math.floor(rng() * 14), lat: Math.floor(rng() * 25) - 12 };
    if (placementOk(f, glider, drop)) return cellsWithObject(f, BLUE, glider, drop);
  }
  return placeFormation(f, BLUE);
};
const meanMult = (rolls) => { const rng = createRng(3); let n = 0; for (let i = 0; i < 4000; i++) n += rollMultiplier(rng, rolls); return n / 4000; };
console.log(`${N} fights per boss; a win pays wager x multiplier, a loss costs the wager`);
console.log('boss'.padEnd(14), 'win rate'.padEnd(10), 'with glider'.padEnd(12), 'avg payout'.padEnd(11), 'EV / bet (no piece, with glider)');
for (const b of BOSSES) {
  let w0 = 0; let w1 = 0;
  for (let i = 0; i < N; i++) {
    const seed = 30000 + i * 13;
    const f = FREE_BUILDS[i % FREE_BUILDS.length];
    const last = FREE_BUILDS[(i + 5) % FREE_BUILDS.length].id;
    const bot = withItem(b, pickBossSetup(b, createRng(seed), last), createRng(seed ^ 0x51ed));
    for (const piece of [false, true]) {
      const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
      e.loadTeams([...(piece ? mineWith(f, seed) : placeFormation(f, BLUE)), ...bot.cells]);
      const r = e.runToEnd();
      const v = r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0;
      if (piece) w1 += v; else w0 += v;
    }
  }
  const m = meanMult(b.rolls);
  const ev = (p) => (p * m - (1 - p)).toFixed(2);
  console.log(b.id.padEnd(14), `${(100 * w0 / N).toFixed(0)}%`.padEnd(10), `${(100 * w1 / N).toFixed(0)}%`.padEnd(12), `x${m.toFixed(1)}`.padEnd(11), `${ev(w0 / N)}, ${ev(w1 / N)}`);
}
