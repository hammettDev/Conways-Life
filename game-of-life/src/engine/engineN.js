import { DEAD, MAX_TICKS, MAX_PERIOD, BASE_GAIN, HOT_BONUS } from './constants.js';
import { createRng } from './rng.js';
import { G2 } from './geometry.js';

// The same game as engine.js, for any number of teams on any board (see geometry.js). It plays the
// shipped rules only (the pit, no live fence); engine.js stays the reference for the classic two-player
// game, and engineN.test.js checks the two agree exactly when this one is set up as 2 teams on G2.
// Teams are 1..n. Even-numbered teams stand on the right and push left; odd ones push right.

export const TEAM_KEYS = ['', 'blue', 'red', 'green', 'violet'];

// ---- Life on a team grid ---------------------------------------------------------------------
// Survival: 2-3 neighbours. Birth: exactly 3; the majority team of the parents wins. With more than
// two teams the parents can all differ, so a tie is settled by a fixed hash of the tile and generation.
function stepTeams(src, out, G, n, gen) {
  const { cols, rows } = G;
  const count = [0, 0, 0, 0, 0];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      count[1] = 0; count[2] = 0; count[3] = 0; count[4] = 0;
      let total = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= cols) continue;
          const v = src[ny * cols + nx];
          if (v !== DEAD) { count[v]++; total++; }
        }
      }
      const i = y * cols + x;
      const cur = src[i];
      if (cur !== DEAD) { out[i] = total === 2 || total === 3 ? cur : DEAD; continue; }
      if (total !== 3) { out[i] = DEAD; continue; }
      let best = 0; let bestTeam = 0; let tied = 0;
      for (let t = 1; t <= n; t++) {
        if (count[t] > best) { best = count[t]; bestTeam = t; tied = 1; } else if (count[t] === best && best > 0) tied++;
      }
      if (tied === 1) { out[i] = bestTeam; continue; }
      let k = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(gen, 83492791)) >>> 0;
      k %= tied;
      for (let t = 1; t <= n; t++) if (count[t] === best && k-- === 0) { out[i] = t; break; }
    }
  }
}

function stepUnderworld(src, out, G) {
  const { cols, rows } = G;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= cols) continue;
          n += src[ny * cols + nx];
        }
      }
      const i = y * cols + x;
      out[i] = src[i] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }
}

// ---- the Hot Zone layer: sparse soup with an acorn in the middle (as underworld.js) ----------
const SOUP_DENSITY = 0.12;
const RESCUE_BELOW = 20;
const ACORN = [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]];

function seedUnderworld(rng, G) {
  const size = G.cols * G.rows;
  const g = new Uint8Array(size);
  const cx = G.cols >> 1;
  const cy = G.rows >> 1;
  if (G.symmetric) {
    // one quadrant of soup, mirrored into the other three, and four mirrored acorns round the middle
    for (let y = 0; y < cy; y++) {
      for (let x = 0; x < cx; x++) {
        if (rng() < SOUP_DENSITY) {
          g[y * G.cols + x] = 1;
          g[y * G.cols + (G.cols - 1 - x)] = 1;
          g[(G.rows - 1 - y) * G.cols + x] = 1;
          g[(G.rows - 1 - y) * G.cols + (G.cols - 1 - x)] = 1;
        }
      }
    }
    for (let y = cy - 8; y < cy + 8; y++) for (let x = cx - 8; x < cx + 8; x++) g[y * G.cols + x] = 0;
    for (const [x, y] of ACORN) {
      const ax = cx - 8 - x; // the acorn's own columns, placed left of centre, then mirrored
      const ay = cy - 7 + y;
      for (const [mx, my] of [[ax, ay], [G.cols - 1 - ax, ay], [ax, G.rows - 1 - ay], [G.cols - 1 - ax, G.rows - 1 - ay]]) g[my * G.cols + mx] = 1;
    }
    return g;
  }
  for (let i = 0; i < size; i++) g[i] = rng() < SOUP_DENSITY ? 1 : 0;
  for (let y = cy - 8; y < cy + 8; y++) for (let x = cx - 8; x < cx + 8; x++) g[y * G.cols + x] = 0;
  const ox = cx - 3;
  const oy = cy - 1;
  for (const [x, y] of ACORN) g[(oy + y) * G.cols + ox + x] = 1;
  return g;
}

function rescueUnderworld(hot, rng) {
  let live = 0;
  for (let i = 0; i < hot.length; i++) live += hot[i];
  if (live >= RESCUE_BELOW) return;
  for (let i = 0; i < hot.length; i++) if (rng() < SOUP_DENSITY) hot[i] = 1;
}

