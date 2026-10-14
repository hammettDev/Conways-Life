// Balance the football drive.   node scripts/football-sim.mjs [drives=200]
// Policies: random calls vs a "smart" caller that knows the defence it faces (an upper bound).
import { OFFENCES, DEFENCES, DEPTHS, RUN_LANES, receiversOf, resolvePlay, newDrive, advance, chooseDefence, openAtSnap } from '../src/engine/football.js';
import { createRng } from '../src/engine/rng.js';

const N = Number(process.argv[2] || 200);
const SCOUT = Number(process.env.SCOUT ?? 0.8);
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const randomCall = (rng) => {
  const off = pick(rng, OFFENCES);
  if (rng() < 0.4) return { off: off.id, kind: 'run', lane: Math.floor(rng() * RUN_LANES.length) };
  const rs = receiversOf(off);
  return { off: off.id, kind: 'pass', target: Math.floor(rng() * rs.length), depth: pick(rng, DEPTHS) };
};
const allCalls = () => {
  const out = [];
  for (const o of OFFENCES) {
    RUN_LANES.forEach((_, lane) => out.push({ off: o.id, kind: 'run', lane }));
    receiversOf(o).forEach((_, target) => DEPTHS.forEach((depth) => out.push({ off: o.id, kind: 'pass', target, depth })));
  }
  return out;
};
const CALLS = allCalls();

function drive(policy, seed) {
  const rng = createRng(seed);
  let s = newDrive();
  const calls = [];
  while (!s.over) {
    const def = SCOUT >= 0 ? chooseDefence(rng, calls, SCOUT) : pick(rng, DEFENCES);
    const call = policy(rng, def, s);
    calls.push(call);
    s = advance(s, resolvePlay(call, def, rng));
  }
  return s;
}
// smart: sample candidate calls against the real defence and take the best expected yards
const smart = (rng, def) => {
  let best = null; let bv = -1e9;
  for (let i = 0; i < 14; i++) {
    const c = pick(rng, CALLS);
    const r = createRng(Math.floor(rng() * 1e9));
    let v = 0; for (let k = 0; k < 3; k++) { const o = resolvePlay(c, def, r); v += o.yards - (o.kind === 'int' ? 20 : 0); }
    if (v > bv) { bv = v; best = c; }
  }
  return best;
};

