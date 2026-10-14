import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  OFFENCES, DEPTHS, RUN_LANES, TUNE, DRIVE, DRIVE_PAYOUT, COLS, ROWS, receiversOf, offenceById, defenceById,
  resolvePlay, chooseDefence, newDrive, advance,
} from '../engine/football.js';
import { placeFormation, BLUE_LOS_X, CENTER_Y } from '../engine/formations.js';
import { createRng } from '../engine/rng.js';
import { BLUE, RED } from '../engine/constants.js';

const money = (n) => (n >= 1000000 ? `$${n / 1000000}M` : n >= 1000 ? `$${n / 1000}k` : `$${n}`);
const X0 = BLUE_LOS_X - 26; const VW = 60;
const Y0 = CENTER_Y - 24; const VH = 48;
const TILE = 10;
const DEPTH_LABEL = { short: 'Short', mid: 'Medium', deep: 'Deep' };
const LANE_LABEL = ['Left', 'Middle', 'Right'];
const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th'][n];
const spotText = (s) => (s >= DRIVE.goal ? 'Goal' : s <= 50 ? `Own ${s}` : `Opp ${DRIVE.goal - s}`);

// Draws the play area: yard lines, the line of scrimmage, both formations, the receivers and the catch circle.
function drawPlay(ctx, { off, def, play, frame, kind, catchSpot }) {
  const W = VW * TILE; const H = VH * TILE;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#06110a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0d2a19'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  for (let x = 0; x <= VW; x += 5) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); ctx.stroke(); }
  // line of scrimmage
  ctx.strokeStyle = 'rgba(255,208,80,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo((BLUE_LOS_X + 1 - X0) * TILE, 0); ctx.lineTo((BLUE_LOS_X + 1 - X0) * TILE, H); ctx.stroke();
  const cell = (x, y, color) => {
    const sx = x - X0; const sy = y - Y0;
    if (sx < 0 || sy < 0 || sx >= VW || sy >= VH) return;
    ctx.fillStyle = color; ctx.fillRect(sx * TILE + 1, sy * TILE + 1, TILE - 2, TILE - 2);
  };
  const dim = (list, color) => list.forEach((c) => cell(c.x, c.y, color));
  const defCells = def ? placeFormation({ players: def.players.filter((p) => p.role !== 'RS') }, RED) : [];
  if (frame) {
    // an animation frame: the whole Life grid (run) or the evolving coverage (pass)
    if (kind === 'run') {
      for (let k = 0; k < frame.length; k++) if (frame[k]) cell(k % COLS, (k / COLS) | 0, frame[k] === BLUE ? '#3aa0ff' : '#ff4d79');
    } else {
      dim(off ? placeFormation({ players: off.players.filter((p) => p.role !== 'RS') }, BLUE) : [], '#3aa0ff');
      dim(defCells.filter((c) => false), '#ff4d79');
      for (let k = 0; k < frame.length; k++) if (frame[k]) cell(k % COLS, (k / COLS) | 0, '#ff4d79');
      // the front line stays put (receivers are ghosts to it)
      const front = def ? placeFormation({ players: def.players.filter((p) => p.role === 'DL') }, RED) : [];
      dim(front, 'rgba(255,77,121,0.55)');
    }
  } else {
    dim(off ? placeFormation({ players: off.players.filter((p) => p.role !== 'RS') }, BLUE) : [], '#3aa0ff');
    dim(defCells, '#ff4d79');
  }
  // receivers and the target
  if (off) {
    receiversOf(off).forEach((p, i) => {
      const x = BLUE_LOS_X - p.depth - X0 + 1; const y = CENTER_Y + p.lat - Y0 + 1;
      const sel = play && play.kind === 'pass' && play.target === i;
      ctx.beginPath(); ctx.arc(x * TILE, y * TILE, sel ? 11 : 9, 0, Math.PI * 2);
      ctx.fillStyle = sel ? '#ffd050' : 'rgba(255,255,255,0.18)'; ctx.fill();
      ctx.fillStyle = sel ? '#1a1200' : '#e8fff1'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x * TILE, y * TILE + 1);
    });
  }
  const spot = catchSpot || (play && play.kind === 'pass' && off ? (() => {
    const rec = receiversOf(off)[play.target]; if (!rec) return null;
    return { x: BLUE_LOS_X + 2 + TUNE.catchDepth[play.depth], y: CENTER_Y + rec.lat, r: TUNE.reach[play.depth] };
  })() : null);
  if (spot) {
    ctx.strokeStyle = 'rgba(255,208,80,0.9)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc((spot.x - X0 + 0.5) * TILE, (spot.y - Y0 + 0.5) * TILE, (spot.r + 0.5) * TILE, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (play && play.kind === 'run' && off) {
    const lat = RUN_LANES[play.lane] ?? 0;
    ctx.strokeStyle = 'rgba(255,208,80,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo((BLUE_LOS_X - 6 - X0) * TILE, (CENTER_Y + lat - Y0 + 1) * TILE); ctx.lineTo((BLUE_LOS_X + 14 - X0) * TILE, (CENTER_Y + lat - Y0 + 1) * TILE); ctx.stroke(); ctx.setLineDash([]);
  }
}

