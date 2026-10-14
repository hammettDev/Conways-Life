import { describe, it, expect } from 'vitest';
import {
  BOSSES, getBoss, unlockedBosses, bossReady, winsToBoss, pickBossSetup, rollMultiplier,
} from './bosses.js';
import { newSave, noteResult, noteFormation, settle, placeBet } from './wallet.js';
import { importCode, exportCode } from './saveStore.js';
import { createRng } from '../engine/rng.js';
import { BOSS_UNLOCK_WINS, BOSS_MULTIPLIERS, WAGER } from '../engine/constants.js';

describe('boss progress', () => {
  it('opens a fight after enough ordinary wins, and a boss fight resets the count', () => {
    let s = newSave();
    expect(bossReady(s)).toBe(false);
    for (let i = 0; i < BOSS_UNLOCK_WINS; i++) s = noteResult(s, 'win');
    expect(bossReady(s)).toBe(true);
    expect(winsToBoss(s)).toBe(0);
    s = noteResult(s, 'lose', 'scout');
    expect(bossReady(s)).toBe(false);
    expect(s.boss.beaten).toEqual([]);
  });
  it('bosses unlock in order as you beat them', () => {
    let s = newSave();
    expect(unlockedBosses(s).map((b) => b.id)).toEqual(['scout']);
    s = noteResult(s, 'win', 'scout');
    expect(unlockedBosses(s).map((b) => b.id)).toEqual(['scout', 'coach']);
    s = noteResult(noteResult(s, 'win', 'coach'), 'win', 'champion');
    expect(unlockedBosses(s)).toHaveLength(BOSSES.length);
  });
  it('survives an export code', () => {
    let s = noteFormation(noteResult(noteResult(newSave(), 'win'), 'win', 'scout'), 'fb-dime');
    const back = importCode(exportCode(s));
    expect(back.boss).toEqual(s.boss);
  });
});

describe('boss fights', () => {
  it('the Scout counters your last formation when it knows it', () => {
    const picks = new Set();
    for (let seed = 1; seed <= 20; seed++) picks.add(pickBossSetup(getBoss('scout'), createRng(seed), 'fb-dime').formation.id);
    for (const id of picks) expect(['fb-46-bear', 'fb-cover-3', 'fb-tampa-2']).toContain(id);
  });
  it('every boss can build a lineup, with or without history', () => {
    for (const b of BOSSES) {
      for (const last of [null, 'fb-shotgun']) {
        const setup = pickBossSetup(b, createRng(3), last);
        expect(setup.cells.length).toBeGreaterThan(20);
      }
    }
  });
  it('the Scout always answers an audible; the others sometimes', () => {
    expect(getBoss('scout').audible).toBe(1);
    expect(getBoss('coach').audible).toBeLessThan(1);
  });
});

describe('hidden multiplier', () => {
  it('only ever rolls values from the table, and rare ones are rare', () => {
    const values = BOSS_MULTIPLIERS.map(([m]) => m);
    const rng = createRng(99);
    const counts = {};
    for (let i = 0; i < 4000; i++) { const m = rollMultiplier(rng); expect(values).toContain(m); counts[m] = (counts[m] || 0) + 1; }
    expect(counts[2]).toBeGreaterThan(counts[20] * 5);
    expect(Math.max(...Object.keys(counts).map(Number))).toBe(20);
  });
  it('a boss win pays the stake back plus the wager times the multiplier', () => {
    const held = placeBet(newSave(), WAGER);
    expect(settle(held, 'win', WAGER, 7).balance).toBe(newSave().balance - WAGER + WAGER + WAGER * 7);
    expect(settle(held, 'lose', WAGER, 7).balance).toBe(newSave().balance - WAGER);
  });
});
