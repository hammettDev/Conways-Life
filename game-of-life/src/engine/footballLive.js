// Live football on a real Life board.
//
//  - Receivers are light spaceships that start deep in your backfield and run at the defence (0.5 cells a tick).
//  - The ball is a glider fired by the quarterback (0.25 cells a tick on a diagonal). To complete a pass the glider
//    has to reach the receiver, so the throw is a timing shot: see aim().
//  - The line fight (your blockers against their linemen) is ordinary Life on its own layer. The ball and the receivers
//    live on a separate layer shared with the defence's coverage players, so a coverage cell the glider touches ends the
//    throw, and a receiver the coverage touches is tackled by Life itself. Both are ghosts to the defensive line.
//  - A run is a glider carrier sent through the whole shared board, linemen and coverage included.
import { placeFormation, BLUE_LOS_X, CENTER_Y } from './formations.js';
import { getObject, placeObject } from './objects.js';
import { COLS, ROWS } from './constants.js';

const SIZE = COLS * ROWS;
export const TEAM = { O: 1, F: 2, COVER: 2, BALL: 9 }; // colour ids; receivers take 3..8
const RECV0 = 3;

// Life on colour ids; a newborn takes the plurality colour of its parents (ties: the lower id).
function stepMulti(g) {
  const n = new Uint8Array(SIZE);
  const cnt = new Uint8Array(16);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let c = 0;
      cnt.fill(0);
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= ROWS) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx; if (xx < 0 || xx >= COLS) continue;
          const t = g[yy * COLS + xx];
          if (t) { c++; cnt[t]++; }
        }
      }
      const k = y * COLS + x;
      if (g[k] ? c === 2 || c === 3 : c === 3) {
        if (g[k]) n[k] = g[k];
        else { let best = 0; let bc = 0; for (let t = 1; t < 16; t++) if (cnt[t] > bc) { bc = cnt[t]; best = t; } n[k] = best; }
      }
    }
  }
  return n;
}
const put = (g, cells, id) => { for (const c of cells) if (c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS) g[c.y * COLS + c.x] = id; };
const cellsOf = (g, id) => { const out = []; for (let k = 0; k < SIZE; k++) if (g[k] === id) out.push([k % COLS, (k / COLS) | 0]); return out; };
const countOf = (g, id) => { let n = 0; for (let k = 0; k < SIZE; k++) if (g[k] === id) n++; return n; };
const centroid = (list) => { if (!list.length) return null; let sx = 0; let sy = 0; for (const [x, y] of list) { sx += x; sy += y; } return [sx / list.length, sy / list.length]; };
const maxX = (g, ids) => { let m = -1; for (let k = 0; k < SIZE; k++) if (g[k] && ids(g[k])) m = Math.max(m, k % COLS); return m; };
// closest Chebyshev distance between two lists of cells (small lists)
const gap = (a, b) => { let best = 99; for (const [x, y] of a) for (const [u, v] of b) best = Math.min(best, Math.max(Math.abs(x - u), Math.abs(y - v))); return best; };

export const TUNE = {
  hold: 80,          // ticks the quarterback can wait before he is sacked
  catchGap: 2,       // ball within this many cells of the receiver: caught
  carryTicks: 70,    // how long a catch is followed
  runTicks: 70, runScale: 1, runMin: -3, runMax: 25,
  intChance: 0.25,    // chance a ball killed by coverage is an interception (else incomplete)
  sackYards: 6,
  yardsPerCell: 1.5, // the field is 60 cells for 100 yards
};

// The ball and a run's carrier are gliders that touch only the coverage players (and, for the ball, the receiver it is
// thrown to): next to a copy of the coverage as it stands this tick, the glider lives or dies by Life's rules, and
// everything else on the field is a ghost to it.
function stepGlider(cells, coverGrid) {
  const g = new Uint8Array(SIZE);
  for (let k = 0; k < SIZE; k++) if (coverGrid[k] === TEAM.COVER) g[k] = TEAM.COVER;
  for (const [x, y] of cells) g[y * COLS + x] = TEAM.BALL;
  return cellsOf(stepMulti(g), TEAM.BALL);
}

