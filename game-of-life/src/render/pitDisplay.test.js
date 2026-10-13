import { describe, it, expect } from 'vitest';
import { createPitDisplay, pitLead, landsAt, TRAVEL_MS, STAGGER_MS } from './pitDisplay.js';

const spill = (born, spilled, landings) => ({ born, crash: { spilled, landings }, landed: false });

describe('pit display', () => {
  it('chips are not in the pit until their trip down the gutter has finished', () => {
    const d = createPitDisplay(10);
    const sp = spill(1000, 3, [[1, 5, 1], [1, 6, 5], [2, 7, 1]]);
    expect(d.update([sp], 1000 + TRAVEL_MS - 1)).toBe(0);      // still running down the pipes
    expect(d.blue[5] + d.blue[6] + d.red[7]).toBe(0);
    expect(d.update([sp], landsAt(sp))).toBe(1);               // arrived: they land on their tiles
    expect([d.blue[5], d.blue[6], d.red[7]]).toEqual([1, 5, 1]);
  });

  it('a spill lands once, however often it is checked', () => {
    const d = createPitDisplay(10);
    const sp = spill(0, 1, [[1, 0, 2]]);
    d.update([sp], 99999);
    d.update([sp], 100000);
    expect(d.blue[0]).toBe(2);
  });

  it('later chips of a spill make it land later', () => {
    expect(landsAt(spill(0, 1, []))).toBe(TRAVEL_MS);
    expect(landsAt(spill(0, 6, []))).toBe(TRAVEL_MS + 5 * STAGGER_MS);
    expect(landsAt(spill(0, 40, []))).toBe(TRAVEL_MS + 5 * STAGGER_MS); // at most six animate
  });

  it('force lands everything still in transit (end of match)', () => {
    const d = createPitDisplay(10);
    const sps = [spill(5000, 2, [[2, 9, 1]]), spill(6000, 2, [[1, 9, 5]])];
    expect(d.update(sps, 0)).toBe(0);
    expect(d.update(sps, 0, true)).toBe(2);
    expect([d.blue[9], d.red[9]]).toEqual([5, 1]);
  });

  it('pitLead counts tiles by who has more chips, ties belong to nobody', () => {
    const d = createPitDisplay(10);
    d.blue[0] = 3; d.red[0] = 1;
    d.red[1] = 2;
    d.blue[2] = 2; d.red[2] = 2;
    expect(pitLead(d.blue, d.red)).toEqual({ blue: 1, red: 1 });
    d.reset();
    expect(pitLead(d.blue, d.red)).toEqual({ blue: 0, red: 0 });
  });
});
