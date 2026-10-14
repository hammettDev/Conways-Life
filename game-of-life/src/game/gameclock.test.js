import { describe, it, expect } from 'vitest';
import { newGame, startPlay, afterPlay, afterSimDrive, other, clockText, PLAY_SECONDS, QUARTER_SECONDS, savable } from './gameclock.js';
import { DRIVE } from '../engine/football.js';

const play = (g, yards = 3, kind = 'run') => afterPlay(g, { kind, yards, note: '' });
const begun = (first = 'you') => startPlay(newGame(7, 'rookies'), first);

describe('game clock', () => {
  it('a play takes 15 seconds and a quarter is 4 minutes: 16 plays', () => {
    let g = begun();
    expect(g.clock).toBe(QUARTER_SECONDS);
    g = play(g);
    expect(g.clock).toBe(QUARTER_SECONDS - PLAY_SECONDS);
    for (let i = 0; i < 15; i++) g = play(g, 0, 'incomplete');
    expect(g.q).toBeGreaterThanOrEqual(2); // 16 plays used up quarter one (turnovers on downs do not change that)
    expect(clockText(75)).toBe('1:15');
  });

  it('a touchdown scores 7, ends the drive and gives the other team the ball at their 30', () => {
    let g = { ...begun(), drive: { ...begun().drive, spot: 90 } };
    g = play(g, 15, 'complete');
    expect(g.you).toBe(7);
    expect(g.poss).toBe('them');
    expect(g.drive.spot).toBe(DRIVE.startSpot);
    expect(g.note).toMatch(/Touchdown/);
  });

  it('a score asks for the cheerleaders: the side that scored, the points and the kind', () => {
    let g = { ...begun(), drive: { ...begun().drive, spot: 90 } };
    g = play(g, 15, 'complete');
    expect(g.cheer).toEqual({ side: 'you', pts: 7, kind: 'td' });
    let h = afterSimDrive(begun('them'), { over: 'fg', spot: 62 }, 4);
    expect(h.cheer).toEqual({ side: 'them', pts: 3, kind: 'fg' });
    expect(play(begun(), 2).cheer).toBeNull();
  });

  it('a turnover on downs gives them the ball where it died, mirrored', () => {
    let g = { ...begun(), drive: { ...begun().drive, spot: 50 } };
    for (let i = 0; i < 4; i++) g = play(g, 0, 'incomplete');
    expect(g.poss).toBe('them');
    expect(g.drive.spot).toBe(50);
    expect(g.you).toBe(0);
  });

  it('the ball switches at the half: the team that received first kicks off the second half', () => {
    let g = begun('you');
    g = { ...g, q: 2, clock: PLAY_SECONDS };
    g = play(g, 1);
    expect(g.q).toBe(3);
    expect(g.clock).toBe(QUARTER_SECONDS);
    expect(g.poss).toBe('them');
    expect(g.drive.spot).toBe(DRIVE.startSpot);
    expect(g.note).toMatch(/Halftime/);
    // and if they received first, you get the second-half ball
    let h = { ...begun('them'), q: 2, clock: PLAY_SECONDS };
    h = play(h, 1);
    expect(h.poss).toBe('you');
  });

  it('quarters 1 and 3 roll over without changing the ball or the drive', () => {
    let g = { ...begun(), q: 1, clock: PLAY_SECONDS };
    const down = g.drive.down;
    g = play(g, 2);
    expect(g.q).toBe(2);
    expect(g.poss).toBe('you');
    expect(g.drive.down).toBe(down + 1);
  });

  it('the game ends when the fourth quarter does', () => {
    let g = { ...begun(), q: 4, clock: PLAY_SECONDS };
    g = play(g, 2);
    expect(g.phase).toBe('final');
  });

  it('a simmed drive settles in one go and burns the clock', () => {
    let g = begun('them');
    g = afterSimDrive(g, { over: 'fg', spot: 62 }, 5);
    expect(g.them).toBe(3);
    expect(g.clock).toBe(QUARTER_SECONDS - 5 * PLAY_SECONDS);
    expect(g.poss).toBe('you');
  });

  it('is plain data that survives JSON, so it can live in the save', () => {
    const g = savable(play(begun()));
    expect(JSON.parse(JSON.stringify(g))).toEqual(g);
    expect(other('you')).toBe('them');
  });
});
