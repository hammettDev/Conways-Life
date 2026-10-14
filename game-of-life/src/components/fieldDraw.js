import { BLUE_LOS_X, CENTER_Y } from '../engine/formations.js';
import { COLS } from '../engine/constants.js';
import { CELL_YARDS, FG_SPOT } from '../engine/football.js';

export const X0 = BLUE_LOS_X - 30; export const VW = 66;
export const Y0 = CENTER_Y - 25; export const VH = 50;
export const TILE = 10;
export const TICK_MS = (() => { try { const v = Number(new URLSearchParams(window.location.search).get('tick')); return v > 0 ? v : 90; } catch { return 90; } })(); // ?tick=10 for a fast test run
export const RECV_COLOR = ['#ffd050', '#7dffb0', '#ff9be8', '#8fd0ff', '#ffb070', '#c8a0ff'];
export const LANE_LABEL = ['Left', 'Middle', 'Right']; // from the runner's point of view (he faces the defence)

// Where the lines sit on the board for a drive: first down, the field goal range and the goal line (board x of each).
export function driveLines(drive) {
  if (!drive) return null;
  const x = (yards) => BLUE_LOS_X + 1 + yards / CELL_YARDS;
  const toFirst = Math.min(drive.toGo, 100 - drive.spot);
  return {
    firstX: x(toFirst), firstIsGoal: drive.spot + drive.toGo >= 100,
    fgX: drive.spot < FG_SPOT ? x(FG_SPOT - drive.spot) : null,
    goalX: x(100 - drive.spot),
  };
}
// Size of the canvas for a view: the Madden view turns the field to run up the screen.
export const canvasSize = (rotate) => (rotate ? { w: VH * TILE, h: VW * TILE } : { w: VW * TILE, h: VH * TILE });

export function drawField(ctx, view) {
  const rotate = !!view.rotate;
  const W = VW * TILE; const H = VH * TILE; // the field as drawn before any turning: x runs along the play
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 2000, 2000);
  if (rotate) ctx.setTransform(0, -1, 1, 0, 0, W); // offence at the bottom, driving up the screen
  // text is drawn upright whatever the field's turn
  const label = (str, u, v, color, font, align = 'center', baseline = 'middle') => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color; ctx.font = font; ctx.textAlign = align; ctx.textBaseline = baseline;
    if (rotate) ctx.fillText(str, v, W - u); else ctx.fillText(str, u, v);
    ctx.restore();
  };
  ctx.fillStyle = '#0d2a19'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  for (let x = 0; x <= VW; x += 5) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); ctx.stroke(); }
  const vline = (bx, color, width, dash, text) => {
    const u = (bx - X0) * TILE;
    if (u < 0 || u > W) return;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(u, 0); ctx.lineTo(u, H); ctx.stroke(); ctx.setLineDash([]);
    if (text) label(text, u + 8, 12, color, 'bold 11px system-ui', 'left', 'middle');
  };
  vline(BLUE_LOS_X + 1, 'rgba(120,170,255,0.9)', 2, null, null); // the line of scrimmage
  const lines = view.lines;
  if (lines) {
    if (lines.fgX !== null && !lines.firstIsGoal) vline(lines.fgX, 'rgba(90,220,255,0.7)', 2, [3, 6], ' FIELD GOAL RANGE');
    if (lines.goalX - 0 > 0) vline(lines.goalX, '#ffffff', 3, null, ' GOAL');
    vline(lines.firstX, '#ffd34d', 4, null, lines.firstIsGoal ? '' : ' 1ST DOWN');
  }
  const { play, sel } = view;
  if (!play) return;
  const cell = (k, color, inset = 1) => {
    const sx = (k % COLS) - X0; const sy = ((k / COLS) | 0) - Y0;
    if (sx < 0 || sy < 0 || sx >= VW || sy >= VH) return;
    ctx.fillStyle = color; ctx.fillRect(sx * TILE + inset, sy * TILE + inset, TILE - inset * 2, TILE - inset * 2);
  };
  const g = play.grids();
  const { FG, W: WG } = g;
  for (let k = 0; k < FG.length; k++) if (FG[k]) cell(k, FG[k] === 1 ? '#2f86d6' : '#c23a5f');
  for (let k = 0; k < WG.length; k++) {
    const t = WG[k]; if (!t) continue;
    if (t === 2) cell(k, '#ff8aa8');
    else if (t === 9) cell(k, '#ffffff', 0);
    else cell(k, RECV_COLOR[(t - 3) % RECV_COLOR.length]);
  }
  // how far the ball carrier has got: a line that stays put once it stops, so the yards you are given are the yards you see
  if (play.progressX !== null && play.progressX !== undefined && play.progressX > BLUE_LOS_X) {
    const px = (play.progressX - X0 + 1) * TILE;
    ctx.strokeStyle = '#4dff9a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    label(`+${Math.round((play.progressX - BLUE_LOS_X) * CELL_YARDS)} yds`, px - 4, H - 10, '#4dff9a', 'bold 13px system-ui', 'right', 'middle');
  }
  if (play.kind === 'pass') {
    play.receivers.forEach((r, i) => {
      if (!r.alive) return;
      const u = (r.x - X0 + 0.5) * TILE; const v = (r.y - Y0 - 3.2) * TILE;
      label(String(i + 1), u, v, i === sel ? '#ffffff' : 'rgba(255,255,255,0.65)', 'bold 14px system-ui');
      if (i === sel) { ctx.strokeStyle = RECV_COLOR[i % RECV_COLOR.length]; ctx.lineWidth = 2; ctx.strokeRect((r.x - X0 - 3) * TILE, (r.y - Y0 - 2.5) * TILE, 8 * TILE, 6 * TILE); }
    });
    const r = play.receivers[sel];
    if (r && r.alive && play.caught === null && play.phase !== 'done') {
      const a = play.aim(sel);
      if (a.wait !== null) {
        const qx = play.qb.x + 2; const qy = play.qb.y;
        const dir = r.y < qy ? -1 : 1;
        const ready = a.wait <= 14 && a.wait >= -5;
        ctx.strokeStyle = ready ? '#4dff9a' : a.wait > 14 ? 'rgba(255,255,255,0.35)' : '#ff5a5a';
        ctx.lineWidth = ready ? 3 : 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo((qx - X0 + 0.5) * TILE, (qy - Y0 + 0.5) * TILE); ctx.lineTo((qx + a.d - X0 + 0.5) * TILE, (qy + dir * a.d - Y0 + 0.5) * TILE); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    label('QB', (play.qb.x - X0 + 0.5) * TILE, (play.qb.y - Y0 + 3) * TILE, '#ffffff', 'bold 11px system-ui');
  } else if (play.phase === 'snap') {
    label('RUNNER', (play.qb.x - X0 + 0.5) * TILE, (play.qb.y - Y0 + 3) * TILE, '#ffffff', 'bold 11px system-ui');
  }
}