const DEFAULTS = {
  threshold: 25, cooldown: 8, maxCrashes: Infinity, shed: true, cold: true, coldAfter: 4, flicker: true,
  pitSize: 0, splash: 1.6, hotValue: 5, unit: 3, overtime: 150,
};

// status: 'running' | 'extinct' | 'stable' | 'cap'
export function createEngineN({ seed, geometry = G2, maxTicks = MAX_TICKS, fortune = {} } = {}) {
  const G = geometry;
  const n = G.teams;
  const { cols, rows } = G;
  const SIZE = cols * rows;
  const F = { ...DEFAULTS, ...fortune };
  const PIT = G.pitSize;
  const splash = F.splash * (PIT / 10); // a bigger pit spreads the chips wider
  const rng = createRng(seed);
  const rng2 = createRng((seed ?? 1) ^ 0x5f3759df);

  let teams = new Uint8Array(SIZE);
  let nextTeams = new Uint8Array(SIZE);
  let hot = seedUnderworld(rng, G);
  let nextHot = new Uint8Array(SIZE);
  const towers = Array.from({ length: n + 1 }, () => new Uint16Array(SIZE));
  const locked = new Uint8Array(SIZE);
  const history = [];
  let tickCount = 0;
  let status = 'running';
  let period = 0;

  const runs = new Array(SIZE).fill(null);
  const stackH = new Uint16Array(SIZE);
  const lastChange = new Int32Array(SIZE);
  let hot2 = seedUnderworld(rng2, G);
  let nextHot2 = new Uint8Array(SIZE);
  const pitChips = Array.from({ length: n + 1 }, () => new Uint16Array(PIT * PIT));
  const crashes = { total: 0 };
  for (let t = 1; t <= n; t++) crashes[TEAM_KEYS[t]] = 0;
  let lastCrash = -Infinity;
  let lastCrashInfo = null;
  let overtimeUntil = null;
  let crashesAtSettle = 0;

  const sameGrid = (a, b) => { for (let i = 0; i < SIZE; i++) if (a[i] !== b[i]) return false; return true; };
  const isEmpty = (a) => { for (let i = 0; i < SIZE; i++) if (a[i] !== DEAD) return false; return true; };

  function loadTeams(cells) {
    teams.fill(DEAD);
    for (const { x, y, team } of cells) teams[y * cols + x] = team;
    history.length = 0;
    history.push(teams.slice());
    tickCount = 0; status = 'running'; period = 0; overtimeUntil = null; lastCrashInfo = null;
    for (const tw of towers) tw.fill(0);
    locked.fill(DEAD);
    runs.fill(null); stackH.fill(0); lastChange.fill(0);
    for (const pc of pitChips) pc.fill(0);
    crashes.total = 0;
    for (let t = 1; t <= n; t++) crashes[TEAM_KEYS[t]] = 0;
    lastCrash = -Infinity;
  }

  function lockCycle(p) {
    for (let k = p - 1; k >= 0; k--) {
      const g = history[k];
      for (let i = 0; i < SIZE; i++) if (g[i] !== DEAD) locked[i] = g[i];
    }
  }

  function accumulateTowers() {
    for (let i = 0; i < SIZE; i++) {
      const t = teams[i];
      if (t === DEAD) continue;
      towers[t][i] += hot[i] ? HOT_BONUS : BASE_GAIN;
    }
  }

  function growStacks() {
    for (let i = 0; i < SIZE; i++) {
      if (teams[i] !== nextTeams[i]) lastChange[i] = tickCount;
      let t = teams[i];
      if (t === DEAD && F.flicker && nextTeams[i] !== DEAD) t = nextTeams[i];
      if (t === DEAD) continue;
      if (F.cold && tickCount - lastChange[i] > F.coldAfter) continue;
      const g = hot[i] ? HOT_BONUS : BASE_GAIN;
      let r = runs[i];
      if (!r) r = runs[i] = [];
      const last = r[r.length - 1];
      if (last && last[0] === t) last[1] += g;
      else r.push([t, g]);
      stackH[i] += g;
    }
  }

  // Equal stacks are common in symmetric set-ups. Taking the first would always topple the top-left one
  // first and feed the pit with its colour, so on a symmetric board a tie is broken at random instead.
  const rng3 = createRng((seed ?? 1) ^ 0x2545f491);
  function tallest() {
    let best = -1;
    let h = F.threshold - 1;
    let ties = 0;
    for (let i = 0; i < SIZE; i++) {
      if (stackH[i] > h) { h = stackH[i]; best = i; ties = 1; } else if (G.symmetric && stackH[i] === h && best >= 0) {
        ties++;
        if (rng3() * ties < 1) best = i; // reservoir sampling: each tied stack is equally likely
      }
    }
    return best;
  }

  // The pit is the central PIT x PIT window of the second Hot Spot grid.
  const pitX0 = (cols - PIT) >> 1;
  const pitY0 = (rows - PIT) >> 1;

  function splatter(chipTeams) {
    const c = (PIT - 1) / 2;
    const landings = [];
    chipTeams.forEach((team, k) => {
      const sigma = splash * (1 + k * 0.03);
      const gx = (rng2() + rng2() + rng2() - 1.5) * 2;
      const gy = (rng2() + rng2() + rng2() - 1.5) * 2;
      const px = Math.min(PIT - 1, Math.max(0, Math.round(c + gx * sigma)));
      const py = Math.min(PIT - 1, Math.max(0, Math.round(c + gy * sigma)));
      const add = hot2[(pitY0 + py) * cols + pitX0 + px] ? F.hotValue : 1;
      pitChips[team][py * PIT + px] += add;
      landings.push([team, py * PIT + px, add]);
    });
    return landings;
  }

  // Each pit tile belongs to the team with the most chips on it (ties belong to nobody).
  function pitTiles() {
    const tiles = new Array(n + 1).fill(0);
    for (let k = 0; k < PIT * PIT; k++) {
      let best = 0; let who = 0; let tied = false;
      for (let t = 1; t <= n; t++) {
        const c = pitChips[t][k];
        if (c > best) { best = c; who = t; tied = false; } else if (c === best && c > 0) tied = true;
      }
      if (who && !tied) tiles[who]++;
    }
    return tiles;
  }

  function runCrash() {
    if ((crashes.total >= F.maxCrashes && overtimeUntil === null) || tickCount - lastCrash < F.cooldown) return;
    const i = tallest();
    if (i < 0) return;
    const full = runs[i];
    const limit = F.shed ? F.threshold : Infinity;
    const keep = [];
    const chipTeams = [];
    const byTeam = new Array(n + 1).fill(0);
    let topChip = 0;
    for (const [t, c] of full) {
      const take = Math.min(c, limit - chipTeams.length);
      if (take > 0) {
        for (let k = 0; k < take; k++) chipTeams.push(t);
        byTeam[t] += take;
        topChip = t;
      }
      if (c - take > 0) keep.push([t, c - take]);
    }
    // It topples toward the enemy of its majority colour (the top chip breaks ties).
    let most = 0;
    for (let t = 1; t <= n; t++) most = Math.max(most, byTeam[t]);
    const tied = [];
    for (let t = 1; t <= n; t++) if (byTeam[t] === most) tied.push(t);
    const owner = tied.length === 1 ? tied[0] : tied.includes(topChip) ? topChip : tied[0];
    const dir = owner % 2 === 1 ? 1 : -1;
    runs[i] = keep.length ? keep : null;
    stackH[i] -= chipTeams.length;
    crashes.total++;
    crashes[TEAM_KEYS[owner]]++;
    lastCrash = tickCount;
    const landings = splatter(chipTeams);
    lastCrashInfo = { id: crashes.total, tick: tickCount, owner, dir, x: i % cols, y: (i / cols) | 0, spilled: chipTeams.length, landings, fence: [] };
  }

  function detectStability() {
    if (isEmpty(teams)) { status = 'extinct'; return; }
    if (overtimeUntil !== null) {
      if (crashes.total > crashesAtSettle || tickCount >= overtimeUntil || tickCount >= maxTicks) status = 'stable';
      return;
    }
    for (let p = 1; p <= MAX_PERIOD && p < history.length; p++) {
      if (sameGrid(teams, history[p])) {
        period = p;
        lockCycle(p);
        if (F.overtime && p >= 2) { overtimeUntil = tickCount + F.overtime; crashesAtSettle = crashes.total; } else status = 'stable';
        return;
      }
    }
    if (tickCount >= maxTicks) status = 'cap';
  }

  function tick() {
    if (status !== 'running') return { tick: tickCount, status };
    stepTeams(teams, nextTeams, G, n, tickCount);
    [teams, nextTeams] = [nextTeams, teams];
    stepUnderworld(hot, nextHot, G);
    [hot, nextHot] = [nextHot, hot];
    rescueUnderworld(hot, rng);
    tickCount++;
    accumulateTowers();
    stepUnderworld(hot2, nextHot2, G);
    [hot2, nextHot2] = [nextHot2, hot2];
    rescueUnderworld(hot2, rng2);
    growStacks();
    runCrash();
    history.unshift(teams.slice());
    if (history.length > MAX_PERIOD + 1) history.length = MAX_PERIOD + 1;
    detectStability();
    return { tick: tickCount, status };
  }

  const runToEnd = () => { while (status === 'running') tick(); return getResult(); };

  // Plots on the field: a tile locked at the end goes to that team, otherwise the tallest tower
  // wins it, and equal towers are nobody's. Returns the plots of each team, plus the neutral ones.
  function plots() {
    const out = new Array(n + 1).fill(0);
    let neutral = 0;
    const useLock = status === 'stable';
    for (let y = G.fy0; y < G.fy1; y++) {
      for (let x = G.fx0; x < G.fx1; x++) {
        const i = y * cols + x;
        const lock = useLock ? locked[i] : DEAD;
        if (lock !== DEAD) { out[lock]++; continue; }
        let best = 0; let who = 0; let tied = false;
        for (let t = 1; t <= n; t++) {
          const h = towers[t][i];
          if (h > best) { best = h; who = t; tied = false; } else if (h === best && h > 0) tied = true;
        }
        if (who && !tied) out[who]++; else neutral++;
      }
    }
    return { out, neutral };
  }

  function heat() {
    const out = new Array(n + 1).fill(0);
    for (let y = G.fy0; y < G.fy1; y++) for (let x = G.fx0; x < G.fx1; x++) for (let t = 1; t <= n; t++) out[t] += towers[t][y * cols + x];
    return out;
  }

  const asScore = (arr, neutral) => {
    const s = { neutral };
    for (let t = 1; t <= n; t++) s[TEAM_KEYS[t]] = arr[t];
    return s;
  };

  // The pit becomes bonus plots for the team with the most pit tiles: one plot per `unit` tiles of lead
  // over the runner-up, so it can flip a close game but not a blowout.
  function getScore(withFortune = true) {
    const { out, neutral } = plots();
    if (withFortune) {
      const tiles = pitTiles();
      const order = [];
      for (let t = 1; t <= n; t++) order.push(t);
      order.sort((a, b) => tiles[b] - tiles[a] || a - b);
      const lead = tiles[order[0]] - tiles[order[1]];
      if (lead > 0) out[order[0]] += Math.floor(lead / F.unit);
    }
    return asScore(out, neutral);
  }

  // The winner has the most plots; a tie is broken by total tower height, and a dead heat is a push.
  function winnerOf(score) {
    const top = Math.max(...TEAM_KEYS.slice(1, n + 1).map((k) => score[k]));
    let tied = [];
    for (let t = 1; t <= n; t++) if (score[TEAM_KEYS[t]] === top) tied.push(t);
    if (tied.length > 1) {
      const h = heat();
      const best = Math.max(...tied.map((t) => h[t]));
      tied = tied.filter((t) => h[t] === best);
    }
    return tied; // one team: the winner; several: a push among them
  }
  const outcomeOf = (score) => {
    const w = winnerOf(score);
    if (w.length > 1) return w.includes(1) ? 'push' : 'lose';
    return w[0] === 1 ? 'win' : 'lose';
  };

  function getResult() {
    const score = getScore();
    const tiles = pitTiles();
    const fortune = { crashes: { ...crashes } };
    for (let t = 1; t <= n; t++) fortune[TEAM_KEYS[t]] = tiles[t];
    return {
      status, period, ticks: tickCount, score, outcome: outcomeOf(score), winners: winnerOf(score),
      fortune, tileOutcome: outcomeOf(getScore(false)),
    };
  }

  return {
    loadTeams, tick, runToEnd, getScore, getResult,
    get geometry() { return G; },
    get teams() { return teams; },
    get hot() { return hot; },
    get hot2() { return hot2; },
    get towers() { return towers; },
    get blueTower() { return towers[1]; },
    get redTower() { return towers[2]; },
    get locked() { return locked; },
    get status() { return status; },
    get tickCount() { return tickCount; },
    get stacks() { return runs; },
    get stackHeight() { return stackH; },
    get pit() { return pitChips; },
    get fortune() { const t = pitTiles(); const f = { crashes: { ...crashes } }; for (let k = 1; k <= n; k++) f[TEAM_KEYS[k]] = t[k]; return f; },
    get lastCrash() { return lastCrashInfo; },
  };
}
