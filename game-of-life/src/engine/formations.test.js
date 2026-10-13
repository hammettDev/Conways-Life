import { describe, it, expect } from 'vitest';
import { BLUE, RED, MAX_DRAFT, COLS, ROWS, FIELD_Y0, FIELD_Y1, DEAD } from './constants.js';
import { SHAPES } from './shapes.js';
import { stepTeams } from './life.js';
import { createEngine } from './engine.js';
import {
  HALF_X, placeFormation, validateDraft, pickBotSetup,
} from './formations.js';
import { BASE_BUILDS, FREE_BUILDS, TARGET_TILES } from './library.js';
import {
  OBJECTS, OBJECT_CATALOG, MAX_OBJECTS, MIN_PRICE, getObject, placeObject, totalPrice,
} from './objects.js';
import { createRng } from './rng.js';

const SIZE = COLS * ROWS;
const solo = (cells) => {
  const e = createEngine({ seed: 1, freezeUnderworld: true });
  e.loadTeams(cells);
  return { e, r: e.runToEnd() };
};

// Tiles a single unit of each shape claims when left alone.
const unitTiles = {};
for (const [name, cells] of Object.entries(SHAPES)) {
  if (['glider', 'lwss', 'mwss', 'hwss', 'acorn', 'rpent'].includes(name)) continue;
  unitTiles[name] = solo(cells.map(([du, dv]) => ({ x: 30 + du, y: 30 + dv, team: BLUE }))).r.score.blue;
}

describe('build library', () => {
  it('is mostly football, with a few builds from other sports', () => {
    const football = FREE_BUILDS.filter((b) => b.sport === 'football');
    expect(FREE_BUILDS.length).toBeGreaterThanOrEqual(25);
    expect(football.length).toBeGreaterThanOrEqual(FREE_BUILDS.length * 0.4);
    expect(new Set(BASE_BUILDS.map((b) => b.id)).size).toBe(BASE_BUILDS.length);
  });

  it('includes the named football looks', () => {
    const ids = BASE_BUILDS.map((b) => b.id);
    for (const id of ['fb-full-house', 'fb-weak-i', 'fb-strong-i', 'fb-pistol', 'fb-shotgun', 'fb-i-form']) {
      expect(ids).toContain(id);
    }
  });

  it('every build places legally for both teams, flipped or not', () => {
    for (const b of BASE_BUILDS) {
      for (const [team, flip] of [[BLUE, false], [BLUE, true], [RED, false], [RED, true]]) {
        const cells = placeFormation(b, team, { flip });
        expect(cells.length).toBeLessThanOrEqual(MAX_DRAFT);
        expect(validateDraft(cells, team), `${b.id} team ${team} flip ${flip}`).toEqual({ ok: true });
      }
    }
  });

  it('football and soccer are 11 three-cell players each', () => {
    for (const b of BASE_BUILDS.filter((x) => ['football', 'soccer'].includes(x.sport))) {
      const players = b.players.filter((p) => p.role !== 'RS');
      expect(players, b.id).toHaveLength(11);
      for (const p of players) expect(SHAPES[p.shape], `${b.id} ${p.role}`).toHaveLength(3);
    }
  });

  it('keeps teams on their own halves with no shared tiles', () => {
    const blue = placeFormation(FREE_BUILDS[0], BLUE);
    const red = placeFormation(FREE_BUILDS[0], RED);
    expect(Math.max(...blue.map((c) => c.x))).toBeLessThan(HALF_X);
    expect(Math.min(...red.map((c) => c.x))).toBeGreaterThanOrEqual(HALF_X);
  });

  it('free builds are inert alone: they settle at once and claim exactly their units', () => {
    for (const b of FREE_BUILDS) {
      const { r } = solo(placeFormation(b, BLUE));
      const expected = b.players.reduce((n, p) => n + unitTiles[p.shape], 0);
      expect(r.status, b.id).toBe('stable');
      expect(r.ticks, b.id).toBeLessThanOrEqual(4);
      expect(r.score.blue, b.id).toBe(expected);
      expect(expected, b.id).toBe(TARGET_TILES);
    }
  });
});

