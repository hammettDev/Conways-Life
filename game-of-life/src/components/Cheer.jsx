import React, { useEffect, useRef } from 'react';
import { createCheer, CHEER_W, CHEER_H, CHEER_GENS } from '../game/cheer.js';
import { TICK_MS } from './fieldDraw.js';

const CELL = 10;
const COLOR = { you: { base: '#2f9bff', glow: 'rgba(47,155,255,0.55)', label: '#6fc0ff' }, them: { base: '#ff4d79', glow: 'rgba(255,77,121,0.5)', label: '#ff8fae' } };

// The cheerleader routine: when somebody scores, a short piece of real Life dances over the field (see game/cheer.js).
// Tap, click or press Space to skip it.
export default function Cheer({ side, pts, kind, teamName, subtitle, sfx, onDone }) {
  const canvas = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;
  const col = COLOR[side] || COLOR.you;

  // the sound that goes with it
  useEffect(() => {
    if (sfx) sfx.play(kind === 'win' ? 'victory' : side === 'them' ? 'theirScore' : kind === 'td' ? 'touchdown' : 'fieldGoal');
  }, [kind, side, sfx]);

  useEffect(() => {
    const c = canvas.current; const ctx = c.getContext('2d');
    const show = createCheer(kind);
    const total = CHEER_GENS[kind];
    let prev = new Uint8Array(show.cells);
    const paint = () => {
      ctx.fillStyle = 'rgba(4, 14, 9, 0.96)'; ctx.fillRect(0, 0, c.width, c.height);
      const g = show.cells;
      ctx.shadowBlur = 8; ctx.shadowColor = col.glow;
      for (let k = 0; k < g.length; k++) {
        if (!g[k]) continue;
        const x = k % CHEER_W; const y = (k / CHEER_W) | 0;
        ctx.fillStyle = prev[k] ? col.base : '#ffffff'; // a newborn cell flashes white
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      }
      ctx.shadowBlur = 0;
    };
    paint();
    const timer = setInterval(() => {
      prev = new Uint8Array(show.cells);
      show.step(); paint();
      if (show.gen >= total) { clearInterval(timer); setTimeout(() => done.current(), 450); }
    }, Math.min(55, TICK_MS));
    return () => clearInterval(timer);
  }, [kind, col]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); done.current(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mine = side === 'you';
  return (
    <div className="cheer" role="dialog" aria-label="Score celebration" onClick={() => done.current()}>
      <div className="cheerbox">
        <canvas ref={canvas} width={CHEER_W * CELL} height={CHEER_H * CELL} className="cheercanvas" />
        <div className="cheertext" style={{ color: col.label }}>
          <b>{kind === 'win' ? 'VICTORY!' : kind === 'td' ? 'TOUCHDOWN!' : 'FIELD GOAL!'}</b>
          <span>{kind === 'win' ? subtitle : `${mine ? 'You' : teamName} +${pts}`}</span>
        </div>
        <small>Tap to skip</small>
      </div>
    </div>
  );
}
