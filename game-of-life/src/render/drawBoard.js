import { COLS, ROWS, FIELD_X0, FIELD_X1, FIELD_Y0, FIELD_Y1, BLUE, RED, DEAD } from '../engine/constants.js';
import { THEME } from './theme.js';
import { TRAVEL_MS, STAGGER_MS } from './pitDisplay.js';

const FILL = { [BLUE]: THEME.blue, [RED]: THEME.red };
const EDGE = { [BLUE]: THEME.blueDeep, [RED]: THEME.redDeep };
const GLOW = { [BLUE]: 'rgba(56,169,255,0.30)', [RED]: 'rgba(255,61,120,0.30)' };

const MAX_DISCS = 14;

// Sim tile (x, y) -> screen tile. Sideways: the teams face each other left to
// right. Madden: the field runs top to bottom with Blue at the bottom facing
// up, so the line of scrimmage is horizontal.
export function toScreen(x, y, rotate) {
  return rotate ? [y, COLS - 1 - x] : [x, y];
}
export const boardSize = (rotate) => (rotate ? { cols: ROWS, rows: COLS } : { cols: COLS, rows: ROWS });

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
  const { tile, teams, hot, stacks, blueTower, redTower, ghost = [], time = 0, rotate = false } = view;
  const heat = view.look !== 'chips'; // the clean tinted-tile look is the default
  const { cols: SC, rows: SR } = boardSize(rotate);
  const W = SC * tile;
  const H = SR * tile;

  // A rectangle given in sim tiles [x0, x1) x [y0, y1), as screen px [x, y, w, h].
  const rect = (x0, y0, x1, y1) => (rotate
    ? [y0 * tile, (COLS - x1) * tile, (y1 - y0) * tile, (x1 - x0) * tile]
    : [x0 * tile, y0 * tile, (x1 - x0) * tile, (y1 - y0) * tile]);
  // A point given in sim tile units, as screen px.
  const pt = (x, y) => (rotate ? [y * tile, (COLS - x) * tile] : [x * tile, y * tile]);

  ctx.fillStyle = THEME.ring;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = THEME.field;
  ctx.fillRect(...rect(FIELD_X0, FIELD_Y0, FIELD_X1, FIELD_Y1));

  // Mown-turf stripes: every other 5-tile band is a shade lighter, with a faint yard line between bands.
  for (let x = FIELD_X0; x < FIELD_X1; x += 5) {
    if (((x - FIELD_X0) / 5) % 2 === 1) {
      ctx.fillStyle = THEME.fieldStripe;
      ctx.fillRect(...rect(x, FIELD_Y0, x + 5, FIELD_Y1));
    }
    ctx.strokeStyle = THEME.yard;
    ctx.beginPath();
    ctx.moveTo(...pt(x, FIELD_Y0));
    ctx.lineTo(...pt(x, FIELD_Y1));
    ctx.stroke();
  }

  if (heat) {
    // A fine tile grid.
    ctx.lineWidth = 1;
    ctx.strokeStyle = THEME.grid;
    ctx.beginPath();
    for (let x = 0; x <= SC; x++) { ctx.moveTo(x * tile + 0.5, 0); ctx.lineTo(x * tile + 0.5, H); }
    for (let y = 0; y <= SR; y++) { ctx.moveTo(0, y * tile + 0.5); ctx.lineTo(W, y * tile + 0.5); }
    ctx.stroke();
  } else {
    // Faint tile centres instead of a heavy grid.
    ctx.fillStyle = THEME.grid;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const [sx, sy] = toScreen(x, y, rotate);
        ctx.fillRect(sx * tile + tile / 2 - 0.5, sy * tile + tile / 2 - 0.5, 1, 1);
      }
    }
  }
  const [fx, fy, fw, fh] = rect(FIELD_X0, FIELD_Y0, FIELD_X1, FIELD_Y1);
  ctx.strokeStyle = THEME.gridField;
  ctx.lineWidth = 1;
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw, fh);

  // Line of scrimmage.
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = THEME.midline;
  ctx.beginPath();
  ctx.moveTo(...pt(COLS / 2, FIELD_Y0));
  ctx.lineTo(...pt(COLS / 2, FIELD_Y1));
  ctx.stroke();
  ctx.restore();

  // Hot Zones: pulsing amber pads (clean look) or glowing rings on the ground (chips look).
  for (let i = 0; i < hot.length; i++) {
    if (!hot[i]) continue;
    const x = i % COLS;
    const y = (i / COLS) | 0;
    const [sx, sy] = toScreen(x, y, rotate);
    const pulse = 0.22 + 0.16 * Math.sin(time * 2.4 + (x + y) * 0.45);
    if (heat) {
      ctx.fillStyle = `rgba(255,176,46,${pulse * 0.8})`;
      ctx.fillRect(sx * tile + 1, sy * tile + 1, tile - 2, tile - 2);
    } else {
      ctx.beginPath();
      ctx.ellipse(sx * tile + tile / 2, sy * tile + tile / 2 + tile * 0.12, tile * 0.46, tile * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,176,46,${pulse})`;
      ctx.fill();
    }
  }

  // Clean look: claimed ground, tinted toward whoever's tower is ahead on each tile.
  if (heat && blueTower && redTower) {
    for (let y = FIELD_Y0; y < FIELD_Y1; y++) {
      for (let x = FIELD_X0; x < FIELD_X1; x++) {
        const i = y * COLS + x;
        const b = blueTower[i];
        const rd = redTower[i];
        if (b === rd) continue;
        const [sx, sy] = toScreen(x, y, rotate);
        const a = Math.min(0.34, 0.04 + 0.035 * Math.sqrt(Math.abs(b - rd)));
        ctx.fillStyle = b > rd ? `rgba(56,169,255,${a})` : `rgba(255,61,120,${a})`;
        ctx.fillRect(sx * tile, sy * tile, tile, tile);
      }
    }
  }

  const r = tile * 0.4;
  const step = Math.max(1.5, tile * 0.19);
  const ghostAt = new Map(ghost.map((g) => [g.y * COLS + g.x, g.team]));

  // Back to front on screen, so a tower in front covers the one behind it.
  for (let sy = 0; sy < SR; sy++) {
    for (let sx = 0; sx < SC; sx++) {
      const x = rotate ? COLS - 1 - sy : sx;
      const y = rotate ? sx : sy;
      const i = y * COLS + x;
      const live = teams[i];

      if (heat) {
        // Clean look: a live cell is a bright square on a soft glow; no stacks drawn.
        const px = sx * tile;
        const py = sy * tile;
        const inset = Math.max(1, Math.round(tile * 0.12));
        if (live !== DEAD) {
          ctx.fillStyle = GLOW[live];
          ctx.fillRect(px - 2, py - 2, tile + 4, tile + 4);
          ctx.fillStyle = FILL[live];
          ctx.fillRect(px + inset, py + inset, tile - inset * 2, tile - inset * 2);
        }
        const gh = ghostAt.get(i);
        if (gh !== undefined) {
          ctx.fillStyle = gh === BLUE ? 'rgba(56,169,255,0.32)' : 'rgba(255,61,120,0.32)';
          ctx.fillRect(px + inset, py + inset, tile - inset * 2, tile - inset * 2);
          ctx.strokeStyle = FILL[gh];
          ctx.strokeRect(px + inset + 0.5, py + inset + 0.5, tile - inset * 2 - 1, tile - inset * 2 - 1);
        }
        continue;
      }

      const cx = sx * tile + tile / 2;
      const base = sy * tile + tile * 0.62;
      const discs = stackDiscs(stacks && stacks[i]);

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
  if (view.look !== 'chips') {
    // Clean look: tinted tiles with the lead on each.
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const k = py * size + px;
        const x = px * tile;
        const y = py * tile;
        if (hot[k]) {
          ctx.fillStyle = 'rgba(255,176,46,0.22)';
          ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        }
        const b = blue[k];
        const rd = red[k];
        if (b === rd) continue;
        ctx.fillStyle = b > rd ? 'rgba(56,169,255,0.6)' : 'rgba(255,61,120,0.6)';
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        ctx.fillStyle = THEME.text;
        ctx.font = `bold ${Math.round(tile * 0.42)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.abs(b - rd)), x + tile / 2, y + tile / 2);
      }
    }
    ctx.strokeStyle = THEME.gridField;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= size; i++) {
      ctx.moveTo(i * tile + 0.5, 0); ctx.lineTo(i * tile + 0.5, S);
      ctx.moveTo(0, i * tile + 0.5); ctx.lineTo(S, i * tile + 0.5);
    }
    ctx.stroke();
    return;
  }
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

