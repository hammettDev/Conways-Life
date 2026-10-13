import React, { useEffect, useRef } from 'react';
import { drawTable, tableSize } from '../render/drawBoard.js';

const TILE = 12;

// Board 1 with the plumbing and the pit under it, as one canvas. `getView` is
// called every frame and returns what to draw, so React never re-renders for the
// simulation itself. `rotate` is the Madden view (field running top to bottom).
export default function Arena({ getView, rotate = false }) {
  const ref = useRef(null);
  const { cols, rows } = tableSize(rotate);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cols * TILE * dpr;
    canvas.height = rows * TILE * dpr;
    let raf;
    const loop = (ms) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTable(ctx, { ...getView(), tile: TILE, time: ms / 1000, now: ms, rotate });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getView, rotate, cols, rows]);
  return (
    <canvas
      ref={ref} className="arena" style={{ aspectRatio: `${cols} / ${rows}` }}
      aria-label="Battle board with the gutter and the pit underneath"
    />
  );
}
