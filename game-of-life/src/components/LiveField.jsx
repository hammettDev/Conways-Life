import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLivePlay, LIVE_OFFENCES, liveOffenceById } from '../engine/footballLive.js';
import { RUN_LANES } from '../engine/football.js';
import { BLUE_LOS_X, CENTER_Y } from '../engine/formations.js';
import { COLS, ROWS } from '../engine/constants.js';
import { createRng } from '../engine/rng.js';

const X0 = BLUE_LOS_X - 30; const VW = 66;
const Y0 = CENTER_Y - 25; const VH = 50;
const TILE = 10;
const TICK_MS = (() => { try { const v = Number(new URLSearchParams(window.location.search).get('tick')); return v > 0 ? v : 90; } catch { return 90; } })(); // ?tick=10 for a fast test run
const RECV_COLOR = ['#ffd050', '#7dffb0', '#ff9be8', '#8fd0ff', '#ffb070', '#c8a0ff'];
const LANE_LABEL = ['Up', 'Middle', 'Down'];

function drawField(ctx, view) {
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

// One play of the live football game: call it, snap it, and (on a pass) fire the ball with a key or a tap.
// Keys: Space = snap / throw / next, 1-4 pick a receiver, Left/Right cycle receivers, P / R switch pass / run.
export default function LiveField({ def, seed, hint, onPlay }) {
  const [offId, setOffId] = useState(LIVE_OFFENCES[0].id);
  const [kind, setKind] = useState('pass');
  const [lane, setLane] = useState(1);
  const [sel, setSel] = useState(0);
  const [phase, setPhase] = useState('call'); // call -> live -> result
  const [result, setResult] = useState(null);
  const canvas = useRef(null);
  const playRef = useRef(null);
  const view = useRef({});
  const timer = useRef(null);
  const rngRef = useRef(createRng(seed));
  const [, force] = useState(0);

  const off = liveOffenceById(offId);
  const laneLat = RUN_LANES[lane];

  // a fresh, un-snapped play whenever the call changes: this is what the field shows before the snap
  const preview = useMemo(() => createLivePlay({ off, def, kind, lane: laneLat, rng: rngRef.current }), [off, def, kind, laneLat]);
  useEffect(() => { if (phase === 'call') { playRef.current = preview; view.current = { play: preview, sel }; } }, [preview, phase, sel]);
  useEffect(() => { view.current = { play: playRef.current, sel }; }, [sel]);
  useEffect(() => { if (sel >= off.receivers.length) setSel(0); }, [off, sel]);

  useEffect(() => {
    const c = canvas.current; if (!c) return undefined;
    const ctx = c.getContext('2d'); let raf;
    const loop = () => { drawField(ctx, view.current); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => () => clearInterval(timer.current), []);

  const snap = () => {
    if (phase !== 'call') return;
    const play = createLivePlay({ off, def, kind, lane: laneLat, rng: rngRef.current });
    playRef.current = play; view.current = { play, sel }; play.start(); setPhase('live');
    timer.current = setInterval(() => {
      play.step();
      if (play.phase === 'done') {
        clearInterval(timer.current);
        setResult(play.result); setPhase('result');
        view.current = { play, sel };
      }
      force((n) => n + 1);
    }, TICK_MS);
  };
  const next = () => {
    if (phase !== 'result' || !result) return;
    const r = result; setResult(null); setPhase('call');
    onPlay(r, { off: offId, kind });
  };
  const fire = () => {
    const play = playRef.current;
    if (phase !== 'live' || !play || play.kind !== 'pass') return;
    play.throwTo(sel);
    force((n) => n + 1);
  };

  const act = () => { if (phase === 'call') snap(); else if (phase === 'live') fire(); else next(); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key;
      if (k === ' ' || k === 'Enter') { e.preventDefault(); act(); return; }
      if (/^[1-6]$/.test(k)) { const i = Number(k) - 1; if (i < off.receivers.length) setSel(i); return; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { setSel((s) => (s + 1) % off.receivers.length); return; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { setSel((s) => (s + off.receivers.length - 1) % off.receivers.length); return; }
      if (phase === 'call') { if (k === 'p' || k === 'P') setKind('pass'); if (k === 'r' || k === 'R') setKind('run'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const play = playRef.current;
  const aim = phase === 'live' && play && play.kind === 'pass' && !play.caught && play.throwTick === null ? play.aim(sel) : null;
  const thrown = phase === 'live' && play && play.throwTick !== null;
  const live = phase === 'live';

  return (
    <div className="livefield">
      <div className="driveplay">
        <canvas ref={canvas} width={VW * TILE} height={VH * TILE} className="drivecanvas" aria-label="The play" onClick={act} />
        <div className="drivedef">{hint || <>Defence shows <b>{def.name}</b></>}</div>
      </div>
      <div className="drivepanel">
        {phase === 'call' && (
          <>
            <div className="drivepick" role="group" aria-label="Formation">
              {LIVE_OFFENCES.map((o) => <button key={o.id} className={o.id === offId ? 'chip on' : 'chip'} onClick={() => setOffId(o.id)}>{o.name}</button>)}
            </div>
            <div className="driveseg" role="group" aria-label="Play type">
              <button className={kind === 'pass' ? 'on' : ''} onClick={() => setKind('pass')}>Pass</button>
              <button className={kind === 'run' ? 'on' : ''} onClick={() => setKind('run')}>Run</button>
            </div>
            {kind === 'run' && (
              <div className="driveseg" role="group" aria-label="Lane">
                {RUN_LANES.map((_, i) => <button key={i} className={lane === i ? 'on' : ''} onClick={() => setLane(i)}>{LANE_LABEL[i]}</button>)}
              </div>
            )}
            <p className="note">{kind === 'pass' ? 'Your receivers are light spaceships that run at the defence; the ball is a glider you fire from the quarterback. After the snap, pick a receiver (1-4) and press Space when the dashed line turns green.' : 'The runner is a glider sent through the line. Pick a lane, then snap.'}</p>
            <button className="lock" onClick={snap}>Snap · Space</button>
          </>
        )}
        {live && (
          <>
            {play && play.kind === 'pass' && (
              <div className="driveseg" role="group" aria-label="Receiver">
                {off.receivers.map((r, i) => <button key={i} className={sel === i ? 'on' : ''} disabled={!play.receivers[i].alive} onClick={() => setSel(i)}>{i + 1}</button>)}
              </div>
            )}
            {play && play.kind === 'pass' && (
              <button className={`lock throw${aim && aim.wait !== null && aim.wait <= 14 && aim.wait >= -5 ? ' go' : ''}`} disabled={thrown} onClick={fire}>
                {thrown ? 'Ball in the air…' : aim && aim.wait !== null ? (aim.wait <= 14 && aim.wait >= -5 ? 'THROW NOW · Space' : aim.wait > 14 ? 'Wait for it · Space' : 'Too late for this one') : 'Throw · Space'}
              </button>
            )}
            {play && play.kind === 'run' && <p className="note drivemsg">Run in progress{typeof play.live === 'number' ? ` · ${Math.max(0, play.live)} yds` : ''}</p>}
          </>
        )}
        {phase === 'result' && result && (
          <>
            <p className={`verdict ${result.yards > 0 ? 'win' : 'lose'}`}>{result.note}</p>
            <button className="lock" onClick={next}>Next · Space</button>
          </>
        )}
      </div>
    </div>
  );
}
