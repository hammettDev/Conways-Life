// Can a faster receiver that starts far back in the backfield physically meet a thrown glider?
//   node scripts/play-deepcatch.mjs
import { getObject, placeObject } from '../src/engine/objects.js';
import { BLUE, COLS, ROWS } from '../src/engine/constants.js';
import { BLUE_LOS_X } from '../src/engine/formations.js';

const at = (id, depth, lat, flip = false) => placeObject(getObject(id), BLUE, { depth, lat, flip });
const live = (cells) => new Set(cells.map((c) => c.y * COLS + c.x));
function step(set) {
  const count = new Map();
  for (const k of set) {
    const x = k % COLS; const y = (k / COLS) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx; const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS) continue;
      const j = yy * COLS + xx;
      count.set(j, (count.get(j) || 0) + 1);
    }
  }
  const out = new Set();
  for (const [j, n] of count) if (n === 3 || (n === 2 && set.has(j))) out.add(j);
  return out;
}
const centroid = (set) => { let sx = 0; let sy = 0; for (const k of set) { sx += k % COLS; sy += (k / COLS) | 0; } return [sx / set.size, sy / set.size]; };
const run = (cells, T) => { let s = live(cells); for (let i = 0; i < T; i++) s = step(s); return s; };

console.log('light-spaceship receiver vs glider ball: where must the receiver start to meet it?');
console.log('lane gap  flight(ticks)  receiver starts at x  catch depth past line  still alive when they meet');
for (const d of [4, 8, 12, 16, 20, 22]) {
  const T = 4 * d;
  const ball = at('glider', 6, 0); // the QB's glider leaves from about 6 behind the line, heading up and across
  const b = centroid(run(ball, T));
  const recv0 = at('lwss', 20, 0);
  const r = centroid(run(recv0, T));
  const dx = Math.round(b[0] - r[0]); const dy = Math.round(b[1] - r[1]);
  const recv = recv0.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  const end = run(recv, T);
  const [ex, ey] = centroid(end);
  const [sx] = centroid(live(recv));
  console.log(String(d).padStart(3), '  ', String(T).padStart(8), '        ', sx.toFixed(0).padStart(6), '            ', (b[0] - BLUE_LOS_X).toFixed(0).padStart(6), '         ', Math.hypot(ex - b[0], ey - b[1]) < 1.5 ? 'met' : `missed by ${Math.hypot(ex - b[0], ey - b[1]).toFixed(1)}`);
}
