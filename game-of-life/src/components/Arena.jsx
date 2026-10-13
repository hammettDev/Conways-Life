import React, { useEffect, useRef } from 'react';
import { drawBoard, boardSize } from '../render/drawBoard.js';

const TILE = 12;

// Board 1. `getView` is called every frame and returns what to draw, so React
// never re-renders for the simulation itself. `rotate` flips to the Madden view
// (field running top to bottom).
export default function Arena({ getView, rotate = false }) {
  const ref = useRef(null);
  const { cols, rows } = boardSize(rotate);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cols * TILE * dpr;
    canvas.height = rows * TILE * dpr;
    let raf;
    const loop = (ms) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBoard(ctx, { ...getView(), tile: TILE, time: ms / 1000, rotate });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getView, rotate, cols, rows]);
  return (
    <canvas
      ref={ref} className={rotate ? 'arena madden' : 'arena'}
      style={{ aspectRatio: `${cols} / ${rows}` }} aria-label="Battle board"
    />
  );
}
