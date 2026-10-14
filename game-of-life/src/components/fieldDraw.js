import { BLUE_LOS_X, CENTER_Y } from '../engine/formations.js';
import { COLS } from '../engine/constants.js';

export const X0 = BLUE_LOS_X - 30; export const VW = 66;
export const Y0 = CENTER_Y - 25; export const VH = 50;
export const TILE = 10;
export const TICK_MS = (() => { try { const v = Number(new URLSearchParams(window.location.search).get('tick')); return v > 0 ? v : 90; } catch { return 90; } })(); // ?tick=10 for a fast test run
export const RECV_COLOR = ['#ffd050', '#7dffb0', '#ff9be8', '#8fd0ff', '#ffb070', '#c8a0ff'];
export const LANE_LABEL = ['Up', 'Middle', 'Down'];

export function drawField(ctx, view) {
  const W = VW * TILE; const H = VH * TILE;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d2a19'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  for (let x = 0; x <= VW; x += 5) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); ctx.stroke(); }
  const los = (BLUE_LOS_X + 1 - X0) * TILE;
  ctx.strokeStyle = 'rgba(255,208,80,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(los, 0); ctx.lineTo(los, H); ctx.stroke();
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
    ctx.fillStyle = '#4dff9a'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`+${Math.round(play.progressX - BLUE_LOS_X)} yds`, px + 5, 6);
  }
  if (play.kind === 'pass') {
    play.receivers.forEach((r, i) => {
      if (!r.alive) return;
      const x = (r.x - X0 + 0.5) * TILE; const y = (r.y - Y0 - 3.2) * TILE;
      ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = i === sel ? '#ffffff' : 'rgba(255,255,255,0.65)';
      ctx.fillText(String(i + 1), x, y);
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
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('QB', (play.qb.x - X0 + 0.5) * TILE, (play.qb.y - Y0 + 3) * TILE);
  } else {
    // the runner's lane, before the snap
    if (play.phase === 'snap') {
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('RUNNER', (play.qb.x - X0 + 0.5) * TILE, (play.qb.y - Y0 + 3) * TILE);
    }
  }
}

