import { describe, it, expect } from 'vitest';
import { recordGame, recordSeason, trophyRoom } from './trophies.js';
import { newSave } from './wallet.js';
import { exportCode, importCode } from './saveStore.js';

describe('trophy room', () => {
  it('starts empty', () => {
    const r = trophyRoom(newSave());
    expect(r.cups).toEqual([]);
    expect(r.earned).toBe(0);
  });

  it('keeps football totals and records across games', () => {
    let s = newSave();
    s = recordGame(s, { you: 24, them: 0, td: 3, fg: 1 });
    s = recordGame(s, { you: 10, them: 17, td: 1, fg: 1 });
    s = recordGame(s, { you: 7, them: 7, td: 1, fg: 0 });
    const f = s.trophies.football;
    expect([f.games, f.wins, f.losses, f.ties]).toEqual([3, 1, 1, 1]);
    expect([f.pf, f.pa, f.bestScore, f.bigWin, f.shutouts, f.td, f.fg]).toEqual([41, 24, 24, 24, 1, 5, 2]);
    expect(f.bestStreak).toBe(1);
    const r = trophyRoom(s);
    expect(r.badges.find((b) => b.id === 'shutout').earned).toBe(true);
    expect(r.badges.find((b) => b.id === 'blowout').earned).toBe(true);
    expect(r.badges.find((b) => b.id === 'first-win').earned).toBe(true);
    expect(r.badges.find((b) => b.id === 'champion').earned).toBe(false);
  });

  it('puts a cup in the cabinet for a championship season, and not for a losing one', () => {
    const season = (wins) => ({ seed: 1, week: 8, results: Array.from({ length: 8 }, (_, i) => ({ team: 't', you: i < wins ? 10 : 3, them: 7 })) });
    let s = newSave();
    s = recordSeason(s, season(8), 6);
    s = recordSeason(s, season(4), 6);
    const r = trophyRoom(s);
    expect(r.seasons.length).toBe(2);
    expect(r.cups.length).toBe(1);
    expect(r.cups[0]).toMatchObject({ n: 1, wins: 8, losses: 0, champion: true });
    expect(r.badges.find((b) => b.id === 'perfect').earned).toBe(true);
    expect(r.badges.find((b) => b.id === 'dynasty').earned).toBe(false);
  });

  it('reads the Takeover records from the save: peak bankroll, streaks, bosses', () => {
    const s = { ...newSave(), peak: 1200000, stats: { played: 80, wins: 55, losses: 25, pushes: 0, streak: 2, bestStreak: 11 }, boss: { wins: 0, beaten: ['scout'], last: null, since: 0 } };
    const r = trophyRoom(s);
    const get = (id) => r.badges.find((b) => b.id === id).earned;
    expect([get('millionaire'), get('whale'), get('rich'), get('streak10'), get('veteran'), get('slayer'), get('all-bosses')]).toEqual([true, true, true, true, true, true, false]);
    expect(r.takeover.find(([k]) => k === 'Peak bankroll')[1]).toBe('$1.2M');
    expect(r.bosses.find((b) => b.id === 'scout').beaten).toBe(true);
  });

  it('survives the save round trip', () => {
    let s = recordGame(newSave(), { you: 31, them: 3, td: 4, fg: 1 });
    s = recordSeason(s, { seed: 1, week: 8, results: Array.from({ length: 8 }, () => ({ team: 't', you: 14, them: 7 })) }, 6);
    const back = importCode(exportCode(s));
    expect(back.trophies).toEqual(s.trophies);
  });
});
