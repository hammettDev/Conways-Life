// How does the bot offence fare against a human-ish defence?   node scripts/football-bot-sim.mjs [drives=20]
// 'random' picks any defence each play; 'smart' picks the defence whose strongest-against class matches the play it expects (its style).
import { createLivePlay } from '../src/engine/footballLive.js';
import { DEFENCES, defenceById, newDrive, advance } from '../src/engine/football.js';
import { botCall, botDriver } from '../src/game/botOffence.js';
import { TEAMS, LIVE_DEF, yardsAgainst, drivePoints } from '../src/game/season.js';
import { inFgRange, fgChance } from '../src/engine/football.js';
import { createRng } from '../src/engine/rng.js';

const N = Number(process.argv[2] || 20);
for (const team of [TEAMS[0], TEAMS[2], TEAMS[5]]) {
  for (const mode of ['random', 'smart']) {
    const rng = createRng(11);
    let pts = 0; let plays = 0; const kinds = {};
    for (let n = 0; n < N; n++) {
      let s = newDrive();
      while (!s.over) {
        const call = botCall(rng, team);
        const def = mode === 'random' ? DEFENCES[Math.floor(rng() * DEFENCES.length)]
          : defenceById(Object.keys(LIVE_DEF).sort((a, b) => yardsAgainst(a, team.style) - yardsAgainst(b, team.style))[0]);
        const play = createLivePlay({ off: call.off, def, kind: call.kind, lane: call.lane, rng });
        const drive = botDriver(play, team, rng);
        play.start();
        for (let i = 0; i < 220 && play.phase !== 'done'; i++) { drive(); play.step(); }
        const r = play.result || { kind: 'incomplete', yards: 0 };
        kinds[r.kind] = (kinds[r.kind] || 0) + 1; plays++;
        s = advance(s, r);
        if (!s.over && s.down === 4 && inFgRange(s.spot)) s = advance(s, { kind: 'kick', made: rng() < fgChance(s.spot), yards: 0 });
      }
      pts += drivePoints(s);
    }
    console.log(team.name.padEnd(17), `L${team.level} ${team.style}`.padEnd(9), mode.padEnd(7), `pts/drive ${(pts / N).toFixed(2)}`, `plays/drive ${(plays / N).toFixed(1)}`, JSON.stringify(kinds));
  }
}
