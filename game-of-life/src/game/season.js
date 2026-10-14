// Football season: 8 games against stronger and stronger teams. In each game you run 6 offensive drives by hand
// (live Life physics, see engine/footballLive.js) and the opponent runs 6 simulated drives against the defence you
// pick. A touchdown is 7, and you can kick a field goal for 3 from inside their 38.
import { DEFENCES, DRIVE } from '../engine/football.js';
import { createRng } from '../engine/rng.js';

export const GAME_DRIVES = 6;
export const SEASON_GAMES = 8;
export const PLAYOFF_WINS = 6; // wins needed to be champions

export const TEAMS = [
  { id: 'rookies', style: 'run', name: 'Sandlot Rookies', level: 0, scout: 0.2, def: ['fb-4-3-over', 'fb-3-4'] },
  { id: 'mudhens', style: 'short', name: 'Mudflat Mudhens', level: 0, scout: 0.3, def: ['fb-cover-3', 'fb-4-3-over'] },
  { id: 'gators', style: 'mid', name: 'Bayou Gators', level: 1, scout: 0.4, def: ['fb-cover-2', 'fb-4-3-under', 'fb-tampa-2'] },
  { id: 'foxes', style: 'deep', name: 'Ridge Foxes', level: 1, scout: 0.5, def: ['fb-dime', 'fb-cover-3', 'fb-3-4'] },
  { id: 'titans', style: 'run', name: 'Iron Titans', level: 1, scout: 0.6, def: ['fb-4-3-under', 'fb-cover-2', 'fb-prevent'] },
  { id: 'vipers', style: 'mid', name: 'Neon Vipers', level: 2, scout: 0.7, def: ['fb-dime', 'fb-tampa-2', 'fb-cover-3', 'fb-mike-blitz'] },
  { id: 'wolves', style: 'deep', name: 'Blackout Wolves', level: 2, scout: 0.8, def: ['fb-prevent', 'fb-dime', 'fb-edge-blitz-l', 'fb-edge-blitz-r'] },
  { id: 'kings', style: 'mid', name: 'Grid Kings', level: 2, scout: 0.9, def: ['fb-dime', 'fb-safety-blitz', 'fb-cover-2', 'fb-mike-blitz', 'fb-all-out'] },
];

// What each defence gives up in the live physics: yards per run and per pass against the bot's offence
// (measured by scripts/football-def-matrix.mjs).
export const LIVE_DEF = {
  'fb-4-3-over': { run: 4.6, pass: 5.7 },
  'fb-4-3-under': { run: 9.6, pass: 5.7 },
  'fb-3-4': { run: 11.9, pass: 9.0 },
  'fb-dime': { run: 2.6, pass: 4.1 },
  'fb-cover-2': { run: 3.4, pass: 2.5 },
  'fb-cover-3': { run: 2.6, pass: 4.1 },
  'fb-tampa-2': { run: 5.5, pass: 4.0 },
  'fb-prevent': { run: 2.6, pass: 4.1 },
  'fb-mike-blitz': { run: 4.5, pass: 1.3 },
  'fb-edge-blitz-l': { run: 3.8, pass: 1.9 },
  'fb-edge-blitz-r': { run: 3.5, pass: 4.1 },
  'fb-safety-blitz': { run: 3.2, pass: 0.0 },
  'fb-all-out': { run: 9.9, pass: 1.6 },
};
const grade = (y) => (y <= 3 ? 'well' : y <= 5 ? 'so-so' : 'poorly');
export const defenceHint = (id) => `stops the run ${grade(LIVE_DEF[id].run)}, stops the pass ${grade(LIVE_DEF[id].pass)}`;
export const yardsAgainst = (id, style) => (LIVE_DEF[id] || LIVE_DEF['fb-cover-3'])[style === 'run' ? 'run' : 'pass'];

export const newSeason = (seed = 1) => ({ seed: seed >>> 0, week: 0, results: [] });
export const seasonOver = (s) => s.week >= SEASON_GAMES;
export const record = (s) => ({ wins: s.results.filter((r) => r.you > r.them).length, losses: s.results.filter((r) => r.you < r.them).length, ties: s.results.filter((r) => r.you === r.them).length });
export const champion = (s) => seasonOver(s) && record(s).wins >= PLAYOFF_WINS;
export const nextTeam = (s) => TEAMS[Math.min(s.week, TEAMS.length - 1)];

// Points a finished drive is worth.
export const drivePoints = (d) => (d.over === 'td' ? 7 : d.over === 'fg' ? 3 : 0);
export const driveNote = (d) => (d.over === 'td' ? 'Touchdown' : d.over === 'fg' ? 'Field goal' : d.over === 'miss' ? 'Missed field goal' : d.over === 'punt' ? 'Punted away' : d.over === 'int' ? 'Intercepted' : 'Turned it over on downs');

// The opponent's drive against the defence you called. Each team has a favourite kind of play (its style); a defence
// that is weak to that style gives up more, a strong one less, and a defence you keep repeating gets read better.
// (Calibrated so a level-0 team scores about 4 a game, level 1 about 7 and level 2 about 10.)
export function botDrive(seed, team, defId, repeats = 0) {
  const rng = createRng(seed);
  const fit = Math.max(0.5, Math.min(1.6, 0.6 + (yardsAgainst(defId, team.style) - 1.5) * 0.13));
  const td = Math.min(0.7, [0.1, 0.17, 0.25][team.level] * fit * (1 + 0.15 * repeats));
  const fg = Math.min(0.3, td * 0.8);
  const r = rng();
  if (r < td) return { over: 'td', spot: DRIVE.goal };
  if (r < td + fg) return { over: 'fg', spot: 62 };
  return { over: rng() < 0.3 ? 'int' : 'downs', spot: 40 };
}

// The defence the opponent shows against one of your plays: mostly its own favourites, and it dials up the counter
// when you repeat yourself (same idea as the classic game).
export function teamDefence(rng, team, recentCalls) {
  const last = recentCalls[recentCalls.length - 1];
  if (last && recentCalls.length >= 2) {
    const same = recentCalls.slice(-3).filter((c) => c === last).length / Math.min(3, recentCalls.length);
    if (rng() < team.scout * (0.2 + 0.8 * same)) {
      const answers = { run: ['fb-prevent', 'fb-4-3-under'], short: ['fb-3-4', 'fb-cover-3'], mid: ['fb-prevent', 'fb-dime'], deep: ['fb-prevent', 'fb-cover-2'] }[last];
      const known = answers.filter((id) => team.def.includes(id));
      return (known.length ? known : team.def)[Math.floor(rng() * (known.length || team.def.length))];
    }
  }
  return team.def[Math.floor(rng() * team.def.length)];
}

// The defence from a team's own pool that gives up the least against a kind of play (what a team audibles to).
export function bestDefenceFor(team, kind, rng = Math.random) {
  const key = kind === 'run' ? 'run' : 'pass';
  const pool = team.def.slice().sort((a, b) => LIVE_DEF[a][key] - LIVE_DEF[b][key]);
  return rng() < 0.7 ? pool[0] : pool[Math.min(1, pool.length - 1)];
}
// The call that hurts a defence most, for a team that audibles after seeing it.
export function bestKindAgainst(defId) {
  const d = LIVE_DEF[defId] || LIVE_DEF['fb-cover-3'];
  return d.run > d.pass * 1.1 ? 'run' : 'pass';
}

export const scoreText = (you, them) => (you > them ? 'Win' : you < them ? 'Loss' : 'Tie');
