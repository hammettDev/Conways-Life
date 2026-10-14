import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLivePlay } from '../engine/footballLive.js';
import { DEFENCES, defenceById } from '../engine/football.js';
import { drawField, TICK_MS, VW, VH, TILE } from './fieldDraw.js';
import { botDriver } from '../game/botOffence.js';
import { defenceHint } from '../game/season.js';
import { createRng } from '../engine/rng.js';


// One play of their drive: you see the formation they lined up in, pick your defence, and watch it play out. The bot
// throws (or runs) on its own. Tap the field to speed it up.
export default function DefendField({ call, team, seed, onPlay, onSim }) {
  const [defId, setDefId] = useState('fb-cover-3');
  const [phase, setPhase] = useState('call'); // call -> live -> result
  const [result, setResult] = useState(null);
  const [fast, setFast] = useState(false);
  const canvas = useRef(null);
  const view = useRef({});
  const timer = useRef(null);
  const playRef = useRef(null);
  const fastRef = useRef(false);
  const rngRef = useRef(createRng(seed));
  const [, force] = useState(0);
  const def = defenceById(defId);

  const preview = useMemo(() => createLivePlay({ off: call.off, def, kind: call.kind, lane: call.lane, rng: rngRef.current }), [call, def]);
  useEffect(() => { if (phase === 'call') { playRef.current = preview; view.current = { play: preview, sel: -1 }; } }, [preview, phase]);
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
  const next = () => { if (phase === 'result' && result) { const r = result; setResult(null); setPhase('call'); onPlay(r, defId); } };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (phase === 'call') snap(); else if (phase === 'result') next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="livefield">
      <div className="driveplay">
        <canvas ref={canvas} width={VW * TILE} height={VH * TILE} className="drivecanvas" aria-label="Their play" onClick={speed} />
        <div className="drivedef">{team.name} line up in <b>{call.off.name}</b>. Pick your defence.{phase === 'live' ? ' Tap the field to speed up.' : ''}</div>
      </div>
      <div className="drivepanel">
        {phase === 'call' && (
          <>
            <div className="drivepick" role="group" aria-label="Your defence">
              {DEFENCES.map((d) => <button key={d.id} className={defId === d.id ? 'chip on' : 'chip'} onClick={() => setDefId(d.id)}>{d.name}</button>)}
            </div>
            <p className="note">{def.name} {defenceHint(defId)}. They have not shown whether it is a pass or a run.</p>
            <button className="lock" onClick={snap}>Set defence · Space</button>
            <button className="ghost small" onClick={() => onSim(defId)}>Sim the rest of their drive</button>
          </>
        )}
        {phase === 'live' && <p className="note drivemsg">{call.kind === 'pass' ? 'Their quarterback drops back…' : 'Handoff…'}{typeof playRef.current?.live === 'number' && call.kind === 'run' ? ` ${playRef.current.live} yds` : ''}</p>}
        {phase === 'result' && result && (
          <>
            <p className={`verdict ${result.yards > 4 ? 'lose' : 'win'}`}>{result.kind === 'sack' ? 'Sack!' : result.kind === 'int' ? 'Interception!' : result.kind === 'incomplete' ? 'Incomplete' : result.yards <= 0 ? 'Stuffed' : `They gain ${result.yards}`}</p>
            <button className="lock" onClick={next}>Next · Space</button>
          </>
        )}
      </div>
    </div>
  );
}
