import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Arena from './components/Arena.jsx';
import Sidebar from './components/Sidebar.jsx';
import SaveDialog from './components/SaveDialog.jsx';
import { createEngine } from './engine/engine.js';
import { FREE_BUILDS, TUTORIAL_BUILDS } from './engine/library.js';
import {
  OBJECTS, getObject, placeObject, cellsWithObject, dropAt, placementOk,
} from './engine/objects.js';
import { placeFormation, pickBotSetup } from './engine/formations.js';
import { DEFAULT_FORTUNE_RULES } from './engine/fortuneRules.js';
import { createRng } from './engine/rng.js';
import { createSfx } from './audio/sfx.js';
import { BLUE, RED, COLS, ROWS, WAGER, MIN_BET, AUDIBLE_PRICE, TUTORIAL_STAKE } from './engine/constants.js';
import { tableSize } from './render/drawBoard.js';
import { createPitDisplay, pitLead } from './render/pitDisplay.js';
import {
  loadSave, persistSave, exportCode, importCode, loadMaxRev, acceptImport,
} from './game/saveStore.js';
import { packMatch, bossMultiplier, resolvePending } from './game/pending.js';
import {
  placeBet, refund, spend, settle, canAfford, bailoutAvailable, bailoutAmount, takeBailout, finishTutorial,
  noteFormation, noteResult, matchSeed, setPending, clearPending, forfeit,
} from './game/wallet.js';
import {
  BOSSES, getBoss, unlockedBosses, bossReady, winsToBoss, pickBossSetup, withItem, rollMultiplier,
} from './game/bosses.js';
import { STEPS, stepFor } from './game/tutorial.js';
import BossReveal from './components/BossReveal.jsx';
import { botAnswers, counterFor } from './game/audible.js';

const CENTER_STEPS = ['pick', 'hot', 'shop', 'wrap']; // lessons that sit mid-board; the rest dock at the top so the action stays visible
const TICKS_PER_SECOND = 6; // at 1x
const SPEEDS = [0.5, 1, 2, 4];
const PIT = DEFAULT_FORTUNE_RULES.pitSize;
const PIT_X0 = (COLS - PIT) >> 1;
const PIT_Y0 = (ROWS - PIT) >> 1;

const newEngine = (seed) => createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
// Load the save, give it an id if it has none, and finish any match that was left running.
function startUp() {
  let save = loadSave();
  if (!save.sid) save = { ...save, sid: 1 + Math.floor(Math.random() * 2 ** 30) };
  const resumed = resolvePending(save);
  return { save: resumed ? resumed.save : save, resumed };
}
const money = (n) => `$${n.toLocaleString()}`;
const findBuild = (id) => FREE_BUILDS.find((b) => b.id === id) || null;

// A formation's cells, with the bought piece swapped in for the reserves if there is one.
// What the bot is fielding, for the scorebar: the formation, plus its piece if it brought one.
const botLabel = (bot) => (bot.item ? `${bot.formation.name} + ${bot.item.name}` : bot.formation.name);
const blueCells = (build, obj, drop) => (obj && drop ? cellsWithObject(build, BLUE, obj, drop) : placeFormation(build, BLUE));

