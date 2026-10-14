import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLivePlay, LIVE_OFFENCES, liveOffenceById } from '../engine/footballLive.js';
import { RUN_LANES } from '../engine/football.js';
import { drawField, TICK_MS, VW, VH, TILE, LANE_LABEL } from './fieldDraw.js';
import { createRng } from '../engine/rng.js';

const EMPTY_DEF = { id: 'none', name: 'unknown', players: [] };

// One play of the live football game. You call the play without seeing the defence; locking in reveals it, and you may
// audible (a limited number a game) to change your call: a good opponent may answer with a counter. Then snap, and on
// a pass fire the ball with a key or a tap.
// Keys: Space = lock in / snap / throw / next, 1-4 pick a receiver, Left/Right cycle receivers, P / R switch pass / run.
export default function LiveField({ team, defFor, counterFor, audibles, onAudible, seed, onPlay }) {
  const [offId, setOffId] = useState(LIVE_OFFENCES[0].id);
  const [kind, setKind] = useState('pass');
  const [lane, setLane] = useState(1);
  const [sel, setSel] = useState(0);
  const [phase, setPhase] = useState('call'); // call -> revealed -> (audible -> revealed2) -> live -> result
  const [def, setDef] = useState(null);       // the defence, once it is revealed
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);
  const canvas = useRef(null);
  const playRef = useRef(null);
  const view = useRef({});
  const timer = useRef(null);
  const rngRef = useRef(createRng(seed));
  const [, force] = useState(0);

  const off = liveOffenceById(offId);
  const laneLat = RUN_LANES[lane];
  const editing = phase === 'call' || phase === 'audible';
  const shownDef = def || EMPTY_DEF;

  // a fresh, un-snapped play whenever the call changes: this is what the field shows before the snap
  const preview = useMemo(() => createLivePlay({ off, def: shownDef, kind, lane: laneLat, rng: rngRef.current }), [off, shownDef, kind, laneLat]);
  useEffect(() => { if (phase !== 'live' && phase !== 'result') { playRef.current = preview; view.current = { play: preview, sel }; } }, [preview, phase, sel]);
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

  const call = () => ({ off, kind, lane: laneLat });
  // lock in your call: the defence shows its hand
  const lockIn = () => { if (phase !== 'call') return; setDef(defFor(call())); setNote(''); setPhase('revealed'); };
  const callAudible = () => { if (phase !== 'revealed' || audibles <= 0) return; onAudible(); setPhase('audible'); };
  const confirmAudible = () => {
    if (phase !== 'audible') return;
    const answer = counterFor(call(), def);
    if (answer && answer.id !== def.id) { setDef(answer); setNote(`They read it and countered with ${answer.name}!`); } else setNote('They stayed put.');
    setPhase('revealed2');
  };
  const snap = () => {
    if (phase !== 'revealed' && phase !== 'revealed2') return;
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
    const r = result; setResult(null); setPhase('call'); setDef(null); setNote('');
    onPlay(r, { off: offId, kind });
  };
  const fire = () => {
    const play = playRef.current;
    if (phase !== 'live' || !play || play.kind !== 'pass') return;
    play.throwTo(sel);
    force((n) => n + 1);
  };

  const act = () => {
    if (phase === 'call') lockIn();
    else if (phase === 'audible') confirmAudible();
    else if (phase === 'revealed' || phase === 'revealed2') snap();
    else if (phase === 'live') fire();
    else next();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key;
      if (k === ' ' || k === 'Enter') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); act(); return; }
      // receivers can be picked in any phase (before the snap too): the number keys, or the arrows to step through them
      if (/^[1-6]$/.test(k)) { e.preventDefault(); const i = Number(k) - 1; if (i < off.receivers.length) setSel(i); return; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % off.receivers.length); return; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); setSel((s) => (s + off.receivers.length - 1) % off.receivers.length); return; }
      if (editing) { if (k === 'p' || k === 'P') setKind('pass'); if (k === 'r' || k === 'R') setKind('run'); }
      if (phase === 'revealed' && (k === 'a' || k === 'A')) callAudible();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const play = playRef.current;
  const aim = phase === 'live' && play && play.kind === 'pass' && play.caught === null && play.throwTick === null ? play.aim(sel) : null;
  const thrown = phase === 'live' && play && play.throwTick !== null;
  const ready = aim && aim.wait !== null && aim.wait <= 14 && aim.wait >= -5;

  return (
    <div className="livefield">
      <div className="driveplay">
        <canvas ref={canvas} width={VW * TILE} height={VH * TILE} className="drivecanvas" aria-label="The play" onClick={act} />
        <div className="drivedef">
          {def ? <>{team.name} show <b>{def.name}</b>. {note}</> : 'Call your play. The defence has not shown its hand.'}
        </div>
      </div>
      <div className="drivepanel">
        {editing && (
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
            {phase === 'call'
              ? <p className="note">{kind === 'pass' ? 'Receivers are light spaceships; the ball is a glider you fire from the quarterback. After the snap pick a receiver (1-4) and press Space when the dashed line turns green.' : 'The runner is a glider sent through the line.'}</p>
              : <p className="note drivemsg">Audible: change your call. A sharp team may see it coming.</p>}
            <button className="lock" onClick={phase === 'call' ? lockIn : confirmAudible}>{phase === 'call' ? 'Lock in call · Space' : 'Confirm audible · Space'}</button>
          </>
        )}
        {(phase === 'revealed' || phase === 'revealed2') && (
          <>
            <p className="note drivemsg">{phase === 'revealed' ? `They showed ${def.name}.` : note}</p>
            {kind === 'pass' && (
              <div className="driveseg" role="group" aria-label="Receiver">
                {off.receivers.map((r, i) => <button key={i} className={sel === i ? 'on' : ''} onClick={() => setSel(i)}>{i + 1}</button>)}
              </div>
            )}
            <button className="lock" onClick={snap}>Snap · Space</button>
            {phase === 'revealed' && <button className="ghost" disabled={audibles <= 0} onClick={callAudible}>Audible · A ({audibles} left)</button>}
          </>
        )}
        {phase === 'live' && (
          <>
            {play && play.kind === 'pass' && (
              <div className="driveseg" role="group" aria-label="Receiver">
                {off.receivers.map((r, i) => (
                  <button key={i} className={sel === i ? 'on' : ''} disabled={!play.receivers[i].alive} onClick={() => setSel(i)}>{i + 1}</button>
                ))}
              </div>
            )}
            {play && play.kind === 'pass' && (
              <button className={`lock throw${ready ? ' go' : ''}`} disabled={thrown} onClick={fire}>
                {thrown ? 'Ball in the air…' : aim && aim.wait !== null ? (ready ? 'THROW NOW · Space' : aim.wait > 14 ? 'Wait for it · Space' : 'Too late for this one') : 'Throw · Space'}
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
