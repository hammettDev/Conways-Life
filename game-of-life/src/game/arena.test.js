import { describe, it, expect } from 'vitest';
import { newSave, placeBet, setPending } from './wallet.js';
import { packMatch, resolvePending } from './pending.js';
import { createEngineN } from '../engine/engineN.js';
import { G4 } from '../engine/geometry.js';
import { arenaCells, ARENA_TEAMS } from '../engine/arena.js';
import { placeFormation } from '../engine/formations.js';
import { FREE_BUILDS } from '../engine/library.js';
import { DEFAULT_FORTUNE_RULES } from '../engine/fortuneRules.js';
import { BLUE, RED, GREEN, VIOLET, FOUR_PLAYER_PAYOUT } from '../engine/constants.js';

const lineup = (a, b, c, d) => {
  const red = placeFormation(FREE_BUILDS[b], RED);
  return {
    blue: placeFormation(FREE_BUILDS[a], BLUE),
    red,
    green: arenaCells(placeFormation(FREE_BUILDS[c], RED), 3),
    violet: arenaCells(placeFormation(FREE_BUILDS[d], RED), 4),
  };
};

describe('4-player arena', () => {
  it('seats are in four distinct corners, none overlapping', () => {
    const l = lineup(0, 1, 2, 3);
    const seen = new Set();
    for (const c of [...l.blue, ...l.red, ...l.green, ...l.violet]) {
      const k = `${c.x},${c.y}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    expect(ARENA_TEAMS).toEqual([BLUE, RED, GREEN, VIOLET]);
  });

  it('a match is deterministic and has exactly one outcome for the player', () => {
    const l = lineup(0, 1, 2, 3);
    const run = () => {
      const e = createEngineN({ seed: 77, geometry: G4, fortune: DEFAULT_FORTUNE_RULES });
      e.loadTeams([...l.blue, ...l.red, ...l.green, ...l.violet]);
      return e.runToEnd();
    };
    const a = run();
    const b = run();
    expect(b.outcome).toBe(a.outcome);
    expect(['win', 'lose', 'push']).toContain(a.outcome);
  });

  const settleWith = (l, seed) => {
    const held = placeBet({ ...newSave(), sid: 5 }, 100);
    const save = setPending(held, packMatch(seed, 100, null, l.blue, l.red, { green: l.green, violet: l.violet }));
    return { held, r: resolvePending(save) };
  };

  it('a pending arena match settles on reload: a win pays the winner-take-all multiple, once', () => {
    const { held, r } = settleWith(lineup(0, 1, 2, 3), 1); // this lineup wins (checked in the sim: all seeds)
    expect(r.outcome).toBe('win');
    expect(r.mult).toBe(FOUR_PLAYER_PAYOUT);
    expect(r.save.pending).toBeFalsy();
    expect(r.save.balance).toBe(held.balance + 100 + 100 * FOUR_PLAYER_PAYOUT);
  });

  it('a lost arena match pays nothing back and clears the pending match', () => {
    const { held, r } = settleWith(lineup(5, 9, 2, 7), 1); // a rival formation wins here
    expect(r.outcome).toBe('lose');
    expect(r.save.pending).toBeFalsy();
    expect(r.save.balance).toBe(held.balance);
  });
});
