import { describe, it, expect } from 'vitest';
import { COLS, ROWS, BLUE, RED, DEAD } from '../engine/constants.js';
import { OBJECT_CATALOG, getObject, placeObject, dropAt, placementOk } from '../engine/objects.js';
import { FREE_BUILDS } from '../engine/library.js';
import { placeFormation } from '../engine/formations.js';
import {
  DEMOS, VIEW, LOOP_TICKS, HOLD_TICKS, demoCells, createPreview, thumbCells,
} from './miniPreview.js';
import { toScreen, fromScreen } from './drawBoard.js';

const meanX = (grid, team) => {
  let n = 0; let sum = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] === team) { n++; sum += i % COLS; }
  return n ? sum / n : NaN;
};
const count = (grid, team) => grid.reduce((n, v) => n + (v === team ? 1 : 0), 0);

describe('shop previews', () => {
  it('every shop item has a demo that starts inside the board and the visible window', () => {
    for (const o of OBJECT_CATALOG) {
      const cells = demoCells(o.id);
      expect(cells.length, o.id).toBeGreaterThan(0);
      expect(cells.some((c) => c.team === BLUE), o.id).toBe(true);
      for (const c of cells) {
        expect(c.x, o.id).toBeGreaterThanOrEqual(VIEW.x0);
        expect(c.x, o.id).toBeLessThan(VIEW.x0 + VIEW.w);
        expect(c.y, o.id).toBeGreaterThanOrEqual(VIEW.y0);
        expect(c.y, o.id).toBeLessThan(VIEW.y0 + VIEW.h);
      }
      expect(DEMOS[o.id].note.length, o.id).toBeGreaterThan(5);
    }
  });

  it('the pieces really do what they claim (it is the real Life rules)', () => {
    const run = (id, ticks) => { const p = createPreview(id); for (let i = 0; i < ticks; i++) p.step(); return p; };
    // spaceships and gliders travel toward the enemy
    for (const id of ['lwss', 'mwss', 'hwss']) {
      const before = meanX(createPreview(id).grid, BLUE);
      expect(meanX(run(id, 24).grid, BLUE) - before, id).toBeGreaterThan(5);
    }
    expect(meanX(run('glider', 16).grid, BLUE)).toBeGreaterThan(meanX(createPreview('glider').grid, BLUE) + 2);
    // an acorn grows
    expect(count(run('acorn', 60).grid, BLUE)).toBeGreaterThan(count(createPreview('acorn').grid, BLUE) * 3);
    // a toad oscillates in place
    expect(Math.abs(meanX(run('toad', 20).grid, BLUE) - meanX(createPreview('toad').grid, BLUE))).toBeLessThan(2);
  });

  it('loops: after the demo and a short rest it starts over', () => {
    const p = createPreview('glider');
    const first = Array.from(p.grid);
    for (let i = 0; i < LOOP_TICKS + HOLD_TICKS; i++) p.step();
    expect(Array.from(p.grid)).not.toEqual(first); // resting on the last frame
    p.step();
    expect(Array.from(p.grid)).toEqual(first);      // and then it restarts
    expect(p.tick).toBe(0);
  });

  it('thumbnails fit their own box and face the enemy', () => {
    for (const o of OBJECT_CATALOG) {
      const t = thumbCells(o.shape);
      expect(t.cells.length, o.id).toBeGreaterThan(0);
      for (const [x, y] of t.cells) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(t.w);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(t.h);
      }
    }
  });
});

describe('placing a bought object', () => {
  const build = FREE_BUILDS[0];

  it('the cursor tile is about the middle of the placed piece', () => {
    for (const id of ['glider', 'acorn', 'lwss']) {
      const o = getObject(id);
      const cells = placeObject(o, BLUE, dropAt(o, 20, 30));
      const mx = cells.reduce((n, c) => n + c.x, 0) / cells.length;
      const my = cells.reduce((n, c) => n + c.y, 0) / cells.length;
      expect(Math.abs(mx - 20), id).toBeLessThanOrEqual(1);
      expect(Math.abs(my - 30), id).toBeLessThanOrEqual(1);
    }
  });

  it('accepts empty ground on your own half and refuses the rest', () => {
    const glider = getObject('glider');
    const front = placeFormation({ ...build, players: build.players.filter((p) => p.role !== 'RS') }, BLUE);
    // find an empty tile in the middle of Blue's field half
    const empty = (x, y) => !front.some((c) => Math.abs(c.x - x) <= 3 && Math.abs(c.y - y) <= 3);
    let spot = null;
    for (let x = 14; x < 36 && !spot; x++) for (let y = 14; y < 46 && !spot; y++) if (empty(x, y)) spot = [x, y];
    expect(spot).not.toBeNull();
    expect(placementOk(build, glider, dropAt(glider, spot[0], spot[1]))).toBe(true);
    expect(placementOk(build, glider, dropAt(glider, 60, 30))).toBe(false);   // the enemy's half
    expect(placementOk(build, glider, dropAt(glider, 20, 5))).toBe(false);    // the border ring
    const on = front[0];
    expect(placementOk(build, glider, dropAt(glider, on.x, on.y))).toBe(false); // on top of your formation
  });
});

describe('screen <-> sim mapping', () => {
  it('fromScreen undoes toScreen in both views', () => {
    for (const rotate of [false, true]) {
      for (const [x, y] of [[0, 0], [12, 40], [79, 59], [40, 30]]) {
        const [sx, sy] = toScreen(x, y, rotate);
        expect(fromScreen(sx, sy, rotate)).toEqual([x, y]);
      }
    }
  });
});
