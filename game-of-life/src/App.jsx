import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Arena from './components/Arena.jsx';
import Sidebar from './components/Sidebar.jsx';
import { createEngine } from './engine/engine.js';
import { FREE_BUILDS } from './engine/library.js';
import { OBJECTS } from './engine/objects.js';
import { placeFormation, pickBotSetup } from './engine/formations.js';
import { DEFAULT_FORTUNE_RULES } from './engine/fortuneRules.js';
import { createRng } from './engine/rng.js';
import { createSfx } from './audio/sfx.js';
import { BLUE, RED, COLS, ROWS } from './engine/constants.js';
import { tableSize } from './render/drawBoard.js';

const TICKS_PER_SECOND = 6; // at 1x; games used to run at 24 a second and felt far too fast
const SPEEDS = [0.5, 1, 2, 4];
const PIT = DEFAULT_FORTUNE_RULES.pitSize;
const PIT_X0 = (COLS - PIT) >> 1;
const PIT_Y0 = (ROWS - PIT) >> 1;

const newEngine = (seed) => createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });

export default function App() {
  const sfx = useMemo(() => createSfx(), []);
  const [phase, setPhase] = useState('draft'); // draft -> locked -> playing -> done
  const [selectedId, setSelectedId] = useState(null);
  const [objectId, setObjectId] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [botName, setBotName] = useState(null);
  const [madden, setMadden] = useState(() => {
    try { return localStorage.getItem('view') !== 'side'; } catch { return true; } // Madden is the default
  });
  const [look, setLook] = useState(() => {
    try { return localStorage.getItem('look') === 'chips' ? 'chips' : 'heat'; } catch { return 'heat'; } // the clean look is the default
  });
  const toggleLook = () => setLook((l) => {
    const next = l === 'chips' ? 'heat' : 'chips';
    try { localStorage.setItem('look', next); } catch { /* storage unavailable */ }
    return next;
  });
  const lookRef = useRef(look);
  lookRef.current = look;
  const toggleView = () => setMadden((m) => {
    const next = !m;
    try { localStorage.setItem('view', next ? 'madden' : 'side'); } catch { /* storage unavailable */ }
    return next;
  });

  const engineRef = useRef(newEngine(1)); // an empty board, so the Hot Zones show while drafting
  const phaseRef = useRef(phase);
  const speedRef = useRef(speed);
  phaseRef.current = phase;
  speedRef.current = speed;

  const selected = FREE_BUILDS.find((b) => b.id === selectedId) || null;
  const ghost = useMemo(
    () => (selected && phase === 'draft' ? placeFormation(selected, BLUE) : []),
    [selected, phase],
  );
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;
  const spillsRef = useRef([]); // chips running down the pipes after a topple
  const lastCrashId = useRef(0);

  const getView = useCallback(() => {
    const e = engineRef.current;
    const hot = new Array(PIT * PIT);
    for (let py = 0; py < PIT; py++) for (let px = 0; px < PIT; px++) hot[py * PIT + px] = e.hot2[(PIT_Y0 + py) * COLS + PIT_X0 + px];
    const now = performance.now();
    spillsRef.current = spillsRef.current.filter((sp) => now - sp.born < 2600);
    return {
      teams: e.teams, hot: e.hot, stacks: e.stacks, blueTower: e.blueTower, redTower: e.redTower,
      ghost: ghostRef.current, look: lookRef.current,
      pit: { size: PIT, hot, blue: e.pit[BLUE], red: e.pit[RED] },
      spills: spillsRef.current,
    };
  }, []);

  const lockIn = () => {
    sfx.play('lockIn');
    const seed = (Math.random() * 2 ** 31) | 0;
    const bot = pickBotSetup(createRng(seed), FREE_BUILDS);
    const e = newEngine(seed);
    e.loadTeams([...placeFormation(selected, BLUE), ...bot.cells]);
    engineRef.current = e;
    spillsRef.current = [];
    lastCrashId.current = 0;
    setBotName(bot.formation.name);
    setPhase('locked');
  };

  const snap = () => { setResult(null); setPhase('playing'); };

  const reset = () => {
    engineRef.current = newEngine(1);
    spillsRef.current = [];
    lastCrashId.current = 0;
    setPhase('draft'); setResult(null); setHud(null); setBotName(null);
  };

  // Drive the simulation at a fixed tick rate, independent of the frame rate.
  useEffect(() => {
    let raf;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const e = engineRef.current;
      if (phaseRef.current === 'playing') {
        acc += dt * TICKS_PER_SECOND * speedRef.current;
        while (acc >= 1 && e.status === 'running') {
          e.tick();
          acc -= 1;
          const lc = e.lastCrash;
          if (lc && lc.id !== lastCrashId.current) {
            lastCrashId.current = lc.id;
            if (lc.spilled > 0) spillsRef.current.push({ born: performance.now(), crash: lc });
          }
        }
        if (now - hudAt > 90) {
          hudAt = now;
          const s = e.getScore();
          setHud({ tick: e.tickCount, blue: s.blue, red: s.red, crashes: e.fortune.crashes.total, pitBlue: e.fortune.blue, pitRed: e.fortune.red });
        }
        if (e.status !== 'running') { setResult(e.getResult()); setPhase('done'); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const outcomeText = result && { win: 'You win', lose: 'You lose', push: 'Push' }[result.outcome];

  const live = hud || { tick: 0, blue: 0, red: 0, crashes: 0 };
  const TABLE = tableSize(madden);

  return (
    <div className="app">
      <header className="top">
        <h1>Gridiron <span>Cellular Warfare</span></h1>
        <p>Pick a formation, lock it in, and watch the board decide.</p>
        <div className="toggles">
          <button className="viewtoggle" onClick={toggleLook} aria-pressed={look === 'chips'}>Look: {look === 'chips' ? 'Chips' : 'Clean'}</button>
          <button className="viewtoggle" onClick={toggleView} aria-pressed={madden}>View: {madden ? 'Madden' : 'Sideways'}</button>
        </div>
      </header>

      <div className="layout">
        <main className="stage">
          <div className="table" style={{ width: `min(100%, calc((100vh - 180px) * ${TABLE.cols} / ${TABLE.rows}))` }}>
          <section className="scorebar">
            <div className="side blue"><span className="num">{phase === 'done' && result ? result.score.blue : live.blue}</span><i>you</i></div>
            <div className="mid">
              {phase === 'draft' && <p>{selected ? <>Previewing <b>{selected.name}</b>. Press Lock In to commit.</> : 'Choose a formation from the sidebar.'}</p>}
              {phase === 'locked' && (
                <>
                  <p><b>{selected.name}</b> vs <b className="red">{botName}</b></p>
                  <div className="row"><button className="go" onClick={snap}>Snap</button><button className="ghost" onClick={reset}>Cancel</button></div>
                </>
              )}
              {phase === 'playing' && (
                <>
                  <p>Tick {live.tick} · {live.crashes} toppled · pit {live.pitBlue ?? 0}–{live.pitRed ?? 0}</p>
                  <div className="row speeds">
                    {SPEEDS.map((s) => <button key={s} className={s === speed ? 'on' : ''} onClick={() => setSpeed(s)}>{s}x</button>)}
                  </div>
                </>
              )}
              {phase === 'done' && result && (
                <>
                  <div className="line">
                    <span className={`verdict ${result.outcome}`}>{outcomeText}</span>
                    <button className="go small" onClick={reset}>New match</button>
                  </div>
                  <p className="note">
                    pit {result.fortune.blue}–{result.fortune.red}
                    {result.tileOutcome !== result.outcome && <b> · pit decided it</b>}
                  </p>
                </>
              )}
            </div>
            <div className="side red"><span className="num">{phase === 'done' && result ? result.score.red : live.red}</span><i>bot</i></div>
          </section>

          <Arena getView={getView} rotate={madden} />
          </div>
        </main>

        <Sidebar
          builds={FREE_BUILDS} objects={OBJECTS}
          selectedId={selectedId} onSelect={setSelectedId}
          objectId={objectId} onObject={setObjectId}
          locked={phase !== 'draft'} onLockIn={lockIn}
        />
      </div>
    </div>
  );
}
