import { describe, it, expect } from 'vitest';
import { WAGER, STARTING_WALLET } from '../engine/constants.js';
import {
  newSave, placeBet, refund, spend, settle, canAfford, bailoutAvailable, bailoutAmount, takeBailout,
} from './wallet.js';
import { exportCode, importCode, loadSave, persistSave, sanitize, checksum } from './saveStore.js';

describe('wallet', () => {
  it('starts at the post-tutorial stack', () => {
    expect(newSave().balance).toBe(STARTING_WALLET);
  });

  it('holds the bet at lock-in and refuses a bet it cannot cover', () => {
    const s = newSave();
    expect(placeBet(s, WAGER).balance).toBe(STARTING_WALLET - WAGER);
    expect(placeBet(s, STARTING_WALLET + 1)).toBeNull();
    expect(placeBet(s, -5)).toBeNull();
    expect(canAfford(s, WAGER)).toBe(true);
  });

  it('a win returns the stake plus even-money winnings; a push returns the stake; a loss returns nothing', () => {
    const held = placeBet(newSave(), WAGER);
    expect(settle(held, 'win', WAGER).balance).toBe(STARTING_WALLET + WAGER);
    expect(settle(held, 'push', WAGER).balance).toBe(STARTING_WALLET);
    expect(settle(held, 'lose', WAGER).balance).toBe(STARTING_WALLET - WAGER);
  });

  it('a boss win pays the multiplier on the wager', () => {
    const held = placeBet(newSave(), WAGER);
    expect(settle(held, 'win', WAGER, 5).balance).toBe(STARTING_WALLET - WAGER + WAGER + WAGER * 5);
  });

  it('tracks wins, losses, pushes and the win streak', () => {
    let s = newSave();
    for (const o of ['win', 'win', 'win', 'lose', 'push', 'win']) s = settle(s, o);
    expect(s.stats).toEqual({ played: 6, wins: 4, losses: 1, pushes: 1, streak: 1, bestStreak: 3 });
  });

  it('cancelling refunds; an audible fee is spent', () => {
    const held = placeBet(newSave(), 150);
    expect(refund(held, 150).balance).toBe(STARTING_WALLET);
    expect(spend(newSave(), 50).balance).toBe(STARTING_WALLET - 50);
    expect(spend(newSave(), STARTING_WALLET + 1)).toBeNull();
  });

  it('a bailout is only for a player who cannot cover a bet, and it shrinks each time', () => {
    const broke = { ...newSave(), balance: WAGER - 1 };
    expect(bailoutAvailable(newSave())).toBe(false);
    expect(takeBailout(newSave())).toBeNull();
    expect(bailoutAvailable(broke)).toBe(true);
    const amounts = [];
    let s = broke;
    for (let i = 0; i < 5; i++) {
      const r = takeBailout({ ...s, balance: 0 });
      amounts.push(r.amount);
      s = { ...r.save, balance: 0 };
    }
    expect(amounts).toEqual([300, 200, 100, 100, 100]);
    expect(Math.max(...amounts)).toBeLessThanOrEqual(STARTING_WALLET); // never beats a fresh start
    expect(bailoutAmount({ bailouts: 0 })).toBe(300);
  });
});

describe('save store', () => {
  const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

  it('round-trips through localStorage', () => {
    const st = fakeStorage();
    const s = settle(placeBet(newSave(), WAGER), 'win');
    expect(persistSave(s, st)).toBe(true);
    expect(loadSave(st)).toEqual(s);
  });

  it('falls back to a fresh save for missing, corrupt or blocked storage', () => {
    expect(loadSave(fakeStorage())).toEqual(newSave());
    const bad = fakeStorage(); bad.setItem('gcw.save', '{not json');
    expect(loadSave(bad)).toEqual(newSave());
    const wrong = fakeStorage(); wrong.setItem('gcw.save', JSON.stringify({ v: 99, balance: 1e9 }));
    expect(loadSave(wrong)).toEqual(newSave());
    expect(loadSave({ getItem() { throw new Error('blocked'); } })).toEqual(newSave());
    expect(persistSave(newSave(), { setItem() { throw new Error('full'); } })).toBe(false);
  });

  it('clamps nonsense values instead of trusting them', () => {
    const s = sanitize({ v: 1, balance: -50, bailouts: 'x', stats: { wins: 3.9, streak: NaN } });
    expect(s.balance).toBe(STARTING_WALLET);
    expect(s.bailouts).toBe(0);
    expect(s.stats.wins).toBe(3);
    expect(s.stats.streak).toBe(0);
  });

  it('export codes round-trip and reject typos and edits', () => {
    const s = settle(placeBet(newSave(), WAGER), 'win');
    const code = exportCode(s);
    expect(code.startsWith('GCW1.')).toBe(true);
    expect(importCode(code)).toEqual(s);
    expect(importCode(` ${code} `)).toEqual(s);
    expect(importCode(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a'))).toBeNull();
    expect(importCode('GCW1.AAAA.zzz')).toBeNull();
    expect(importCode('hello')).toBeNull();
    expect(importCode(null)).toBeNull();
    expect(checksum('x')).not.toBe(checksum('y'));
  });
});
