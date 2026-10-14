import { describe, it, expect } from 'vitest';
import { createEngine } from './engine.js';
import { createEngineN, TEAM_KEYS } from './engineN.js';
import { G2, G4 } from './geometry.js';
import { DEFAULT_FORTUNE_RULES } from './fortuneRules.js';
import { FREE_BUILDS } from './library.js';
import { placeFormation } from './formations.js';
import { BLUE, RED } from './constants.js';

describe('engineN reproduces the classic two-player engine', () => {
  it('gives the same result, tick for tick, on the standard board', () => {
    const pairs = [[0, 5], [1, 9], [2, 14], [7, 3], [10, 11], [4, 15], [12, 6], [8, 13]];
    for (const [a, b] of pairs) {
      for (const seed of [3, 17]) {
        const cells = [...placeFormation(FREE_BUILDS[a], BLUE), ...placeFormation(FREE_BUILDS[b], RED)];
        const old = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
        old.loadTeams(cells);
        const o = old.runToEnd();
        const fresh = createEngineN({ seed, geometry: G2 });
        fresh.loadTeams(cells);
        const n = fresh.runToEnd();
        const label = `${FREE_BUILDS[a].id} vs ${FREE_BUILDS[b].id} seed ${seed}`;
        expect(n.ticks, label).toBe(o.ticks);
        expect(n.status, label).toBe(o.status);
        expect(n.outcome, label).toBe(o.outcome);
        expect(n.score.blue, label).toBe(o.score.blue);
        expect(n.score.red, label).toBe(o.score.red);
        expect(n.score.neutral, label).toBe(o.score.neutral);
        expect(n.fortune.blue, label).toBe(o.fortune.blue);
        expect(n.fortune.red, label).toBe(o.fortune.red);
        expect(n.fortune.crashes.total, label).toBe(o.fortune.crashes.total);
        expect(n.tileOutcome, label).toBe(o.tileOutcome);
      }
    }
  }, 120000);
});

describe('four teams on the doubled board', () => {
  it('has the shape the arena needs', () => {
    expect(G4.cols).toBe(G2.cols);
    expect(G4.fy1 - G4.fy0).toBe(2 * (G2.fy1 - G2.fy0)); // twice as tall
    expect(G4.teams).toBe(4);
    expect(G4.pitSize).toBeGreaterThan(G2.pitSize);
    expect(TEAM_KEYS.slice(1)).toEqual(['blue', 'red', 'green', 'yellow']);
  });
  it('a lone team of each colour survives alone and the others score nothing', () => {
    const block = (x, y, team) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => ({ x: x + dx, y: y + dy, team }));
    const e = createEngineN({ seed: 5, geometry: G4 });
    e.loadTeams([...block(20, 20, 1), ...block(50, 20, 2), ...block(20, 70, 3), ...block(50, 70, 4)]);
    const r = e.runToEnd();
    expect(r.status).toBe('stable');
    for (const k of ['blue', 'red', 'green', 'yellow']) expect(r.score[k]).toBe(4);
    expect(r.winners.length).toBeGreaterThanOrEqual(1); // level plots go to total tower height (Hot Zone luck); a dead heat on that too is a push
  });
  it('a three-way birth with three different parents is settled the same way every time', () => {
    const L = [{ x: 30, y: 30, team: 1 }, { x: 31, y: 31, team: 2 }, { x: 32, y: 30, team: 3 }];
    const run = () => { const e = createEngineN({ seed: 1, geometry: G4 }); e.loadTeams(L); e.tick(); return Array.from(e.teams).join(''); };
    expect(run()).toBe(run());
  });
  it('plays a full four-way match to the end with sensible numbers', () => {
    const lay = (f, team) => placeFormation(f, team === 1 || team === 2 ? team : team - 2).map((c) => ({ ...c, team, y: c.y + (team > 2 ? 40 : 0) }));
    const e = createEngineN({ seed: 9, geometry: G4 });
    e.loadTeams([...lay(FREE_BUILDS[0], 1), ...lay(FREE_BUILDS[1], 2), ...lay(FREE_BUILDS[2], 3), ...lay(FREE_BUILDS[3], 4)]);
    const r = e.runToEnd();
    expect(['stable', 'cap', 'extinct']).toContain(r.status);
    const total = r.score.blue + r.score.red + r.score.green + r.score.yellow + r.score.neutral;
    expect(total).toBeGreaterThanOrEqual(60 * 80); // every field tile is counted once, plus pit bonus plots
    expect(['win', 'lose', 'push']).toContain(r.outcome);
    expect(r.fortune.crashes.total).toBeGreaterThan(0);
    expect(r.fortune.blue + r.fortune.red + r.fortune.green + r.fortune.yellow).toBeLessThanOrEqual(G4.pitSize ** 2);
  }, 120000);
});
