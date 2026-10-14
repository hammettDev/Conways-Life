import { describe, it, expect } from 'vitest';
import { stepFor, STEPS, ORDER } from './tutorial.js';
import { newPlayerSave, finishTutorial, placeBet, settle } from './wallet.js';
import { importCode, exportCode } from './saveStore.js';
import { TUTORIAL_STAKE, STARTING_WALLET } from '../engine/constants.js';

describe('tutorial', () => {
  it('every step has copy and either a wait or a next', () => {
    for (const k of ORDER) {
      expect(STEPS[k].text.length).toBeGreaterThan(20);
      expect(Boolean(STEPS[k].next) !== Boolean(STEPS[k].wait)).toBe(true);
    }
  });
  it('advances with the match', () => {
    expect(stepFor('pick', { phase: 'draft', hasSelection: false })).toBe('pick');
    expect(stepFor('pick', { phase: 'draft', hasSelection: true })).toBe('rules');
    expect(stepFor('lock', { phase: 'locked', hasSelection: true })).toBe('snap');
    expect(stepFor('snap', { phase: 'playing', hasSelection: true })).toBe('watch');
    expect(stepFor('watch', { phase: 'done', hasSelection: true })).toBe('wrap');
  });
  it('the insured first bet lands exactly on the starting wallet', () => {
    const held = placeBet(newPlayerSave(), TUTORIAL_STAKE);
    const won = settle(held, 'win', TUTORIAL_STAKE);
    expect(won.balance).toBe(STARTING_WALLET);
    expect(finishTutorial(won).tutorialDone).toBe(true);
    expect(finishTutorial(newPlayerSave()).balance).toBe(STARTING_WALLET); // skipping
  });
  it('the flag survives an export code and old saves count as done', () => {
    expect(importCode(exportCode(newPlayerSave())).tutorialDone).toBe(false);
    const old = { v: 1, balance: 400, bailouts: 0, stats: { played: 3, wins: 2, losses: 1, pushes: 0, streak: 0, bestStreak: 1 } };
    expect(importCode(exportCode(old)).tutorialDone).toBe(true);
  });
});