export function createLivePlay({ off, def, kind, lane = 0, rng = Math.random, tune = TUNE }) {
  const defPlayers = def.players.filter((p) => p.role !== 'RS');
  const front = placeFormation({ players: defPlayers.filter((p) => p.role === 'DL') }, 2);
  const cover = placeFormation({ players: defPlayers.filter((p) => p.role !== 'DL') }, 2);
  const line = placeFormation({ players: off.line }, 1);
  const qbSpec = off.line.find((p) => p.role === 'QB');
  const qb = qbSpec ? placeFormation({ players: [qbSpec] }, 1) : [];
  const qbC = centroid(qb.map((c) => [c.x, c.y])) || [BLUE_LOS_X - 6, CENTER_Y];

  const p = { kind, tick: 0, phase: 'snap', result: null, off, def, lane, throwTick: null, target: null, caught: null, carryStart: 0, progressX: null, live: 0 };

  // the line fight (your blockers against their linemen) and the field layer (coverage + receivers) are separate worlds
  let FG = new Uint8Array(SIZE); put(FG, line, 1); put(FG, front, 2);
  let W = new Uint8Array(SIZE); put(W, cover, TEAM.COVER);
  let glider = []; // the ball in the air, or the runner
  const recv = kind === 'pass' ? off.receivers.map((r, i) => ({ i, id: RECV0 + i, ...r, alive: true, x: 0, y: 0 })) : [];
  recv.forEach((r) => put(W, placeObject(getObject('lwss'), 1, { depth: r.depth, lat: r.lat }), r.id));
  const refresh = () => {
    for (const r of recv) {
      const cs = cellsOf(W, r.id);
      r.alive = cs.length >= 5;
      if (r.alive) { const c = centroid(cs); r.x = c[0]; r.y = c[1]; }
    }
  };
  refresh();

  // what the screen draws: the field layer with the glider on top
  p.grids = () => {
    const D = new Uint8Array(W);
    for (const [x, y] of glider) D[y * COLS + x] = TEAM.BALL;
    return { FG, W: D };
  };
  p.receivers = recv;
  p.qb = { x: qbC[0], y: qbC[1] };
  p.start = () => { p.phase = 'live'; };
  const finish = (kindR, yards, note) => { p.phase = 'done'; p.result = { kind: kindR, yards, note }; };
  const spawnGlider = (flip, sx, sy) => {
    const cells = placeObject(getObject('glider'), 1, { depth: 0, lat: 0, flip });
    const gx = Math.min(...cells.map((c) => c.x)); const gy = Math.round(centroid(cells.map((c) => [c.x, c.y]))[1]);
    return cells.map((c) => [c.x - gx + sx, c.y - gy + sy]).filter(([x, y]) => x >= 0 && y >= 0 && x < COLS && y < ROWS);
  };
  const inBounds = (cells) => cells.filter(([x, y]) => x >= 0 && y >= 0 && x < COLS && y < ROWS);

  if (kind === 'pass') {
    let maxCatch = -1;
    let ballFired = -1;
    const trail = []; // where the ball has been, to spot one that has stopped moving
    p.ball = () => (glider.length ? centroid(glider) : null);

    // When must the quarterback fire at receiver i? Ticks from now (0 = fire now), and whether it can still connect.
    p.aim = (i) => {
      const r = recv[i];
      if (!r || !r.alive || glider.length || p.caught !== null) return { ok: false, wait: null, d: 0 };
      const d = Math.abs(r.y - qbC[1]);
      if (d < 3) return { ok: false, wait: null, d };
      const qx = qbC[0] + 2;
      const wait = 2 * (qx - r.x) - 2 * d; // the glider meets the receiver at x = qx + d
      return { ok: wait >= -6, wait, d };
    };

    p.throwTo = (i) => {
      if (p.phase !== 'live' || glider.length || p.caught !== null) return false;
      const r = recv[i]; if (!r || !r.alive) return false;
      glider = spawnGlider(r.y < qbC[1], Math.round(qbC[0]) + 2, Math.round(qbC[1]));
      ballFired = p.tick; p.target = i; p.throwTick = p.tick; trail.length = 0;
      return true;
    };

    p.step = () => {
      if (p.phase !== 'live') return;
      p.tick++;
      FG = stepMulti(FG);
      // sack: a defender reaches the quarterback
      if (p.caught === null && !glider.length && gap(cellsOf(FG, 2), [[Math.round(qbC[0]), Math.round(qbC[1])]]) <= 1) { finish('sack', -tune.sackYards, 'Sacked'); return; }
      // the ball against the coverage as it stands now (before the field layer moves on)
      const coverNow = W;
      let ballDied = false; let offField = false;
      if (glider.length) {
        // caught? only the receiver it was thrown to can take it, and the ball never touches any other receiver
        const tr = recv[p.target];
        if (tr && tr.alive && gap(glider, cellsOf(W, tr.id)) <= tune.catchGap) {
          glider = []; p.caught = p.target; p.carryStart = p.tick;
        } else {
          glider = inBounds(stepGlider(glider, coverNow));
          const bc = centroid(glider);
          // a ball that has left the field, settled into a still life against the edge, or flown too long is thrown away
          if (bc) { trail.push(bc); }
          const stalled = trail.length > 14 && Math.hypot(bc[0] - trail[trail.length - 15][0], bc[1] - trail[trail.length - 15][1]) < 2;
          // a glider that hit something and is now a still life or a blob is dead: it is no longer flying
          if (!bc || glider.length < 4 || glider.length > 9 || stalled) { glider = []; ballDied = true; }
          else if (bc[0] > 68 || bc[1] < 9 || bc[1] > 51 || p.tick - ballFired > 110) { glider = []; ballDied = true; offField = true; }
        }
      }
      W = stepMulti(W);
      refresh();
      if (ballDied && p.caught === null) {
        const intercepted = !offField && rng() < tune.intChance;
        finish(intercepted ? 'int' : 'incomplete', 0, intercepted ? 'Intercepted by coverage' : offField ? 'Overthrown' : 'Ball knocked down'); return;
      }
      if (p.caught !== null) {
        const r = recv[p.caught];
        if (r.alive) maxCatch = Math.max(maxCatch, maxX(W, (t) => t === r.id));
        p.progressX = maxCatch;
        if (!r.alive || p.tick - p.carryStart >= tune.carryTicks || maxCatch >= 68) {
          const yards = Math.round(Math.max(0, Math.min(40, maxCatch - BLUE_LOS_X)) * tune.yardsPerCell);
          finish('complete', yards, `Complete for ${yards}`);
        }
        return;
      }
      if (!glider.length && p.tick >= tune.hold) finish('sack', -tune.sackYards, 'Held the ball too long: sacked');
      else if (p.tick > 300) finish('incomplete', 0, 'Play dead');
    };
  } else {
    // a run: the carrier is a glider behind the line; only the coverage (linebackers, corners, safeties) can stop it
    glider = inBounds(placeObject(getObject('glider'), 1, { depth: 5, lat: lane, flip: lane > 0 }).map((c) => [c.x, c.y]));
    let best = Math.max(...glider.map(([x]) => x));
    p.step = () => {
      if (p.phase !== 'live') return;
      p.tick++;
      FG = stepMulti(FG);
      glider = inBounds(stepGlider(glider, W));
      W = stepMulti(W);
      if (glider.length >= 3) best = Math.max(best, ...glider.map(([x]) => x));
      p.progressX = best;
      p.live = Math.round(Math.max(0, Math.min(tune.runMax, best - BLUE_LOS_X)) * tune.yardsPerCell);
      if (glider.length < 3 || p.tick >= tune.runTicks || best >= 68) {
        const yards = Math.round(Math.max(tune.runMin, Math.min(tune.runMax, (best - BLUE_LOS_X) * tune.runScale)) * tune.yardsPerCell);
        glider = [];
        finish('run', yards, yards <= 0 ? 'Stuffed at the line' : `Run for ${yards}`);
      }
    };
  }
  return p;
}

