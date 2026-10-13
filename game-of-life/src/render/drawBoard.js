import { COLS, ROWS, FIELD_X0, FIELD_X1, FIELD_Y0, FIELD_Y1, BLUE, RED, DEAD } from '../engine/constants.js';
import { THEME } from './theme.js';

const teamColor = (t) => (t === BLUE ? THEME.blue : THEME.red);
const teamGlow = (t) => (t === BLUE ? 'rgba(56,169,255,0.28)' : 'rgba(255,61,120,0.28)');
const teamTint = (t, a) => (t === BLUE ? `rgba(56,169,255,${a})` : `rgba(255,61,120,${a})`);

// Draws one frame of Board 1. `view` is plain data so this stays easy to test:
//   { tile, teams, hot, blueTower, redTower, ghost: [{x,y,team}], time }
export function drawBoard(ctx, view) {
  const { tile, teams, hot, blueTower, redTower, ghost = [], time = 0 } = view;
  const W = COLS * tile;
  const H = ROWS * tile;

  ctx.fillStyle = THEME.ring;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = THEME.field;
  ctx.fillRect(FIELD_X0 * tile, FIELD_Y0 * tile, (FIELD_X1 - FIELD_X0) * tile, (FIELD_Y1 - FIELD_Y0) * tile);

  // Hot Zones: pulsing amber pads under everything else.
  for (let i = 0; i < hot.length; i++) {
    if (!hot[i]) continue;
    const x = i % COLS;
    const y = (i / COLS) | 0;
    const pulse = 0.14 + 0.1 * Math.sin(time * 2.4 + (x + y) * 0.45);
    ctx.fillStyle = `rgba(255,176,46,${pulse})`;
    ctx.fillRect(x * tile + 1, y * tile + 1, tile - 2, tile - 2);
  }

  // Claimed ground: tower height tints a tile toward the team that is ahead.
  for (let y = FIELD_Y0; y < FIELD_Y1; y++) {
    for (let x = FIELD_X0; x < FIELD_X1; x++) {
      const i = y * COLS + x;
      const b = blueTower[i];
      const r = redTower[i];
      if (b === r) continue;
      const lead = Math.abs(b - r);
      ctx.fillStyle = teamTint(b > r ? BLUE : RED, Math.min(0.34, 0.04 + 0.035 * Math.sqrt(lead)));
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }

  // Grid.
  ctx.lineWidth = 1;
  ctx.strokeStyle = THEME.grid;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * tile + 0.5, 0); ctx.lineTo(x * tile + 0.5, H); }
  for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * tile + 0.5); ctx.lineTo(W, y * tile + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = THEME.gridField;
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

  // Cells: a soft glow plate under a bright core.
  const inset = Math.max(1, Math.round(tile * 0.12));
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    if (t === DEAD) continue;
    const x = (i % COLS) * tile;
    const y = ((i / COLS) | 0) * tile;
    ctx.fillStyle = teamGlow(t);
    ctx.fillRect(x - 2, y - 2, tile + 4, tile + 4);
    ctx.fillStyle = teamColor(t);
    ctx.fillRect(x + inset, y + inset, tile - inset * 2, tile - inset * 2);
  }

  // Ghost preview of a formation that is not locked in yet.
  for (const c of ghost) {
    ctx.fillStyle = teamTint(c.team, 0.32);
    ctx.fillRect(c.x * tile + inset, c.y * tile + inset, tile - inset * 2, tile - inset * 2);
    ctx.strokeStyle = teamColor(c.team);
    ctx.strokeRect(c.x * tile + inset + 0.5, c.y * tile + inset + 0.5, tile - inset * 2 - 1, tile - inset * 2 - 1);
  }
}

// Board 2: the pit. `view` = { size, tile, hot (array of 0/1 per pit tile), blue, red (chip counts) }
export function drawPit(ctx, view) {
  const { size, tile, hot, blue, red } = view;
  const S = size * tile;
  ctx.fillStyle = THEME.field;
  ctx.fillRect(0, 0, S, S);
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
      const r = red[k];
      if (b !== r) {
        const team = b > r ? BLUE : RED;
        ctx.fillStyle = teamTint(team, 0.55);
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        ctx.fillStyle = THEME.text;
        ctx.font = `bold ${Math.round(tile * 0.45)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.abs(b - r)), x + tile / 2, y + tile / 2);
      }
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
}