// blind: the single best call on average over all defences (what a player settles on without scouting)
const avgRng = createRng(99);
const score = (c) => { let v = 0; let n = 0; for (const d of DEFENCES) for (let k = 0; k < 2; k++) { const o = resolvePlay(c, d, avgRng); v += o.yards - (o.kind === 'int' ? 20 : 0); n++; } return v / n; };
const ranked = CALLS.map((c) => [score(c), c]).sort((a, b) => b[0] - a[0]);
console.log('top blind calls:', ranked.slice(0, 4).map(([v, c]) => `${v.toFixed(1)} ${c.off} ${c.kind}${c.kind === 'pass' ? ' r' + c.target + ' ' + c.depth : ' l' + c.lane}`).join(' | '));
const blind = () => ranked[0][1];
const top = ranked.slice(0, 10).map((r) => r[1]);
const mix = (rng) => pick(rng, top);
// reader: knows each defence's weakest class (from the matrix below) but picks formation and receiver at random
const classYards = new Map();
{
  const cr = createRng(21);
  for (const d of DEFENCES) {
    const best = ['run', 'short', 'mid', 'deep'].map((k) => {
      let v = 0;
      for (let i = 0; i < 16; i++) {
        const off = pick(cr, OFFENCES); const rs = receiversOf(off);
        const c = k === 'run' ? { off: off.id, kind: 'run', lane: Math.floor(cr() * 3) } : { off: off.id, kind: 'pass', target: Math.floor(cr() * rs.length), depth: k };
        const o = resolvePlay(c, d, cr); v += o.yards - (o.kind === 'int' ? 8 : 0);
      }
      return [v, k];
    }).sort((a, b) => b[0] - a[0]);
    classYards.set(d.id, best.map((b) => b[1]));
  }
}
const reader = (rng, def, s) => {
  const order = classYards.get(def.id);
  const k = rng() < 0.7 ? order[0] : order[1];
  const off = pick(rng, OFFENCES);
  if (k === 'run') return { off: off.id, kind: 'run', lane: Math.floor(rng() * 3) };
  const rs = receiversOf(off);
  return { off: off.id, kind: 'pass', target: Math.floor(rng() * rs.length), depth: k };
};
// eyes: reads the screen like a person: of a few random calls, takes a pass whose catch circle is clear right now
const eyes = (rng, def) => {
  let fallback = null;
  for (let i = 0; i < 24; i++) {
    const c = pick(rng, CALLS);
    if (c.kind === 'pass' && openAtSnap(c, def)) return c;
    fallback = fallback || c;
  }
  return fallback;
};
const report = (name, policy, n) => {
  let td = 0; let plays = 0; const over = {}; let yards = 0;
  for (let i = 0; i < n; i++) { const s = drive(policy, 1000 + i); if (s.over === 'td') td++; plays += s.plays; over[s.over] = (over[s.over] || 0) + 1; yards += s.spot; }
  console.log(name.padEnd(8), `TD ${(100 * td / n).toFixed(0)}%`, `plays ${(plays / n).toFixed(1)}`, `avg spot ${(yards / n).toFixed(0)}`, JSON.stringify(over));
};
report('random', randomCall, N);
report('blind', blind, N);
report('mix', mix, N);
report('reader', reader, N);
report('eyes', eyes, N);
report('smart', smart, Math.max(30, Math.floor(N / 4)));

// per-defence view of pass vs run yardage, so the formations visibly matter
const rng = createRng(7);
console.log('\ndefence'.padEnd(16), 'run yds/play', 'pass comp%', 'pass yds/att');
for (const d of DEFENCES) {
  let ry = 0; let rn = 0; let pc = 0; let py = 0; let pn = 0;
  for (let i = 0; i < 60; i++) {
    const off = pick(rng, OFFENCES);
    const r = resolvePlay({ off: off.id, kind: 'run', lane: Math.floor(rng() * 3) }, d, rng); ry += r.yards; rn++;
    const rs = receiversOf(off);
    const p = resolvePlay({ off: off.id, kind: 'pass', target: Math.floor(rng() * rs.length), depth: pick(rng, DEPTHS) }, d, rng);
    pn++; py += p.yards; if (p.kind === 'complete') pc++;
  }
  console.log(d.id.padEnd(15), (ry / rn).toFixed(1).padStart(8), `${(100 * pc / pn).toFixed(0)}%`.padStart(10), (py / pn).toFixed(1).padStart(10));
}

// yards per play by defence and call type (feeds COUNTER in football.js)
console.log('\nyards/play by defence x call (30 samples each)');
console.log('defence'.padEnd(15), ['run', 'short', 'mid', 'deep'].map((x) => x.padStart(7)).join(''));
const mrng = createRng(5);
for (const d of DEFENCES) {
  const row = ['run', 'short', 'mid', 'deep'].map((k) => {
    let v = 0; let n = 0;
    for (let i = 0; i < 30; i++) {
      const off = pick(mrng, OFFENCES);
      const rs = receiversOf(off);
      const c = k === 'run' ? { off: off.id, kind: 'run', lane: Math.floor(mrng() * 3) } : { off: off.id, kind: 'pass', target: Math.floor(mrng() * rs.length), depth: k };
      const o = resolvePlay(c, d, mrng); v += o.yards - (o.kind === 'int' ? 8 : 0); n++;
    }
    return (v / n).toFixed(1).padStart(7);
  });
  console.log(d.id.padEnd(15), row.join(''));
}