// Two formations' worth of rules for the live game: offences built from this physics.
// Receivers must start deep enough (depth >= lateral + 6) for a glider thrown from the quarterback to reach them.
const OL = (lat) => ({ role: 'OL', shape: 'bar', depth: 0, lat });
const LINE5 = [OL(-10), OL(-5), OL(0), OL(5), OL(10)];
const QB = { role: 'QB', shape: 'ell', depth: 6, lat: -1 };
export const LIVE_OFFENCES = [
  { id: 'lo-spread', name: 'Spread', line: [...LINE5, QB], receivers: [{ lat: -16, depth: 24 }, { lat: -8, depth: 16 }, { lat: 9, depth: 17 }, { lat: 17, depth: 25 }] },
  { id: 'lo-trips', name: 'Trips Right', line: [...LINE5, QB], receivers: [{ lat: 8, depth: 15 }, { lat: 14, depth: 21 }, { lat: 20, depth: 27 }, { lat: -9, depth: 16 }] },
  { id: 'lo-bunch', name: 'Bunch Left', line: [...LINE5, QB], receivers: [{ lat: -8, depth: 16 }, { lat: -14, depth: 22 }, { lat: -20, depth: 27 }, { lat: 10, depth: 17 }] },
  { id: 'lo-twins', name: 'Twins', line: [...LINE5, QB], receivers: [{ lat: -13, depth: 20 }, { lat: -19, depth: 26 }, { lat: 13, depth: 20 }, { lat: 19, depth: 26 }] },
  { id: 'lo-slot', name: 'Slot', line: [...LINE5, QB], receivers: [{ lat: -6, depth: 13 }, { lat: 7, depth: 14 }, { lat: -17, depth: 24 }, { lat: 18, depth: 25 }] },
];
export const liveOffenceById = (id) => LIVE_OFFENCES.find((o) => o.id === id);
