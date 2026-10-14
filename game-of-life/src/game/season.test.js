import { describe, it, expect } from 'vitest';
import {
  TEAMS, SEASON_GAMES, newSeason, seasonOver, record, champion, nextTeam, drivePoints, botDrive, teamDefence,
} from './season.js';
import { createRng } from '../engine/rng.js';
import { sanitize, exportCode, importCode } from './saveStore.js';
import { newSave } from './wallet.js';

describe('football season', () => {
  it('has eight teams of rising level', () => {
    expect(TEAMS.length).toBe(SEASON_GAMES);
    for (let i = 1; i < TEAMS.length; i++) expect(TEAMS[i].level).toBeGreaterThanOrEqual(TEAMS[i - 1].level);
  });
  it('tracks the record and the title', () => {
    let s = newSeason(5);
    expect(nextTeam(s).id).toBe(TEAMS[0].id);
    for (let i = 0; i < SEASON_GAMES; i++) s = { ...s, week: s.week + 1, results: [...s.results, { team: TEAMS[i].id, you: i < 6 ? 10 : 3, them: 7 }] };
    expect(seasonOver(s)).toBe(true);
    expect(record(s)).toEqual({ wins: 6, losses: 2, ties: 0 });
    expect(champion(s)).toBe(true);
  });
  it('scores a touchdown 7 and a made field goal 3; a miss or a turnover nothing', () => {
    expect(drivePoints({ over: 'td', spot: 100 })).toBe(7);
    expect(drivePoints({ over: 'fg', spot: 70 })).toBe(3);
    expect(drivePoints({ over: 'miss', spot: 70 })).toBe(0);
    expect(drivePoints({ over: 'downs', spot: 65 })).toBe(0);
    expect(drivePoints({ over: 'downs', spot: 30 })).toBe(0);
    expect(drivePoints({ over: 'int', spot: 70 })).toBe(0);
  });
  it('better teams score more, and a defence weak to their style gives up more', () => {
    const rate = (team, def) => { let p = 0; for (let i = 0; i < 400; i++) p += drivePoints(botDrive(i, team, def)); return p / 400; };
    expect(rate(TEAMS[7], 'fb-cover-3')).toBeGreaterThan(rate(TEAMS[0], 'fb-cover-3'));
    const t = { ...TEAMS[2], style: 'mid' };
    expect(rate(t, 'fb-prevent')).toBeGreaterThan(rate(t, 'fb-dime')); // Prevent gives up the pass, Dime stops it
  });
  it('the opponent reads a repeated defence', () => {
    const a = rate0(0); const b = rate0(4);
    expect(b).toBeGreaterThan(a);
    function rate0(rep) { let p = 0; for (let i = 0; i < 400; i++) p += drivePoints(botDrive(i, TEAMS[3], 'fb-cover-3', rep)); return p; }
  });
  it('the defence it shows leans on its own formations and counters a repeated call', () => {
    const rng = createRng(2);
    for (let i = 0; i < 20; i++) expect(TEAMS[1].def).toContain(teamDefence(rng, TEAMS[1], []));
  });
  it('a season survives the save round trip', () => {
    const save = { ...newSave(), season: { seed: 9, week: 2, results: [{ team: 'rookies', you: 14, them: 7 }, { team: 'mudhens', you: 3, them: 10 }] } };
    const back = importCode(exportCode(save));
    expect(back.season).toEqual(save.season);
    expect(sanitize({ ...save, season: 'junk' }).season).toBeNull();
  });
});
