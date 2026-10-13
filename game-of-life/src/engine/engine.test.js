import { describe, it, expect } from 'vitest';
import { COLS, ROWS, BLUE, RED, DEAD, FIELD_X0, FIELD_Y0, BOSS_PAYOUT } from './constants.js';
import { stepTeams, stepUnderworld } from './life.js';
import { accumulateTowers } from './towers.js';
import { scorePlots, outcomeFor, payoutFor } from './scoring.js';
import { createEngine } from './engine.js';
import { createRng } from './rng.js';
import { seedUnderworld, rescueUnderworld, RESCUE_BELOW } from './underworld.js';

const SIZE = COLS * ROWS;
const at = (x, y) => y * COLS + x;
const grid = (list) => {
  const g = new Uint8Array(SIZE);
  for (const [x, y, t] of list) g[at(x, y)] = t;
  return g;
};
const cells = (list) => list.map(([x, y, team]) => ({ x, y, team }));
const X = FIELD_X0 + 5;
const Y = FIELD_Y0 + 5;

describe('team life rules', () => {
  it('births follow the majority parent team', () => {
    const out = new Uint8Array(SIZE);
    stepTeams(grid([[10, 10, BLUE], [12, 10, BLUE], [11, 12, RED]]), out);
    expect(out[at(11, 11)]).toBe(BLUE);
    stepTeams(grid([[10, 10, RED], [12, 10, RED], [11, 12, BLUE]]), out);
    expect(out[at(11, 11)]).toBe(RED);
  });

  it('survivors keep their own team even beside enemies', () => {
    const out = new Uint8Array(SIZE);
    stepTeams(grid([[10, 10, BLUE], [11, 10, RED], [12, 10, BLUE]]), out);
    expect(out[at(11, 10)]).toBe(RED);
  });

  it('lonely cells die', () => {
    const out = new Uint8Array(SIZE);
    stepTeams(grid([[5, 5, BLUE]]), out);
    expect(out[at(5, 5)]).toBe(DEAD);
  });

  it('edges are hard walls (no wrapping)', () => {
    const out = new Uint8Array(SIZE);
    stepTeams(grid([[0, 0, BLUE], [COLS - 1, 0, BLUE], [0, ROWS - 1, BLUE]]), out);
    expect(out.every((v) => v === DEAD)).toBe(true);
  });
});

describe('underworld', () => {
  it('runs plain Conway (blinker oscillates)', () => {
    const a = grid([[5, 5, 1], [6, 5, 1], [7, 5, 1]]);
    const b = new Uint8Array(SIZE);
    stepUnderworld(a, b);
    expect([b[at(6, 4)], b[at(6, 5)], b[at(6, 6)], b[at(5, 5)]]).toEqual([1, 1, 1, 0]);
  });
});

describe('tower accumulation', () => {
  it('adds +1 normally and +2 on a Hot Zone, per team', () => {
    const teams = grid([[1, 1, BLUE], [2, 1, BLUE], [3, 1, RED], [4, 1, RED]]);
    const hot = grid([[2, 1, 1], [4, 1, 1]]);
    const bt = new Uint16Array(SIZE);
    const rt = new Uint16Array(SIZE);
    const hits = accumulateTowers(teams, hot, bt, rt);
    expect(hits).toBe(2);
    expect([bt[at(1, 1)], bt[at(2, 1)], rt[at(3, 1)], rt[at(4, 1)]]).toEqual([1, 2, 1, 2]);
    expect(rt[at(1, 1)]).toBe(0);
  });
});

describe('scoring', () => {
  it('higher tower wins a plot; equal is unclaimed; locks win outright', () => {
    const bt = new Uint16Array(SIZE);
    const rt = new Uint16Array(SIZE);
    bt[at(X, Y)] = 5; rt[at(X, Y)] = 3;          // blue by height
    rt[at(X + 1, Y)] = 4;                         // red by height
    bt[at(X + 2, Y)] = 2; rt[at(X + 2, Y)] = 2;   // tie -> neutral
    bt[at(X + 3, Y)] = 1; rt[at(X + 3, Y)] = 99;  // red taller but blue lock
    const locked = new Uint8Array(SIZE);
    locked[at(X + 3, Y)] = BLUE;
    const s = scorePlots(bt, rt, locked);
    expect(s.blue).toBe(2);
    expect(s.red).toBe(1);
    expect(s.blue + s.red + s.neutral).toBe(2400);
  });

  it('ignores the ring outside the Playing Field', () => {
    const bt = new Uint16Array(SIZE);
    const rt = new Uint16Array(SIZE);
    bt[at(0, 0)] = 50;
    expect(scorePlots(bt, rt, null)).toEqual({ blue: 0, red: 0, neutral: 2400 });
  });

  it('maps outcomes to even-money payouts with a push on ties', () => {
    expect(outcomeFor({ blue: 3, red: 2 })).toBe('win');
    expect(outcomeFor({ blue: 2, red: 3 })).toBe('lose');
    expect(outcomeFor({ blue: 2, red: 2 })).toBe('push');
    expect(payoutFor('win', 100)).toBe(100);
    expect(payoutFor('lose', 100)).toBe(-100);
    expect(payoutFor('push', 100)).toBe(0);
  });

  it('pays x5 for beating a boss but still costs one wager to lose', () => {
    expect(BOSS_PAYOUT).toBe(5);
    expect(payoutFor('win', 100, BOSS_PAYOUT)).toBe(500);
    expect(payoutFor('lose', 100, BOSS_PAYOUT)).toBe(-100);
    expect(payoutFor('push', 100, BOSS_PAYOUT)).toBe(0);
  });
});

