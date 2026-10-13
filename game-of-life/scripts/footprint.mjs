// Solo check: every free build should be inert on its own (settles fast, locks
// exactly the tiles its units cover). Usage: node scripts/footprint.mjs [-v]
import { BASE_BUILDS } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE } from '../src/engine/constants.js';

export const UNIT_TILES = { bar: 5, dart: 5, ell: 4, block: 4, tub: 4, boat: 5, hive: 6, loaf: 7, toad: 10, toadv: 10, beacon: 8 };

const bySport = {};
for (const b of BASE_BUILDS) {
  if (b.sport === 'arsenal') continue;
  const e = createEngine({ seed: 1, freezeUnderworld: true });
  const cells = placeFormation(b, BLUE);
  e.loadTeams(cells);
  const r = e.runToEnd();
  const expected = b.players.reduce((n, p) => n + UNIT_TILES[p.shape], 0);
  const tiles = r.status === 'stable' ? r.score.blue : null;
  const inert = r.status === 'stable' && r.ticks <= 4 && tiles === expected;
  (bySport[b.sport] ||= []).push({ id: b.id, cells: cells.length, tiles, expected, inert });
  if (!inert || process.argv.includes('-v')) {
    console.log(inert ? 'ok   ' : 'LIVE ', b.id.padEnd(22), 'cells', cells.length, 'tiles', tiles, 'expected', expected, r.status, r.ticks);
  }
}
for (const [s, v] of Object.entries(bySport)) {
  const e = v.map((x) => x.expected);
  console.log(s.padEnd(10), 'builds', v.length, 'inert', v.filter((x) => x.inert).length, 'footprint', Math.min(...e) + '-' + Math.max(...e), 'cells', Math.min(...v.map((x) => x.cells)) + '-' + Math.max(...v.map((x) => x.cells)));
}
