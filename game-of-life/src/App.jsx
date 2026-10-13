import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Arena from './components/Arena.jsx';
import Pit from './components/Pit.jsx';
import Sidebar from './components/Sidebar.jsx';
import { createEngine } from './engine/engine.js';
import { FREE_BUILDS } from './engine/library.js';
import { OBJECTS } from './engine/objects.js';
import { placeFormation, pickBotSetup } from './engine/formations.js';
import { DEFAULT_FORTUNE_RULES } from './engine/fortuneRules.js';
import { createRng } from './engine/rng.js';
import { createSfx } from './audio/sfx.js';
import { BLUE, RED, COLS, ROWS } from './engine/constants.js';

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
    try { return localStorage.getItem('view') === 'madden'; } catch { return false; }
  });
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

  const getView = useCallback(() => {
    const e = engineRef.current;
    return { teams: e.teams, hot: e.hot, stacks: e.stacks, ghost: ghostRef.current };
  }, []);

  const getPitView = useCallback(() => {
    const e = engineRef.current;
    const hot = new Array(PIT * PIT);
    for (let py = 0; py < PIT; py++) for (let px = 0; px < PIT; px++) hot[py * PIT + px] = e.hot2[(PIT_Y0 + py) * COLS + PIT_X0 + px];
    return { hot, blue: e.pit[BLUE], red: e.pit[RED] };
  }, []);

  const lockIn = () => {
    sfx.play('lockIn');
    const seed = (Math.random() * 2 ** 31) | 0;
    const bot = pickBotSetup(createRng(seed), FREE_BUILDS);
    const e = newEngine(seed);
    e.loadTeams([...placeFormation(selected, BLUE), ...bot.cells]);
    engineRef.current = e;
    setBotName(bot.formation.name);
    setPhase('locked');
  };

  const snap = () => { setResult(null); setPhase('playing'); };

  const reset = () => {
    engineRef.current = newEngine(1);
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
        while (acc >= 1 && e.status === 'running') { e.tick(); acc -= 1; }
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

  return (
    <div className="app">
      <header className="top">
        <h1>Gridiron <span>Cellular Warfare</span></h1>
        <p>Pick a formation, lock it in, and watch the board decide.</p>
        <button className="viewtoggle" onClick={toggleView} aria-pressed={madden}>View: {madden ? 'Madden' : 'Sideways'}</button>
      </header>

      <div className="layout">
        <main className="stage">
          <section className={madden ? "scorebar madden" : "scorebar"}>
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
                  <p>Tick {live.tick} · {live.crashes} toppled</p>
                  <div className="row speeds">
                    {SPEEDS.map((s) => <button key={s} className={s === speed ? 'on' : ''} onClick={() => setSpeed(s)}>{s}x</button>)}
                  </div>
                </>
              )}
              {phase === 'done' && result && (
                <>
                  <div className={`verdict ${result.outcome}`}>{outcomeText}</div>
                  <p className="note">
                    Ended {result.status} at tick {result.ticks} · pit {result.fortune.blue}–{result.fortune.red}
                    {result.tileOutcome !== result.outcome && <> · <b>the pit decided it</b></>}
                  </p>
                  <button className="go" onClick={reset}>New match</button>
                </>
              )}
            </div>
            <div className="side red"><span className="num">{phase === 'done' && result ? result.score.red : live.red}</span><i>bot</i></div>
          </section>

          <Arena getView={getView} rotate={madden} />

          <div className="gutter" aria-hidden="true"><span>gutter</span></div>

          <section className="pitwrap">
            <h2>The Pit</h2>
            <Pit getView={getPitView} size={PIT} />
            <p className="note">Overflow chips drop in here. More chips owns the tile; a hot landing counts x5.</p>
          </section>
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
