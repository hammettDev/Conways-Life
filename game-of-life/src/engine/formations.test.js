import { describe, it, expect } from 'vitest';
import { BLUE, RED, MAX_DRAFT, COLS, ROWS, FIELD_Y0, FIELD_Y1, DEAD } from './constants.js';
import { SHAPES } from './shapes.js';
import { stepTeams } from './life.js';
import { createEngine } from './engine.js';
import {
  HALF_X, placeFormation, validateDraft, pickBotSetup,
} from './formations.js';
import {
  BASE_BUILDS, BUILDS, FREE_BUILDS, FREE_MAX, TARGET_TILES, priceFor,
} from './library.js';
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
  it('has 50+ free builds across several sports, plus paid weapon packs', () => {
    const sports = new Set(FREE_BUILDS.map((b) => b.sport));
    expect(FREE_BUILDS.length).toBeGreaterThanOrEqual(50);
    expect(sports).toEqual(new Set(['football', 'soccer', 'basketball', 'baseball', 'hockey']));
    expect(BASE_BUILDS.some((b) => b.sport === 'arsenal')).toBe(true);
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
    const blue = placeFormation(BUILDS[0], BLUE);
    const red = placeFormation(BUILDS[0], RED);
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

describe('weapons', () => {
  const unit = (shape, team) => placeFormation({ players: [{ role: 'W', shape, depth: 14, lat: 0 }] }, team);
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

  it('gliders and spaceships travel toward the enemy', () => {
    expect(step(unit('glider', BLUE), 4)).toEqual(shifted(unit('glider', BLUE), 1, 1));
    expect(step(unit('lwss', BLUE), 4)).toEqual(shifted(unit('lwss', BLUE), 2, 0));
    expect(step(unit('mwss', BLUE), 4)).toEqual(shifted(unit('mwss', BLUE), 2, 0));
    expect(step(unit('hwss', BLUE), 4)).toEqual(shifted(unit('hwss', BLUE), 2, 0));
  });

  it('mirror for Red so they also advance toward the middle', () => {
    expect(step(unit('lwss', RED), 4)).toEqual(shifted(unit('lwss', RED), -2, 0));
    expect(step(unit('glider', RED), 4)).toEqual(shifted(unit('glider', RED), -1, 1));
  });
});

describe('pricing', () => {
  it('is free up to the ceiling and charges the edge above it', () => {
    expect(priceFor(null)).toBe(0);
    expect(priceFor(0.5)).toBe(0);
    expect(priceFor(FREE_MAX)).toBe(0);
    expect(priceFor(0.7)).toBe(40); // wins 70% -> +40% edge -> $40 on a $100 bet
    expect(priceFor(0.9)).toBe(80);
  });

  it('never gets cheaper as builds get stronger', () => {
    let last = 0;
    for (let r = 0.4; r <= 1; r += 0.01) {
      const p = priceFor(r);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it('only paid builds cost money', () => {
    for (const b of BUILDS) expect(b.cost === 0 || b.winRate > FREE_MAX).toBe(true);
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
    expect(a.formation.cost).toBe(0);
    expect(validateDraft(a.cells, RED)).toEqual({ ok: true });
  });

  it('draws from across the whole free pool', () => {
    const rng = createRng(2);
    const sports = new Set();
    for (let i = 0; i < 300; i++) sports.add(pickBotSetup(rng, FREE_BUILDS).formation.sport);
    expect(sports.size).toBe(5);
  });
});
