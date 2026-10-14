import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLivePlay, LIVE_OFFENCES, liveOffenceById } from '../engine/footballLive.js';
import { RUN_LANES } from '../engine/football.js';
import { drawField, TICK_MS, VW, VH, TILE, LANE_LABEL } from './fieldDraw.js';
import { createRng } from '../engine/rng.js';

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
