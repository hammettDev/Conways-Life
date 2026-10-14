// What does each defence actually do against the bot, in the live physics?   node scripts/football-def-matrix.mjs [plays=30]
import { createLivePlay, LIVE_OFFENCES } from '../src/engine/footballLive.js';
import { DEFENCES } from '../src/engine/football.js';
import { botDriver } from '../src/game/botOffence.js';
import { TEAMS } from '../src/game/season.js';
import { createRng } from '../src/engine/rng.js';
const N = Number(process.argv[2] || 30);
const team = TEAMS[5];
console.log('defence'.padEnd(14), 'run yds', 'pass yds/att', 'comp%', 'int%', 'sack%');
for (const def of DEFENCES) {
  const rng = createRng(4);
  let ry = 0; let py = 0; let c = 0; let i = 0; let s = 0;
  for (let n = 0; n < N; n++) {
    const off = LIVE_OFFENCES[n % LIVE_OFFENCES.length];
    const rp = createLivePlay({ off, def, kind: 'run', lane: [-12, 0, 12][n % 3], rng }); rp.start(); while (rp.phase !== 'done') rp.step(); ry += rp.result.yards;
    const pp = createLivePlay({ off, def, kind: 'pass', rng }); const d = botDriver(pp, team, rng); pp.start();
    for (let k = 0; k < 220 && pp.phase !== 'done'; k++) { d(); pp.step(); }
    const r = pp.result || { kind: 'incomplete', yards: 0 };
    py += r.yards; if (r.kind === 'complete') c++; if (r.kind === 'int') i++; if (r.kind === 'sack') s++;
  }
  console.log(def.id.padEnd(14), (ry / N).toFixed(1).padStart(7), (py / N).toFixed(1).padStart(12), `${Math.round(100 * c / N)}`.padStart(5), `${Math.round(100 * i / N)}`.padStart(4), `${Math.round(100 * s / N)}`.padStart(5));
}
