import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLivePlay, LIVE_OFFENCES, RUN_PLAYS } from '../engine/footballLive.js';
import { LIVE_DEFENCES, defenceById } from '../engine/football.js';
import { drawField, driveLines, canvasSize, TICK_MS } from './fieldDraw.js';
import { botDriver } from '../game/botOffence.js';
import { defenceHint, bestKindAgainst } from '../game/season.js';
import { createRng } from '../engine/rng.js';

const NO_OFFENCE = { id: 'none', name: 'unknown', line: [], receivers: [] };

// One play of their drive. You pick your defence without seeing their formation; locking in reveals it, and you may
// audible (a limited number a game). A sharp team may answer by changing its own play. Then the bot throws or runs
// on its own. Tap the field to speed it up.
export default function DefendField({ call: firstCall, team, audibles, onAudible, seed, onPlay, onSim, drive, rotate, tendency = [] }) {
  const [defId, setDefId] = useState('fb-cover-3');
  const [phase, setPhase] = useState('call'); // call -> revealed -> (audible -> revealed2) -> live -> result
  const [call, setCall] = useState(firstCall);
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);
  const [fast, setFast] = useState(false);
  const canvas = useRef(null);
  const view = useRef({});
  const extra = useRef({});
  extra.current = { rotate, lines: driveLines(drive) };
  const size = canvasSize(rotate);
  const timer = useRef(null);
  const playRef = useRef(null);
  const fastRef = useRef(false);
  const rngRef = useRef(createRng(seed));
  const [, force] = useState(0);
  const def = defenceById(defId);
  const shownOff = phase === 'call' ? NO_OFFENCE : call.off;
  const editing = phase === 'call' || phase === 'audible';

  const preview = useMemo(() => createLivePlay({ off: shownOff, def, kind: call.kind, lane: call.lane, rng: rngRef.current }), [shownOff, def, call]);
  useEffect(() => { if (phase !== 'live' && phase !== 'result') { playRef.current = preview; view.current = { play: preview, sel: -1 }; } }, [preview, phase]);
  useEffect(() => {
    const c = canvas.current; if (!c) return undefined;
    const ctx = c.getContext('2d'); let raf;
    const loop = () => { drawField(ctx, { ...view.current, ...extra.current }); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => () => clearInterval(timer.current), []);

  const lockIn = () => { if (phase === 'call') { setNote(''); setPhase('revealed'); } };
  const callAudible = () => { if (phase === 'revealed' && audibles > 0) { onAudible(); setPhase('audible'); } };
  const confirmAudible = () => {
    if (phase !== 'audible') return;
    // a sharp team sees your new defence and changes its play to hurt it
    const rng = rngRef.current;
    if (rng() < team.scout) {
      const kind = bestKindAgainst(defId);
      const off = LIVE_OFFENCES[Math.floor(rng() * LIVE_OFFENCES.length)];
      const changed = kind !== call.kind || off.id !== call.off.id;
      setCall({ off, kind, lane: Math.floor(rng() * RUN_PLAYS.length) });
      setNote(changed ? `They read it and switched to ${off.name}!` : 'They stayed put.');
    } else setNote('They stayed put.');
    setPhase('revealed2');
  };
  const snap = () => {
    if (phase !== 'revealed' && phase !== 'revealed2') return;
    const play = createLivePlay({ off: call.off, def, kind: call.kind, lane: call.lane, rng: rngRef.current });
    const drive = botDriver(play, team, rngRef.current);
    playRef.current = play; view.current = { play, sel: -1 }; play.start(); setPhase('live');
    const run = () => {
      drive();
      play.step();
      if (play.phase === 'done') { clearInterval(timer.current); setResult(play.result); setPhase('result'); }
      force((n) => n + 1);
    };
    const start = () => { clearInterval(timer.current); timer.current = setInterval(run, fastRef.current ? Math.min(20, TICK_MS) : TICK_MS); };
    start();
    playRef.current.restart = start;
  };
  const speed = () => { fastRef.current = !fastRef.current; setFast(fastRef.current); if (playRef.current && playRef.current.restart && phase === 'live') playRef.current.restart(); };
  const next = () => { if (phase === 'result' && result) { const r = result; setResult(null); onPlay(r, defId); } };

  const act = () => {
    if (phase === 'call') lockIn();
    else if (phase === 'audible') confirmAudible();
    else if (phase === 'revealed' || phase === 'revealed2') snap();
    else if (phase === 'result') next();
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(); }
      if (phase === 'revealed' && (e.key === 'a' || e.key === 'A')) callAudible();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="livefield">
      <div className="driveplay">
        <canvas ref={canvas} width={size.w} height={size.h} className="drivecanvas" style={{ aspectRatio: `${size.w} / ${size.h}`, width: `min(100%, calc((100dvh - 170px) * ${(size.w / size.h).toFixed(4)}))` }} aria-label="Their play" onClick={phase === 'live' ? speed : act} />
        <div className="drivedef">
          {phase === 'call' ? `${team.name} have not shown their formation. Pick your defence.` : <>{team.name} line up in <b>{call.off.name}</b>. {note}{phase === 'live' ? ' Tap the field to speed up.' : ''}</>}
        </div>
      </div>
      <div className="drivepanel">
        {editing && (
          <>
            <div className="drivepick" role="group" aria-label="Your defence">
              {LIVE_DEFENCES.map((d) => <button key={d.id} className={defId === d.id ? 'chip on' : 'chip'} onClick={() => setDefId(d.id)}>{d.name}</button>)}
            </div>
            {tendency.length >= 2 && <p className="note scout">Scouting: their last {tendency.length} calls were {tendency.map((k) => (k === 'run' ? 'R' : 'P')).join(' ')} ({Math.round((100 * tendency.filter((k) => k === 'pass').length) / tendency.length)}% pass).</p>}
            <p className="note">{def.name} {defenceHint(defId)}. {phase === 'call' ? 'You both lock in at the same time: they have not shown whether it is a pass or a run.' : 'Audible: change your defence. A sharp team may change its play.'}</p>
            <button className="lock" onClick={phase === 'call' ? lockIn : confirmAudible}>{phase === 'call' ? 'Lock in defence · Space' : 'Confirm audible · Space'}</button>
            {phase === 'call' && <button className="ghost small" onClick={() => onSim(defId)}>Sim the rest of their drive</button>}
          </>
        )}
        {(phase === 'revealed' || phase === 'revealed2') && (
          <>
            <p className="note drivemsg">{phase === 'revealed' ? `They are in ${call.off.name}.` : note}</p>
            <button className="lock" onClick={snap}>Snap · Space</button>
            {phase === 'revealed' && <button className="ghost" disabled={audibles <= 0} onClick={callAudible}>Audible · A ({audibles} left)</button>}
          </>
        )}
        {phase === 'live' && <p className="note drivemsg">{call.kind === 'pass' ? 'Their quarterback drops back…' : 'Handoff…'}{typeof playRef.current?.live === 'number' && call.kind === 'run' ? ` ${playRef.current.live} yds` : ''}</p>}
        {phase === 'result' && result && (
          <>
            <p className={`verdict ${result.yards > 6 ? 'lose' : 'win'}`}>{result.kind === 'sack' ? 'Sack!' : result.kind === 'int' ? 'Interception!' : result.kind === 'incomplete' ? 'Incomplete' : result.yards <= 0 ? 'Stuffed' : `They gain ${result.yards}`}</p>
            <button className="lock" onClick={next}>Next · Space</button>
          </>
        )}
      </div>
    </div>
  );
}
