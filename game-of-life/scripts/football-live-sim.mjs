// Does the live physics work?   node scripts/football-live-sim.mjs
// An auto-player snaps, waits for the aim window to open on one receiver, throws, and we count what happens.
import { createLivePlay, LIVE_OFFENCES } from '../src/engine/footballLive.js';
import { DEFENCES } from '../src/engine/football.js';
import { createRng } from '../src/engine/rng.js';

const rng = createRng(3);
const tally = {};
for (const def of DEFENCES) {
  const row = {};
  for (const off of LIVE_OFFENCES) for (let t = 0; t < off.receivers.length; t++) {
    const play = createLivePlay({ off, def, kind: 'pass', rng });
    play.start();
    let fired = false;
    for (let i = 0; i < 160 && play.phase !== 'done'; i++) {
      if (!fired) { const a = play.aim(t); if (a.ok && a.wait <= 0.5) { fired = play.throwTo(t); } else if (!a.ok && i > 2) { /* window gone */ } }
      play.step();
    }
    const k = play.result ? play.result.kind : 'none';
    row[k] = (row[k] || 0) + 1;
    row[fired ? 'fired' : 'nofire'] = (row[fired ? 'fired' : 'nofire'] || 0) + 1;
  }
  console.log(def.id.padEnd(14), JSON.stringify(row));
}
