// Football season: 8 games against stronger and stronger teams. In each game you run 6 offensive drives by hand
// (live Life physics, see engine/footballLive.js) and the opponent runs 6 simulated drives against the defence you
// pick. A touchdown is 7, and a drive that stalls inside the opponent's 40 kicks a field goal for 3.
import { DEFENCES, DRIVE, RUN_LANES, resolvePlay, newDrive, advance, receiversOf, OFFENCES, DEPTHS } from '../engine/football.js';
import { createRng } from '../engine/rng.js';

export const GAME_DRIVES = 6;
export const SEASON_GAMES = 8;
export const PLAYOFF_WINS = 6; // wins needed to be champions

export const TEAMS = [
  { id: 'rookies', name: 'Sandlot Rookies', level: 0, scout: 0.2, def: ['fb-4-3-over', 'fb-3-4'] },
  { id: 'mudhens', name: 'Mudflat Mudhens', level: 0, scout: 0.3, def: ['fb-cover-3', 'fb-4-3-over'] },
  { id: 'gators', name: 'Bayou Gators', level: 1, scout: 0.4, def: ['fb-cover-2', 'fb-4-3-under', 'fb-tampa-2'] },
  { id: 'foxes', name: 'Ridge Foxes', level: 1, scout: 0.5, def: ['fb-dime', 'fb-cover-3', 'fb-3-4'] },
  { id: 'titans', name: 'Iron Titans', level: 1, scout: 0.6, def: ['fb-4-3-under', 'fb-cover-2', 'fb-prevent'] },
  { id: 'vipers', name: 'Neon Vipers', level: 2, scout: 0.7, def: ['fb-dime', 'fb-tampa-2', 'fb-cover-3'] },
  { id: 'wolves', name: 'Blackout Wolves', level: 2, scout: 0.8, def: ['fb-prevent', 'fb-dime', 'fb-4-3-under'] },
  { id: 'kings', name: 'Grid Kings', level: 2, scout: 0.9, def: ['fb-dime', 'fb-prevent', 'fb-cover-2', 'fb-tampa-2'] },
];

// Which kinds of play each defence is weakest to, best first (measured by scripts/football-sim.mjs).
export const WEAK = {
  'fb-4-3-over': ['deep', 'mid', 'run', 'short'],
  'fb-4-3-under': ['mid', 'deep', 'run', 'short'],
  'fb-3-4': ['deep', 'mid', 'run', 'short'],
  'fb-dime': ['deep', 'mid', 'run', 'short'],
  'fb-cover-2': ['mid', 'run', 'deep', 'short'],
  'fb-cover-3': ['deep', 'mid', 'run', 'short'],
  'fb-tampa-2': ['mid', 'deep', 'run', 'short'],
  'fb-prevent': ['short', 'run', 'mid', 'deep'],
};

export const newSeason = (seed = 1) => ({ seed: seed >>> 0, week: 0, results: [] });
export const seasonOver = (s) => s.week >= SEASON_GAMES;
export const record = (s) => ({ wins: s.results.filter((r) => r.you > r.them).length, losses: s.results.filter((r) => r.you < r.them).length, ties: s.results.filter((r) => r.you === r.them).length });
export const champion = (s) => seasonOver(s) && record(s).wins >= PLAYOFF_WINS;
export const nextTeam = (s) => TEAMS[Math.min(s.week, TEAMS.length - 1)];

// Points a finished drive is worth.
export const drivePoints = (d) => (d.over === 'td' ? 7 : (d.over === 'downs' || d.over === 'clock') && d.spot >= 60 ? 3 : 0);
export const driveNote = (d) => (d.over === 'td' ? 'Touchdown' : drivePoints(d) === 3 ? 'Field goal' : d.over === 'int' ? 'Intercepted' : 'Turned it over on downs');

// The opponent's drive against the defence you called. A better team reads your defence's weak spot more often,
// and a defence you keep repeating is read better still.
export function botDrive(seed, team, defId, repeats = 0) {
  const rng = createRng(seed);
  const def = DEFENCES.find((d) => d.id === defId) || DEFENCES[0];
  const sharp = Math.min(0.95, [0.05, 0.45, 0.7][team.level] + 0.12 * repeats);
  let s = newDrive();
  const pick = (a) => a[Math.floor(rng() * a.length)];
  while (!s.over) {
    const order = WEAK[def.id];
    const cls = rng() < sharp ? (rng() < 0.75 ? order[0] : order[1]) : pick(['run', 'short', 'mid', 'deep']);
    const off = pick(OFFENCES);
    let call;
    if (cls === 'run') call = { off: off.id, kind: 'run', lane: Math.floor(rng() * RUN_LANES.length) };
    else { const rs = receiversOf(off); call = { off: off.id, kind: 'pass', target: Math.floor(rng() * rs.length), depth: cls }; }
    s = advance(s, resolvePlay(call, def, rng));
  }
  return s;
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

export const scoreText = (you, them) => (you > them ? 'Win' : you < them ? 'Loss' : 'Tie');
