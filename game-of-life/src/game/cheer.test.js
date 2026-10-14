import { describe, it, expect } from 'vitest';
import { createCheer, CHEER_GENS, PULSAR } from './cheer.js';

describe('the cheerleader routine', () => {
  it('a pulsar has the 48 cells of its first phase', () => { expect(PULSAR.length).toBe(48); });

  it('the squad stays in step: after a whole number of periods the pulsars are untouched by the show', () => {
    const c = createCheer('td');
    for (let i = 0; i < 30; i++) c.step();       // 30 is a multiple of 3: back to phase one
    expect(c.squadAlive()).toEqual([48, 48, 48]);
    for (let i = 0; i < 33; i++) c.step();       // and again at 63
    expect(c.squadAlive()).toEqual([48, 48, 48]);
  });

  it('the routine runs to its end with something still alive, for both a touchdown and a field goal', () => {
    for (const kind of ['td', 'fg']) {
      const c = createCheer(kind);
      for (let i = 0; i < CHEER_GENS[kind]; i++) c.step();
      expect(c.alive).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    const a = createCheer('td'); const b = createCheer('td');
    for (let i = 0; i < 40; i++) { a.step(); b.step(); }
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
  });
});
