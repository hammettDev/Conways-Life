// The trophy room: championships, records and badges across the games. Football keeps its own running totals in the
// save (`trophies`); Conway's Takeover's records come from what the save already tracks (peak bankroll, wins,
// streaks, bosses beaten).
import { BOSSES } from './bosses.js';
import { SEASON_GAMES } from './season.js';
import { finishText, champion as wonTitle } from './playoffs.js';

export const newTrophies = () => ({
  football: { games: 0, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, bestScore: 0, bigWin: 0, shutouts: 0, td: 0, fg: 0, streak: 0, bestStreak: 0 },
  seasons: [], // { n, wins, losses, ties, pf, pa, champion, finish }
});

// A finished football game: you, them, and how many touchdowns and field goals you scored.
export function recordGame(save, { you, them, td = 0, fg = 0 }) {
  const t = save.trophies || newTrophies();
  const f = { ...t.football };
  f.games += 1; f.pf += you; f.pa += them; f.td += td; f.fg += fg;
  f.bestScore = Math.max(f.bestScore, you);
  if (you > them) { f.wins += 1; f.streak += 1; f.bestStreak = Math.max(f.bestStreak, f.streak); f.bigWin = Math.max(f.bigWin, you - them); if (them === 0) f.shutouts += 1; }
  else if (you < them) { f.losses += 1; f.streak = 0; }
  else { f.ties += 1; f.streak = 0; }
  return { ...save, trophies: { ...t, football: f } };
}

// A finished season (`season.results` has every game): the cup goes in the cabinet if you won enough.
export function recordSeason(save, season) {
  const t = save.trophies || newTrophies();
  const wins = season.results.filter((r) => r.you > r.them).length;
  const losses = season.results.filter((r) => r.you < r.them).length;
  const ties = season.results.length - wins - losses;
  const pf = season.results.reduce((n, r) => n + r.you, 0);
  const pa = season.results.reduce((n, r) => n + r.them, 0);
  const entry = { n: t.seasons.length + 1, wins, losses, ties, pf, pa, champion: wonTitle(season), finish: finishText(season) };
  return { ...save, trophies: { ...t, seasons: [...t.seasons, entry].slice(-40) } };
}

const money = (n) => (n >= 1000000 ? `$${+(n / 1000000).toFixed(2)}M` : n >= 1000 ? `$${+(n / 1000).toFixed(1)}k` : `$${n}`);

export function trophyRoom(save) {
  const t = save.trophies || newTrophies();
  const f = t.football;
  const cups = t.seasons.filter((s) => s.champion);
  const perfect = t.seasons.some((s) => s.wins === SEASON_GAMES && s.losses === 0);
  const bossesBeaten = (save.boss && save.boss.beaten ? save.boss.beaten : []).filter((id) => BOSSES.some((b) => b.id === id));
  const peak = save.peak || 0;
  const st = save.stats || { played: 0, wins: 0, losses: 0, bestStreak: 0 };

  const badges = [
    { id: 'first-win', game: 'Football', name: 'First Win', desc: 'Win a football game.', earned: f.wins >= 1 },
    { id: 'champion', game: 'Football', name: 'Champions', desc: 'Win a championship.', earned: cups.length >= 1 },
    { id: 'dynasty', game: 'Football', name: 'Dynasty', desc: 'Win three championships.', earned: cups.length >= 3 },
    { id: 'perfect', game: 'Football', name: 'Perfect Season', desc: `Go ${SEASON_GAMES}-0 in a season.`, earned: perfect },
    { id: 'shutout', game: 'Football', name: 'Shutout', desc: 'Win without giving up a point.', earned: f.shutouts >= 1 },
    { id: 'blowout', game: 'Football', name: 'Blowout', desc: 'Win by 21 or more.', earned: f.bigWin >= 21 },
    { id: 'td-machine', game: 'Football', name: 'Touchdown Machine', desc: 'Score 25 touchdowns.', earned: f.td >= 25 },
    { id: 'veteran', game: "Conway's Takeover", name: 'Veteran', desc: 'Win 50 matches.', earned: st.wins >= 50 },
    { id: 'streak10', game: "Conway's Takeover", name: 'On Fire', desc: 'Win 10 matches in a row.', earned: st.bestStreak >= 10 },
    { id: 'rich', game: "Conway's Takeover", name: 'High Roller', desc: 'Hold $50,000 at once.', earned: peak >= 50000 },
    { id: 'whale', game: "Conway's Takeover", name: 'Whale', desc: 'Hold $500,000 at once.', earned: peak >= 500000 },
    { id: 'millionaire', game: "Conway's Takeover", name: 'Millionaire', desc: 'Hold $1,000,000 at once.', earned: peak >= 1000000 },
    { id: 'slayer', game: "Conway's Takeover", name: 'Boss Slayer', desc: 'Beat a boss.', earned: bossesBeaten.length >= 1 },
    { id: 'all-bosses', game: "Conway's Takeover", name: 'Boss Rush', desc: 'Beat every boss.', earned: bossesBeaten.length >= BOSSES.length },
  ];

  const football = [
    ['Championships', String(cups.length)],
    ['Seasons played', String(t.seasons.length)],
    ['Games (W-L-T)', `${f.wins}-${f.losses}-${f.ties}`],
    ['Points for / against', `${f.pf} / ${f.pa}`],
    ['Best score in a game', String(f.bestScore)],
    ['Biggest win', f.bigWin ? `by ${f.bigWin}` : '-'],
    ['Shutouts', String(f.shutouts)],
    ['Touchdowns / field goals', `${f.td} / ${f.fg}`],
    ['Longest win streak', String(f.bestStreak)],
  ];
  const takeover = [
    ['Peak bankroll', money(peak)],
    ['Matches (W-L)', `${st.wins}-${st.losses} of ${st.played}`],
    ['Best win streak', String(st.bestStreak)],
    ['Bosses beaten', `${bossesBeaten.length} of ${BOSSES.length}`],
    ['Formations designed', String(save.custom && save.custom.list ? save.custom.list.length : 0)],
  ];
  const bosses = BOSSES.map((b) => ({ id: b.id, name: b.name, beaten: bossesBeaten.includes(b.id) }));
  return { cups, seasons: t.seasons, badges, football, takeover, bosses, earned: badges.filter((b) => b.earned).length };
}