// ---------------------------------------------------------------------------
// The table: Board 1, the plumbing around it, and the pit underneath, all in one
// canvas so it scales as one picture. Sizes are in board tiles.
// ---------------------------------------------------------------------------
export const APRON = 22;      // rows of tiles under the board: funnel + pit + margin
const PIT_TILES = 16;         // the pit's width/height, in board tiles
const FUNNEL = 5;             // rows between the board and the pit
const RAIL_X = 5;             // rail centre from each side: the middle of the 10-tile border ring

export function tableSize(rotate) {
  const { cols, rows } = boardSize(rotate);
  return { cols, rows: rows + APRON, boardRows: rows };
}

// The route spilled chips take, as points in tile units from the topple to the
// middle of the pit. Chips leave Board 1 off the edge the fence was falling toward
// and run down a side rail (or, in Madden view, off the bottom edge straight in).
export function spillPath(crash, rotate) {
  const { cols, rows } = boardSize(rotate);
  const [sx, sy] = toScreen(crash.x, crash.y, rotate);
  const px = sx + 0.5;
  const py = sy + 0.5;
  const cx = cols / 2;
  const pitTop = rows + FUNNEL;
  const pitMid = [cx, pitTop + PIT_TILES / 2];
  const railL = RAIL_X;
  const railR = cols - RAIL_X;
  if (rotate) {
    if (crash.dir > 0) { // toward the top edge: collector along the top, then the nearest rail down
      const rail = px < cx ? railL : railR;
      return [[px, py], [px, 0.5], [px, 5], [rail, 5], [rail, rows], [cx, pitTop], pitMid];
    }
    return [[px, py], [px, rows - 0.5], [cx, pitTop], pitMid]; // off the bottom: straight down
  }
  const rail = crash.dir > 0 ? railR : railL; // sideways: Blue's chips leave the right edge, Red's the left
  return [[px, py], [rail, py], [rail, rows], [cx, pitTop], pitMid];
}

