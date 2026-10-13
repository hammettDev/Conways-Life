import { COLS, ROWS, DEAD, BLUE, RED, MAX_TICKS, MAX_PERIOD } from './constants.js';
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
  avalanche = null, // { threshold, target, maxTicks }: towers crash into fences, no stabilization end
} = {}) {
  const AV = avalanche && { threshold: 100, target: 3, maxTicks: 1500, cooldown: 15, ...avalanche };
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
  let bankedBlue = 0;
  let bankedRed = 0;
  let lastCrashBlue = -Infinity;
  let lastCrashRed = -Infinity;

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
    bankedBlue = 0;
    bankedRed = 0;
    lastCrashBlue = -Infinity;
    lastCrashRed = -Infinity;
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

  // A tower that reaches the crash height banks a point for its team, clears
  // its tile, and topples toward the enemy: 2x2 blocks every 4 tiles along its
  // row to the board edge. Blocks land on top of empty tiles and enemy cells
  // (crushing them) and leave the team's own cells alone.
  function fence(i, team) {
    const x0 = i % COLS;
    const y = (i / COLS) | 0;
    const dir = team === BLUE ? 1 : -1;
    const y0 = y + 1 < ROWS ? y : y - 1;
    for (let bx = x0 + dir * 2; ; bx += dir * 4) {
      const a = dir > 0 ? bx : bx - 1;
      if (a < 0 || a + 1 >= COLS || y0 < 0) break;
      for (let yy = y0; yy <= y0 + 1; yy++) {
        for (let xx = a; xx <= a + 1; xx++) teams[yy * COLS + xx] = team;
      }
    }
  }

  // One crash per team at a time: its single tallest tower, if it has reached
  // the crash height and the team is off cooldown. (If every tower crashed,
  // a solid formation would lay dozens of overlapping fences at once.)
  function tallest(tower) {
    let best = -1;
    let h = AV.threshold - 1;
    for (let i = 0; i < SIZE; i++) if (tower[i] > h) { h = tower[i]; best = i; }
    return best;
  }

  function runCrashes() {
    if (tickCount - lastCrashBlue >= AV.cooldown) {
      const i = tallest(blueTower);
      if (i >= 0) { blueTower[i] = 0; bankedBlue++; lastCrashBlue = tickCount; fence(i, BLUE); }
    }
    if (tickCount - lastCrashRed >= AV.cooldown) {
      const i = tallest(redTower);
      if (i >= 0) { redTower[i] = 0; bankedRed++; lastCrashRed = tickCount; fence(i, RED); }
    }
  }

  function detectEnd() {
    if (bankedBlue >= AV.target || bankedRed >= AV.target) status = 'target';
    else if (isEmpty(teams)) status = 'extinct';
    else if (tickCount >= AV.maxTicks) status = 'cap';
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

    if (AV) {
      runCrashes();
      detectEnd();
    } else {
      history.unshift(teams.slice());
      if (history.length > MAX_PERIOD + 1) history.length = MAX_PERIOD + 1;
      detectStability();
    }

    return { tick: tickCount, status, hotHits };
  }

  function runToEnd() {
    while (status === 'running') tick();
    return getResult();
  }

  function getScore() {
    return scorePlots(blueTower, redTower, status === 'stable' ? locked : null);
  }

  function getResult() {
    const score = getScore();
    if (AV) {
      // The bank race decides first; equal banks fall back to the tile count.
      const outcome = bankedBlue > bankedRed ? 'win' : bankedBlue < bankedRed ? 'lose' : outcomeFor(score);
      return { status, period, ticks: tickCount, score, outcome, banked: { blue: bankedBlue, red: bankedRed } };
    }
    return { status, period, ticks: tickCount, score, outcome: outcomeFor(score) };
  }

  return {
    loadTeams,
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
    get banked() { return { blue: bankedBlue, red: bankedRed }; },
  };
}
