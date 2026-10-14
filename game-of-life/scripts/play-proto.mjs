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
// 1. What can physically catch what? Speeds of the pieces, then a search for a
//    release time and spot where the ball and the receiver can meet downfield.
// ---------------------------------------------------------------------------
const transpose = (cells) => cells.map((c) => ({ ...c, x: c.y, y: c.x }));
function velocity(cells, ticks = 40) {
  let g = grid(cells);
  const a = stats(g, BLUE);
  for (let i = 0; i < ticks; i++) g = step(g);
  const b = stats(g, BLUE);
  return [(b.cx - a.cx) / ticks, (b.cy - a.cy) / ticks];
}
const at = (id, depth, lat, flip = false) => placeObject(getObject(id), BLUE, { depth, lat, flip });
const PIECES = {
  'glider up-left': () => at('glider', 20, 0),
  'glider up-right': () => at('glider', 20, 0, true),
  'lwss straight': () => at('lwss', 20, 0),
  'lwss across': () => transpose(at('lwss', 20, 0)).map((c) => ({ ...c, x: c.x + 20, y: c.y + 10 })),
  'block (stops)': () => at('block', 20, 0),
};
const vel = Object.fromEntries(Object.entries(PIECES).map(([k, f]) => [k, velocity(f())]));
console.log('speeds (cells/tick, x upfield):');
for (const [k, v] of Object.entries(vel)) console.log(' ', k.padEnd(16), 'vx', v[0].toFixed(2), 'vy', v[1].toFixed(2));

function feasible(ball, recv) {
  const vb = vel[ball]; const vr = vel[recv];
  let best = -1; let ways = 0;
  for (let bx = 28; bx <= 36; bx += 2) for (let by = CENTER_Y - 4; by <= CENTER_Y + 4; by += 2) {
    for (let delay = 0; delay <= 12; delay += 2) for (let rx = 36; rx <= 38; rx++) {
      for (let ry = CENTER_Y - 22; ry <= CENTER_Y + 22; ry += 2) {
        for (let t = delay; t <= 120; t++) {
          const px = bx + vb[0] * (t - delay); const py = by + vb[1] * (t - delay);
          const qx = rx + vr[0] * t; const qy = ry + vr[1] * t;
          if (Math.hypot(px - qx, py - qy) <= 1.2 && qx >= BLUE_LOS_X + 3 && qx < 68) { ways++; best = Math.max(best, qx - BLUE_LOS_X); break; }
        }
      }
    }
  }
  return { ways, depth: best };
}
console.log('\ncan the ball meet the receiver downfield? (max catch depth past the line, #setups)');
const balls = ['glider up-left', 'glider up-right', 'lwss straight'];
const recvs = ['glider up-left', 'glider up-right', 'lwss straight', 'lwss across', 'block (stops)'];
console.log(''.padEnd(16), ...balls.map((b) => b.padEnd(22)));
for (const r of recvs) {
  console.log(r.padEnd(16), ...balls.map((b) => { const f = feasible(b, r); return (f.ways ? `${f.depth.toFixed(0)} deep, ${f.ways}` : 'impossible').padEnd(22); }));
}

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
    if (close(R, C, Number(process.env.CR || 2))) { hit = true; const [c2, r2] = split(step(merge(C, R))); C = c2; R = r2; } else { C = step(C); R = step(R); }
  }
  return { out: 'jammed', t: maxTicks }; // stalled: it died down to a still life
}

const lanes = [-20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20];
const RECV = {
  // receiver kind -> cells for a lane
  'glider (corner)': (lat) => at('glider', 2, lat, lat < 0),
  'lwss (go)': (lat) => at('lwss', 3, lat),
  'block (hitch)': (lat) => at('block', -6 + 0, lat).map((c) => ({ ...c, x: c.x + 12 + 0 })), // sits 6 past the line
};

const rate = (arr, k) => (100 * arr.filter((o) => o === k).length / arr.length).toFixed(0).padStart(3);
const rows = [];
for (const d of DEFENCES) {
  const row = { id: d.id };
  for (const [name, mk] of Object.entries(RECV)) {
    const depth = name.startsWith('block') ? 6 : 12;
    const outs = (name.startsWith('glider') ? lanes.filter((l) => Math.abs(l) <= 16) : lanes).map((lat) => pass(d, mk(lat), depth).out);
    row[name] = { comp: rate(outs, 'complete'), cont: rate(outs, 'contested'), jam: rate(outs, 'jammed') };
  }
  rows.push(row);
}
console.log('\npass completion % by defence (11 lanes each: complete / contested / jammed at the press)');
console.log('defence'.padEnd(16), ...Object.keys(RECV).map((k) => k.padEnd(26)));
for (const r of rows) console.log(r.id.padEnd(16), ...Object.keys(RECV).map((k) => `${r[k].comp} / ${r[k].cont} / ${r[k].jam}`.padEnd(26)));

// ---------------------------------------------------------------------------
// 3. Run play: a heavy spaceship through an ordinary shared board.
// ---------------------------------------------------------------------------
function runGain(offence, defence, lat, withCarrier) {
  const cells = [...placeFormation(offence, BLUE), ...placeFormation(defence, RED)];
  if (withCarrier) cells.push(...at('hwss', 6, lat));
  let g = grid(cells);
  let reach = 0;
  for (let t = 0; t < 70; t++) {
    g = step(g);
    reach = Math.max(reach, stats(g, BLUE).maxX - BLUE_LOS_X);
  }
  return reach;
}
const RUN_LANES = [-12, -8, -4, 0, 4, 8, 12];
console.log('\nrun play: furthest blue cell past the line after 70 ticks, carrier minus the same formation without it');
const runRows = DEFENCES.map((d) => {
  let sum = 0; let n = 0; let stuff = 0;
  for (const o of OFFENCES) {
    const base = runGain(o, d, 0, false);
    for (const lat of RUN_LANES) { const gain = runGain(o, d, lat, true) - base; sum += gain; n++; if (gain <= 0) stuff++; }
  }
  return { id: d.id, avg: sum / n, stuffed: (100 * stuff / n).toFixed(0) };
});
for (const r of runRows) console.log(r.id.padEnd(16), 'avg gain', r.avg.toFixed(1).padStart(5), ' stuffed', `${r.stuffed}%`);
