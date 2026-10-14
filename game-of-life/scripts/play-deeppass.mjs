// Football-play prototype (no UI).   node scripts/play-proto.mjs
// Tests the ideas: offence and defence live on separate layers that only touch in
// the press band at the line of scrimmage (or once the ball is caught); a catch
// is a rule (receiver alive + not contested); a run is a carrier through the
// ordinary shared board. Reports what physically works, and whether the football
// logic holds (goal-line D vs the run, prevent vs the deep pass).
import { FREE_BUILDS } from '../src/engine/library.js';
import { placeFormation, BLUE_LOS_X, RED_LOS_X, CENTER_Y } from '../src/engine/formations.js';
import { getObject, placeObject } from '../src/engine/objects.js';
import { BLUE, RED, COLS, ROWS } from '../src/engine/constants.js';

const SIZE = COLS * ROWS;
const grid = (cells) => {
  const g = new Uint8Array(SIZE);
  for (const c of cells) if (c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS) g[c.y * COLS + c.x] = c.team;
  return g;
};

// One Life tick on a team grid; a newborn takes the majority colour of its parents.
function step(g) {
  const n = new Uint8Array(SIZE);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let c = 0;
      let b = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ROWS) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= COLS) continue;
          const t = g[yy * COLS + xx];
          if (t) { c++; if (t === BLUE) b++; }
        }
      }
      const k = y * COLS + x;
      if (g[k] ? c === 2 || c === 3 : c === 3) n[k] = g[k] || (b * 2 > c ? BLUE : RED);
    }
  }
  return n;
}

const stats = (g, team) => {
  let n = 0; let sx = 0; let sy = 0; let x0 = 1e9; let x1 = -1; let maxX = -1;
  for (let k = 0; k < SIZE; k++) {
    if (g[k] !== team) continue;
    const x = k % COLS; const y = (k / COLS) | 0;
    n++; sx += x; sy += y; x0 = Math.min(x0, x); x1 = Math.max(x1, x); maxX = Math.max(maxX, x);
  }
  return { n, cx: n ? sx / n : NaN, cy: n ? sy / n : NaN, x0, x1, maxX };
};

const split = (g) => {
  const red = new Uint8Array(SIZE); const blue = new Uint8Array(SIZE);
  for (let k = 0; k < SIZE; k++) { if (g[k] === RED) red[k] = RED; else if (g[k] === BLUE) blue[k] = BLUE; }
  return [red, blue];
};
const merge = (a, b) => { const o = new Uint8Array(a); for (let k = 0; k < SIZE; k++) if (b[k]) o[k] = b[k]; return o; };

// ---------------------------------------------------------------------------
// 2. Press band + contested catch, by defence.
// ---------------------------------------------------------------------------
const DEFENCES = FREE_BUILDS.filter((b) => b.id.startsWith('fb-') && /4-3|dime|46|cover|tampa|goal-line-d|prevent/.test(b.id));
const OFFENCES = FREE_BUILDS.filter((b) => b.id.startsWith('fb-') && /shotgun|pistol|i-form|strong|full|flex|single|empty|bunch/.test(b.id));
const near = (g, cx, cy, r) => {
  for (let y = Math.round(cy) - r; y <= Math.round(cy) + r; y++) for (let x = Math.round(cx) - r; x <= Math.round(cx) + r; x++) {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && g[y * COLS + x] === RED) return true;
  }
  return false;
};

// A receiver is ghost to the defensive line but live to coverage (LB / CB / S): it
// only touches them when it gets within 2 squares of one, and after the catch the
// whole defence can hit it. Press = coverage standing close to the line.
const COVER = new Set(['LB', 'CB', 'S']);
const layers = (defence) => {
  const all = placeFormation(defence, RED);
  const players = defence.players.filter((p) => p.role !== 'RS');
  const front = []; const cover = [];
  for (const pl of players) {
    const cs = placeFormation({ players: [pl] }, RED);
    (COVER.has(pl.role) ? cover : front).push(...cs);
  }
  return { front: grid(front), cover: grid(cover), all };
};
const close = (R, C, r = 2) => {
  for (let k = 0; k < SIZE; k++) {
    if (R[k] !== BLUE) continue;
    const x = k % COLS; const y = (k / COLS) | 0;
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS && C[yy * COLS + xx] === RED) return true;
    }
  }
  return false;
};

function pass(defence, recvCells, depth, maxTicks = 220) {
  let { front: F, cover: C } = layers(defence);
  let R = grid(recvCells);
  let hit = false;
  for (let t = 0; t < maxTicks; t++) {
    const s = stats(R, BLUE);
    if (!s.n) return { out: 'jammed', t };
    if (s.cx >= BLUE_LOS_X + depth) {
      return near(C, s.cx, s.cy, 2) ? { out: 'contested', t } : { out: 'complete', t, hit };
    }
    F = step(F);
    if (!process.env.GHOST && close(R, C, Number(process.env.CR || 2))) { hit = true; const [c2, r2] = split(step(merge(C, R))); C = c2; R = r2; } else { C = step(C); R = step(R); }
  }
  return { out: 'jammed', t: maxTicks }; // stalled: it died down to a still life
}


const at = (id, depth, lat, flip = false) => placeObject(getObject(id), BLUE, { depth, lat, flip });
const lanes = [-20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20];
const DEPTHS = [3, 8, 14, 20, 26];
const CATCH = Number(process.env.CATCH || 12);
const rate = (arr, k) => (100 * arr.filter((o) => o === k).length / arr.length).toFixed(0).padStart(3);
console.log(`LWSS receiver start depth (cells behind the line) vs defence; catch ${CATCH} past the line: complete / contested / jammed %`);
console.log('defence'.padEnd(16), ...DEPTHS.map((d) => String(d).padEnd(16)));
for (const d of DEFENCES) {
  const row = DEPTHS.map((dep) => {
    const outs = lanes.map((lat) => pass(d, at('lwss', dep, lat), CATCH, 320).out);
    return `${rate(outs, 'complete')}/${rate(outs, 'contested')}/${rate(outs, 'jammed')}`.padEnd(16);
  });
  console.log(d.id.padEnd(16), ...row);
}
if (process.env.DEBUG) {
  const d = DEFENCES.find((x) => x.id === 'fb-cover-2');
  let { cover: C } = layers(d); let R = grid(at('lwss', 14, 0));
  for (let t = 0; t < 120; t++) {
    const s = stats(R, BLUE);
    if (t % 10 === 0) console.log(t, 'n', s.n, 'cx', s.cx.toFixed(1), 'cy', s.cy.toFixed(1), 'LOS', BLUE_LOS_X, 'close', close(R, C, 2));
    if (close(R, C, 2)) { const [c2, r2] = split(step(merge(C, R))); C = c2; R = r2; } else { C = step(C); R = step(R); }
    if (!s.n) break;
  }
}
