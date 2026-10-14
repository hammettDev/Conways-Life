import { describe, it, expect } from 'vitest';
import { qualified, yourSeed, startPlayoffs, field, bracket, nextOpponent, playoffResult, seasonDone, champion, finishText, ROUND_NAMES, currentTeam } from './playoffs.js';
import { newSeason, TEAMS } from './season.js';

const finished = (wins, seed = 42) => ({ ...newSeason(seed), week: 8, results: Array.from({ length: 8 }, (_, i) => ({ team: TEAMS[i].id, you: i < wins ? 14 : 3, them: 7 })) });

describe('playoffs', () => {
  it('you qualify with 6 wins; the seed follows the record', () => {
    expect(qualified(finished(5))).toBe(false);
    expect(qualified(finished(6))).toBe(true);
    expect([yourSeed(finished(8)), yourSeed(finished(7)), yourSeed(finished(6))]).toEqual([1, 2, 3]);
    expect(seasonDone(finished(5))).toBe(true);        // missed it: the season is over
    expect(finishText(finished(5))).toBe('Missed the playoffs');
    expect(seasonDone(finished(6))).toBe(false);       // but with 6 wins the playoffs are still to come
  });

  it('an eight-team bracket with you in your seed and the league\'s seven best around you', () => {
    const s = startPlayoffs(finished(7));
    const ids = field(s);
    expect(ids.length).toBe(8);
    expect(ids[1]).toBe('you');                       // 7-1 is the 2 seed
    expect(new Set(ids).size).toBe(8);
    expect(ids).not.toContain('rookies');             // the weakest team is out
    expect(ids[0]).toBe('kings');                     // the strongest is the 1 seed
  });

  it('a quarterfinal and a semifinal on your side, then the championship against the winner of the other side', () => {
    let s = startPlayoffs(finished(6));              // seed 3: plays seed 6 in round one
    expect(ROUND_NAMES).toEqual(['Quarterfinal', 'Semifinal', 'Championship']);
    const b = bracket(s);
    const mine = b.rounds[0].find((m) => m.mine);
    expect([mine.a, mine.b].sort()).toEqual([3, 6]);
    const t1 = nextOpponent(s);
    expect(t1.id).toBe(field(s)[5]);
    s = playoffResult(s, { team: t1.id, you: 21, them: 10 });
    expect(s.playoffs.round).toBe(1);
    const t2 = nextOpponent(s);
    expect(t2).toBeTruthy();
    s = playoffResult(s, { team: t2.id, you: 17, them: 14 });
    expect(s.playoffs.round).toBe(2);
    const t3 = nextOpponent(s);                      // the winner of the other half of the bracket
    expect(t3).toBeTruthy();
    expect(['you']).not.toContain(t3.id);
    s = playoffResult(s, { team: t3.id, you: 24, them: 20 });
    expect(champion(s)).toBe(true);
    expect(seasonDone(s)).toBe(true);
    expect(finishText(s)).toBe('Champions');
  });

  it('the other half of the bracket gives the same finalist when it is asked for twice', () => {
    let s = startPlayoffs(finished(6));
    s = playoffResult(s, { team: nextOpponent(s).id, you: 10, them: 3 });
    s = playoffResult(s, { team: nextOpponent(s).id, you: 10, them: 3 });
    expect(nextOpponent(s).id).toBe(nextOpponent(s).id);
  });

  it('a loss ends it, and says where', () => {
    let s = startPlayoffs(finished(6));
    s = playoffResult(s, { team: nextOpponent(s).id, you: 10, them: 3 });
    s = playoffResult(s, { team: nextOpponent(s).id, you: 7, them: 9 });
    expect(s.playoffs.out).toBe(true);
    expect(seasonDone(s)).toBe(true);
    expect(champion(s)).toBe(false);
    expect(finishText(s)).toBe('Lost in the semifinal');
    expect(nextOpponent(s)).toBeNull();
    // out of it, the bracket plays out so you can see who won
    const b = bracket(s);
    expect(b.rounds[2][0].winner).not.toBeNull();
  });

  it('the team you play is the regular-season opponent, then the playoff opponent', () => {
    expect(currentTeam({ ...newSeason(1), week: 2 }).id).toBe(TEAMS[2].id);
    expect(currentTeam(startPlayoffs(finished(6))).id).toBe(field(startPlayoffs(finished(6)))[5]);
  });
});
