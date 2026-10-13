import { describe, it, expect } from 'vitest';
import { COLS, ROWS, BLUE, RED, DEAD, FIELD_X0, FIELD_Y0, BOSS_PAYOUT } from './constants.js';
import { stepTeams, stepUnderworld } from './life.js';
import { accumulateTowers } from './towers.js';
import { scorePlots, outcomeFor, payoutFor } from './scoring.js';
import { createEngine } from './engine.js';
import { createRng } from './rng.js';
import {
  FORTUNE_RULES, FORTUNE_RULES_LIVE_FENCE, DEFAULT_FORTUNE_RULES, fortuneRulesFor,
} from './fortuneRules.js';
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

  it('level plots are broken by tower height, and a true dead heat is a push', () => {
    const setup = (heat) => {
      const e = createEngine({ seed: 1, freezeUnderworld: true });
      e.hot.fill(0);
      if (heat) e.hot[at(X, Y)] = 1; // a Hot Zone under one of Blue's block cells
      e.loadTeams(cells([...block(BLUE), ...block(RED).map(([x, y, t]) => [x + 20, y, t])]));
      return e.runToEnd();
    };
    const hot = setup(true);
    expect(hot.score.blue).toBe(hot.score.red);
    expect(hot.outcome).toBe('win');   // Blue's extra chips break the tie
    expect(setup(false).outcome).toBe('push'); // no luck either way: a true dead heat
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

describe('fortune layer (stacks, coloured fences, Board 2 spill)', () => {
  const FORT = { threshold: 5, cooldown: 4, maxCrashes: 6, chipsPerBlock: 1, chipCap: 2, unit: 5 };
  // A bare engine: no live cells, so every tower is an injected stack.
  const make = (fortune, { hot2At = [] } = {}) => {
    const e = createEngine({ seed: 1, freezeUnderworld: true, fortune });
    e.hot.fill(0);
    if (e.hot2) { e.hot2.fill(0); for (const [x, y] of hot2At) e.hot2[at(x, y)] = 1; }
    e.loadTeams([]);
    return e;
  };
  const total = (e, team) => e.chips[team].reduce((a, v) => a + v, 0);

  it('is off by default', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true });
    e.loadTeams([{ x: 20, y: 30, team: BLUE }]);
    expect(e.stacks).toBeNull();
    expect(e.fortune.crashes.total).toBe(0);
  });

  it('stacks record chips in order, coloured by whose cell added them', () => {
    const e = createEngine({ seed: 1, freezeUnderworld: true, fortune: { ...FORT, threshold: 999 } });
    e.hot.fill(0);
    e.hot[at(20, 30)] = 1; // a Hot Zone adds two chips a tick
    e.loadTeams([20, 21].flatMap((x) => [30, 31].map((y) => ({ x, y, team: BLUE }))));
    e.tick(); // a still life settles after one tick, so one tick of growth
    expect(e.stacks[at(20, 30)]).toEqual([[BLUE, 2]]); // on the Hot Zone
    expect(e.stacks[at(21, 30)]).toEqual([[BLUE, 1]]);
  });

  it('a crash lays a fence in the stack\'s own colours, bottom nearest the tower', () => {
    const e = make(FORT);
    e.setStack(20, 30, [[BLUE, 2], [RED, 2], [BLUE, 1]]); // 5 chips, blue majority
    e.tick();
    expect(e.fortune.crashes.total).toBe(1);
    // blocks every 4 tiles from x = 22; colours follow the stack bottom to top
    expect([22, 26, 30, 34, 38].map((x) => e.teams[at(x, 30)])).toEqual([BLUE, BLUE, RED, RED, BLUE]);
    expect(e.stacks[at(20, 30)]).toBeNull(); // the stack is cleared
    expect(e.stackHeight[at(20, 30)]).toBe(0);
  });

  it('topples toward the enemy of its majority colour', () => {
    const e = make(FORT);
    e.setStack(60, 30, [[RED, 4], [BLUE, 1]]);
    e.tick();
    expect(e.teams[at(58, 30)]).toBe(RED);   // left, toward Blue
    expect(e.teams[at(62, 30)]).toBe(DEAD);  // not the other way
  });

  it('a fence block crushes cells of the other colour and spares its own', () => {
    const e = make(FORT);
    e.loadTeams([{ x: 30, y: 30, team: RED }, { x: 31, y: 30, team: RED }, { x: 34, y: 30, team: BLUE }, { x: 35, y: 30, team: BLUE }]);
    e.setStack(20, 30, [[BLUE, 5]]);
    e.tick();
    // blocks at 22, 26, 30, 34, 38; the blue block at 30 crushed the red cells
    expect(e.teams[at(30, 30)]).toBe(BLUE);
    expect(e.teams[at(34, 30)]).toBe(BLUE);
  });

  it('what does not fit before the edge spills into Board 2 as a cluster, in its own colours', () => {
    const e = make(FORT);
    e.setStack(70, 30, [[BLUE, 3], [RED, 3]]); // tie -> top chip (red) decides: topples left
    e.tick();
    expect(e.fortune.crashes.red).toBe(1);
    // left fence from x=70: blocks at 66, 62, ... all 6 fit before the edge, nothing spills
    expect(total(e, BLUE) + total(e, RED)).toBe(0);

    const f = make(FORT);
    f.setStack(70, 30, [[BLUE, 3], [BLUE, 3]]); // 6 chips, blue majority, topples right
    f.tick();
    // right of x=70: blocks at 72 and 76 fit (2 chips); the other 4 spill
    expect(total(f, BLUE)).toBe(4);
    for (let i = 0; i < f.chips[BLUE].length; i++) if (f.chips[BLUE][i]) {
      const x = i % COLS;
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(14); // clustered at the entry side
    }
  });

  it('spilled chips keep their colours and score for them', () => {
    const e = make({ ...FORT, fence: false }, { hot2At: [[10, 30]] });
    e.setStack(40, 30, [[BLUE, 3], [RED, 1], [BLUE, 2]]); // 6 chips, blue majority, no fence
    e.tick();
    expect(total(e, BLUE)).toBe(5);
    expect(total(e, RED)).toBe(1);
    // chipCap 2: bottom two chips (blue) sit on the Hot Spot at the entry tile (x5 each)
    expect(e.chips[BLUE][at(10, 30)]).toBe(2);
    expect(e.fortune.blue).toBe(2 * 5 + 2 * 1 + 1 * 1); // 2 on the hot tile, 3 on plain tiles
    expect(e.fortune.red).toBe(1);
  });

  it('Board 2 is only the 60x40 playable area, and Red\'s spill enters from the far side', () => {
    const e = make({ ...FORT, fence: false });
    e.setStack(40, 30, [[RED, 6]]);
    e.tick();
    for (let i = 0; i < e.chips[RED].length; i++) if (e.chips[RED][i]) {
      const x = i % COLS;
      const y = (i / COLS) | 0;
      expect(x).toBeLessThanOrEqual(69);
      expect(x).toBeGreaterThanOrEqual(65);
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThan(50);
    }
    expect(total(e, RED)).toBe(6);
  });

  it('tiles hold at most chipCap chips, so Board 2 stays bounded', () => {
    const e = make({ ...FORT, fence: false, cooldown: 1, chipCap: 1 });
    for (let k = 0; k < 4; k++) { e.setStack(40, 30 + k, [[BLUE, 6]]); e.tick(); }
    expect(Math.max(...e.chips[BLUE])).toBeLessThanOrEqual(1);
  });

  it('crashes are spaced by the cooldown and limited per match', () => {
    const e = make({ ...FORT, cooldown: 3, maxCrashes: 2 });
    // an R-pentomino keeps Board 1 busy so the match does not settle early
    e.loadTeams([[61, 45], [62, 45], [60, 46], [61, 46], [61, 47]].map(([x, y]) => ({ x, y, team: RED })));
    for (let k = 0; k < 4; k++) e.setStack(20, 20 + k * 4, [[BLUE, 6]]);
    for (let i = 0; i < 20; i++) e.tick();
    expect(e.fortune.crashes.total).toBe(2);
  });

  it('the chip-score lead becomes bonus plots for the leader', () => {
    const e = make({ ...FORT, fence: false, unit: 2 }, { hot2At: [[10, 30]] });
    e.loadTeams([]);
    e.setStack(40, 30, [[BLUE, 5]]); // 5 chips: two on the hot entry tile, three on plain ones
    e.tick();
    expect(e.fortune.blue).toBe(2 * 5 + 3 * 1);
    const withBonus = e.getScore();
    const tilesOnly = e.getScore(false);
    expect(withBonus.blue - tilesOnly.blue).toBe(6); // floor(13 / 2)
    expect(withBonus.red).toBe(tilesOnly.red);
  });

  it('a crash clears the stack but leaves the scoring tower alone (unless asked)', () => {
    const e = make({ ...FORT, fence: false });
    e.setStack(40, 30, [[BLUE, 6]]);
    e.blueTower[at(40, 30)] = 17;
    e.tick();
    expect(e.stackHeight[at(40, 30)]).toBe(0);
    expect(e.blueTower[at(40, 30)]).toBe(17);
    const f = make({ ...FORT, fence: false, resetTowers: true });
    f.setStack(40, 30, [[BLUE, 6]]);
    f.blueTower[at(40, 30)] = 17;
    f.tick();
    expect(f.blueTower[at(40, 30)]).toBe(0);
  });

  describe('spread drops', () => {
    const SPREAD = { ...FORT, spread: true, spacing: 6 };

    it('pieces land one per slot, spaced far apart, in stack order and colour', () => {
      const e = make(SPREAD);
      e.setStack(20, 30, [[BLUE, 3], [RED, 2]]); // blue majority -> topples right
      e.tick();
      const xs = [23, 29, 35, 41, 47];
      expect(xs.map((x) => e.teams[at(x, 30)])).toEqual([BLUE, BLUE, BLUE, RED, RED]);
      // nothing fills the gaps: pieces do not touch each other
      expect([25, 26, 27, 31, 32, 33].every((x) => e.teams[at(x, 30)] === DEAD)).toBe(true);
    });

    it('a piece already sitting on the spot wins; the chip spills to Board 2 instead', () => {
      const e = make(SPREAD);
      e.loadTeams([{ x: 29, y: 30, team: RED }, { x: 30, y: 30, team: RED }, { x: 29, y: 31, team: RED }, { x: 30, y: 31, team: RED }]);
      e.setStack(20, 30, [[BLUE, 5]]);
      e.tick();
      expect(e.teams[at(29, 30)]).toBe(RED);           // the original piece stays
      expect([23, 35, 41, 47].map((x) => e.teams[at(x, 30)])).toEqual([BLUE, BLUE, BLUE, BLUE]);
      expect(total(e, BLUE)).toBe(1);                   // the blocked chip went to Board 2
    });

    it('pieces landing in clear space leave the rest of the board untouched', () => {
      const e = make(SPREAD);
      e.loadTeams([{ x: 60, y: 45, team: RED }, { x: 61, y: 45, team: RED }, { x: 60, y: 46, team: RED }, { x: 61, y: 46, team: RED }]);
      e.setStack(20, 30, [[BLUE, 3]]);
      e.tick();
      expect([[60, 45], [61, 45], [60, 46], [61, 46]].every(([x, y]) => e.teams[at(x, y)] === RED)).toBe(true);
    });
  });

  describe('cold pieces', () => {
    const alive = [[61, 45], [62, 45], [60, 46], [61, 46], [61, 47]]; // R-pentomino keeps the match going
    const run = (fortune) => {
      const e = createEngine({ seed: 1, freezeUnderworld: true, fortune: { ...FORT, threshold: 999, ...fortune } });
      e.hot.fill(0);
      e.loadTeams([
        ...alive.map(([x, y]) => ({ x, y, team: RED })),
        ...[[20, 30], [21, 30], [20, 31], [21, 31]].map(([x, y]) => ({ x, y, team: BLUE })), // a still block
        ...[[30, 30], [31, 30], [32, 30]].map(([x, y]) => ({ x, y, team: BLUE })),           // a blinker
      ]);
      for (let i = 0; i < 10; i++) e.tick();
      return e;
    };

    it('a still block stops adding chips once cold, a flasher keeps adding', () => {
      const warm = run({ cold: false });
      const cold = run({ cold: true, coldAfter: 2 });
      expect(warm.stackHeight[at(20, 30)]).toBe(10);          // never cold: a chip every tick
      expect(cold.stackHeight[at(20, 30)]).toBeLessThan(5);   // went cold after ~2 quiet ticks
      expect(cold.stackHeight[at(30, 30)] + cold.stackHeight[at(32, 30)]).toBeGreaterThan(cold.stackHeight[at(20, 30)]);
    });
  });

  describe('the pit (Board 2 as a small tile battle)', () => {
    const PIT = { ...FORT, fence: false, pit: true, pitSize: 10, unit: 2 };
    const inPit = (e) => {
      const out = [];
      for (const team of [BLUE, RED]) e.pit[team].forEach((c, k) => { if (c) out.push([team, k, c]); });
      return out;
    };

    it('overflow splatters inside the 10x10 pit and both colours land on the same tiles', () => {
      const e = make(PIT);
      e.setStack(30, 30, [[BLUE, 14], [RED, 14]]);
      e.tick();
      const spots = inPit(e);
      expect(spots.reduce((n, [, , c]) => n + c, 0)).toBe(28);
      expect(spots.every(([, k]) => k >= 0 && k < 100)).toBe(true);
      const blueTiles = new Set(spots.filter(([t]) => t === BLUE).map(([, k]) => k));
      const shared = spots.filter(([t, k]) => t === RED && blueTiles.has(k));
      expect(shared.length).toBeGreaterThan(0);
    });

    it('a tile goes to the colour with more chips, one tile-point each; ties belong to nobody', () => {
      const e = make({ ...PIT });
      e.pit[BLUE][0] = 3; e.pit[RED][0] = 1; // blue ahead
      e.pit[RED][1] = 2;                     // red only
      e.pit[BLUE][2] = 2; e.pit[RED][2] = 2; // tie
      e.pit[BLUE][3] = 1;                    // blue only
      expect(e.fortune.blue).toBe(2);
      expect(e.fortune.red).toBe(1);
    });

    it('a chip landing on a Hot Spot becomes a stack of 5 of its own colour; elsewhere it adds 1', () => {
      const cx = (COLS - 10) >> 1;
      const cy = (ROWS - 10) >> 1;
      const total = (e) => e.pit[BLUE].reduce((a, v) => a + v, 0);
      const hotPit = make({ ...PIT, hotValue: 5 });
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) hotPit.hot2[(cy + y) * COLS + cx + x] = 1;
      hotPit.setStack(30, 30, [[BLUE, 6]]);
      hotPit.tick();
      expect(total(hotPit)).toBe(6 * 5);   // every chip landed on a Hot Spot: 5 each
      const coldPit = make({ ...PIT, hotValue: 5 });
      coldPit.setStack(30, 30, [[BLUE, 6]]);
      coldPit.tick();
      expect(total(coldPit)).toBe(6);       // none on a Hot Spot: 1 each
    });

    it('a hot landing can swing a tile the other colour', () => {
      const e = make({ ...PIT, hotValue: 5 });
      const cx = (COLS - 10) >> 1;
      const cy = (ROWS - 10) >> 1;
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) e.hot2[(cy + y) * COLS + cx + x] = 1;
      for (let k = 0; k < 100; k++) e.pit[RED][k] = 4;       // red holds every tile, 4 chips each
      e.setStack(30, 30, [[BLUE, 12]]);                       // 12 blue chips, each a 5-stack
      e.tick();
      expect(e.fortune.blue).toBeGreaterThan(0);              // blue flipped tiles from red
      expect(e.fortune.blue + e.fortune.red).toBeLessThanOrEqual(100);
    });

    it('the tile lead becomes bonus plots', () => {
      const e = make({ ...PIT, unit: 2 });
      for (let k = 0; k < 8; k++) e.pit[BLUE][k] = 1; // blue holds 8 tiles, red none
      expect(e.getScore().blue - e.getScore(false).blue).toBe(4);
    });

    it('a tight small fence still drops on Board 1; the rest goes down the gutter to the pit', () => {
      const e = make({ ...PIT, fence: true, spread: true, spacing: 4, maxBlocks: 2 });
      e.setStack(20, 30, [[BLUE, 6]]);
      e.tick();
      expect([23, 27].map((x) => e.teams[at(x, 30)])).toEqual([BLUE, BLUE]); // two blocks, 4 apart
      expect(e.teams[at(31, 30)]).toBe(DEAD);                                  // no third
      expect(inPit(e).reduce((n, [, , c]) => n + c, 0)).toBe(4);               // 6 - 2 chips overflow
    });
  });
});

