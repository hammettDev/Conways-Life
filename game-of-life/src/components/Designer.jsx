import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CUSTOM_SHAPES, MAX_DEPTH, checkCustom, buildCustom } from '../engine/custom.js';
import { SHAPES, UNIT_TILES } from '../engine/shapes.js';
import { FREE_BUILDS, TARGET_TILES } from '../engine/library.js';
import { MAX_CUSTOM_UNITS, CUSTOM_RATING_CAP } from '../engine/constants.js';
import { designHash } from '../engine/rating.js';

const LAT_MIN = -20;
const LAT_MAX = 19;
const DEPTHS = 26;
const PX = 14;
const W = (LAT_MAX - LAT_MIN + 1) * PX;
const H = DEPTHS * PX;
const LABEL = { bar: 'Bar', dart: 'Dart', ell: 'L', block: 'Block', tub: 'Tub', boat: 'Boat', hive: 'Hive', loaf: 'Loaf', toad: 'Toad', toadv: 'Toad (up)', beacon: 'Beacon' };

const cellsOf = (p) => SHAPES[p.shape].map(([du, dv]) => [p.depth + du, p.lat + dv]);

// Design a formation on your own half. Top is the line of scrimmage, the bottom is your backfield.
export default function Designer({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name || 'My formation');
  const [units, setUnits] = useState(initial.players || []);
  const [shape, setShape] = useState('bar');
  const [hover, setHover] = useState(null);
  const canvas = useRef(null);
  // The rating belongs to one exact design: change a unit and it has to be measured again.
  const [rated, setRated] = useState(initial.rating != null ? { key: designHash(initial.players, 0), rating: initial.rating } : null);
  const [progress, setProgress] = useState(null); // { done, total } while rating
  const worker = useRef(null);
  useEffect(() => () => worker.current && worker.current.terminate(), []);

  const spec = { id: initial.id, name, players: units };
  const check = useMemo(() => checkCustom(spec), [units]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = useMemo(() => designHash(units, 0), [units]);
  const current = rated && rated.key === key ? rated.rating : null;
  const overCap = current != null && current > CUSTOM_RATING_CAP + 1e-9;
  const measure = () => {
    if (worker.current) worker.current.terminate();
    const w = new Worker(new URL('../workers/rating.worker.js', import.meta.url), { type: 'module' });
    worker.current = w;
    setProgress({ done: 0, total: FREE_BUILDS.length });
    w.onmessage = (e) => {
      if (e.data.type === 'progress') setProgress({ done: e.data.done, total: e.data.total });
      else { setRated({ key, rating: e.data.rating }); setProgress(null); w.terminate(); worker.current = null; }
    };
    w.postMessage({ players: units });
  };
  const reserves = useMemo(() => (check.ok ? buildCustom(spec).players.filter((p) => p.role === 'RS') : []), [units, check.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (ev) => {
    const r = canvas.current.getBoundingClientRect();
    const lat = Math.floor(((ev.clientX - r.left) / r.width) * (LAT_MAX - LAT_MIN + 1)) + LAT_MIN;
    const depth = Math.floor(((ev.clientY - r.top) / r.height) * DEPTHS);
    return { lat, depth };
  };
  const unitAt = ({ lat, depth }) => units.findIndex((p) => cellsOf(p).some(([d, l]) => d === depth && l === lat));

  const click = (ev) => {
    const t = at(ev);
    const hit = unitAt(t);
    if (hit >= 0) setUnits(units.filter((_, i) => i !== hit));
    else if (units.length < MAX_CUSTOM_UNITS) setUnits([...units, { shape, depth: t.depth, lat: t.lat }]);
  };

  const ghostOk = hover && unitAt(hover) < 0 && !cellsOf({ shape, ...hover }).some(([d, l]) => units.some((p) => cellsOf(p).some(([a, b]) => a === d && b === l)));

  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a1a10';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,200,150,0.12)';
    ctx.beginPath();
    for (let i = 0; i <= LAT_MAX - LAT_MIN + 1; i++) { ctx.moveTo(i * PX + 0.5, 0); ctx.lineTo(i * PX + 0.5, H); }
    for (let j = 0; j <= DEPTHS; j++) { ctx.moveTo(0, j * PX + 0.5); ctx.lineTo(W, j * PX + 0.5); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,176,46,0.5)'; // the line of scrimmage
    ctx.fillRect(0, 0, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; // too far back
    ctx.fillRect(0, (MAX_DEPTH + 1) * PX, W, H - (MAX_DEPTH + 1) * PX);
    const draw = (cells, color) => { ctx.fillStyle = color; for (const [d, l] of cells) ctx.fillRect((l - LAT_MIN) * PX + 1, d * PX + 1, PX - 2, PX - 2); };
    for (const r of reserves) draw(cellsOf(r), 'rgba(160,170,160,0.35)');
    for (const p of units) draw(cellsOf(p), '#38a9ff');
    if (hover) draw(cellsOf({ shape, ...hover }), ghostOk ? 'rgba(80,230,140,0.55)' : 'rgba(255,61,120,0.5)');
  }, [units, hover, shape, ghostOk, reserves]);

  const preset = (id) => {
    const b = FREE_BUILDS.find((x) => x.id === id);
    if (b) { setUnits(b.players.filter((p) => p.role !== 'RS').map(({ shape: s, depth, lat }) => ({ shape: s, depth, lat }))); setName(`${b.name} (mine)`); }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Formation designer">
      <div className="dialog designer">
        <h2>Design a formation</h2>
        <p className="note">Same rules as every formation: {TARGET_TILES} tiles, your half only, and it has to hold still on its own. Click to place a unit, click a unit to remove it. Grey tiles are reserves added automatically.</p>
        <div className="designrow">
          <div>
            <canvas
              ref={canvas} width={W} height={H} className="designboard" aria-label="Your half of the field"
              onPointerMove={(e) => setHover(at(e))} onPointerLeave={() => setHover(null)} onClick={click}
            />
            <p className="note small">Top edge = line of scrimmage. Bottom = your backfield.</p>
          </div>
          <div className="designside">
            <label className="note">Name <input className="search" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-label="Formation name" /></label>
            <div className="shapes" role="radiogroup" aria-label="Unit">
              {CUSTOM_SHAPES.map((s) => (
                <button key={s} role="radio" aria-checked={shape === s} className={shape === s ? 'chip on' : 'chip'} onClick={() => setShape(s)}>{LABEL[s]} {UNIT_TILES[s]}</button>
              ))}
            </div>
            <label className="note">Start from <select className="search" defaultValue="" onChange={(e) => preset(e.target.value)} aria-label="Start from a built-in formation">
              <option value="" disabled>a built-in…</option>
              {FREE_BUILDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></label>
            <p className={check.ok ? 'hint good' : 'hint bad'} role="status">
              {units.length} of {MAX_CUSTOM_UNITS} units · {check.footprint} of {TARGET_TILES} tiles{check.ok ? ' · ready' : ` · ${check.reason}`}
            </p>
            <div className="ratebox">
              <button className="ghost" onClick={measure} disabled={!check.ok || Boolean(progress)}>
                {progress ? `Rating… ${Math.round((progress.done / progress.total) * 100)}%` : current != null ? 'Rate again' : 'Rate this formation'}
              </button>
              {current != null && (
                <p className={overCap ? 'hint bad' : 'hint good'} role="status">
                  Rating {Math.round(current * 100)}% · limit {Math.round(CUSTOM_RATING_CAP * 100)}%{overCap ? ' · too strong, adjust it' : ' · allowed'}
                </p>
              )}
              {current == null && !progress && <p className="hint">Rate it to save: it is measured against the bot formations (about 10 seconds). The best built-in formations rate 65-67%.</p>}
            </div>
            <div className="row">
              <button className="ghost" onClick={() => setUnits([])}>Clear</button>
              <button className="ghost" onClick={onClose}>Cancel</button>
              <button className="go" disabled={!check.ok || !name.trim() || current == null || overCap} onClick={() => onSave({ id: initial.id, name: name.trim(), players: units, rating: current, hash: designHash(units, current) })}>Save formation</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
