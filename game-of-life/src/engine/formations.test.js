import { describe, it, expect } from 'vitest';
import { BLUE, RED, MAX_DRAFT, COLS, FIELD_Y0, FIELD_Y1 } from './constants.js';
import {
  OFFENSE, DEFENSE, HALF_X, placeFormation, validateDraft, pickBotSetup,
} from './formations.js';
import { createRng } from './rng.js';

describe('formation library', () => {
  for (const [side, list, team] of [['offense', OFFENSE, BLUE], ['defense', DEFENSE, RED]]) {
    for (const f of list) {
      it(`${side}: ${f.name} is 11 players, 7 on the line, 3 cells each`, () => {
        expect(f.players).toHaveLength(11);
        expect(f.players.filter((p) => p.depth === 0)).toHaveLength(7);
        const cells = placeFormation(f, team);
        expect(cells).toHaveLength(33);
        expect(cells.length).toBeLessThanOrEqual(MAX_DRAFT);
        expect(validateDraft(cells, team)).toEqual({ ok: true });
        expect(validateDraft(placeFormation(f, team, { flip: true }), team)).toEqual({ ok: true });
      });
    }
  }

  it('keeps the two teams on their own halves with a gap at the line', () => {
    const blue = placeFormation(OFFENSE[0], BLUE);
    const red = placeFormation(DEFENSE[0], RED);
    expect(Math.max(...blue.map((c) => c.x))).toBeLessThan(HALF_X);
    expect(Math.min(...red.map((c) => c.x))).toBeGreaterThanOrEqual(HALF_X);
    const keys = new Set([...blue, ...red].map((c) => c.y * COLS + c.x));
    expect(keys.size).toBe(66);
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
    expect(validateDraft([{ x: HALF_X - 1, y: 25, team: RED }], RED).ok).toBe(false);
  });

  it('rejects duplicates and wrong-team cells', () => {
    expect(validateDraft([ok, ok], BLUE).ok).toBe(false);
    expect(validateDraft([{ ...ok, team: RED }], BLUE).ok).toBe(false);
  });
});

describe('bot setup', () => {
  it('picks a valid random defense, reproducible by seed', () => {
    const a = pickBotSetup(createRng(11));
    const b = pickBotSetup(createRng(11));
    expect(a.formation.id).toBe(b.formation.id);
    expect(a.flip).toBe(b.flip);
    expect(validateDraft(a.cells, RED)).toEqual({ ok: true });
  });

  it('eventually uses every defensive formation', () => {
    const rng = createRng(2);
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(pickBotSetup(rng).formation.id);
    expect(seen.size).toBe(DEFENSE.length);
  });
});
