import { describe, it, expect } from 'vitest';
import { TABLES, getTable, tableOpen, feeFor, betStep, maxBetFor, pickTableSetup } from './tables.js';
import { CHIP_STYLES, getStyle, colorAt, buyStyle, equipStyle, isAnimated } from './cosmetics.js';
import { newSave } from './wallet.js';
import { importCode, exportCode } from './saveStore.js';
import { createRng } from '../engine/rng.js';
import { FREE_BUILDS, BOSS_BUILDS } from '../engine/library.js';
import { COUNTERS } from '../engine/counters.js';

describe('stakes tables', () => {
  it('climb in stakes and sharpness, and the ceilings stop a bankroll compounding forever', () => {
    for (let i = 1; i < TABLES.length; i++) {
      expect(TABLES[i].min).toBeGreaterThan(TABLES[i - 1].min);
      expect(TABLES[i].max).toBeGreaterThan(TABLES[i - 1].max);
      expect(TABLES[i].fee).toBeGreaterThanOrEqual(TABLES[i - 1].fee);
      expect(TABLES[i].scout).toBeGreaterThanOrEqual(TABLES[i - 1].scout);
    }
    expect(TABLES[0].unlock).toBe(0);
    expect(maxBetFor(TABLES[0], 5e8, 0)).toBe(1000); // $500M in the bank still only bets $1,000 at Rookie
  });
  it('open by the most cash you have ever held, not by what you hold now', () => {
    const s = { ...newSave(), balance: 100, peak: 60000 };
    expect(tableOpen(s, getTable('high'))).toBe(true);
    expect(tableOpen(s, getTable('whale'))).toBe(false);
  });
  it('charge a fee and cap what you can bet by what you can cover', () => {
    const t = getTable('regular');
    expect(feeFor(t, 5000)).toBe(100);
    expect(maxBetFor(t, 5100, 0)).toBe(5000);
    expect(maxBetFor(t, 1e9, 0)).toBe(t.max);
    expect(betStep(TABLES[0])).toBe(10);
    expect(betStep(TABLES[4])).toBe(100000);
  });
  it('Rookie bots are random; the higher tables counter the formation you used last', () => {
    const counters = new Set(COUNTERS['fb-dime']);
    const hits = (id) => { let n = 0; for (let s = 1; s <= 60; s++) if (counters.has(pickTableSetup(getTable(id), createRng(s), 'fb-dime', createRng(s + 9)).formation.id)) n++; return n; };
    expect(hits('whale')).toBe(60); // always the counter
    expect(hits('rookie')).toBeLessThan(25);
  });
  it('bring pieces at the higher tables and none at Rookie', () => {
    const has = (id) => { let n = 0; for (let s = 1; s <= 40; s++) if (pickTableSetup(getTable(id), createRng(s), null, createRng(s + 5)).item) n++; return n; };
    expect(has('rookie')).toBe(0);
    expect(has('whale')).toBeGreaterThan(30);
    expect(FREE_BUILDS.length + BOSS_BUILDS.length).toBeGreaterThan(10);
  });
});

describe('chip colours', () => {
  it('are bought once and equipped; classic is free and always owned', () => {
    const rich = { ...newSave(), balance: 100000 };
    expect(rich.style.owned).toEqual(['classic']);
    const bought = buyStyle(rich, 'ember');
    expect(bought.balance).toBe(75000);
    expect(bought.style.equipped).toBe('ember');
    expect(buyStyle(bought, 'ember')).toBeNull(); // not twice
    expect(buyStyle({ ...newSave(), balance: 10 }, 'ember')).toBeNull(); // not without the cash
    expect(equipStyle(bought, 'classic').style.equipped).toBe('classic');
    expect(equipStyle(newSave(), 'gold')).toBeNull(); // cannot equip what you do not own
  });
  it('animated colours change over time; solid ones do not', () => {
    const aurora = getStyle('aurora');
    expect(isAnimated(aurora)).toBe(true);
    expect(colorAt(aurora, 0)).not.toEqual(colorAt(aurora, 1500));
    expect(colorAt(getStyle('rainbow'), 0)).not.toEqual(colorAt(getStyle('rainbow'), 2000));
    const ember = getStyle('ember');
    expect(colorAt(ember, 0)).toEqual(colorAt(ember, 5000));
    expect(CHIP_STYLES.filter(isAnimated).length).toBeGreaterThanOrEqual(3);
  });
  it('survive the export code, and an unknown or unowned colour falls back to classic', () => {
    const s = buyStyle({ ...newSave(), balance: 100000 }, 'lime');
    expect(importCode(exportCode(s)).style).toEqual(s.style);
    const bad = { ...s, style: { owned: ['classic', 'nope'], equipped: 'nope' } };
    expect(importCode(exportCode(bad)).style).toEqual({ owned: ['classic'], equipped: 'classic' });
  });
  it('the table and peak survive the export code', () => {
    const s = { ...newSave(), table: 'high', peak: 80000, balance: 100 };
    const back = importCode(exportCode(s));
    expect(back.table).toBe('high');
    expect(back.peak).toBe(80000);
  });
});
