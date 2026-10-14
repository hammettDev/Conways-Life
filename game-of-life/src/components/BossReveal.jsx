import React, { useEffect, useState } from 'react';
import { BOSS_MULTIPLIERS } from '../engine/constants.js';

// A little slot reel: spins through the possible multipliers, then lands on the real one.
export default function BossReveal({ value }) {
  const [shown, setShown] = useState(null);
  useEffect(() => {
    let i = 0;
    const faces = BOSS_MULTIPLIERS.map(([m]) => m);
    const spin = setInterval(() => { setShown(faces[i % faces.length]); i++; }, 70);
    const stop = setTimeout(() => { clearInterval(spin); setShown(value); }, 1300);
    return () => { clearInterval(spin); clearTimeout(stop); };
  }, [value]);
  const landed = shown === value;
  return <span className={landed ? 'reel landed' : 'reel'}>×{shown ?? '?'}</span>;
}
