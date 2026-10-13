// Solo check: every free build should be inert on its own (settles fast, locks
// exactly the tiles its units cover). Usage: node scripts/footprint.mjs [-v]
import { BASE_BUILDS, footprintOf, TARGET_TILES } from '../src/engine/library.js';
import { placeFormation } from '../src/engine/formations.js';
import { createEngine } from '../src/engine/engine.js';
import { BLUE } from '../src/engine/constants.js';



const bySport = {};
for (const b of BASE_BUILDS) {
  if (b.sport === 'arsenal') continue;
  const e = createEngine({ seed: 1, freezeUnderworld: true });
  const cells = placeFormation(b, BLUE);
  e.loadTeams(cells);
  const r = e.runToEnd();
  const expected = footprintOf(b.players);
  const tiles = r.status === 'stable' ? r.score.blue : null;
  const inert = r.status === 'stable' && r.ticks <= 4 && tiles === expected && expected === TARGET_TILES;
  (bySport[b.sport] ||= []).push({ id: b.id, cells: cells.length, tiles, expected, inert });
  if (!inert || process.argv.includes('-v')) {
    console.log(inert ? 'ok   ' : 'LIVE ', b.id.padEnd(22), 'cells', cells.length, 'tiles', tiles, 'expected', expected, r.status, r.ticks);
  }
}
for (const [s, v] of Object.entries(bySport)) {
  const e = v.map((x) => x.expected);
  console.log(s.padEnd(10), 'builds', v.length, 'inert', v.filter((x) => x.inert).length, 'footprint', Math.min(...e) + '-' + Math.max(...e), 'cells', Math.min(...v.map((x) => x.cells)) + '-' + Math.max(...v.map((x) => x.cells)));
}
