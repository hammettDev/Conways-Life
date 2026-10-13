import { COLS, ROWS, BLUE, RED, DEAD } from '../engine/constants.js';
import { SHAPES } from '../engine/shapes.js';
import { stepTeams } from '../engine/life.js';
import { THEME } from './theme.js';

// A tiny looping simulation that shows what a shop item is and what it does: the
// piece on a small patch of grass, with something in its way. It reuses the real
// Life rules, so what you see is what the piece will do on the board.

// Where the demo lives on the 80x60 grid, and how much of it is shown.
export const VIEW = { x0: 28, y0: 20, w: 32, h: 20 };
export const LOOP_TICKS = 110; // the demo restarts after this many ticks
export const HOLD_TICKS = 14;  // and rests this long on the last frame

// Cells of a shape placed with its pivot at (x, y), facing the enemy like a real
// piece: Blue faces +x, Red faces -x.
export function cellsOf(shape, team, x, y) {
  return SHAPES[shape].map(([du, dv]) => ({ x: team === BLUE ? x - du : x + du, y: y + dv, team }));
}

const blockWall = (x, ys) => ys.flatMap((y) => cellsOf('block', RED, x, y));

// What each item demonstrates. `ours` is the item, `theirs` is the enemy it meets.
export const DEMOS = {
  block: { ours: [['block', BLUE, 40, 30]], theirs: [['glider', RED, 56, 29]], note: 'Holds its ground when a glider hits it.' },
  toad: { ours: [['toad', BLUE, 40, 29]], theirs: [['glider', RED, 56, 28]], note: 'Flashes in place, claiming extra ground.' },
  glider: { ours: [['glider', BLUE, 31, 22]], theirs: [['block', RED, 44, 33]], note: 'Crawls diagonally into the enemy.' },
  rpent: { ours: [['rpent', BLUE, 40, 30]], theirs: [], note: 'A small spark that grows into a brawl.' },
  acorn: { ours: [['acorn', BLUE, 40, 30]], theirs: [], note: 'Burns for hundreds of ticks, spreading wide.' },
  lwss: { ours: [['lwss', BLUE, 35, 28]], wall: [54, [26, 30, 34]], note: 'Charges straight at the line.' },
  mwss: { ours: [['mwss', BLUE, 35, 28]], wall: [54, [26, 30, 34]], note: 'A heavier charge.' },
  hwss: { ours: [['hwss', BLUE, 35, 27]], wall: [54, [26, 30, 34]], note: 'The biggest charge you can buy.' },
};

export function demoCells(id) {
  const d = DEMOS[id];
  if (!d) return [];
  const cells = [];
  for (const [shape, team, x, y] of d.ours) cells.push(...cellsOf(shape, team, x, y));
  for (const [shape, team, x, y] of d.theirs || []) cells.push(...cellsOf(shape, team, x, y));
  if (d.wall) cells.push(...blockWall(d.wall[0], d.wall[1]));
  return cells;
}

export function createPreview(id) {
  let a = new Uint8Array(COLS * ROWS);
  let b = new Uint8Array(COLS * ROWS);
  let tick = 0;
  const reset = () => {
    a.fill(DEAD);
    for (const c of demoCells(id)) a[c.y * COLS + c.x] = c.team;
    tick = 0;
  };
  reset();
  return {
    get grid() { return a; },
    get tick() { return tick; },
    reset,
    // Advance one tick; after the loop plus a short rest, start over.
    step() {
      if (tick >= LOOP_TICKS + HOLD_TICKS) { reset(); return; }
      if (tick < LOOP_TICKS) {
        stepTeams(a, b);
        [a, b] = [b, a];
      }
      tick++;
    },
  };
}

// Draw the demo window.
export function drawPreview(ctx, preview, tile, time = 0) {
  const { x0, y0, w, h } = VIEW;
  ctx.fillStyle = THEME.field;
  ctx.fillRect(0, 0, w * tile, h * tile);
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x++) { ctx.moveTo(x * tile + 0.5, 0); ctx.lineTo(x * tile + 0.5, h * tile); }
  for (let y = 0; y <= h; y++) { ctx.moveTo(0, y * tile + 0.5); ctx.lineTo(w * tile, y * tile + 0.5); }
  ctx.stroke();
  const inset = Math.max(1, Math.round(tile * 0.14));
  const g = preview.grid;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = g[(y0 + y) * COLS + (x0 + x)];
      if (t === DEAD) continue;
      ctx.fillStyle = t === BLUE ? 'rgba(56,169,255,0.28)' : 'rgba(255,61,120,0.28)';
      ctx.fillRect(x * tile - 1, y * tile - 1, tile + 2, tile + 2);
      ctx.fillStyle = t === BLUE ? THEME.blue : THEME.red;
      ctx.fillRect(x * tile + inset, y * tile + inset, tile - inset * 2, tile - inset * 2);
    }
  }
}

// A still picture of just the piece, for a list thumbnail. Returns the cells
// relative to their own top-left corner plus the bounding box.
export function thumbCells(shape) {
  const cells = SHAPES[shape];
  const us = cells.map(([du]) => du);
  const vs = cells.map(([, dv]) => dv);
  const minU = Math.min(...us);
  const minV = Math.min(...vs);
  // Facing right (toward the enemy): larger du is further from the enemy, so flip it.
  const maxU = Math.max(...us);
  return {
    cells: cells.map(([du, dv]) => [maxU - du, dv - minV]),
    w: maxU - minU + 1,
    h: Math.max(...vs) - minV + 1,
  };
}
