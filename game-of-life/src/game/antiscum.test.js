import { describe, it, expect } from 'vitest';
import {
  newSave, matchSeed, placeBet, setPending, clearPending, forfeit, noteFormation,
} from './wallet.js';
import {
  exportCode, importCode, acceptImport, loadMaxRev, persistSave, loadSave,
} from './saveStore.js';
import { packMatch, resolvePending } from './pending.js';
import { createEngine } from '../engine/engine.js';
import { DEFAULT_FORTUNE_RULES } from '../engine/fortuneRules.js';
import { placeFormation, pickBotSetup } from '../engine/formations.js';
import { FREE_BUILDS } from '../engine/library.js';
import { createRng } from '../engine/rng.js';
import { BLUE, RED, WAGER } from '../engine/constants.js';

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

const lockedSave = (seed = 4242) => {
  const bot = pickBotSetup(createRng(seed), FREE_BUILDS);
  const mine = placeFormation(FREE_BUILDS[0], BLUE);
  const held = placeBet({ ...newSave(), sid: 99 }, WAGER);
  return { held, mine, bot, save: setPending(held, packMatch(seed, WAGER, null, mine, bot.cells)), seed };
};

describe('opponents cannot be rerolled', () => {
  it('the seed is fixed by the save and its match count', () => {
    const s = { ...newSave(), sid: 7 };
    expect(matchSeed(s)).toBe(matchSeed({ ...s }));
    expect(matchSeed({ ...s, stats: { ...s.stats, played: 1 } })).not.toBe(matchSeed(s));
    expect(matchSeed({ ...s, sid: 8 })).not.toBe(matchSeed(s));
    expect(matchSeed(s, 1)).not.toBe(matchSeed(s, 0));
  });
  it('cancelling forfeits the re-pick fee, never more than you hold', () => {
    expect(forfeit({ ...newSave(), balance: 200 }, 50).balance).toBe(150);
    expect(forfeit({ ...newSave(), balance: 20 }, 50).balance).toBe(0);
  });
});

describe('a match left running settles itself', () => {
  it('replays to the same outcome as playing it, and pays out once', () => {
    const { save, mine, bot, seed } = lockedSave();
    const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
    e.loadTeams([...mine, ...bot.cells]);
    const played = e.runToEnd();
    const r = resolvePending(save);
    expect(r.outcome).toBe(played.outcome);
    expect(r.save.pending).toBeNull();
    expect(r.save.rev).toBe(save.rev + 1);
    const expected = { win: 300 - WAGER + 2 * WAGER, push: 300, lose: 300 - WAGER }[played.outcome];
    expect(r.save.balance).toBe(expected);
    expect(r.save.stats.played).toBe(1);
    expect(resolvePending(r.save)).toBeNull(); // nothing left to settle
  });
  it('survives the export code and is dropped when malformed', () => {
    const { save } = lockedSave();
    expect(importCode(exportCode(save)).pending).toEqual(save.pending);
    const bad = { ...save, pending: { seed: 'x', wager: 100, blue: [[1, 1]], red: [[2, 2]] } };
    expect(importCode(exportCode(bad)).pending).toBeNull();
    const wild = { ...save, pending: { ...save.pending, blue: [[9999, 3], ...save.pending.blue] } };
    expect(importCode(exportCode(wild)).pending.blue).toHaveLength(save.pending.blue.length);
  });
});

describe('an older save code cannot roll progress back', () => {
  it('loads only codes newer than anything seen on this device', () => {
    const store = fakeStorage();
    const oldCode = importCode(exportCode({ ...newSave(), rev: 10 }));
    persistSave({ ...newSave(), rev: 10 }, store);
    persistSave({ ...newSave(), rev: 15, balance: 50 }, store); // played on, lost a bet
    const now = loadSave(store);
    expect(loadMaxRev(store)).toBe(15);
    expect(acceptImport(oldCode, now, loadMaxRev(store))).toBe(false); // the revert is refused
    const newer = importCode(exportCode({ ...newSave(), rev: 16, balance: 900 }));
    expect(acceptImport(newer, now, loadMaxRev(store))).toBe(true);
  });
  it('a fresh device accepts any real code', () => {
    const fresh = fakeStorage();
    const code = importCode(exportCode({ ...newSave(), rev: 40 }));
    expect(acceptImport(code, loadSave(fresh), loadMaxRev(fresh))).toBe(true);
  });
});
