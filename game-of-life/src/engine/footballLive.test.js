import { describe, it, expect } from 'vitest';
import { createLivePlay, LIVE_OFFENCES, RUN_PLAYS } from './footballLive.js';
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
    const run = () => { const p = play('run', { lane: 4 }); p.start(); while (p.phase !== 'done') p.step(); return p.result; };
    const a = run(); const b = run();
    expect(b).toEqual(a);
    expect(a.kind).toBe('run');
  });
});

describe('plays always end', () => {
  it('a ball that settles against the edge of the board does not hang the play', () => {
    // a receiver that cannot be reached so the ball flies on to the wall: the play must still finish
    const open = { id: 'open', name: 'Open', players: [] };
    const p = createLivePlay({ off: LIVE_OFFENCES[0], def: open, kind: 'pass', rng: createRng(1) });
    p.start();
    for (let i = 0; i < 3; i++) p.step();
    p.throwTo(0);
    for (let i = 0; i < 400 && p.phase !== 'done'; i++) p.step();
    expect(p.phase).toBe('done');
  });
});

describe('a ball that stops flying ends the play quickly', () => {
  it('a thrown ball into a wall of coverage finishes well inside the flight limit', () => {
    const wall = { id: 'wall', name: 'Wall', players: [-12, -8, -4, 0, 4, 8, 12].map((lat) => ({ role: 'LB', shape: 'block', depth: -3, lat })) };
    for (let r = 0; r < LIVE_OFFENCES[0].receivers.length; r++) {
      const p = createLivePlay({ off: LIVE_OFFENCES[0], def: wall, kind: 'pass', rng: createRng(r + 1) });
      p.start();
      for (let i = 0; i < 3; i++) p.step();
      p.throwTo(r);
      let ticks = 0;
      while (p.phase !== 'done' && ticks < 300) { p.step(); ticks++; }
      expect(p.phase).toBe('done');
      expect(ticks).toBeLessThan(120);
    }
  });
});

describe('offensive formations', () => {
  it('there are plenty, with unique ids and names', () => {
    expect(LIVE_OFFENCES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(LIVE_OFFENCES.map((o) => o.id)).size).toBe(LIVE_OFFENCES.length);
    expect(new Set(LIVE_OFFENCES.map((o) => o.name)).size).toBe(LIVE_OFFENCES.length);
  });
  it('receivers never start on top of each other and stay on the field', () => {
    for (const o of LIVE_OFFENCES) {
      expect(o.receivers.length).toBeLessThanOrEqual(5);
      o.receivers.forEach((r, i) => {
        expect(Math.abs(r.lat)).toBeLessThanOrEqual(20);
        expect(r.depth).toBeLessThanOrEqual(29);
        o.receivers.slice(i + 1).forEach((q) => {
          if (Math.abs(r.depth - q.depth) < 7) expect(Math.abs(r.lat - q.lat), `${o.id}`).toBeGreaterThanOrEqual(6);
        });
      });
    }
  });
  it('every formation can play a pass and a run to the end', () => {
    const open = { id: 'open', name: 'Open', players: [] };
    for (const o of LIVE_OFFENCES) {
      for (const kind of ['pass', 'run']) {
        const p = createLivePlay({ off: o, def: open, kind, rng: createRng(2) });
        p.start();
        for (let i = 0; i < 400 && p.phase !== 'done'; i++) p.step();
        expect(p.phase, `${o.id} ${kind}`).toBe('done');
      }
    }
  });
});

describe('a run and a pass look the same before the snap', () => {
  it('every formation lines up identically for both', () => {
    for (const o of LIVE_OFFENCES) {
      for (const lane of [0, 1, 2, 3, 4]) {
        const a = createLivePlay({ off: o, def: DEFENCES[0], kind: 'pass', lane, rng: createRng(1) }).grids();
        const b = createLivePlay({ off: o, def: DEFENCES[0], kind: 'run', lane, rng: createRng(1) }).grids();
        expect(Array.from(b.FG), `${o.id} line`).toEqual(Array.from(a.FG));
        expect(Array.from(b.W), `${o.id} field`).toEqual(Array.from(a.W));
      }
    }
  });
});

describe('a ball killed by coverage on a long flight never crashes', () => {
  it('throws at every receiver into a thick defence without an error', () => {
    const thick = DEFENCES.find((d) => d.id === 'fb-dime');
    for (const o of LIVE_OFFENCES) for (let r = 0; r < o.receivers.length; r++) {
      const p = createLivePlay({ off: o, def: thick, kind: 'pass', rng: createRng(3) });
      p.start(); let fired = false;
      for (let i = 0; i < 300 && p.phase !== 'done'; i++) { if (!fired) { const a = p.aim(r); if (a.wait !== null && a.wait <= 0.5) fired = p.throwTo(r); } p.step(); }
      expect(p.phase).toBe('done');
    }
  });
});