// The Football drive: call plays against a bot defence and try to score. A touchdown pays the bet x DRIVE_PAYOUT.
export default function Drive({ balance, table, minBet, maxBet, betStep, feeFor, seed, onStart, onFinish, onExit }) {
  const [wager, setWager] = useState(Math.min(maxBet, Math.max(minBet, minBet)));
  const [state, setState] = useState(null);   // null until the drive starts
  const [held, setHeld] = useState(0);        // stake (with fee) taken for this drive
  const [offId, setOffId] = useState(OFFENCES[0].id);
  const [kind, setKind] = useState('pass');
  const [target, setTarget] = useState(0);
  const [depth, setDepth] = useState('mid');
  const [lane, setLane] = useState(1);
  const [calls, setCalls] = useState([]);
  const [def, setDef] = useState(null);       // the defence shown before the snap
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef(null);
  const view = useRef({});
  const extra0 = useRef(null); // true while a play is animating
  const skip = useRef(false);   // tap the field to skip the animation
  const rngRef = useRef(null);
  const off = offenceById(offId);
  const receivers = useMemo(() => receiversOf(off), [off]);
  const play = kind === 'pass' ? { off: offId, kind, target: Math.min(target, receivers.length - 1), depth } : { off: offId, kind, lane };

  useEffect(() => { if (target >= receivers.length) setTarget(0); }, [receivers.length, target]);

  const fee = feeFor(table, wager);
  const cost = wager + fee;
  const canStart = balance >= cost && wager >= minBet;

  const start = () => {
    if (!canStart || !onStart(cost)) return;
    rngRef.current = createRng(seed);
    const d0 = newDrive();
    setHeld(cost); setState(d0); setCalls([]); setMsg('');
    setDef(chooseDefence(rngRef.current, [], table.scout));
  };

  useEffect(() => { if (!extra0.current) view.current = { off, def: state ? def : null, play: state ? play : null }; });

  useEffect(() => {
    const c = canvas.current; if (!c) return undefined;
    const ctx = c.getContext('2d');
    let raf;
    const loop = () => { drawPlay(ctx, view.current); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const snap = () => {
    if (busy || !state || state.over || !def) return;
    setBusy(true); setMsg(''); skip.current = false;
    const playRng = createRng(seed ^ Math.imul(state.plays + 1, 0x9e3779b1));
    const out = resolvePlay(play, def, playRng, TUNE, true);
    const frames = out.frames || [];
    let i = 0; extra0.current = true;
    const kindNow = play.kind;
    const tick = () => {
      if (i < frames.length) {
        view.current = { off, def, play, frame: frames[i], kind: kindNow, catchSpot: out.catchSpot };
        i += skip.current ? frames.length : 1; setTimeout(tick, skip.current ? 0 : 40);
      } else {
        extra0.current = null;
        const next = advance(state, out);
        const nextCalls = [...calls, play];
        setCalls(nextCalls); setState(next); setMsg(out.note);
        if (next.over) { setDef(null); setBusy(false); onFinish(next.over === 'td', wager, next); }
        else { setDef(chooseDefence(rngRef.current, nextCalls, table.scout)); setBusy(false); }
      }
    };
    tick();
  };

  const over = state && state.over;
  const win = over === 'td';
  const overText = { td: `Touchdown! +${money(Math.round(wager * DRIVE_PAYOUT))}`, int: 'Intercepted. Drive over.', downs: 'Turnover on downs.', clock: 'Out of time.' }[over];

  return (
    <main className="drive">
      <div className="drivehead">
        <div className="driveinfo">
          {state ? (
            <>
              <b>{over ? 'Drive over' : `${ordinal(state.down)} & ${state.toGo}`}</b>
              <span>{spotText(state.spot)} · play {state.plays + (over ? 0 : 1)}</span>
            </>
          ) : <b>Football drive</b>}
        </div>
        <div className="drivefield" aria-label="Field position">
          <i style={{ width: `${Math.min(100, state ? state.spot : DRIVE.startSpot)}%` }} />
          {state && !over && <em style={{ left: `${Math.min(100, state.spot + state.toGo)}%` }} title="First-down line" />}
        </div>
        <button className="ghost small" onClick={() => (state && !over ? setLeaving(true) : onExit())}>Exit</button>
      </div>
      {leaving && (
        <div className="driveleave">
          <span>Leave the drive? You lose the {money(held)} stake.</span>
          <button className="ghost small" onClick={() => { setLeaving(false); onFinish(false, wager, { over: 'quit' }); onExit(); }}>Leave</button>
          <button className="ghost small" onClick={() => setLeaving(false)}>Stay</button>
        </div>
      )}
      <div className="driveplay">
        <canvas ref={canvas} width={VW * TILE} height={VH * TILE} className="drivecanvas" aria-label="The play" onClick={() => { skip.current = true; }} />
        <div className="drivedef">{def ? <>Defence shows <b>{def.name}</b></> : state ? '' : 'Set a stake and start a drive. Score a touchdown to win.'}</div>
      </div>

      {!state ? (
        <div className="drivepanel">
          <p className="note">Call plays one at a time against a bot defence. 4 downs for each 10 yards; a touchdown pays <b>×{DRIVE_PAYOUT}</b>, an interception or turnover on downs loses the stake. The defence reads your calls: repeat yourself and it adjusts.</p>
          <label className="betbox">
            <span>Stake <b>{money(wager)}</b>{fee ? ` + ${money(fee)} fee` : ''}</span>
            <input type="range" min={minBet} max={Math.max(minBet, maxBet)} step={betStep} value={wager} onChange={(e) => setWager(Number(e.target.value))} />
          </label>
          <button className="lock" disabled={!canStart} onClick={start}>{canStart ? `Start drive · ${money(cost)}` : 'Not enough cash'}</button>
        </div>
      ) : over ? (
        <div className="drivepanel">
          <p className={win ? 'verdict win' : 'verdict lose'}>{overText}</p>
          {msg && <p className="note drivemsg">Last play: {msg}</p>}
          <button className="lock" onClick={() => { setState(null); setDef(null); setCalls([]); setMsg(''); }}>New drive</button>
        </div>
      ) : (
        <div className="drivepanel">
          {msg && <p className="note drivemsg">{msg}</p>}
          {state.log.length > 0 && <p className="note drivelog">{state.log.slice(-4).map((o) => o.note).join(' · ')}</p>}
          <div className="drivepick" role="group" aria-label="Formation">
            {OFFENCES.map((o) => (
              <button key={o.id} className={o.id === offId ? 'chip on' : 'chip'} onClick={() => setOffId(o.id)} disabled={busy}>{o.name}</button>
            ))}
          </div>
          <div className="driveseg" role="group" aria-label="Play type">
            <button className={kind === 'pass' ? 'on' : ''} onClick={() => setKind('pass')} disabled={busy}>Pass</button>
            <button className={kind === 'run' ? 'on' : ''} onClick={() => setKind('run')} disabled={busy}>Run</button>
          </div>
          {kind === 'pass' ? (
            <>
              <div className="driveseg" role="group" aria-label="Receiver">
                {receivers.map((r, i) => (
                  <button key={i} className={target === i ? 'on' : ''} onClick={() => setTarget(i)} disabled={busy}>{i + 1}</button>
                ))}
              </div>
              <div className="driveseg" role="group" aria-label="Depth">
                {DEPTHS.map((d) => <button key={d} className={depth === d ? 'on' : ''} onClick={() => setDepth(d)} disabled={busy}>{DEPTH_LABEL[d]}</button>)}
              </div>
            </>
          ) : (
            <div className="driveseg" role="group" aria-label="Lane">
              {RUN_LANES.map((_, i) => <button key={i} className={lane === i ? 'on' : ''} onClick={() => setLane(i)} disabled={busy}>{LANE_LABEL[i]}</button>)}
            </div>
          )}
          <button className="lock" disabled={busy || !def} onClick={snap}>{busy ? 'Play in progress…' : 'Snap'}</button>
        </div>
      )}
    </main>
  );
}
