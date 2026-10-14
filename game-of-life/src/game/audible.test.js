import { describe, it, expect } from 'vitest';
import { FREE_BUILDS } from '../engine/library.js';
import { COUNTERS } from '../engine/counters.js';
import { BOT_AUDIBLE_CHANCE } from '../engine/constants.js';
import { createRng } from '../engine/rng.js';
import { botAnswers, counterFor } from './audible.js';

describe('audible', () => {
  it('has simulated counters for every formation, all of them real, none the formation itself', () => {
    const ids = new Set(FREE_BUILDS.map((b) => b.id));
    for (const b of FREE_BUILDS) {
      const list = COUNTERS[b.id];
      expect(list, b.id).toBeDefined();
      expect(list.length, b.id).toBeGreaterThanOrEqual(1);
      for (const c of list) { expect(ids.has(c), `${b.id} -> ${c}`).toBe(true); expect(c).not.toBe(b.id); }
    }
  });

  it('the bot picks one of the listed counters', () => {
    const rng = createRng(3);
    for (const b of FREE_BUILDS) {
      const pick = counterFor(b.id, FREE_BUILDS, rng);
      expect(COUNTERS[b.id]).toContain(pick.id);
    }
  });

  it('falls back to some other formation if nothing is listed', () => {
    const pick = counterFor('no-such-build', FREE_BUILDS, createRng(1));
    expect(FREE_BUILDS.map((b) => b.id)).toContain(pick.id);
  });

  it('the bot answers about as often as the audible chance says', () => {
    const rng = createRng(11);
    let yes = 0;
    for (let i = 0; i < 4000; i++) if (botAnswers(rng)) yes++;
    expect(yes / 4000).toBeGreaterThan(BOT_AUDIBLE_CHANCE - 0.04);
    expect(yes / 4000).toBeLessThan(BOT_AUDIBLE_CHANCE + 0.04);
    expect(botAnswers(() => 0.99, 1)).toBe(true); // The Scout always answers (chance 1)
    expect(botAnswers(() => 0, 0)).toBe(false);
  });
});
