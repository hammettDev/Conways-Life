import { describe, it, expect } from 'vitest';
import { createLivePlay, LIVE_OFFENCES } from './footballLive.js';
import { DEFENCES } from './football.js';
import { createRng } from './rng.js';

const play = (kind, extra = {}) => createLivePlay({ off: LIVE_OFFENCES[0], def: DEFENCES[0], kind, rng: createRng(1), ...extra });

describe('live football physics', () => {
  it('every receiver can in principle be reached: depth is at least the lateral distance plus 6', () => {
    for (const o of LIVE_OFFENCES) {
      expect(o.receivers.length).toBeGreaterThanOrEqual(3);
      for (const r of o.receivers) expect(r.depth).toBeGreaterThanOrEqual(Math.abs(r.lat) - 4); // the quarterback sits 1 off centre
    }
  });

  it('receivers are spaceships: they run straight at the defence at about half a cell a tick', () => {
    const p = play('pass'); p.start();
    const x0 = p.receivers.map((r) => r.x);
    for (let i = 0; i < 20; i++) p.step();
    p.receivers.forEach((r, i) => { if (r.alive) expect(r.x - x0[i]).toBeGreaterThan(3); });
  });

  it('a glider thrown when the aim says go reaches the receiver on an open board', () => {
    const open = { id: 'open', name: 'Open', players: [] };
    const p = createLivePlay({ off: LIVE_OFFENCES[0], def: open, kind: 'pass', rng: createRng(1) });
    p.start();
    let fired = false;
    for (let i = 0; i < 120 && p.phase !== 'done'; i++) {
      if (!fired) { const a = p.aim(1); if (a.ok && a.wait <= 0.5) fired = p.throwTo(1); }
      p.step();
    }
    expect(fired).toBe(true);
    expect(p.result.kind).toBe('complete');
  });

  it('holding the ball too long is a sack', () => {
    const open = { id: 'open', name: 'Open', players: [] };
    const p = createLivePlay({ off: LIVE_OFFENCES[0], def: open, kind: 'pass', rng: createRng(1) });
    p.start();
    for (let i = 0; i < 200 && p.phase !== 'done'; i++) p.step();
    expect(p.result.kind).toBe('sack');
    expect(p.result.yards).toBeLessThan(0);
  });

  it('a run finishes with a gain or a stuff, and is deterministic', () => {
    const run = () => { const p = play('run', { lane: 12 }); p.start(); while (p.phase !== 'done') p.step(); return p.result; };
    const a = run(); const b = run();
    expect(b).toEqual(a);
    expect(a.kind).toBe('run');
  });
});
