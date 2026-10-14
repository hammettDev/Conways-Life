// Football drive mode, rules layer over real Life.
//
// You run an offensive drive against a bot defence. Each play is resolved by rules that read the real Life
// board, because a spaceship thrown through a defensive line just dies (see scripts/play-deeppass.mjs):
//   - Receivers are ghosts to the defensive line: they only matter at the catch spot.
//   - The defence's coverage players (LB / CB / S) evolve under Life's rules until the ball arrives; if one
//     is standing within reach of the catch spot, the pass is covered. The defence formation decides where
//     those players are, and Life decides where they have drifted to by then.
//   - A run is a heavy spaceship carrier sent through the ordinary shared board (real fighting), measured in gains.
import { placeFormation, BLUE_LOS_X, CENTER_Y } from './formations.js';
import { getObject, placeObject } from './objects.js';
import { FREE_BUILDS } from './library.js';
import { BLUE, RED, COLS, ROWS } from './constants.js';

const SIZE = COLS * ROWS;

export const DRIVE = {
  startSpot: 25,      // yards from your own goal line
  goal: 100,
  firstDown: 10,
  downs: 4,
  maxPlays: 16,
};

// Tunable feel (balanced by scripts/football-sim.mjs).
export const TUNE = {
  reach: { short: 3, mid: 5, deep: 7 },     // how close a defender must be to the catch spot to cover it
  flight: { short: 12, mid: 28, deep: 44 }, // ticks before the ball arrives: coverage evolves this long
  catchDepth: { short: 5, mid: 9, deep: 15 },
  accuracy: { short: 0.95, mid: 0.85, deep: 0.62 }, // chance an uncovered throw is on target
  yacCap: 4,
  sackBase: 0.08, sackPerRush: 0.07, sackPerDepth: 0.008,
  intWhenCovered: { short: 0.03, mid: 0.1, deep: 0.18 },
  runTicks: 60, runScale: 1.4, runMin: -2, runMax: 24,
};

export const DRIVE_PAYOUT = 2; // a touchdown pays this multiple of the bet
export { COLS, ROWS };
export const DEPTHS = ['short', 'mid', 'deep'];
export const RUN_LANES = [-12, 0, 12];

export const OFFENCES = FREE_BUILDS.filter((b) => /^fb-(shotgun-trips|pistol|pistol-split|strong-i|flexbone|singleback|bunch|hail-mary)$/.test(b.id));
export const DEFENCES = FREE_BUILDS.filter((b) => /^fb-(4-3-over|4-3-under|3-4|dime|cover-2|cover-3|tampa-2|prevent)$/.test(b.id));
export const offenceById = (id) => OFFENCES.find((b) => b.id === id);
export const defenceById = (id) => DEFENCES.find((b) => b.id === id);

// The eligible receivers of a formation, left to right.
export const receiversOf = (off) => off.players.filter((p) => p.role === 'WR' || p.role === 'TE').slice().sort((a, b) => a.lat - b.lat);

// ---- Life on a plain grid ---------------------------------------------------
function step(g) {
  const n = new Uint8Array(SIZE);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let c = 0; let b = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= ROWS) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx; if (xx < 0 || xx >= COLS) continue;
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
const grid = (cells) => {
  const g = new Uint8Array(SIZE);
  for (const c of cells) if (c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS) g[c.y * COLS + c.x] = c.team;
  return g;
};
const maxBlueX = (g) => { let m = -1; for (let k = 0; k < SIZE; k++) if (g[k] === BLUE) m = Math.max(m, k % COLS); return m; };

// The defence's coverage players (LB, CB, S) as a grid, evolved `ticks` generations on their own.
function coverageAt(def, ticks, frames = null) {
  const cover = def.players.filter((p) => p.role === 'LB' || p.role === 'CB' || p.role === 'S');
  let g = grid(placeFormation({ players: cover }, RED));
  if (frames) frames.push(g);
  for (let t = 0; t < ticks; t++) { g = step(g); if (frames) frames.push(g); }
  return g;
}
// Nearest live coverage cell (Chebyshev) to a tile within `max`; Infinity when none.
function nearest(g, x, y, max) {
  let best = Infinity;
  for (let dy = -max; dy <= max; dy++) for (let dx = -max; dx <= max; dx++) {
    const xx = x + dx; const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS || !g[yy * COLS + xx]) continue;
    best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dy)));
  }
  return best;
}

const count = (def, roles) => def.players.filter((p) => roles.includes(p.role)).reduce((n, p) => n + 1, 0);

