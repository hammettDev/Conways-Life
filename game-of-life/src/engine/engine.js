import {
  COLS, ROWS, DEAD, BLUE, RED, MAX_TICKS, MAX_PERIOD, BASE_GAIN, HOT_BONUS,
  FIELD_X0, FIELD_X1, FIELD_Y0, FIELD_Y1,
} from './constants.js';
import { createRng } from './rng.js';
import { seedUnderworld, rescueUnderworld } from './underworld.js';
import { stepTeams, stepUnderworld } from './life.js';
import { accumulateTowers } from './towers.js';
import { scorePlots, outcomeFor } from './scoring.js';

const SIZE = COLS * ROWS;

function sameGrid(a, b) {
  for (let i = 0; i < SIZE; i++) if (a[i] !== b[i]) return false;
  return true;
}

function isEmpty(a) {
  for (let i = 0; i < SIZE; i++) if (a[i] !== DEAD) return false;
  return true;
}

// status: 'running' | 'extinct' | 'stable' | 'cap'
export function createEngine({
  seed,
  maxTicks = MAX_TICKS,
  freezeUnderworld = false,
  // Fortune layer. Each tile's tower is a real stack of chips in the order
  // they were added, coloured by whose cell added them. A stack that gets too
  // tall crashes: it topples as a fence of blocks in those same colours, and
  // whatever does not fit before the board edge spills into Board 2 (a second
  // 60x40 board with its own Hot Spots) as a cluster, scoring for its colours.
  fortune = null,
} = {}) {
  const F = fortune && {
    threshold: 25, cooldown: 8, maxCrashes: 6, chipsPerBlock: 1, chipCap: 3,
    hotValue: 5, restValue: 1, unit: 5, fence: true, ...fortune,
  };
  const rng = createRng(seed);

  let teams = new Uint8Array(SIZE);
  let nextTeams = new Uint8Array(SIZE);
  let hot = seedUnderworld(rng);
  let nextHot = new Uint8Array(SIZE);
  const blueTower = new Uint16Array(SIZE);
  const redTower = new Uint16Array(SIZE);
  const locked = new Uint8Array(SIZE);

  // Last MAX_PERIOD team grids, newest first, for repeat detection.
  const history = [];

  let tickCount = 0;
  let status = 'running';
  let period = 0;
  // Fortune-layer state: the ordered chip runs of every tile's stack, Board 2's
  // own evolving Hot Spots, the chips landed on Board 2, and each colour's score.
  const rng2 = F ? createRng((seed ?? 1) ^ 0x5f3759df) : null;
  const runs = F ? new Array(SIZE).fill(null) : null; // per tile: [[team, count], ...] bottom to top
  let hot2 = F ? seedUnderworld(rng2) : null;
  let nextHot2 = F ? new Uint8Array(SIZE) : null;
  const chips = { [BLUE]: new Uint8Array(F ? SIZE : 0), [RED]: new Uint8Array(F ? SIZE : 0) };
  const fortuneScore = { blue: 0, red: 0 };
  const crashes = { total: 0, blue: 0, red: 0 }; // by the stack's majority colour
  let lastCrash = -Infinity;

  function loadTeams(cells) {
    teams.fill(DEAD);
    for (const { x, y, team } of cells) teams[y * COLS + x] = team;
    history.length = 0;
    history.push(teams.slice());
    tickCount = 0;
    status = 'running';
    period = 0;
    blueTower.fill(0);
    redTower.fill(0);
    locked.fill(DEAD);
    if (F) {
      runs.fill(null);
      chips[BLUE].fill(0); chips[RED].fill(0);
      fortuneScore.blue = 0; fortuneScore.red = 0;
      crashes.total = 0; crashes.blue = 0; crashes.red = 0;
      lastCrash = -Infinity;
    }
  }

  function lockCycle(p) {
    // Every tile held by a team cell in any phase of the repeating cycle.
    // history[0] is the newest grid; later phases overwrite earlier ones only
    // where the earlier one was empty, so the latest occupant wins.
    for (let k = p - 1; k >= 0; k--) {
      const g = history[k];
      for (let i = 0; i < SIZE; i++) if (g[i] !== DEAD) locked[i] = g[i];
    }
  }

  // Every live cell adds chips to its tile's stack in its own colour (two on a
  // Hot Zone), extending the last run if the colour matches.
  function growStacks() {
    for (let i = 0; i < SIZE; i++) {
      const t = teams[i];
      if (t === DEAD) continue;
      const g = hot[i] ? HOT_BONUS : BASE_GAIN;
      let r = runs[i];
      if (!r) r = runs[i] = [];
      const last = r[r.length - 1];
      if (last && last[0] === t) last[1] += g;
      else r.push([t, g]);
    }
  }

  // One crash at a time: the single tallest stack, if it has reached the crash
  // height. (If every tall stack crashed, a solid formation would lay dozens of
  // overlapping fences at once.)
  function tallest() {
    let best = -1;
    let h = F.threshold - 1;
    for (let i = 0; i < SIZE; i++) {
      const total = blueTower[i] + redTower[i];
      if (total > h) { h = total; best = i; }
    }
    return best;
  }

  // The fence: one 2x2 block per chip-group, every 4 tiles outward from the
  // tower, bottom of the stack nearest the tower, each in the colour of its
  // chip. A block crushes cells of the other colour and leaves its own colour
  // alone. Returns how many chips were used before the board edge.
  function layFence(x0, y, dir, chipTeams) {
    const y0 = y + 1 < ROWS ? y : y - 1;
    const blocks = Math.floor(chipTeams.length / F.chipsPerBlock);
    let placed = 0;
    for (let j = 0; j < blocks; j++) {
      const bx = x0 + dir * 2 + dir * 4 * j;
      const a = dir > 0 ? bx : bx - 1;
      if (a < 0 || a + 1 >= COLS || y0 < 0) break;
      const color = chipTeams[j * F.chipsPerBlock];
      for (let yy = y0; yy <= y0 + 1; yy++) {
        for (let xx = a; xx <= a + 1; xx++) teams[yy * COLS + xx] = color;
      }
      placed++;
    }
    return placed * F.chipsPerBlock;
  }

  // Board 2 landing order for a spill entering at (ex, ey): tiles fanning out
  // from the entry point, inward first. The playable area is the 60x40 field.
  function spillOrder(ex, ey, dir) {
    const R = 10;
    const tiles = [];
    for (let ox = 0; ox <= R; ox++) {
      for (let oy = -R; oy <= R; oy++) {
        const x = ex + dir * ox;
        const y = ey + oy;
        if (x < FIELD_X0 || x >= FIELD_X1 || y < FIELD_Y0 || y >= FIELD_Y1) continue;
        tiles.push([ox + Math.abs(oy), Math.abs(oy), y * COLS + x]);
      }
    }
    tiles.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    return tiles.map((t) => t[2]);
  }

  // The overflow lands as a cluster, literal colours, up to chipCap chips per
  // tile; each chip scores hotValue on a Board 2 Hot Spot, else restValue.
  function spill(chipTeams, y, dir) {
    if (!chipTeams.length) return;
    const ex = dir > 0 ? FIELD_X0 : FIELD_X1 - 1;
    const ey = Math.min(FIELD_Y1 - 1, Math.max(FIELD_Y0, y));
    const order = spillOrder(ex, ey, dir);
    let k = 0;
    for (const team of chipTeams) {
      while (k < order.length && chips[BLUE][order[k]] + chips[RED][order[k]] >= F.chipCap) k++;
      if (k >= order.length) break;
      const idx = order[k];
      chips[team][idx]++;
      fortuneScore[team === BLUE ? 'blue' : 'red'] += hot2[idx] ? F.hotValue : F.restValue;
    }
  }

  function runCrash() {
    if (crashes.total >= F.maxCrashes || tickCount - lastCrash < F.cooldown) return;
    const i = tallest();
    if (i < 0) return;
    const r = runs[i];
    const chipTeams = [];
    for (const [t, c] of r) for (let k = 0; k < c; k++) chipTeams.push(t);
    // It topples toward the enemy of its majority colour (the top chip breaks ties).
    const blue = blueTower[i];
    const red = redTower[i];
    const owner = blue > red ? BLUE : red > blue ? RED : r[r.length - 1][0];
    const dir = owner === BLUE ? 1 : -1;
    blueTower[i] = 0;
    redTower[i] = 0;
    runs[i] = null;
    crashes.total++;
    crashes[owner === BLUE ? 'blue' : 'red']++;
    lastCrash = tickCount;
    const x0 = i % COLS;
    const y = (i / COLS) | 0;
    const used = F.fence ? layFence(x0, y, dir, chipTeams) : 0;
    spill(chipTeams.slice(used), y, dir);
  }

  function detectStability() {
    if (isEmpty(teams)) {
      status = 'extinct';
      return;
    }
    for (let p = 1; p <= MAX_PERIOD && p < history.length; p++) {
      if (sameGrid(teams, history[p])) {
        status = 'stable';
        period = p;
        lockCycle(p);
        return;
      }
    }
    if (tickCount >= maxTicks) status = 'cap';
  }

  function tick() {
    if (status !== 'running') return { tick: tickCount, status, hotHits: 0 };

    stepTeams(teams, nextTeams);
    [teams, nextTeams] = [nextTeams, teams];

    if (!freezeUnderworld) {
      stepUnderworld(hot, nextHot);
      [hot, nextHot] = [nextHot, hot];
      rescueUnderworld(hot, rng);
    }

    tickCount++;
    const hotHits = accumulateTowers(teams, hot, blueTower, redTower);

    if (F) {
      // Board 2 only runs while Board 1 does: same clock, same lifetime.
      if (!freezeUnderworld) {
        stepUnderworld(hot2, nextHot2);
        [hot2, nextHot2] = [nextHot2, hot2];
        rescueUnderworld(hot2, rng2);
      }
      growStacks();
      runCrash();
    }
    history.unshift(teams.slice());
    if (history.length > MAX_PERIOD + 1) history.length = MAX_PERIOD + 1;
    detectStability();

    return { tick: tickCount, status, hotHits };
  }

  function runToEnd() {
    while (status === 'running') tick();
    return getResult();
  }

  // The fortune total becomes bonus plots for whoever leads it, one plot per
  // `unit` points of lead, so it can flip close games but not blowouts.
  function getScore(withFortune = true) {
    const base = scorePlots(blueTower, redTower, status === 'stable' ? locked : null);
    if (!F || !withFortune) return base;
    const diff = fortuneScore.blue - fortuneScore.red;
    const bonus = Math.floor(Math.abs(diff) / F.unit);
    return diff > 0 ? { ...base, blue: base.blue + bonus } : { ...base, red: base.red + bonus };
  }

  function getResult() {
    const score = getScore();
    const result = { status, period, ticks: tickCount, score, outcome: outcomeFor(score) };
    if (F) {
      result.fortune = { blue: fortuneScore.blue, red: fortuneScore.red, crashes: { ...crashes } };
      result.tileOutcome = outcomeFor(getScore(false)); // what Board 1 alone would have decided
    }
    return result;
  }

  // Test/tool hook: put a known stack of chips on a tile (needs the fortune layer).
  function setStack(x, y, stackRuns) {
    const i = y * COLS + x;
    runs[i] = stackRuns.map(([t, c]) => [t, c]);
    blueTower[i] = stackRuns.reduce((n, [t, c]) => n + (t === BLUE ? c : 0), 0);
    redTower[i] = stackRuns.reduce((n, [t, c]) => n + (t === RED ? c : 0), 0);
  }

  return {
    loadTeams,
    setStack,
    tick,
    runToEnd,
    getScore,
    getResult,
    get teams() { return teams; },
    get hot() { return hot; },
    get blueTower() { return blueTower; },
    get redTower() { return redTower; },
    get locked() { return locked; },
    get status() { return status; },
    get tickCount() { return tickCount; },
    get hot2() { return hot2; },
    get stacks() { return runs; },
    get chips() { return chips; },
    get fortune() { return { blue: fortuneScore.blue, red: fortuneScore.red, crashes: { ...crashes } }; },
  };
}
