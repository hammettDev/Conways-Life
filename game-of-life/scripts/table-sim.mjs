// How does a formation do at each stakes table?   node scripts/table-sim.mjs [formation-id] [matches]
// Plays it as you would with auto-play (the same formation every match) and also rotating through
// the free pool, against each table's bot, and reports the win rate and the net result per $100 bet
// after the table fee. This is the check for "is a 55% formation still worth playing here?".
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { DEFAULT_FORTUNE_RULES } from '../src/engine/fortuneRules.js';
import { createRng } from '../src/engine/rng.js';
import { TABLES, pickTableSetup } from '../src/game/tables.js';
import { BLUE } from '../src/engine/constants.js';
import { getObject, cellsWithObject, placementOk } from '../src/engine/objects.js';

const id = process.argv[2] || 'fb-prevent';
const N = Number(process.argv[3] || 120);
const mine = FREE_BUILDS.find((b) => b.id === id);
const glider = getObject('glider');
const withGlider = (formation, seed) => {
  const rng = createRng(seed ^ 0xabc);
  for (let k = 0; k < 40; k++) {
    const drop = { depth: 6 + Math.floor(rng() * 14), lat: Math.floor(rng() * 25) - 12 };
    if (placementOk(formation, glider, drop)) return cellsWithObject(formation, BLUE, glider, drop);
  }
  return placeFormation(formation, BLUE);
};
const play = (formation, table, seed, lastId, piece = false) => {
  const bot = pickTableSetup(table, createRng(seed), lastId, createRng(seed ^ 0x51ed));
  const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
  e.loadTeams([...(piece ? withGlider(formation, seed) : placeFormation(formation, BLUE)), ...bot.cells]);
  const r = e.runToEnd();
  return r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0;
};
console.log(`${mine.name} (${id}), ${N} matches per table`);
console.log('table        repeat the same     rotate formations   rotate + you buy a glider');
for (const t of TABLES) {
  let rep = 0; let rot = 0; let pc = 0;
  for (let i = 0; i < N; i++) {
    rep += play(mine, t, 5000 + i, id);
    const other = FREE_BUILDS[i % FREE_BUILDS.length];
    const prev = FREE_BUILDS[(i + FREE_BUILDS.length - 1) % FREE_BUILDS.length].id;
    rot += play(other, t, 9000 + i, prev);
    pc += play(other, t, 9000 + i, prev, true);
  }
  const net = (w) => ((2 * w - 1) * 100 - 100 * t.fee).toFixed(1); // net per $100 bet, even money, after the fee
  console.log(`${t.name.padEnd(12)} ${(100 * rep / N).toFixed(0)}% (net ${net(rep / N)})`.padEnd(32) + `${(100 * rot / N).toFixed(0)}% (net ${net(rot / N)})`.padEnd(22) + `${(100 * pc / N).toFixed(0)}% (net ${net(pc / N)}, before the piece's price)`);
}
