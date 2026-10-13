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
  // Fortune layer: towers that get too tall crash into a fence on this board
  // and spill chips onto a second, same-sized Hot Spot board (see below).
  fortune = null,
} = {}) {
  const F = fortune && {
    threshold: 25, cooldown: 8, maxCrashes: 4, chipCap: 3, hotValue: 5, restValue: 1, unit: 5, fence: true, ...fortune,
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
  // Board 2 (only when the fortune layer is on): its own evolving Hot Spots,
  // a per-team chip count on every tile, and each team's running chip score.
  const rng2 = F ? createRng((seed ?? 1) ^ 0x5f3759df) : null;
  let hot2 = F ? seedUnderworld(rng2) : null;
  let nextHot2 = F ? new Uint8Array(SIZE) : null;
  const chips = { [BLUE]: new Uint8Array(F ? SIZE : 0), [RED]: new Uint8Array(F ? SIZE : 0) };
  const fortuneScore = { blue: 0, red: 0 };
  const crashes = { blue: 0, red: 0 };
  const lastCrash = { blue: -Infinity, red: -Infinity };

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
      chips[BLUE].fill(0); chips[RED].fill(0);
      fortuneScore.blue = 0; fortuneScore.red = 0;
      crashes.blue = 0; crashes.red = 0;
      lastCrash.blue = -Infinity; lastCrash.red = -Infinity;
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

  // A tower that reaches the crash height topples toward the enemy: 2x2 blocks
  // every 4 tiles along its row to the board edge. Blocks land on top of empty
  // tiles and enemy cells (crushing them) and leave the team's own cells alone.
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
  // the crash height. (If every tower crashed, a solid formation would lay
  // dozens of overlapping fences at once.)
  function tallest(tower) {
    let best = -1;
    let h = F.threshold - 1;
    for (let i = 0; i < SIZE; i++) if (tower[i] > h) { h = tower[i]; best = i; }
    return best;
  }

  // A chip spilled off Board 1 enters Board 2 from the side facing its team and
  // rolls along its row onto the first Hot Spot with room (worth hotValue).
  // With no Hot Spot it comes to rest at the far end (restValue).
  function dropChip(team, y) {
    const dir = team === BLUE ? 1 : -1;
    const mine = chips[team];
    for (let k = 0, x = team === BLUE ? 0 : COLS - 1; k < COLS; k++, x += dir) {
      const idx = y * COLS + x;
      if (hot2[idx] && mine[idx] < F.chipCap) { mine[idx]++; return F.hotValue; }
    }
    const end = y * COLS + (team === BLUE ? COLS - 1 : 0);
    if (mine[end] < F.chipCap) { mine[end]++; return F.restValue; }
    return 0;
  }

  function runCrashes() {
    for (const [team, tower, key] of [[BLUE, blueTower, 'blue'], [RED, redTower, 'red']]) {
      if (crashes[key] >= F.maxCrashes || tickCount - lastCrash[key] < F.cooldown) continue;
      const i = tallest(tower);
      if (i < 0) continue;
      tower[i] = 0;
      crashes[key]++;
      lastCrash[key] = tickCount;
      if (F.fence) fence(i, team);
      fortuneScore[key] += dropChip(team, (i / COLS) | 0);
    }
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
      runCrashes();
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
    get hot2() { return hot2; },
    get chips() { return chips; },
    get fortune() { return { blue: fortuneScore.blue, red: fortuneScore.red, crashes: { ...crashes } }; },
  };
}
