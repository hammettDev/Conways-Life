import React, { useEffect, useRef } from 'react';
import { drawPit } from '../render/drawBoard.js';

const TILE = 24;

// Board 2, the pit. `getView` returns { size, hot, blue, red } each frame.
export default function Pit({ getView, size = 10 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * TILE * dpr;
    canvas.height = size * TILE * dpr;
    let raf;
    const loop = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPit(ctx, { ...getView(), size, tile: TILE });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getView, size]);
  return <canvas ref={ref} className="pit" aria-label="Pit board" />;
}
