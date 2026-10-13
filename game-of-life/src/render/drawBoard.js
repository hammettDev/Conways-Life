import { COLS, ROWS, FIELD_X0, FIELD_X1, FIELD_Y0, FIELD_Y1, BLUE, RED, DEAD } from '../engine/constants.js';
import { THEME } from './theme.js';

const FILL = { [BLUE]: THEME.blue, [RED]: THEME.red };
const EDGE = { [BLUE]: THEME.blueDeep, [RED]: THEME.redDeep };
const GLOW = { [BLUE]: 'rgba(56,169,255,0.30)', [RED]: 'rgba(255,61,120,0.30)' };

const MAX_DISCS = 14;

// One chip, seen slightly from above: a flat ellipse.
function chip(ctx, cx, cy, r, team, lift = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy - lift, r, r * 0.56, 0, 0, Math.PI * 2);
  ctx.fillStyle = FILL[team];
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = EDGE[team];
  ctx.stroke();
}

// Turn an ordered stack of runs ([[team, count], ...] bottom to top) into at
// most MAX_DISCS discs, keeping the colour order and proportions.
export function stackDiscs(runs, maxDiscs = MAX_DISCS) {
  if (!runs || !runs.length) return [];
  const total = runs.reduce((n, [, c]) => n + c, 0);
  const discs = Math.min(maxDiscs, total);
  const out = [];
  let ri = 0;
  let upTo = runs[0][1];
  for (let k = 0; k < discs; k++) {
    const pos = ((k + 0.5) / discs) * total;
    while (pos > upTo && ri < runs.length - 1) { ri++; upTo += runs[ri][1]; }
    out.push(runs[ri][0]);
  }
  return out;
}

// Board 1. `view` is plain data so this stays easy to test:
//   { tile, teams, hot, stacks, ghost: [{x,y,team}], time }
// Towers are stacks of round chips in the colours they were laid; a live cell
// is the bright chip on top. Rows are drawn top to bottom so a tower in front
// covers the one behind it.
export function drawBoard(ctx, view) {
  const { tile, teams, hot, stacks, ghost = [], time = 0 } = view;
  const W = COLS * tile;
  const H = ROWS * tile;

  ctx.fillStyle = THEME.ring;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = THEME.field;
  ctx.fillRect(FIELD_X0 * tile, FIELD_Y0 * tile, (FIELD_X1 - FIELD_X0) * tile, (FIELD_Y1 - FIELD_Y0) * tile);

  // Mown-turf stripes: every other 5-tile band is a shade lighter, with a faint yard line between bands.
  for (let x = FIELD_X0; x < FIELD_X1; x += 5) {
    if (((x - FIELD_X0) / 5) % 2 === 1) {
      ctx.fillStyle = THEME.fieldStripe;
      ctx.fillRect(x * tile, FIELD_Y0 * tile, 5 * tile, (FIELD_Y1 - FIELD_Y0) * tile);
    }
    ctx.fillStyle = THEME.yard;
    ctx.fillRect(x * tile - 0.5, FIELD_Y0 * tile, 1, (FIELD_Y1 - FIELD_Y0) * tile);
  }

  // Faint tile centres instead of a heavy grid.
  ctx.fillStyle = THEME.grid;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) ctx.fillRect(x * tile + tile / 2 - 0.5, y * tile + tile / 2 - 0.5, 1, 1);
  ctx.strokeStyle = THEME.gridField;
  ctx.lineWidth = 1;
  ctx.strokeRect(FIELD_X0 * tile + 0.5, FIELD_Y0 * tile + 0.5, (FIELD_X1 - FIELD_X0) * tile, (FIELD_Y1 - FIELD_Y0) * tile);

  // Line of scrimmage.
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = THEME.midline;
  ctx.beginPath();
  ctx.moveTo((COLS / 2) * tile, FIELD_Y0 * tile);
  ctx.lineTo((COLS / 2) * tile, FIELD_Y1 * tile);
  ctx.stroke();
  ctx.restore();

  // Hot Zones: glowing amber rings on the ground.
  for (let i = 0; i < hot.length; i++) {
    if (!hot[i]) continue;
    const x = i % COLS;
    const y = (i / COLS) | 0;
    const pulse = 0.22 + 0.16 * Math.sin(time * 2.4 + (x + y) * 0.45);
    ctx.beginPath();
    ctx.ellipse(x * tile + tile / 2, y * tile + tile / 2 + tile * 0.12, tile * 0.46, tile * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,176,46,${pulse})`;
    ctx.fill();
  }

  const r = tile * 0.4;
  const step = Math.max(1.5, tile * 0.19);
  const ghostAt = new Map(ghost.map((g) => [g.y * COLS + g.x, g.team]));

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      const cx = x * tile + tile / 2;
      const base = y * tile + tile * 0.62;
      const discs = stackDiscs(stacks && stacks[i]);
      const live = teams[i];

      for (let k = 0; k < discs.length; k++) chip(ctx, cx, base, r, discs[k], k * step);

      if (live !== DEAD) {
        const top = discs.length * step;
        ctx.beginPath();
        ctx.ellipse(cx, base - top, r * 1.6, r * 1.0, 0, 0, Math.PI * 2);
        ctx.fillStyle = GLOW[live];
        ctx.fill();
        chip(ctx, cx, base, r, live, top);
      }

      const g = ghostAt.get(i);
      if (g !== undefined) {
        ctx.globalAlpha = 0.5;
        chip(ctx, cx, base, r, g, discs.length * step);
        ctx.globalAlpha = 1;
      }
    }
  }
}

// Board 2: the pit. `view` = { size, tile, hot (0/1 per pit tile), blue, red (chip counts) }.
// Each tile is a tower: the contested chips at the bottom in the loser's colour,
// the lead in the owner's colour on top.
export function drawPit(ctx, view) {
  const { size, tile, hot, blue, red } = view;
  const S = size * tile;
  ctx.fillStyle = THEME.field;
  ctx.fillRect(0, 0, S, S);
  const r = tile * 0.36;
  const step = Math.max(1.5, tile * 0.13);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const k = py * size + px;
      const cx = px * tile + tile / 2;
      const base = py * tile + tile * 0.66;
      if (hot[k]) {
        ctx.beginPath();
        ctx.ellipse(cx, base + 1, tile * 0.46, tile * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,176,46,0.35)';
        ctx.fill();
      }
      const b = blue[k];
      const rd = red[k];
      if (!b && !rd) continue;
      const lo = Math.min(b, rd);
      const hi = Math.max(b, rd);
      const ownerTeam = b >= rd ? BLUE : RED;
      const loserTeam = ownerTeam === BLUE ? RED : BLUE;
      const cap = 12;
      const below = Math.min(lo, cap);
      const above = Math.min(hi - lo, cap - below);
      let n = 0;
      for (let q = 0; q < below; q++, n++) chip(ctx, cx, base, r, loserTeam, n * step);
      for (let q = 0; q < Math.max(above, hi > lo ? 1 : 0); q++, n++) chip(ctx, cx, base, r, ownerTeam, n * step);
      if (hi === lo) {
        // a tie belongs to nobody: show a hollow ring on top
        ctx.beginPath();
        ctx.ellipse(cx, base - n * step, r, r * 0.56, 0, 0, Math.PI * 2);
        ctx.strokeStyle = THEME.dim;
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = THEME.gridField;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
}