describe('shipped fortune rules', () => {
  const cells = [
    [30, 28], [30, 29], [30, 30], [31, 28], [32, 29], [29, 31], [33, 31], [34, 29], [35, 30], [28, 30],
  ].map(([x, y]) => ({ x, y, team: BLUE }))
    .concat([[50, 28], [50, 29], [50, 30], [49, 28], [48, 29], [51, 31], [47, 31], [46, 29], [45, 30], [52, 30]]
      .map(([x, y]) => ({ x, y, team: RED })));

  it('run a full match with both rule sets and report the pit', () => {
    for (const rules of [FORTUNE_RULES, FORTUNE_RULES_LIVE_FENCE]) {
      const e = createEngine({ seed: 7, fortune: rules });
      e.loadTeams(cells);
      const r = e.runToEnd();
      expect(['stable', 'cap', 'extinct']).toContain(r.status);
      expect(r.fortune).toBeDefined();
      expect(r.fortune.blue + r.fortune.red).toBeLessThanOrEqual(100); // pit is 10x10
    }
  });

  it('the safe rules never touch Board 1 on a topple; the live-fence rules may', () => {
    expect(FORTUNE_RULES.fence).toBe(false);
    expect(FORTUNE_RULES_LIVE_FENCE.fence).toBe(true);
    expect(FORTUNE_RULES_LIVE_FENCE.maxBlocks).toBe(2);
    expect(FORTUNE_RULES.unit).toBe(0.25);
  });

  it('the live fence is the default, and one switch turns it off', () => {
    expect(DEFAULT_FORTUNE_RULES).toBe(FORTUNE_RULES_LIVE_FENCE);
    expect(fortuneRulesFor()).toBe(FORTUNE_RULES_LIVE_FENCE);
    expect(fortuneRulesFor({ liveFence: false })).toBe(FORTUNE_RULES);
  });

  describe('overtime for flashers', () => {
    const OT = { threshold: 4, cooldown: 2, maxCrashes: 3, chipsPerBlock: 1, chipCap: 2, unit: 5, fence: false, cold: true, coldAfter: 2, overtime: 40 };
    const blinker = [[30, 30], [31, 30], [32, 30]].map(([x, y]) => ({ x, y, team: BLUE }));
    const run = (fortune) => {
      const e = createEngine({ seed: 1, freezeUnderworld: true, fortune });
      e.hot.fill(0);
      e.loadTeams(blinker);
      return { e, r: e.runToEnd() };
    };

    it('a settled board with flashers plays on until the first topple', () => {
      const { e, r } = run(OT);
      expect(r.status).toBe('stable');
      expect(r.ticks).toBeGreaterThan(4);               // it did not stop at the settle (tick 2)
      expect(e.fortune.crashes.total).toBeGreaterThanOrEqual(1);
      expect(r.ticks).toBeLessThan(OT.overtime + 4);   // and it stopped soon after the topple
    });

    it('the static middle stays cold; only the outer flashers stack', () => {
      const { e } = run({ ...OT, threshold: 999 }); // no topple, so the stacks stay readable
      expect(e.stackHeight[at(31, 30)]).toBeLessThanOrEqual(OT.coldAfter + 2); // the middle cell goes cold
      expect(e.stackHeight[at(30, 30)] + e.stackHeight[at(32, 30)]).toBeGreaterThan(e.stackHeight[at(31, 30)]);
    });

    it('gives up at the overtime limit if nothing ever topples', () => {
      const { r } = run({ ...OT, threshold: 999, overtime: 20 });
      expect(r.status).toBe('stable');
      expect(r.ticks).toBeLessThanOrEqual(2 + 20 + 1);
      expect(r.ticks).toBeGreaterThan(20);
    });

    it('all-still boards and the old rules end at once', () => {
      const still = createEngine({ seed: 1, freezeUnderworld: true, fortune: OT });
      still.loadTeams([[30, 30], [31, 30], [30, 31], [31, 31]].map(([x, y]) => ({ x, y, team: BLUE })));
      expect(still.runToEnd().ticks).toBeLessThanOrEqual(2);
      const old = createEngine({ seed: 1, freezeUnderworld: true });
      old.loadTeams(blinker);
      expect(old.runToEnd().ticks).toBeLessThanOrEqual(3);
    });
  });
});
