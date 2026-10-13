import React, { useEffect, useRef } from 'react';
import { COLS, ROWS } from '../engine/constants.js';
import { drawBoard } from '../render/drawBoard.js';

const TILE = 11;

// Board 1. `getView` is called every frame and returns what to draw, so React
// never re-renders for the simulation itself.
export default function Arena({ getView }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = COLS * TILE * dpr;
    canvas.height = ROWS * TILE * dpr;
    let raf;
    const loop = (ms) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBoard(ctx, { ...getView(), tile: TILE, time: ms / 1000 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getView]);
  return <canvas ref={ref} className="arena" style={{ aspectRatio: `${COLS} / ${ROWS}` }} aria-label="Battle board" />;
}
