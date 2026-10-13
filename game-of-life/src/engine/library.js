import { FOOTBALL } from './builds/football.js';
import { SOCCER } from './builds/soccer.js';
import { BASKETBALL } from './builds/basketball.js';
import { BASEBALL } from './builds/baseball.js';
import { HOCKEY } from './builds/hockey.js';
import { RATINGS } from './ratings.js';
import { ROSTER } from './roster.js';
import { TUNING } from './tuning.js';
import { reserveUnits } from './builds/helpers.js';
import { UNIT_TILES } from './shapes.js';

// Every build is topped up to exactly this many tiles with rear-row reserves,
// so non-contact matchups push and only the clash decides a match.
export const TARGET_TILES = 60;

export const footprintOf = (players) => players.reduce((n, p) => n + UNIT_TILES[p.shape], 0);

// Builds as authored, before tuning and reserves.
export const RAW = [...FOOTBALL, ...SOCCER, ...BASKETBALL, ...BASEBALL, ...HOCKEY];

// Apply tuning moves ([playerIndex, depthDelta, latDelta]) found by
// scripts/jitter.mjs, then top the build up with reserves to TARGET_TILES.
export function assemble(raw, moves = []) {
  const players = raw.players.map((p, i) => {
    const m = moves.find((x) => x[0] === i);
    return m ? { ...p, depth: p.depth + m[1], lat: p.lat + m[2] } : p;
  });
  const reserves = reserveUnits(TARGET_TILES - footprintOf(players));
  return { ...raw, players: [...players, ...reserves] };
}

export const CANDIDATES = RAW.map((b) => assemble(b, TUNING[b.id]));

// Candidates that made the cut after balance testing (see scripts/cull.mjs).
const chosen = new Set(ROSTER.free);
export const BASE_BUILDS = CANDIDATES.filter((b) => chosen.has(b.id));

// Every build is free; winRate is its measured score against the rest of the pool.
export const BUILDS = BASE_BUILDS.map((b) => ({ ...b, winRate: RATINGS[b.id] ?? null }));
export const FREE_BUILDS = BUILDS;

export const getBuild = (id) => BUILDS.find((b) => b.id === id);