// ---- one play ---------------------------------------------------------------
// play: { off, kind: 'pass', target: receiver index, depth } or { off, kind: 'run', lane: index into RUN_LANES }
// returns { kind: 'complete'|'incomplete'|'sack'|'int'|'run', yards, note }
export function resolvePlay(play, def, rng, tune = TUNE, record = false) {
  const off = offenceById(play.off);
  if (play.kind === 'run') {
    const lat = RUN_LANES[play.lane] ?? 0;
    const base = placeFormation(off, BLUE);
    const rs = def; // eslint-disable-line no-unused-vars
    const red = placeFormation(def, RED);
    const carrier = placeObject(getObject('hwss'), BLUE, { depth: 6, lat });
    let withC = grid([...base, ...red, ...carrier]);
    let without = grid([...base, ...red]);
    let a = 0; let b = 0;
    const frames = record ? [withC] : null;
    for (let t = 0; t < tune.runTicks; t++) {
      withC = step(withC); without = step(without);
      if (frames) frames.push(withC);
      a = Math.max(a, maxBlueX(withC) - BLUE_LOS_X); b = Math.max(b, maxBlueX(without) - BLUE_LOS_X);
    }
    const gain = Math.round(Math.max(tune.runMin, Math.min(tune.runMax, (a - b) * tune.runScale + (a > 0 ? 0 : -1))));
    return { kind: 'run', yards: gain, note: gain <= 0 ? 'Stuffed at the line' : `Run for ${gain}`, frames };
  }

  // protection vs rush
  const rush = count(def, ['DL']) + 0.5 * count(def, ['LB']);
  const prot = count(off, ['OL']) + 0.5 * count(off, ['TE']);
  const rec = receiversOf(off)[play.target];
  if (!rec) return { kind: 'incomplete', yards: 0, note: 'No receiver there' };
  const depth = tune.catchDepth[play.depth];
  const sackP = Math.max(0, tune.sackBase + tune.sackPerRush * (rush - prot) / 3 + tune.sackPerDepth * depth);
  if (rng() < sackP) return { kind: 'sack', yards: -(4 + Math.floor(rng() * 5)), note: 'Sacked' };

  const cx = BLUE_LOS_X + 1 + depth + 1; // catch spot, downfield of the line (towards Red)
  const cy = CENTER_Y + rec.lat;
  const frames = record ? [] : null;
  const cov = coverageAt(def, tune.flight[play.depth], frames);
  const d = nearest(cov, cx, cy, 12);
  const meta = { frames, catchSpot: { x: cx, y: cy, r: tune.reach[play.depth] } };
  if (d <= tune.reach[play.depth]) {
    if (rng() < tune.intWhenCovered[play.depth]) return { kind: 'int', yards: 0, note: 'Intercepted', ...meta };
    return { kind: 'incomplete', yards: 0, note: 'Covered, incomplete', ...meta };
  }
  if (rng() > tune.accuracy[play.depth]) return { kind: 'incomplete', yards: 0, note: 'Overthrown', ...meta };
  // open: the gap to the nearest defender downfield becomes yards after the catch
  const yac = Math.min(tune.yacCap, Math.max(0, (Number.isFinite(d) ? d : 12) - tune.reach[play.depth]));
  const gain = depth + yac;
  return { kind: 'complete', yards: gain, note: `Complete for ${gain}`, ...meta };
}

// What a player can read off the screen before the snap: is the catch spot clear of defenders right now?
// (Life moves them before the ball arrives, so this is a good guide and not a guarantee.)
export function openAtSnap(play, def, tune = TUNE) {
  if (play.kind !== 'pass') return false;
  const rec = receiversOf(offenceById(play.off))[play.target];
  if (!rec) return false;
  const cx = BLUE_LOS_X + 1 + tune.catchDepth[play.depth] + 1;
  return nearest(coverageAt(def, 0), cx, CENTER_Y + rec.lat, 12) > tune.reach[play.depth];
}

// ---- the bot defence --------------------------------------------------------------
// Which defences blunt which call (measured by scripts/football-sim.mjs). The bot sees your history: repeat the
// same kind of call and it increasingly dials up the counter; mix them up and it mostly guesses.
export const callClass = (c) => (c.kind === 'run' ? 'run' : c.depth);
export const COUNTER = {
  run: ['fb-prevent', 'fb-4-3-under', 'fb-4-3-over'],
  short: ['fb-3-4', 'fb-cover-3', 'fb-cover-2'],
  mid: ['fb-prevent', 'fb-dime', 'fb-cover-3'],
  deep: ['fb-prevent', 'fb-cover-2', 'fb-4-3-under'],
};
export function chooseDefence(rng, calls, scout = 0.8) {
  if (calls.length) {
    const last = callClass(calls[calls.length - 1]);
    const recent = calls.slice(-4);
    const share = recent.filter((c) => callClass(c) === last).length / recent.length;
    if (rng() < scout * (0.2 + 0.8 * share) * Math.min(1, calls.length / 2)) {
      const list = COUNTER[last];
      return defenceById(list[Math.floor(rng() * 2)]); // one of its top two answers
    }
  }
  return DEFENCES[Math.floor(rng() * DEFENCES.length)];
}

// ---- the drive ----------------------------------------------------------------
export const newDrive = () => ({ down: 1, toGo: DRIVE.firstDown, spot: DRIVE.startSpot, plays: 0, over: null, log: [] });

export function advance(state, outcome) {
  const spot = Math.max(0, state.spot + outcome.yards);
  const s = { ...state, spot, plays: state.plays + 1, log: [...state.log, outcome] };
  if (outcome.kind === 'int') return { ...s, over: 'int', spot: state.spot };
  if (spot >= DRIVE.goal) return { ...s, spot: DRIVE.goal, over: 'td' };
  if (outcome.yards >= state.toGo) return { ...s, down: 1, toGo: Math.min(DRIVE.firstDown, DRIVE.goal - spot) };
  const down = state.down + 1;
  if (down > DRIVE.downs) return { ...s, over: 'downs' };
  if (s.plays >= DRIVE.maxPlays) return { ...s, over: 'clock' };
  return { ...s, down, toGo: state.toGo - outcome.yards };
}
