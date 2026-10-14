// The playoffs: win 6 of the 8 regular-season games and you are in an 8-team bracket. You play a quarterfinal and a
// semifinal on your side of it, then the championship against the winner of the other side. The other seven teams are the
// league's best; their games against each other are settled by the league's strength and the season's seed, so the bracket
// is the same every time you look at it.
import { TEAMS, SEASON_GAMES, PLAYOFF_WINS, record } from './season.js';
import { createRng } from '../engine/rng.js';

// a playoff game that ended level is decided by the seeds (`tb` is the side that goes through)
export const wonGame = (g) => g.you > g.them || (g.you === g.them && g.tb === 'you');
export const ROUND_NAMES = ['Quarterfinal', 'Semifinal', 'Championship'];
const PAIRS = [[1, 8], [4, 5], [2, 7], [3, 6]]; // seeds that meet in the first round
// the AI seeds, strongest first (the weakest team misses out: eight teams make the bracket with you)
const AI_ORDER = ['kings', 'wolves', 'vipers', 'titans', 'foxes', 'gators', 'mudhens'];

export const regularDone = (s) => s.results.length >= SEASON_GAMES;
export const qualified = (s) => regularDone(s) && record(s).wins >= PLAYOFF_WINS;
export const yourSeed = (s) => { const w = record(s).wins; return w >= 8 ? 1 : w === 7 ? 2 : 3; };
export const startPlayoffs = (s) => ({ ...s, playoffs: { seed: yourSeed(s), round: 0, out: false, champion: false, games: [] } });

// seed -> team id ('you' for yours)
export function field(s) {
  const me = s.playoffs ? s.playoffs.seed : yourSeed(s);
  const ids = []; let ai = 0;
  for (let seed = 1; seed <= 8; seed++) ids.push(seed === me ? 'you' : AI_ORDER[ai++]);
  return ids; // index = seed - 1
}
const teamOf = (id) => TEAMS.find((t) => t.id === id);
const power = (id) => { const t = teamOf(id); return t.level * 10 + t.scout * 6; };

// An AI-vs-AI game: the stronger team usually wins. Returns { winner: 'a' | 'b', a, b } with a plausible score.
function aiGame(s, round, idA, idB) {
  const r = createRng((s.seed ^ Math.imul(round + 1, 0x9e3779b1) ^ Math.imul(idA.length * 31 + idB.charCodeAt(0), 0x85ebca6b)) >>> 0);
  const pA = 1 / (1 + Math.exp(-(power(idA) - power(idB)) / 7));
  const winner = r() < pA ? 'a' : 'b';
  const hi = 17 + Math.floor(r() * 17); const lo = Math.floor(r() * (hi - 2));
  return { winner, a: winner === 'a' ? hi : lo, b: winner === 'a' ? lo : hi };
}

// The whole bracket as it stands: rounds of matches, each with its two seeds, the winner once known and the score.
export function bracket(s) {
  const ids = field(s);
  const p = s.playoffs;
  const me = p ? p.seed : yourSeed(s);
  const rounds = [];
  let seeds = PAIRS.map(([a, b]) => ({ a, b }));
  for (let round = 0; round < 3; round++) {
    const played = p ? p.games.length : 0; // how many rounds you have played
    const matches = seeds.map((m) => {
      const mine = m.a === me || m.b === me;
      let winner = null; let sa = null; let sb = null;
      if (mine) {
        const g = p && p.games[round];
        if (g) { const youWon = wonGame(g); winner = youWon ? me : (m.a === me ? m.b : m.a); const myScore = g.you; const theirs = g.them; sa = m.a === me ? myScore : theirs; sb = m.b === me ? myScore : theirs; }
      } else if (round < played || (p && (p.out || p.champion))) {
        // AI games resolve once you have played the round, or all the way through once you are out (or have won)
        const r = aiGame(s, round, ids[m.a - 1], ids[m.b - 1]);
        winner = r.winner === 'a' ? m.a : m.b; sa = r.a; sb = r.b;
      }
      return { ...m, winner, sa, sb, mine };
    });
    rounds.push(matches);
    // the next round: winners of adjacent matches (a missing winner is unknown for now)
    const next = [];
    for (let i = 0; i < matches.length; i += 2) next.push({ a: matches[i].winner, b: matches[i + 1] ? matches[i + 1].winner : null });
    seeds = next;
    if (round === 1) seeds = [{ a: next[0].a, b: next[0].b }];
  }
  return { rounds, ids, me };
}

// Who you play next in the playoffs. In the championship that is the winner of the other half of the bracket, which is
// settled the moment you get there.
export function nextOpponent(s) {
  const p = s.playoffs;
  if (!p || p.out || p.champion) return null;
  const b = bracket(s);
  const { ids } = b;
  const match = b.rounds[p.round].find((m) => m.mine);
  let oppSeed = match && (match.a === b.me ? match.b : match.a);
  if (oppSeed == null && p.round === 2) {
    const ai = (round, x, y) => (aiGame(s, round, ids[x - 1], ids[y - 1]).winner === 'a' ? x : y);
    const half = b.rounds[0].findIndex((m) => m.mine) < 2 ? 1 : 0; // the half of the bracket you are not in
    const w = [0, 1].map((i) => { const m = b.rounds[0][half * 2 + i]; return m.winner != null ? m.winner : ai(0, m.a, m.b); });
    oppSeed = ai(1, w[0], w[1]);
  }
  return oppSeed == null ? null : teamOf(ids[oppSeed - 1]);
}

// You have played a playoff game: move on, go out, or win it all.
export function playoffResult(s, { team, you, them, tb = null }) {
  const p = s.playoffs;
  const games = [...p.games, { round: p.round, team, you, them, tb }];
  const won = wonGame({ you, them, tb });
  return { ...s, playoffs: { ...p, games, round: won ? p.round + 1 : p.round, out: !won, champion: won && p.round === 2 } };
}

export const playoffsOver = (s) => Boolean(s.playoffs && (s.playoffs.out || s.playoffs.champion));
// the whole season is done: missed the playoffs, or the playoffs are over
export const seasonDone = (s) => regularDone(s) && (!qualified(s) || playoffsOver(s));
export const champion = (s) => Boolean(s.playoffs && s.playoffs.champion);
export const finishText = (s) => {
  if (!regularDone(s)) return 'In progress';
  if (!qualified(s)) return 'Missed the playoffs';
  const p = s.playoffs;
  if (!p) return 'Qualified';
  if (p.champion) return 'Champions';
  if (p.out) return ['Lost in the quarterfinal', 'Lost in the semifinal', 'Lost the championship'][p.round];
  return 'In the playoffs';
};
// the team you play now: the next regular-season opponent or the next playoff opponent
export const currentTeam = (s) => (s.playoffs ? nextOpponent(s) : TEAMS[Math.min(s.week, TEAMS.length - 1)]);
