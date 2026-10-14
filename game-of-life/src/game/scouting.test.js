import { describe, it, expect } from 'vitest';
import { describeCall, depthWord, sideWord } from './scouting.js';
import { LIVE_OFFENCES } from '../engine/footballLive.js';

const off = LIVE_OFFENCES[1];
describe('scouting', () => {
  it('a run says which hole', () => {
    expect(describeCall({ off, kind: 'run', lane: 0 }, null)).toEqual({ formation: off.name, kind: 'run', label: 'Outside Left' });
    expect(describeCall({ off, kind: 'run', lane: 2 }, null).label).toBe('Middle Dive');
    expect(describeCall({ off, kind: 'run', lane: 4 }, null).label).toBe('Outside Right');
  });
  it('a pass says the side and the depth', () => {
    const play = { target: 1, qb: { y: 29 }, receivers: [{ y: 20 }, { y: 45 }] };
    expect(describeCall({ off, kind: 'pass' }, play)).toEqual({ formation: off.name, kind: 'pass', label: 'right, deep' });
    expect(describeCall({ off, kind: 'pass' }, { ...play, target: 0 }).label).toBe('left, medium');
    expect(describeCall({ off, kind: 'pass' }, { ...play, target: null }).label).toMatch(/no throw/);
  });
  it('words', () => {
    expect([depthWord(5), depthWord(12), depthWord(18)]).toEqual(['short', 'medium', 'deep']);
    expect([sideWord(-10), sideWord(1), sideWord(10)]).toEqual(['left', 'middle', 'right']);
  });
});
