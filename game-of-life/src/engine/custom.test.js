import { describe, it, expect } from 'vitest';
import { CUSTOM_SHAPES, checkCustom, buildCustom, footprintOk } from './custom.js';
import { FREE_BUILDS, TARGET_TILES, footprintOf } from './library.js';
import { placeFormation, validateDraft } from './formations.js';
import { BLUE, MAX_CUSTOM_UNITS } from './constants.js';
import { SHAPES } from './shapes.js';

// A legal base: the seven-bar line of every football build, plus a few backs.
const line = [-15, -10, -5, 0, 5, 10, 15].map((lat) => ({ shape: 'bar', depth: 0, lat })); // 35 tiles
const legal = [...line, { shape: 'ell', depth: 6, lat: 0 }, { shape: 'dart', depth: 3, lat: -18 }, { shape: 'dart', depth: 3, lat: 18 }]; // 35+4+5+5 = 49

describe('custom formations', () => {
  it('accepts a normal-looking formation and tops it up to the standard tile budget', () => {
    const c = checkCustom({ players: legal });
    expect(c.ok, c.reason).toBe(true);
    const b = buildCustom({ id: 'c1', name: 'Mine', players: legal });
    expect(footprintOf(b.players)).toBe(TARGET_TILES);
    expect(validateDraft(placeFormation(b, BLUE), BLUE).ok).toBe(true);
  });
  it('is held to the same budget as the built-ins', () => {
    expect(checkCustom({ players: [] }).ok).toBe(false);
    const tooBig = [...legal, ...[-12, -4, 4, 12].map((lat) => ({ shape: 'loaf', depth: 12, lat }))];
    expect(checkCustom({ players: tooBig }).ok).toBe(false);
    expect(checkCustom({ players: line.slice(0, 3) }).reason).toMatch(/46 to 56/);
    expect(footprintOk(58)).toBe(false);
    expect(footprintOk(60)).toBe(true);
  });
  it('rejects units that overlap, sit off the field, or reach too far back', () => {
    expect(checkCustom({ players: [...legal, { shape: 'ell', depth: 6, lat: 0 }] }).ok).toBe(false);
    expect(checkCustom({ players: legal.map((p, i) => (i === 0 ? { ...p, lat: -40 } : p)) }).ok).toBe(false);
    expect(checkCustom({ players: legal.map((p, i) => (i === 7 ? { ...p, depth: 24 } : p)) }).ok).toBe(false);
  });
  it('rejects weapons and unknown shapes, and caps the unit count', () => {
    expect(checkCustom({ players: [...line, { shape: 'glider', depth: 5, lat: 0 }] }).ok).toBe(false);
    for (const s of CUSTOM_SHAPES) expect(SHAPES[s]).toBeTruthy();
    const many = Array.from({ length: MAX_CUSTOM_UNITS + 1 }, (_, i) => ({ shape: 'block', depth: 0, lat: -19 + i * 2 }));
    expect(checkCustom({ players: many }).ok).toBe(false);
  });
  it('every built-in football formation would pass the same checks (the rules are fair)', () => {
    for (const b of FREE_BUILDS) {
      const units = b.players.filter((p) => p.role !== 'RS').map(({ shape, depth, lat }) => ({ shape, depth, lat }));
      const c = checkCustom({ players: units });
      expect(c.ok, `${b.id}: ${c.reason}`).toBe(true);
    }
  });
});