// Position a fraction t (0..1) along a polyline.
export function pointAlong(path, t) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 1;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f];
    }
    d -= lens[i];
  }
  return path[path.length - 1];
}

function tube(ctx, pts, tile) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * tile, y * tile) : ctx.moveTo(x * tile, y * tile))); };
  trace(); ctx.strokeStyle = '#04100a'; ctx.lineWidth = tile * 2.4; ctx.stroke();
  trace(); ctx.strokeStyle = '#123824'; ctx.lineWidth = tile * 1.8; ctx.stroke();
  trace(); ctx.strokeStyle = 'rgba(160,255,200,0.16)'; ctx.lineWidth = tile * 0.35; ctx.stroke();
}

// `view` = a Board 1 view plus { pit: {size, hot, blue, red}, spills: [{born, crash}], now (ms) }
export function drawTable(ctx, view) {
  const { tile, rotate = false, pit, spills = [], now = 0 } = view;
  const { cols, rows } = boardSize(rotate);
  const W = cols * tile;

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, W, (rows + APRON) * tile);
  drawBoard(ctx, view);

  // Plumbing: a rail down each side through the border ring, a collector along the
  // top in Madden view, and a funnel into the pit.
  const railL = RAIL_X;
  const railR = cols - RAIL_X;
  const cx = cols / 2;
  const pitTop = rows + FUNNEL;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo((railL - 1.2) * tile, (rows - 1) * tile);
  ctx.lineTo((railR + 1.2) * tile, (rows - 1) * tile);
  ctx.lineTo((cx + PIT_TILES / 2 + 0.6) * tile, pitTop * tile);
  ctx.lineTo((cx - PIT_TILES / 2 - 0.6) * tile, pitTop * tile);
  ctx.closePath();
  ctx.fillStyle = '#0a1f13';
  ctx.fill();
  ctx.strokeStyle = THEME.panelEdge;
  ctx.stroke();
  ctx.restore();
  tube(ctx, [[railL, rotate ? 5 : 1], [railL, rows - 0.5]], tile);
  tube(ctx, [[railR, rotate ? 5 : 1], [railR, rows - 0.5]], tile);
  if (rotate) tube(ctx, [[railL, 5], [railR, 5]], tile);

  // The pit.
  const pitPx = PIT_TILES * tile;
  ctx.save();
  ctx.translate(cx * tile - pitPx / 2, pitTop * tile);
  ctx.fillStyle = '#04100a';
  ctx.fillRect(-4, -4, pitPx + 8, pitPx + 8);
  drawPit(ctx, { ...pit, tile: pitPx / pit.size, look: view.look });
  ctx.restore();
  // The label sits in the funnel, above the pit.
  ctx.fillStyle = THEME.dim;
  ctx.font = `600 ${Math.round(tile * 0.8)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('THE PIT', cx * tile, (rows + 1.6) * tile);

  // Chips running down the pipes after a topple.
  const DURATION = TRAVEL_MS;
  for (const sp of spills) {
    const n = Math.min(6, Math.max(1, sp.crash.spilled));
    const path = spillPath(sp.crash, rotate);
    for (let k = 0; k < n; k++) {
      const t = (now - sp.born - k * STAGGER_MS) / DURATION;
      if (t < 0 || t > 1) continue;
      const eased = t * t * (3 - 2 * t);
      const [x, y] = pointAlong(path, eased);
      chip(ctx, x * tile, y * tile, tile * 0.42, sp.crash.owner);
    }
  }
}
