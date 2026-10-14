import { describe, it, expect } from 'vitest';
import {
  fgChance, fgDistance, inFgRange, FG_SPOT,
  OFFENCES, DEFENCES, DRIVE, receiversOf, resolvePlay, newDrive, advance, chooseDefence, callClass, COUNTER, defenceById,
} from './football.js';
import { createRng } from './rng.js';

describe('football drive', () => {
  it('has offences with receivers and defences with coverage', () => {
    expect(OFFENCES.length).toBe(8);
    expect(DEFENCES.length).toBe(8);
    for (const o of OFFENCES) expect(receiversOf(o).length).toBeGreaterThan(1);
    for (const l of Object.values(COUNTER)) for (const id of l) expect(defenceById(id)).toBeTruthy();
  });

  it('a play is deterministic for a given rng and returns yards and a note', () => {
    const call = { off: OFFENCES[0].id, kind: 'pass', target: 1, depth: 'mid' };
    const a = resolvePlay(call, DEFENCES[0], createRng(5));
    const b = resolvePlay(call, DEFENCES[0], createRng(5));
    expect(b).toEqual(a);
    expect(['complete', 'incomplete', 'sack', 'int']).toContain(a.kind);
    expect(typeof a.note).toBe('string');
  });

  it('records frames when asked, for the animation', () => {
    const out = resolvePlay({ off: OFFENCES[0].id, kind: 'run', lane: 1 }, DEFENCES[0], createRng(1), undefined, true);
    expect(out.frames.length).toBeGreaterThan(10);
    const pass = resolvePlay({ off: OFFENCES[0].id, kind: 'pass', target: 1, depth: 'short' }, DEFENCES[0], () => 0.99, undefined, true);
    expect(pass.frames === null || pass.frames.length > 5 || pass.kind === 'sack').toBe(true);
  });

  it('the defence decides coverage: deep throws beat a 4-3 more often than they beat prevent', () => {
    const rate = (defId) => {
      let c = 0; let n = 0;
      const rng = createRng(11);
      for (const o of OFFENCES) for (let t = 0; t < receiversOf(o).length; t++) for (let k = 0; k < 2; k++) {
        const r = resolvePlay({ off: o.id, kind: 'pass', target: t, depth: 'deep' }, defenceById(defId), rng);
        n++; if (r.kind === 'complete') c++;
      }
      return c / n;
    };
    expect(rate('fb-4-3-over')).toBeGreaterThan(rate('fb-prevent'));
  });

  describe('the drive', () => {
    it('starts at the 30, 1st and 20 (a first down is 20 yards)', () => {
      const s = newDrive();
      expect([s.down, s.toGo, s.spot]).toEqual([1, DRIVE.firstDown, DRIVE.startSpot]);
    });
    it('a first down resets the downs; a short gain moves to the next down', () => {
      const s = advance(newDrive(), { kind: 'run', yards: 3, note: '' });
      expect([s.down, s.toGo, s.spot]).toEqual([2, DRIVE.firstDown - 3, DRIVE.startSpot + 3]);
      const t = advance(s, { kind: 'complete', yards: DRIVE.firstDown, note: '' });
      expect([t.down, t.toGo]).toEqual([1, DRIVE.firstDown]);
    });
    it('ends on a touchdown, an interception or turnover on downs', () => {
      expect(advance({ ...newDrive(), spot: 90 }, { kind: 'complete', yards: 15, note: '' }).over).toBe('td');
      expect(advance(newDrive(), { kind: 'int', yards: 0, note: '' }).over).toBe('int');
      let s = newDrive();
      for (let i = 0; i < 4; i++) s = advance(s, { kind: 'incomplete', yards: 0, note: '' });
      expect(s.over).toBe('downs');
    });
    it('a sack loses yards but never goes behind your own goal line', () => {
      const s = advance({ ...newDrive(), spot: 2 }, { kind: 'sack', yards: -8, note: '' });
      expect(s.spot).toBe(0);
    });
  });

  describe('field goals', () => {
    it('are in range from their 38 and longer kicks are harder', () => {
      expect(inFgRange(FG_SPOT)).toBe(true);
      expect(inFgRange(FG_SPOT - 1)).toBe(false);
      expect(fgDistance(90)).toBe(27);
      expect(fgChance(95)).toBeGreaterThan(fgChance(FG_SPOT));
      expect(fgChance(FG_SPOT)).toBeGreaterThan(0.3);
    });
    it('a kick ends the drive: good or missed', () => {
      expect(advance(newDrive(), { kind: 'kick', made: true, yards: 0 }).over).toBe('fg');
      expect(advance(newDrive(), { kind: 'kick', made: false, yards: 0 }).over).toBe('miss');
    });
  });

  describe('the bot defence', () => {
    it('guesses at the start of a drive, and answers a repeated call more and more often', () => {
      const deepCall = { off: OFFENCES[0].id, kind: 'pass', target: 0, depth: 'deep' };
      const counters = new Set(COUNTER.deep);
      const hits = (calls) => { let h = 0; for (let i = 0; i < 400; i++) if (counters.has(chooseDefence(createRng(i), calls, 0.8).id)) h++; return h / 400; };
      expect(hits([])).toBeLessThan(0.5);
      expect(hits([deepCall, deepCall, deepCall, deepCall])).toBeGreaterThan(0.5);
      expect(callClass(deepCall)).toBe('deep');
    });
  });
});