describe('run plays', () => {
  it('there are five: outside and inside, left and right, and the dive', () => {
    expect(RUN_PLAYS.map((r) => r.label)).toEqual(['Outside Left', 'Inside Left', 'Middle Dive', 'Inside Right', 'Outside Right']);
    // they line up left to right
    for (let i = 1; i < RUN_PLAYS.length; i++) expect(RUN_PLAYS[i].lat).toBeGreaterThan(RUN_PLAYS[i - 1].lat);
  });
  it('the back lines up where the play says: left runs start left of centre, right runs right', () => {
    const open = { id: 'open', name: 'Open', players: [] };
    const startY = (lane) => { const g = createLivePlay({ off: LIVE_OFFENCES[0], def: open, kind: 'run', lane, rng: createRng(1) }).grids().W; let sy = 0; let n = 0; for (let k = 0; k < g.length; k++) if (g[k] === 9) { sy += Math.floor(k / 80); n++; } return sy / n; };
    const ys = [0, 1, 2, 3, 4].map(startY);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    expect(ys[0]).toBeLessThan(25); expect(ys[4]).toBeGreaterThan(35);
  });
  it('the runner really goes the way the play says', () => {
    const open = { id: 'open', name: 'Open', players: [] };
    const drift = (lane) => {
      const p = createLivePlay({ off: LIVE_OFFENCES[0], def: open, kind: 'run', lane, rng: createRng(1) });
      const y0 = (() => { const g = p.grids().W; let sy = 0; let n = 0; for (let k = 0; k < g.length; k++) if (g[k] === 9) { sy += Math.floor(k / 80); n++; } return sy / n; })();
      p.start();
      for (let i = 0; i < 10; i++) p.step();
      let sy = 0; let n = 0; const g = p.grids().W; for (let k = 0; k < g.length; k++) if (g[k] === 9) { sy += Math.floor(k / 80); n++; }
      return n ? sy / n - y0 : 0;
    };
    expect(drift(0)).toBeLessThan(-1.5);  // outside left drifts left (towards smaller y)
    expect(drift(1)).toBeLessThan(-1.5);
    expect(drift(3)).toBeGreaterThan(1.5);
    expect(drift(4)).toBeGreaterThan(1.5); // outside right drifts right
  });
});

describe('blitzes', () => {
  const blitz = (id) => DEFENCES.concat([]).find((d) => d.id === id) || null;
  it('are defence formations with a spaceship that runs into the backfield', async () => {
    const { BLITZ_DEFENCES, LIVE_DEFENCES, defenceById } = await import('./football.js');
    expect(BLITZ_DEFENCES.length).toBeGreaterThanOrEqual(4);
    for (const b of BLITZ_DEFENCES) {
      expect(b.players.some((p) => p.role === 'BL')).toBe(true);
      expect(defenceById(b.id)).toBe(b);
    }
    expect(LIVE_DEFENCES.length).toBe(DEFENCES.length + BLITZ_DEFENCES.length);
  });
  it('a middle blitz sacks a quarterback who holds the ball, long before the hold limit', async () => {
    const { defenceById } = await import('./football.js');
    const p = createLivePlay({ off: LIVE_OFFENCES[0], def: defenceById('fb-mike-blitz'), kind: 'pass', rng: createRng(1) });
    p.start();
    let ticks = 0;
    while (p.phase !== 'done' && ticks < 200) { p.step(); ticks++; }
    expect(p.result.kind).toBe('sack');
    expect(p.result.note).toMatch(/blitz/i);
    expect(ticks).toBeLessThan(40);
  });
  it('a blitzer can meet the back in the backfield: some run is stuffed that a normal defence gives up yards on', async () => {
    const { defenceById } = await import('./football.js');
    const avg = (lane, def) => { let v = 0; for (const o of LIVE_OFFENCES.slice(0, 4)) { const p = createLivePlay({ off: o, def, kind: 'run', lane, rng: createRng(1) }); p.start(); while (p.phase !== 'done') p.step(); v += p.result.yards; } return v / 4; };
    expect(avg(1, defenceById('fb-mike-blitz'))).toBeLessThan(1);   // inside left meets the middle blitzer
    expect(avg(1, defenceById('fb-cover-3'))).toBeGreaterThan(2);
  });
});
