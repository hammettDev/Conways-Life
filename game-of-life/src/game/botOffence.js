// The bot's offence for the plays you defend. It calls a formation and a pass or run, and on a pass it picks a receiver
// and fires the glider; a better team picks a clearer lane and times it better.
import { LIVE_OFFENCES, RUN_PLAYS } from '../engine/footballLive.js';
import { COLS, ROWS } from '../engine/constants.js';

const RUN_SHARE = { run: 0.6, short: 0.2, mid: 0.25, deep: 0.2 };

export function botCall(rng, team) {
  const off = LIVE_OFFENCES[Math.floor(rng() * LIVE_OFFENCES.length)];
  const run = rng() < (RUN_SHARE[team.style] ?? 0.25);
  return { off, kind: run ? 'run' : 'pass', lane: Math.floor(rng() * RUN_PLAYS.length) };
}

// How clear is the glider's path to receiver r? The smallest gap between the path and any coverage cell.
function clearance(play, r, cover) {
  const qx = play.qb.x + 2; const qy = play.qb.y;
  const d = Math.abs(r.y - qy); const dir = r.y < qy ? -1 : 1;
  let best = 99;
  for (let k = 0; k <= d; k++) {
    const px = Math.round(qx + k); const py = Math.round(qy + dir * k);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = px + dx; const y = py + dy;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS && cover[y * COLS + x] === 2) best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dy)));
    }
  }
  return best;
}

// Returns a function to call once before every tick of the play: it throws when its mind is made up.
export function botDriver(play, team, rng) {
  if (play.kind !== 'pass') return () => {};
  const level = team.level;
  const slop = [4, 2, 0][level];            // ticks of timing error
  let target = null;
  return () => {
    if (play.phase !== 'live' || play.throwTick !== null) return;
    if (target === null && play.tick >= 2) {
      const cover = play.grids().W;
      const cands = play.receivers.filter((r) => r.alive && play.aim(r.i).ok && play.aim(r.i).wait !== null);
      if (cands.length) {
        if (level === 0) target = cands[Math.floor(rng() * cands.length)].i;
        else {
          const ranked = cands.map((r) => ({ i: r.i, c: clearance(play, r, cover), d: Math.abs(r.y - play.qb.y) })).sort((a, b) => b.c - a.c || a.d - b.d);
          target = (level === 1 && ranked.length > 1 && rng() < 0.35 ? ranked[1] : ranked[0]).i;
        }
      }
    }
    if (target !== null) {
      const a = play.aim(target);
      if (!a.ok || a.wait === null) { target = null; return; }
      if (a.wait <= (rng() * slop - slop / 2) + 0.5) play.throwTo(target);
    }
  };
}