describe('engine', () => {
  const block = (team) => [[X, Y, team], [X + 1, Y, team], [X, Y + 1, team], [X + 1, Y + 1, team]];

  it('detects a still life, locks its tiles, and awards them', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.loadTeams(cells(block(BLUE)));
    const r = e.runToEnd();
    expect(r.status).toBe('stable');
    expect(r.period).toBe(1);
    expect(r.score.blue).toBe(4);
    expect(r.outcome).toBe('win');
  });

  it('locks every phase of a blinker (period 2)', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.loadTeams(cells([[X, Y, RED], [X + 1, Y, RED], [X + 2, Y, RED]]));
    const r = e.runToEnd();
    expect(r.status).toBe('stable');
    expect(r.period).toBe(2);
    // horizontal 3 + vertical 3 share the center tile -> 5 tiles
    expect(r.score.red).toBe(5);
    expect(r.outcome).toBe('lose');
  });

  it('a locked repeating cell beats a taller enemy tower', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.loadTeams(cells(block(BLUE)));
    e.redTower[at(X, Y)] = 1000;
    expect(e.runToEnd().score.blue).toBe(4);
  });

  it('ends as extinct when everything dies, and pushes', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.loadTeams(cells([[X, Y, BLUE], [X + 10, Y, RED]]));
    const r = e.runToEnd();
    expect(r.status).toBe('extinct');
    expect(r.outcome).toBe('push');
  });

  it('stops at the tick cap for non-repeating patterns', () => {
    const e = createEngine({ seed: 1, maxTicks: 5, freezeUnderworld: true });
    // R-pentomino never repeats within 5 ticks.
    e.loadTeams(cells([[X + 1, Y, BLUE], [X + 2, Y, BLUE], [X, Y + 1, BLUE], [X + 1, Y + 1, BLUE], [X + 1, Y + 2, BLUE]]));
    const r = e.runToEnd();
    expect(r.status).toBe('cap');
    expect(r.ticks).toBe(5);
  });

  it('grows towers every tick, +2 on hot tiles', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.hot.fill(0);
    e.hot[at(X, Y)] = 1;
    // A pentomino keeps evolving, so several ticks accumulate.
    e.loadTeams(cells([[X + 1, Y, BLUE], [X + 2, Y, BLUE], [X, Y + 1, BLUE], [X + 1, Y + 1, BLUE], [X + 1, Y + 2, BLUE]]));
    const total = () => e.blueTower.reduce((a, v) => a + v, 0);
    e.tick();
    const after1 = total();
    e.tick();
    expect(e.tickCount).toBe(2);
    expect(after1).toBeGreaterThan(0);
    expect(total()).toBeGreaterThan(after1);
  });

  it('adds +2 for a live cell standing on a Hot Zone', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.hot.fill(0);
    e.hot[at(X, Y)] = 1;
    e.loadTeams(cells(block(BLUE)));
    const t = e.tick(); // block is a still life; stops after the first tick
    expect(t.status).toBe('stable');
    expect(t.hotHits).toBe(1);
    expect(e.blueTower[at(X, Y)]).toBe(2);
    expect(e.blueTower[at(X + 1, Y + 1)]).toBe(1);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const e = createEngine({ seed: 42, maxTicks: 60 });
      e.loadTeams(cells([[X + 1, Y, BLUE], [X + 2, Y, RED], [X, Y + 1, BLUE], [X + 1, Y + 1, RED], [X + 1, Y + 2, BLUE]]));
      return JSON.stringify(e.runToEnd());
    };
    expect(run()).toBe(run());
  });
});

describe('rng', () => {
  it('is reproducible by seed', () => {
    const a = createRng(5); const b = createRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('underworld seeding', () => {
  const live = (g) => g.reduce((a, v) => a + v, 0);

  it('plants an acorn in the middle with soup only on the outskirts', () => {
    const g = seedUnderworld(createRng(3));
    const cx = COLS >> 1;
    const cy = ROWS >> 1;
    expect(g[at(cx - 3 + 1, cy - 1)]).toBe(1); // acorn head
    let centerLive = 0;
    for (let y = cy - 8; y < cy + 8; y++) for (let x = cx - 8; x < cx + 8; x++) centerLive += g[at(x, y)];
    expect(centerLive).toBe(7);
    expect(live(g)).toBeGreaterThan(SIZE * 0.08);
  });

  it('stays alive for a full match without any injection', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let a = seedUnderworld(createRng(seed));
      let b = new Uint8Array(SIZE);
      for (let t = 0; t < 500; t++) {
        stepUnderworld(a, b);
        [a, b] = [b, a];
      }
      expect(live(a)).toBeGreaterThanOrEqual(RESCUE_BELOW);
    }
  });

  it('only rescues a nearly empty layer', () => {
    const rng = createRng(9);
    const healthy = seedUnderworld(rng);
    expect(rescueUnderworld(healthy, rng)).toBe(false);
    const empty = new Uint8Array(SIZE);
    expect(rescueUnderworld(empty, rng)).toBe(true);
    expect(live(empty)).toBeGreaterThan(0);
  });
});
