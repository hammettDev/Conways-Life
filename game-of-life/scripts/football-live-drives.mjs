// How does a simple auto-player fare in live drives?   node scripts/football-live-drives.mjs [drives=40] [policy=deep|short|mix]
// Policy picks a receiver (deep: the widest, short: the narrowest, mix: random), fires when the aim window opens.
import { createLivePlay, LIVE_OFFENCES } from '../src/engine/footballLive.js';
import { DEFENCES, newDrive, advance } from '../src/engine/football.js';
import { drivePoints, teamDefence, TEAMS } from '../src/game/season.js';
import { defenceById } from '../src/engine/football.js';
import { createRng } from '../src/engine/rng.js';

const N = Number(process.argv[2] || 40);
const policy = process.argv[3] || 'mix';
const team = TEAMS[Number(process.argv[4] || 3)]; // the opponent: scouts repeated calls like in the season
const rng = createRng(17);
const pick = (a) => a[Math.floor(rng() * a.length)];
const stats = { td: 0, fg: 0, none: 0, plays: 0, yards: 0, kinds: {} };
for (let n = 0; n < N; n++) {
  let s = newDrive(); const classes = [];
  while (!s.over) {
    const off = pick(LIVE_OFFENCES); const def = defenceById(teamDefence(rng, team, classes));
    const run = policy === 'altmix' ? rng() < 0.25 : rng() < 0.2;
    const play = createLivePlay({ off, def, kind: run ? 'run' : 'pass', lane: Math.floor(rng() * 5), rng });
    play.start();
    let fired = false; let target = null;
    for (let i = 0; i < 200 && play.phase !== 'done'; i++) {
      if (!run && !fired) {
        const alive = play.receivers.filter((r) => r.alive);
        if (target === null && alive.length) {
          const sorted = alive.slice().sort((a, b) => Math.abs(b.y - play.qb.y) - Math.abs(a.y - play.qb.y));
          target = policy === 'deep' ? sorted[0].i : policy === 'short' ? sorted[sorted.length - 1].i : policy === 'altmix' ? (rng() < 0.5 ? sorted[0].i : sorted[sorted.length - 1].i) : pick(alive).i;
        }
        if (target !== null) { const a = play.aim(target); if (a.wait !== null && a.wait <= 3 && a.wait >= -5) fired = play.throwTo(target); }
      }
      play.step();
    }
    const r = play.result || { kind: 'incomplete', yards: 0, note: '' };
    stats.kinds[r.kind] = (stats.kinds[r.kind] || 0) + 1; stats.plays++; stats.yards += r.yards;
    classes.push(r.kind === 'run' ? 'run' : r.yards > 14 ? 'deep' : r.yards > 7 ? 'mid' : 'short');
    s = advance(s, r);
  }
  const pts = drivePoints(s); if (pts === 7) stats.td++; else if (pts === 3) stats.fg++; else stats.none++;
}
console.log(policy, `drives ${N}`, `TD ${stats.td} FG ${stats.fg} none ${stats.none}`, `plays/drive ${(stats.plays / N).toFixed(1)}`, `yds/play ${(stats.yards / stats.plays).toFixed(1)}`, JSON.stringify(stats.kinds));
