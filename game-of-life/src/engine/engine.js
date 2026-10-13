import { COLS, ROWS, DEAD, MAX_TICKS, MAX_PERIOD } from './constants.js';
import { createRng } from './rng.js';
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
  hotDensity = 0.25,
  hotMinPopulation = 0.06,
  freezeUnderworld = false,
} = {}) {
  const rng = createRng(seed);

  let teams = new Uint8Array(SIZE);
  let nextTeams = new Uint8Array(SIZE);
  let hot = new Uint8Array(SIZE);
  let nextHot = new Uint8Array(SIZE);
  const blueTower = new Uint16Array(SIZE);
  const redTower = new Uint16Array(SIZE);
  const locked = new Uint8Array(SIZE);

  // Last MAX_PERIOD team grids, newest first, for repeat detection.
  const history = [];

  let tickCount = 0;
  let status = 'running';
  let period = 0;

  for (let i = 0; i < SIZE; i++) hot[i] = rng() < hotDensity ? 1 : 0;

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
  }

  // Keep the Hot Zones alive: if the underworld thins out, scatter new live
  // cells until it is back at the minimum population.
  function replenishHot() {
    let live = 0;
    for (let i = 0; i < SIZE; i++) live += hot[i];
    let need = Math.ceil(SIZE * hotMinPopulation) - live;
    while (need > 0) {
      const i = Math.floor(rng() * SIZE);
      if (!hot[i]) {
        hot[i] = 1;
        need--;
      }
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
      replenishHot();
    }

    tickCount++;
    const hotHits = accumulateTowers(teams, hot, blueTower, redTower);

    history.unshift(teams.slice());
    if (history.length > MAX_PERIOD + 1) history.length = MAX_PERIOD + 1;
    detectStability();

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
  };
}