export default function App() {
  const sfx = useMemo(() => createSfx(), []);
  const pitDisplay = useMemo(() => createPitDisplay(PIT), []);

  const [boot] = useState(startUp);
  const [save, setSave] = useState(boot.save);
  // Every change to the save bumps its revision, which is what makes an older save code detectable.
  const commit = (next) => setSave((s) => ({ ...(typeof next === 'function' ? next(s) : next), rev: s.rev + 1 }));
  useEffect(() => { persistSave(save); }, [save]);

  const [phase, setPhase] = useState('draft'); // draft -> locked -> (audible) -> playing -> done
  const [selectedId, setSelectedId] = useState(null);
  const [objectId, setObjectId] = useState(null);
  const [drop, setDrop] = useState(null);       // where the bought piece sits: { depth, lat }
  const [armed, setArmed] = useState(false);    // waiting for a click on the board to place the piece
  const [audibleChoice, setAudibleChoice] = useState(null);
  const [audibleUsed, setAudibleUsed] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [botName, setBotName] = useState(null);
  const [notice, setNotice] = useState(() => (boot.resumed
    ? `A match you left running finished: ${{ win: 'you won', lose: 'you lost', push: 'it was a push' }[boot.resumed.outcome]}${boot.resumed.mult > 1 ? ` (x${boot.resumed.mult})` : ''}.`
    : ''));
  const [showSave, setShowSave] = useState(false);
  const [madden, setMadden] = useState(() => {
    try { return localStorage.getItem('view') !== 'side'; } catch { return true; } // Madden is the default
  });
  const [look, setLook] = useState(() => {
    try { return localStorage.getItem('look') === 'chips' ? 'chips' : 'heat'; } catch { return 'heat'; }
  });
  const toggleView = () => setMadden((m) => {
    const next = !m;
    try { localStorage.setItem('view', next ? 'madden' : 'side'); } catch { /* storage unavailable */ }
    return next;
  });
  const toggleLook = () => setLook((l) => {
    const next = l === 'chips' ? 'heat' : 'chips';
    try { localStorage.setItem('look', next); } catch { /* storage unavailable */ }
    return next;
  });

  const selected = findBuild(selectedId);
  const obj = objectId ? getObject(objectId) : null;
  const [practice, setPractice] = useState(false); // replaying the tutorial: nothing is paid or won
  const tutorial = !save.tutorialDone || practice; // the guided match: fixed stake, free pieces and audible
  const [tStep, setTStep] = useState('pick');
  const [bossId, setBossId] = useState(null);       // the boss you are challenging this match
  const [bossMult, setBossMult] = useState(null);   // the hidden payout, revealed after a win
  const [betPref, setBetPref] = useState(WAGER);
  const pieceCost = obj && !tutorial ? obj.price : 0;
  const maxBet = Math.max(MIN_BET, save.balance - pieceCost);   // up to everything left after the piece
  const wager = tutorial ? (practice ? 0 : TUTORIAL_STAKE) : Math.min(Math.max(betPref, MIN_BET), maxBet);
  const cost = wager + pieceCost;
  const setBet = (v) => setBetPref(Math.min(maxBet, Math.max(MIN_BET, Math.round(v))));
  const audiblePrice = tutorial ? 0 : AUDIBLE_PRICE;

  // Everything the per-frame callbacks and window listeners need, kept current.
  const live = useRef({});
  live.current = { tutorial, practice, wager, phase, selected, obj, drop, armed, audibleChoice, speed, look, save };
  const engineRef = useRef(newEngine(1)); // an empty board, so the Hot Zones show while drafting
  const spillsRef = useRef([]);
  const lastCrashId = useRef(0);
  const escrowRef = useRef(0);
  const wagerRef = useRef(WAGER);
  const bossRef = useRef(null);
  const skipRef = useRef(false);
  const seedRef = useRef(1);
  const botRef = useRef(null);
  const botPendingRef = useRef(null);
  const settledRef = useRef(true);
  const hoverRef = useRef(null);
  const arenaRef = useRef(null);

  const startEngine = (blue, red, seed) => {
    const e = newEngine(seed);
    e.loadTeams([...blue, ...red]);
    engineRef.current = e;
    spillsRef.current = [];
    pitDisplay.reset();
    lastCrashId.current = 0;
  };
  const emptyBoard = () => {
    engineRef.current = newEngine(1);
    spillsRef.current = [];
    pitDisplay.reset();
    lastCrashId.current = 0;
  };

  const getView = useCallback(() => {
    const e = engineRef.current;
    const { phase: ph, selected: sel, obj: o, drop: d, armed: arm, audibleChoice: ac, look: lk } = live.current;
    const hot = new Array(PIT * PIT);
    for (let py = 0; py < PIT; py++) for (let px = 0; px < PIT; px++) hot[py * PIT + px] = e.hot2[(PIT_Y0 + py) * COLS + PIT_X0 + px];
    const now = performance.now();
    pitDisplay.animate(now);
    pitDisplay.update(spillsRef.current, now); // chips land once their trip down the gutter has finished
    spillsRef.current = spillsRef.current.filter((sp) => !sp.landed || now - sp.born < 2600);

    // Previews on your half: the formation (with the piece swapped in), and the piece under the cursor.
    let ghost = [];
    if (ph === 'draft' && sel) ghost = blueCells(sel, o, d);
    if (ph === 'audible' && ac) { const b = findBuild(ac); if (b) ghost = placeFormation(b, BLUE); }
    if (ph === 'draft' && o && arm && hoverRef.current && sel) {
      const dd = dropAt(o, hoverRef.current[0], hoverRef.current[1]);
      const ok = placementOk(sel, o, dd);
      ghost = ghost.concat(placeObject(o, BLUE, dd).map((c) => ({ ...c, team: ok ? BLUE : RED })));
    }
    return {
      teams: e.teams, hot: e.hot, stacks: e.stacks, blueTower: e.blueTower, redTower: e.redTower,
      ghost, look: lk,
      pit: { size: PIT, hot, blue: pitDisplay.blue, red: pitDisplay.red, ghost: pitDisplay.ghost, time: now },
      spills: spillsRef.current,
    };
  }, [pitDisplay]);

  // ---- placing the bought piece -------------------------------------------------
  const tryPlace = (tile) => {
    const { selected: sel, obj: o } = live.current;
    if (!sel || !o || !tile) return;
    const d = dropAt(o, tile[0], tile[1]);
    if (placementOk(sel, o, d)) { setDrop(d); setArmed(false); hoverRef.current = null; setNotice(''); }
    else setNotice('Not there: keep it on your half, off your formation.');
  };

  const onDragStart = (e) => {
    if (live.current.phase !== 'draft' || !live.current.obj) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    setArmed(true);
    const move = (ev) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) moved = true;
      hoverRef.current = arenaRef.current ? arenaRef.current.tileAt(ev.clientX, ev.clientY) : null;
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const tile = arenaRef.current ? arenaRef.current.tileAt(ev.clientX, ev.clientY) : null;
      if (moved && tile) tryPlace(tile);
      else if (moved) { setArmed(false); hoverRef.current = null; } // dropped off the board: cancel
      // a plain click leaves it armed, for click-to-place
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setArmed(false); setShowSave(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- the match flow -----------------------------------------------------------
  const lockIn = () => {
    if (!selected || (obj && !drop)) return;
    const held = placeBet(save, cost);
    if (!held) return;
    sfx.play('lockIn');
    const seed = matchSeed(save); // fixed by the save, so cancelling and locking in again faces the same opponent
    const boss = !tutorial && bossId ? getBoss(bossId) : null;
    const bot = boss
      ? withItem(boss, pickBossSetup(boss, createRng(seed), save.boss.last), createRng(seed ^ 0x51ed))
      : pickBotSetup(createRng(seed), tutorial && TUTORIAL_BUILDS.length ? TUTORIAL_BUILDS : FREE_BUILDS);
    const mine = blueCells(selected, obj, drop);
    // the match is written into the save now, so closing the page cannot dodge a loss
    commit(() => {
      const next = noteFormation(held, selected.id);
      return tutorial ? next : setPending(next, packMatch(seed, wager, boss && boss.id, mine, bot.cells));
    });
    escrowRef.current = cost;
    wagerRef.current = wager;
    settledRef.current = false;
    seedRef.current = seed;
    bossRef.current = boss;
    setBossMult(null);
    skipRef.current = false;
    botRef.current = bot;
    botPendingRef.current = null;
    startEngine(mine, bot.cells, seed);
    setBotName(botLabel(bot));
    setNotice('');
    setAudibleUsed(false);
    setPhase('locked');
  };

  // Backing out after the bot is revealed costs the re-pick fee: an audible is the paid way to react,
  // and the opponent stays the same, so cancelling is not a free look at it.
  const cancelMatch = () => {
    const held = escrowRef.current; // read now: the updater below runs after this handler returns
    commit((s) => {
      const back = clearPending(refund(s, held));
      return tutorial ? back : forfeit(back, AUDIBLE_PRICE);
    });
    escrowRef.current = 0;
    settledRef.current = true;
    emptyBoard();
    setPhase('draft');
    setNotice('');
  };

  const callAudible = () => { setAudibleChoice(null); setPhase('audible'); };
  const cancelAudible = () => { setAudibleChoice(null); setPhase('locked'); };

  const confirmAudible = () => {
    const next = findBuild(audibleChoice);
    const paid = spend(save, audiblePrice);
    if (!next || !paid) return;
    setAudibleUsed(true);
    setSelectedId(next.id);
    // The bot may answer with its own audible, kept hidden until the snap. It is seeded too.
    const seed = matchSeed(save, 1);
    const rng = createRng(seed ^ 0x9e3779b9);
    let bot = botRef.current;
    botPendingRef.current = null;
    if (!tutorial && botAnswers(rng, bossRef.current ? bossRef.current.audible : undefined)) {
      const c = counterFor(next.id, FREE_BUILDS, rng);
      const flip = rng() < 0.5;
      bot = { formation: c, flip, cells: placeFormation(c, RED, { flip }) };
      if (bossRef.current) bot = withItem(bossRef.current, bot, rng);
      botPendingRef.current = { name: botLabel(bot), notice: `The bot called an audible: ${bot.formation.name}.` };
    }
    const mine = blueCells(next, obj, drop);
    commit(() => {
      const after = noteFormation(paid, next.id);
      return tutorial ? after : setPending(after, packMatch(seed, wagerRef.current, bossRef.current && bossRef.current.id, mine, bot.cells));
    });
    botRef.current = bot;
    seedRef.current = seed;
    startEngine(mine, bot.cells, seed);
    setAudibleChoice(null);
    setPhase('locked');
  };

  const skipToEnd = () => { skipRef.current = true; };

  const snap = () => {
    skipRef.current = false;
    const pending = botPendingRef.current;
    if (pending) { setBotName(pending.name); setNotice(pending.notice); botPendingRef.current = null; }
    setResult(null);
    setPhase('playing');
  };

  const newMatch = () => {
    emptyBoard();
    setPhase('draft');
    setResult(null);
    setHud(null);
    setObjectId(null);   // the piece was used up
    setBossId(null);
    setDrop(null);
    setArmed(false);
    setNotice('');
  };

  // Keep the lesson in step with what the player has done.
  useEffect(() => {
    if (tutorial) setTStep((c) => stepFor(c, { phase, hasSelection: Boolean(selectedId) }));
  }, [tutorial, phase, selectedId]);
  const leaveTutorial = () => {
    if (practice) setPractice(false);
    else commit((s) => finishTutorial(s));
  };
  const startTutorial = () => {
    emptyBoard();
    setSelectedId(null); setObjectId(null); setDrop(null); setBossId(null); setNotice('');
    setTStep('pick');
    setPractice(true);
  };
  const endTutorial = () => {
    leaveTutorial();
    newMatch();
    setSelectedId(null);
    setTStep('pick');
  };
  const nextStep = () => setTStep((c) => ({ hot: 'shop', shop: 'lock' }[c] || c));
  const lesson = tutorial ? { ...STEPS[tStep], text: (practice && STEPS[tStep].practice) || STEPS[tStep].text } : null;

  const takeBail = () => {
    const r = takeBailout(save);
    if (r) { commit(r.save); setNotice(`Bailout: +${money(r.amount)}. It shrinks each time, so play it smart.`); }
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
      if (live.current.phase === 'playing') {
        acc += dt * TICKS_PER_SECOND * live.current.speed;
        if (skipRef.current) acc = Infinity; // skip to the result: play every remaining tick now
        while (acc >= 1 && e.status === 'running') {
          e.tick();
          acc -= 1;
          const lc = e.lastCrash;
          if (lc && lc.id !== lastCrashId.current) {
            lastCrashId.current = lc.id;
            if (lc.spilled > 0) spillsRef.current.push({ born: performance.now(), crash: lc });
          }
        }
        if (skipRef.current) { acc = 0; skipRef.current = false; }
        if (now - hudAt > 90) {
          hudAt = now;
          // Score what the player can see: the pit counts only chips that have landed.
          pitDisplay.update(spillsRef.current, performance.now());
          const s = e.getScore(false);
          const lead = pitLead(pitDisplay.blue, pitDisplay.red);
          const bonus = Math.floor(Math.abs(lead.blue - lead.red) / DEFAULT_FORTUNE_RULES.unit);
          setHud({
            tick: e.tickCount, crashes: e.fortune.crashes.total, pitBlue: lead.blue, pitRed: lead.red,
            blue: s.blue + (lead.blue > lead.red ? bonus : 0), red: s.red + (lead.red > lead.blue ? bonus : 0),
          });
        }
        if (e.status !== 'running') {
          pitDisplay.update(spillsRef.current, 0, true); // chips still in the pipes land now so the board matches the result
          const r = e.getResult();
          setResult(r);
          setPhase('done');
          if (!settledRef.current) {
            settledRef.current = true;
            const w = wagerRef.current;
            // the tutorial bet is insured: it pays as a win whatever the board said
            const boss = bossRef.current;
            const mult = bossMultiplier(seedRef.current, boss, r.outcome); // seeded, so a reload cannot reroll it
            if (boss && r.outcome === 'win') setBossMult(mult);
            commit((s) => clearPending(live.current.tutorial
              ? (live.current.practice ? s : settle(s, 'win', w))
              : noteResult(settle(s, r.outcome, w, mult), r.outcome, boss ? boss.id : null)));
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pitDisplay]);

  // ---- what the UI shows ----------------------------------------------------------
  const drafting = phase === 'draft';
  const afford = canAfford(save, cost);
  const canLock = drafting && Boolean(selected) && (!obj || Boolean(drop)) && afford;
  const lockHint = !drafting ? '' : !selected ? 'Choose a formation.'
    : obj && !drop ? 'Place your piece on the board first.'
      : !afford ? 'Not enough cash for this bet.' : '';
  const challenger = !tutorial && bossId ? getBoss(bossId) : null;
  const lockLabel = drafting ? `${challenger ? `Challenge ${challenger.name}` : 'Lock In'} · ${money(cost)}` : 'Locked in';
  const audibleBuild = findBuild(audibleChoice);
  const canAudible = Boolean(audibleBuild) && audibleBuild.id !== selectedId && canAfford(save, audiblePrice);

  const live2 = hud || { tick: 0, blue: 0, red: 0, crashes: 0, pitBlue: 0, pitRed: 0 };
  const TABLE = tableSize(madden);
  const verdict = result && (tutorial && !practice ? 'Insured win' : { win: 'You win', lose: 'You lose', push: 'Push' }[result.outcome]);
  const net = result && (practice ? 'practice run, no money moved' : tutorial ? `insured +${money(wager)}` : result.outcome === 'win' ? `+${money(wagerRef.current * (bossMult || 1))}` : result.outcome === 'lose' ? `−${money(wagerRef.current)}` : 'bet returned');

  return (
    <div className="app">
      <header className="top">
        <h1>Gridiron <span>Cellular Warfare</span></h1>
        <p>Pick a formation, lock it in, and watch the board decide.</p>
        <div className="toggles">
          <div className="wallet" title={`${save.stats.wins} wins · ${save.stats.losses} losses · best streak ${save.stats.bestStreak}`}>
            <span className="cash">{money(save.balance)}</span>
            {drafting && !tutorial && bailoutAvailable(save) && (
              <button className="ghost small" onClick={takeBail}>Bailout +{money(bailoutAmount(save))}</button>
            )}
          </div>
          {drafting && !tutorial && <button className="viewtoggle" onClick={startTutorial}>How to play</button>}
          <button className="viewtoggle" onClick={() => setShowSave(true)}>Save</button>
          <button className="viewtoggle" onClick={toggleLook} aria-pressed={look === 'chips'}>Look: {look === 'chips' ? 'Chips' : 'Clean'}</button>
          <button className="viewtoggle" onClick={toggleView} aria-pressed={madden}>View: {madden ? 'Madden' : 'Sideways'}</button>
        </div>
      </header>

      <div className="layout">
        <main className="stage">
          <div className={lesson && CENTER_STEPS.includes(tStep) ? "table dimmed" : "table"} style={{ width: `min(100%, calc((100vh - 180px) * ${TABLE.cols} / ${TABLE.rows}))` }}>
            <section className="scorebar">
              <div className="side blue"><span className="num">{phase === 'done' && result ? result.score.blue : live2.blue}</span><i>you</i></div>
              <div className="mid">
                {drafting && <p>{notice || (selected ? <>Previewing <b>{selected.name}</b>. {challenger ? <>Boss fight: <b>{challenger.name}</b>, hidden payout. </> : null}Lock In to bet {money(cost)}.</> : 'Choose a formation from the sidebar.')}</p>}
                {phase === 'locked' && (
                  <>
                    <p><b>{selected && selected.name}</b> vs <b className="red">{botName}</b></p>
                  </>
                )}
                {phase === 'audible' && (
                  <>
                    <p>Pick your new formation in the sidebar.</p>
                  </>
                )}
                {phase === 'playing' && (
                  <>
                    <p>Tick {live2.tick} · {live2.crashes} toppled · pit {live2.pitBlue}–{live2.pitRed}</p>
                    {notice && <p className="note">{notice}</p>}
                    <div className="row speeds">
                      {SPEEDS.map((s) => <button key={s} className={s === speed ? 'on' : ''} onClick={() => setSpeed(s)}>{s}x</button>)}
                    </div>
                  </>
                )}
                {phase === 'done' && result && (
                  <>
                    <div className="line">
                      <span className={`verdict ${tutorial && !practice ? 'win' : result.outcome}`}>{verdict}</span>
                    </div>
                    <p className="note">
                      {bossMult ? <><BossReveal value={bossMult} /> boss payout · </> : null}{net} · pit {result.fortune.blue}–{result.fortune.red}
                      {result.tileOutcome !== result.outcome && <b> · pit decided it</b>}
                    </p>
                  </>
                )}
              </div>
              <div className="side red"><span className="num">{phase === 'done' && result ? result.score.red : live2.red}</span><i>bot</i></div>
            </section>
            {lesson && (
              <aside className={`coach ${CENTER_STEPS.includes(tStep) ? 'center' : 'dock'}`} role="status" aria-live="polite">
                <b>{lesson.title}</b>
                <p>{lesson.text}</p>
                <div className="coachact">
                  {lesson.next && <button className="go" onClick={tStep === 'wrap' ? endTutorial : nextStep}>{lesson.next}</button>}
                  {lesson.wait && <span className="waiting">{lesson.wait}</span>}
                  {tStep !== 'wrap' && <button className="ghost small" onClick={() => { if (phase === 'locked') cancelMatch(); leaveTutorial(); }}>{practice ? 'Leave tutorial' : 'Skip tutorial'}</button>}
                </div>
              </aside>
            )}
            <Arena
              ref={arenaRef} getView={getView} rotate={madden}
              onHover={(t) => { hoverRef.current = t; }}
              onTileClick={(t) => { if (live.current.armed && t) tryPlace(t); }}
            />
          </div>
        </main>

        <Sidebar
          builds={FREE_BUILDS} objects={OBJECTS} balance={save.balance} wager={wager} free={tutorial} bet={tutorial ? null : wager} minBet={MIN_BET} maxBet={maxBet} onBet={setBet} phase={phase}
          selectedId={selectedId}
          onSelect={(id) => (phase === 'audible' ? setAudibleChoice(id) : setSelectedId(id))}
          objectId={objectId}
          onObject={(id) => { setObjectId(id); setDrop(null); setArmed(false); setNotice(''); }}
          placed={Boolean(drop)} armed={armed}
          onArm={() => setArmed(true)} onDragStart={onDragStart}
          onClearPlace={() => { setDrop(null); setArmed(false); }}
          lockLabel={lockLabel} lockHint={lockHint} canLock={canLock} onLockIn={lockIn}
          audibleChoiceId={audibleChoice} canAudible={canAudible}
          audibleLabel={audibleBuild ? `Switch to ${audibleBuild.name} · ${tutorial ? 'free' : money(AUDIBLE_PRICE)}` : 'Pick a formation'}
          onAudibleConfirm={confirmAudible}
          bosses={tutorial ? null : { list: unlockedBosses(save), all: BOSSES, ready: bossReady(save), toGo: winsToBoss(save), beaten: save.boss.beaten, selected: bossId }}
          onBoss={(id) => setBossId(id)}
          onNewMatch={newMatch} onSnap={snap} onSkip={skipToEnd} onCallAudible={callAudible} onCancel={cancelMatch} onBackAudible={cancelAudible}
          audibleDisabled={audibleUsed || !canAfford(save, audiblePrice)}
          audibleFee={tutorial ? 'free' : money(AUDIBLE_PRICE)}
          cancelFee={tutorial ? '' : money(AUDIBLE_PRICE)}
        />
      </div>

      {showSave && (
        <SaveDialog
          code={exportCode(save)}
          onImport={(text) => {
            const incoming = importCode(text);
            if (!incoming) return 'That code did not work. Check it for typos.';
            if (!acceptImport(incoming, save, loadMaxRev())) return 'That code is older than the progress already on this device, so it cannot be loaded.';
            setSave(incoming); // keeps its own revision, which is above everything seen here
            return '';
          }}
          onClose={() => setShowSave(false)}
        />
      )}
    </div>
  );
}
