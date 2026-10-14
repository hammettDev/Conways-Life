// The cheerleader routine: a short, choreographed piece of real Life that plays when somebody scores.
//   - three pulsars along the bottom are the squad (period-3 oscillators: they pulse in time)
//   - a pentadecathlon up top ripples (period 15)
//   - a fountain of gliders sprays out from the middle, up and away, like pom-poms
//   - blinker "sparklers" light up, and an R-pentomino goes off as the finale
// Nothing is faked: after the stamps it is ordinary Conway's Life, so the squad stays in step because they are
// oscillators and the sprays fly clear of them.
export const CHEER_W = 72;
export const CHEER_H = 44;

const rows = (...lines) => lines.flatMap((l, y) => [...l].map((c, x) => (c === 'O' ? [x, y] : null)).filter(Boolean));
export const PULSAR = rows(
  '..OOO...OOO..',
  '.............',
  'O....O.O....O',
  'O....O.O....O',
  'O....O.O....O',
  '..OOO...OOO..',
  '.............',
  '..OOO...OOO..',
  'O....O.O....O',
  'O....O.O....O',
  'O....O.O....O',
  '.............',
  '..OOO...OOO..',
);
export const PENTADECATHLON = rows('..O....O..', 'OO.OOOO.OO', '..O....O..');
export const GLIDER_UL = rows('OOO', 'O..', '.O.');   // flies up and to the left
export const GLIDER_UR = rows('OOO', '..O', '.O.');   // flies up and to the right
export const RPENT = rows('.OO', 'OO.', '.O.');

// the squad: where the pulsars stand (top-left corners)
export const SQUAD = [[5, 28], [29, 28], [53, 28]];
export const PENTA_AT = [[0, 9], [62, 9]]; // up in the corners, clear of the fountain

export function createCheer(kind = 'td') {
  const big = kind === 'td';
  let g = new Uint8Array(CHEER_W * CHEER_H);
  let gen = 0;
  const stamp = (cells, ox, oy) => { for (const [x, y] of cells) { const X = x + ox; const Y = y + oy; if (X >= 0 && Y >= 0 && X < CHEER_W && Y < CHEER_H) g[Y * CHEER_W + X] = 1; } };
  (big ? SQUAD : [SQUAD[1]]).forEach(([x, y]) => stamp(PULSAR, x, y));
  PENTA_AT.forEach(([x, y]) => stamp(PENTADECATHLON, x, y));

  const step = () => {
    const n = new Uint8Array(g.length);
    for (let y = 0; y < CHEER_H; y++) for (let x = 0; x < CHEER_W; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx; const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < CHEER_W && yy < CHEER_H) c += g[yy * CHEER_W + xx];
      }
      const k = y * CHEER_W + x;
      n[k] = g[k] ? (c === 2 || c === 3 ? 1 : 0) : (c === 3 ? 1 : 0);
    }
    g = n;
    // the top edge would turn the sprayed gliders into blocks: let them fly off
    for (let x = 0; x < CHEER_W; x++) { g[x] = 0; g[CHEER_W + x] = 0; }
    gen++;
    // the choreography, on the beat
    const beatAt = (big ? [1, 7, 25, 31, 49, 55] : [1, 7, 25, 31]).indexOf(gen);
    if (beatAt >= 0) {
      // two lanes a side, each reused only once its earlier glider is long gone, so nothing collides
      const lane = beatAt % 2;
      stamp(GLIDER_UL, lane ? 28 : 33, 20);
      stamp(GLIDER_UR, lane ? 41 : 36, 20);
    }
    if (gen === 30) for (let i = 0; i < 5; i++) stamp(rows('OOO'), 14 + i * 11, 4); // sparklers
    if (big && gen === 56) stamp(RPENT, 34, 7); // the finale, up top where it cannot reach the squad
  };
  return {
    step,
    get gen() { return gen; },
    get cells() { return g; },
    get alive() { return g.reduce((a, b) => a + b, 0); },
    squadAlive: () => SQUAD.map(([x, y]) => { let n = 0; for (let j = 0; j < 13; j++) for (let i = 0; i < 13; i++) n += g[(y + j) * CHEER_W + x + i]; return n; }),
  };
}
export const CHEER_GENS = { td: 96, fg: 60 };