describe('purchasable objects', () => {
  const step = (cells, n) => {
    let a = new Uint8Array(SIZE);
    let b = new Uint8Array(SIZE);
    for (const c of cells) a[c.y * COLS + c.x] = c.team;
    for (let i = 0; i < n; i++) { stepTeams(a, b); [a, b] = [b, a]; }
    const out = [];
    for (let i = 0; i < SIZE; i++) if (a[i] !== DEAD) out.push([i % COLS, (i / COLS) | 0]);
    return out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  };
  const shifted = (cells, dx, dy) =>
    cells.map((c) => [c.x + dx, c.y + dy]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const drop = (id, team) => placeObject(getObject(id), team, { depth: 14, lat: 0 });

  it('gliders and spaceships travel toward the enemy', () => {
    expect(step(drop('glider', BLUE), 4)).toEqual(shifted(drop('glider', BLUE), 1, 1));
    for (const id of ['lwss', 'mwss', 'hwss']) {
      expect(step(drop(id, BLUE), 4), id).toEqual(shifted(drop(id, BLUE), 2, 0));
    }
  });

  it('mirror for Red so they also advance toward the middle', () => {
    expect(step(drop('lwss', RED), 4)).toEqual(shifted(drop('lwss', RED), -2, 0));
    expect(step(drop('glider', RED), 4)).toEqual(shifted(drop('glider', RED), -1, 1));
  });

  it('every object can be dropped legally on its own half', () => {
    for (const o of OBJECTS) {
      for (const team of [BLUE, RED]) {
        expect(validateDraft(placeObject(o, team, { depth: 10, lat: 0 }), team), o.id).toEqual({ ok: true });
      }
    }
  });

  it('are the only paid items: each has a price and a cell count', () => {
    expect(OBJECTS).toHaveLength(OBJECT_CATALOG.length);
    for (const o of OBJECTS) {
      expect(o.price, o.id).toBeGreaterThanOrEqual(MIN_PRICE);
      expect(o.cells, o.id).toBeGreaterThanOrEqual(4);
    }
  });

  it('caps how many can be bought and sums their prices', () => {
    expect(totalPrice(['glider', 'glider'])).toBe(getObject('glider').price * 2);
    expect(totalPrice(Array(MAX_OBJECTS + 1).fill('glider'))).toBeNull();
    expect(totalPrice([])).toBe(0);
  });
});

describe('validateDraft', () => {
  const ok = { x: 20, y: 25, team: BLUE };

  it('rejects more than 50 cells', () => {
    const many = [];
    for (let i = 0; i < MAX_DRAFT + 1; i++) {
      many.push({ x: 12 + (i % 2), y: FIELD_Y0 + (i >> 1), team: BLUE });
    }
    expect(validateDraft(many, BLUE).ok).toBe(false);
    expect(validateDraft(many.slice(0, MAX_DRAFT), BLUE).ok).toBe(true);
  });

  it('rejects cells in the other half, the ring, or off the field', () => {
    expect(validateDraft([{ ...ok, x: HALF_X }], BLUE).ok).toBe(false);
    expect(validateDraft([{ ...ok, x: 5 }], BLUE).ok).toBe(false);
    expect(validateDraft([{ ...ok, y: FIELD_Y0 - 1 }], BLUE).ok).toBe(false);
    expect(validateDraft([{ ...ok, y: FIELD_Y1 }], BLUE).ok).toBe(false);
    expect(validateDraft([{ x: HALF_X - 1, y: 25, team: RED }], RED).ok).toBe(false);
  });

  it('rejects duplicates and wrong-team cells', () => {
    expect(validateDraft([ok, ok], BLUE).ok).toBe(false);
    expect(validateDraft([{ ...ok, team: RED }], BLUE).ok).toBe(false);
  });
});

describe('bot setup', () => {
  it('picks a valid free build, reproducible by seed', () => {
    const a = pickBotSetup(createRng(11), FREE_BUILDS);
    const b = pickBotSetup(createRng(11), FREE_BUILDS);
    expect(a.formation.id).toBe(b.formation.id);
    expect(a.flip).toBe(b.flip);
    expect(validateDraft(a.cells, RED)).toEqual({ ok: true });
  });

  it('draws from across the whole free pool', () => {
    const rng = createRng(2);
    const sports = new Set();
    for (let i = 0; i < 300; i++) sports.add(pickBotSetup(rng, FREE_BUILDS).formation.sport);
    expect(sports.size).toBeGreaterThanOrEqual(2);
  });
});
