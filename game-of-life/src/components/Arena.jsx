import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { drawTable, tableSize, boardSize, fromScreen } from '../render/drawBoard.js';
import { COLS, ROWS } from '../engine/constants.js';

const TILE = 12;

// Board 1 with the plumbing and the pit under it, as one canvas. `getView` is
// called every frame and returns what to draw, so React never re-renders for the
// simulation itself. `rotate` is the Madden view (field running top to bottom).
// The parent can ask which board tile a screen point is over via `tileAt`.
const Arena = forwardRef(function Arena({ getView, rotate = false, onHover, onTileClick }, outer) {
  const ref = useRef(null);
  const { cols, rows } = tableSize(rotate);
  const board = boardSize(rotate);

  const tileAt = (clientX, clientY) => {
    const canvas = ref.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const sx = Math.floor(((clientX - r.left) / r.width) * cols);
    const sy = Math.floor(((clientY - r.top) / r.height) * rows);
    if (sx < 0 || sx >= board.cols || sy < 0 || sy >= board.rows) return null; // off the board (or on the pit)
    const [x, y] = fromScreen(sx, sy, rotate);
    return x >= 0 && x < COLS && y >= 0 && y < ROWS ? [x, y] : null;
  };
  useImperativeHandle(outer, () => ({ tileAt }));

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
      onPointerMove={onHover ? (e) => onHover(tileAt(e.clientX, e.clientY)) : undefined}
      onPointerLeave={onHover ? () => onHover(null) : undefined}
      onClick={onTileClick ? (e) => onTileClick(tileAt(e.clientX, e.clientY)) : undefined}
    />
  );
});

export default Arena;
