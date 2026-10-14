import React, { useEffect, useRef } from 'react';
import { createPreview, drawPreview, thumbCells, VIEW } from '../render/miniPreview.js';
import { THEME } from '../render/theme.js';

const TILE = 9;
const TICKS_PER_SECOND = 9;

// A little looping "in-shot" demo of a shop item meeting something in its way.
export function MiniPreview({ objectId }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = VIEW.w * TILE * dpr;
    canvas.height = VIEW.h * TILE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const preview = createPreview(objectId);
    let raf;
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      acc += Math.min(0.1, (now - last) / 1000) * TICKS_PER_SECOND;
      last = now;
      while (acc >= 1) { preview.step(); acc -= 1; }
      drawPreview(ctx, preview, TILE, now / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [objectId]);
  return <canvas ref={ref} className="minipreview" aria-label="Preview of the item in action" />;
}

// A still picture of just the piece, for the list.
export function Thumb({ shape }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const { cells, w, h } = thumbCells(shape);
    const t = Math.max(3, Math.min(7, Math.floor(34 / Math.max(w, h))));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 40 * dpr;
    canvas.height = 40 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 40, 40);
    const ox = Math.round((40 - w * t) / 2);
    const oy = Math.round((40 - h * t) / 2);
    ctx.fillStyle = THEME.blue;
    for (const [x, y] of cells) ctx.fillRect(ox + x * t + 0.5, oy + y * t + 0.5, t - 1, t - 1);
  }, [shape]);
  return <canvas ref={ref} className="thumb" style={{ width: 40, height: 40 }} aria-hidden="true" />;
}
