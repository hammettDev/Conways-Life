import { describe, it, expect } from 'vitest';
import {
  BOSSES, getBoss, unlockedBosses, bossReady, winsToBoss, pickBossSetup, withItem, rollMultiplier,
} from './bosses.js';
import { newSave, noteResult, noteFormation, settle, placeBet } from './wallet.js';
import { importCode, exportCode } from './saveStore.js';
import { createRng } from '../engine/rng.js';
import { COUNTERS } from '../engine/counters.js';
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
    for (const b of BOSSES) s = noteResult(s, 'win', b.id);
    expect(unlockedBosses(s)).toHaveLength(BOSSES.length);
    expect(BOSSES.length).toBeGreaterThanOrEqual(6);
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
    for (const id of picks) expect(COUNTERS['fb-dime']).toContain(id);
  });
  it('every boss can build a lineup, with or without history', () => {
    for (const b of BOSSES) {
      for (const last of [null, 'fb-shotgun']) {
        const setup = pickBossSetup(b, createRng(3), last);
        expect(setup.cells.length).toBeGreaterThan(20);
      }
    }
  });
  it('the Mirror fields your last formation; the Blitzer stays aggressive; the Fortress stays tight', () => {
    for (let seed = 1; seed <= 15; seed++) {
      expect(pickBossSetup(getBoss('mirror'), createRng(seed), 'fb-i-form').formation.id).toBe('fb-i-form');
      expect(['fb-46-bear', 'fb-cover-0', 'fb-dime', 'fb-goal-line-d', 'fb-4-3-over', 'sc-2-3-5'])
        .toContain(pickBossSetup(getBoss('blitzer'), createRng(seed), 'fb-i-form').formation.id);
      expect(['fb-goal-line-d', 'fb-goal-line', 'fb-prevent', 'fb-bunch', 'fb-46-bear', 'fb-4-3-under', 'fb-full-house'])
        .toContain(pickBossSetup(getBoss('fortress'), createRng(seed), 'fb-i-form').formation.id);
    }
  });
  it('the Scout always answers an audible; the others sometimes', () => {
    expect(getBoss('scout').audible).toBe(1);
    expect(getBoss('coach').audible).toBeLessThan(1);
  });
});

describe('boss items', () => {
  it('every boss brings a piece that fits on its half without overlapping', () => {
    for (const b of BOSSES) {
      for (let seed = 1; seed <= 25; seed++) {
        const rng = createRng(seed);
        const base = pickBossSetup(b, rng, 'fb-shotgun');
        const setup = withItem(b, base, createRng(seed + 100));
        expect(setup.item, `${b.id} seed ${seed}`).toBeTruthy();
        expect(b.items).toContain(setup.item.id);
        const keys = setup.cells.map((c) => c.y * 1000 + c.x);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });
  it('the heavier bosses bring heavier pieces', () => {
    expect(getBoss('champion').items).toContain('hwss');
    expect(getBoss('scout').items).not.toContain('hwss');
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
  it('more rolls pay better on average, and never below the table', () => {
    const mean = (rolls) => { const rng = createRng(7); let n = 0; for (let i = 0; i < 4000; i++) n += rollMultiplier(rng, rolls); return n / 4000; };
    expect(mean(2)).toBeGreaterThan(mean(1));
    expect(mean(3)).toBeGreaterThan(mean(2));
  });
  it('a boss win pays the stake back plus the wager times the multiplier', () => {
    const held = placeBet(newSave(), WAGER);
    expect(settle(held, 'win', WAGER, 7).balance).toBe(newSave().balance - WAGER + WAGER + WAGER * 7);
    expect(settle(held, 'lose', WAGER, 7).balance).toBe(newSave().balance - WAGER);
  });
});
