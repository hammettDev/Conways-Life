import React, { useMemo, useState } from 'react';
import LiveField from './LiveField.jsx';
import DefendField from './DefendField.jsx';
import { botCall } from '../game/botOffence.js';
import { defenceById, newDrive, advance, DRIVE, fgChance, inFgRange } from '../engine/football.js';
import {
  TEAMS, GAME_DRIVES, SEASON_GAMES, PLAYOFF_WINS, newSeason, seasonOver, record, champion, nextTeam,
  drivePoints, driveNote, botDrive, teamDefence, bestDefenceFor, scoreText,
} from '../game/season.js';
import { createRng } from '../engine/rng.js';

export const AUDIBLES = 4; // audibles per game, for both your offence and your defence
const startSpot = () => { try { const v = Number(new URLSearchParams(window.location.search).get('spot')); return v > 0 && v < 100 ? v : null; } catch { return null; } }; // ?spot=70 starts every drive there, for testing
const freshDrive = () => { const d = newDrive(); const sp = startSpot(); return sp ? { ...d, spot: sp } : d; };
const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th'][n];
const spotText = (s) => (s >= DRIVE.goal ? 'Goal' : s <= 50 ? `Own ${s}` : `Opp ${DRIVE.goal - s}`);
const classOf = (r) => (r.kind === 'run' ? 'run' : r.yards > 14 ? 'deep' : r.yards > 7 ? 'mid' : 'short');
const STYLE_TEXT = { run: 'run the ball', short: 'throw short', mid: 'throw over the middle', deep: 'go deep' };

// The football game: a season of 8 games. Each game is 6 drives each; you play yours by hand, the opponent's are simulated
// against the defence you call.
export default function Game({ season, onSeason, onExit }) {
  const [madden, setMadden] = useState(() => { try { return localStorage.getItem('fbview') !== 'side'; } catch { return true; } });
  const toggleView = () => setMadden((m) => { try { localStorage.setItem('fbview', m ? 'side' : 'madden'); } catch { /* storage unavailable */ } return !m; });
  const [stage, setStage] = useState('hub');         // hub -> game
  const [g, setG] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const cur = season || null;
  const team = cur ? nextTeam(cur) : null;

  const startSeason = () => onSeason(newSeason((Math.random() * 2 ** 31) >>> 0));

  const startGame = () => {
    const seed = (cur.seed + cur.week * 7919) >>> 0;
    const rng = createRng(seed);
    setG({ seed, rng, aud: AUDIBLES, you: 0, them: 0, driveIdx: 0, drive: freshDrive(), classes: [], plays: 0, defId: teamDefence(rng, team, []), between: null, mode: 'off', foe: null, foePlays: 0, foeCall: null, mine: 0, mineNote: '' });
    setStage('game');
  };

  const startFoe = (s, mine, mineNote) => ({
    ...s, mode: 'def', mine, mineNote, you: s.you + mine, foe: freshDrive(), foePlays: 0, foeCall: botCall(s.rng, team),
  });
  const onPlay = (result) => {
    setG((s) => {
      const outcome = { kind: result.kind, yards: result.yards, note: result.note };
      const drive = advance(s.drive, outcome);
      const classes = [...s.classes, classOf(result)];
      const plays = s.plays + 1;
      if (!drive.over) return { ...s, drive, classes, plays, defId: teamDefence(s.rng, team, classes) };
      return startFoe({ ...s, drive, classes, plays }, drivePoints(drive), driveNote(drive));
    });
  };
  // one play of their drive, with the defence you picked
  const endFoe = (s, foe) => {
    const tp = drivePoints(foe);
    return { ...s, foe, mode: 'off', them: s.them + tp, between: { yours: s.mineNote, mine: s.mine, theirs: driveNote(foe), tp } };
  };
  const onFoePlay = (result) => {
    setG((s) => {
      let foe = advance(s.foe, { kind: result.kind, yards: result.yards, note: result.note });
      // a team in range on 4th down kicks
      if (!foe.over && foe.down === 4 && inFgRange(foe.spot)) foe = advance(foe, { kind: 'kick', made: s.rng() < fgChance(foe.spot), yards: 0 });
      if (foe.over) return endFoe(s, foe);
      return { ...s, foe, foePlays: s.foePlays + 1, foeCall: botCall(s.rng, team) };
    });
  };
  const simFoe = (defId) => {
    setG((s) => {
      const d = botDrive((s.seed ^ Math.imul(s.driveIdx + 1, 0x9e3779b1)) >>> 0, team, defId, 0);
      return endFoe(s, d);
    });
  };

  // kick a field goal on your drive
  const kickFg = () => {
    setG((s) => {
      if (!inFgRange(s.drive.spot)) return s;
      const made = s.rng() < fgChance(s.drive.spot);
      const drive = advance(s.drive, { kind: 'kick', made, yards: 0 });
      return startFoe({ ...s, drive, plays: s.plays + 1 }, drivePoints(drive), driveNote(drive));
    });
  };
  const useAudible = () => setG((s) => ({ ...s, aud: Math.max(0, s.aud - 1) }));
  const counterFor = (call, cur) => {
    // a sharp opponent sees your audible and swaps to the defence from its own pool that stops it best
    if (g.rng() >= team.scout) return null;
    return defenceById(bestDefenceFor(team, call.kind, g.rng));
  };
  const defFor = () => defenceById(teamDefence(g.rng, team, g.classes));

  const nextDrive = () => {
    setG((s) => {
      const idx = s.driveIdx + 1;
      if (idx >= GAME_DRIVES) return { ...s, driveIdx: idx, between: null, finished: true };
      return { ...s, driveIdx: idx, drive: freshDrive(), classes: [], between: null, mode: 'off', defId: teamDefence(s.rng, team, []) };
    });
  };
  const finishGame = () => {
    const res = { team: team.id, you: g.you, them: g.them };
    onSeason({ ...cur, week: cur.week + 1, results: [...cur.results, res] });
    setG(null); setStage('hub');
  };

    const rec = cur ? record(cur) : null;

  return (
    <main className="drive">
      <div className="drivehead">
        <div className="driveinfo">
          {stage === 'game' && g ? (
            <>
              <b>{g.finished ? 'Final' : g.between ? 'Drive over' : g.mode === 'def' ? `Their ${ordinal(g.foe.down)} & ${g.foe.toGo}` : `${ordinal(g.drive.down)} & ${g.drive.toGo}`}</b>
              <span>{g.finished || g.between ? `Drive ${Math.min(g.driveIdx + 1, GAME_DRIVES)} of ${GAME_DRIVES}` : (g.mode === 'def' ? `Ball on ${g.foe.spot <= 50 ? `their ${g.foe.spot}` : `your ${DRIVE.goal - g.foe.spot}`} · you defend` : `${spotText(g.drive.spot)} · drive ${g.driveIdx + 1}/${GAME_DRIVES}`)}</span>
            </>
          ) : <><b>Football season</b><span>{cur ? `Week ${Math.min(cur.week + 1, SEASON_GAMES)} of ${SEASON_GAMES}` : 'New'}</span></>}
        </div>
        {stage === 'game' && g ? (
          <div className="scoreline"><span className="aud" title="Audibles left">A{g.aud}</span><span className="you">You {g.you}</span><span className="vs">–</span><span className="them">{g.them} {team.name.split(' ').pop()}</span></div>
        ) : <div className="scoreline" />}
        <button className="ghost small" onClick={toggleView}>View: {madden ? 'Madden' : 'Sideways'}</button>
        <button className="ghost small" onClick={() => (stage === 'game' && g && !g.finished ? setLeaving(true) : onExit())}>Exit</button>
      </div>
      {leaving && (
        <div className="driveleave">
          <span>Leave the game? It will not count.</span>
          <button className="ghost small" onClick={() => { setLeaving(false); setG(null); setStage('hub'); onExit(); }}>Leave</button>
          <button className="ghost small" onClick={() => setLeaving(false)}>Stay</button>
        </div>
      )}

      {stage === 'hub' && (
        <section className="hub">
          {!cur ? (
            <>
              <h3>Football season</h3>
              <p className="note">Eight games against tougher and tougher teams. Each game is six drives each: you call and play yours live, and they run theirs against the defence you pick. Win {PLAYOFF_WINS} to be champions.</p>
              <p className="note"><b>Controls.</b> Snap with Space. On a pass your receivers are light spaceships and the ball is a glider you fire from the quarterback: pick a receiver (1-4 or arrows) and press Space when the dashed line turns green. Taps work too.</p>
              <button className="lock" onClick={startSeason}>Start a season</button>
            </>
          ) : seasonOver(cur) ? (
            <>
              <h3>{champion(cur) ? 'Champions!' : 'Season over'}</h3>
              <p className="note">{rec.wins}-{rec.losses}{rec.ties ? `-${rec.ties}` : ''}. {champion(cur) ? 'You took the title.' : `You needed ${PLAYOFF_WINS} wins.`}</p>
              <button className="lock" onClick={startSeason}>New season</button>
            </>
          ) : (
            <>
              <h3>Week {cur.week + 1}: {team.name}</h3>
              <p className="note">Record {rec.wins}-{rec.losses}{rec.ties ? `-${rec.ties}` : ''}. {team.level === 0 ? 'A friendly start.' : team.level === 1 ? 'A real test.' : 'The best in the league.'} They love to {STYLE_TEXT[team.style]}, and they usually line up in {team.def.map((id) => defenceById(id).name).join(', ')}. You also defend their six drives: you see their formation and pick your defence play by play.</p>
              <button className="lock" onClick={startGame}>Play week {cur.week + 1}</button>
            </>
          )}
          {cur && cur.results.length > 0 && (
            <ul className="schedule">
              {cur.results.map((r, i) => (
                <li key={i} className={r.you > r.them ? 'w' : r.you < r.them ? 'l' : ''}>
                  <span>Wk {i + 1} · {TEAMS.find((t) => t.id === r.team)?.name || r.team}</span><b>{scoreText(r.you, r.them)} {r.you}–{r.them}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {stage === 'game' && g && !g.finished && !g.between && g.mode === 'def' && (
        <DefendField key={`d${g.driveIdx}-${g.foePlays}`} drive={g.foe} rotate={madden} call={g.foeCall} team={team} audibles={g.aud} onAudible={useAudible} seed={(g.seed + g.foePlays * 977 + g.driveIdx * 31) >>> 0} onPlay={onFoePlay} onSim={simFoe} />
      )}
      {stage === 'game' && g && !g.finished && !g.between && g.mode === 'off' && (
        <LiveField key={`${g.driveIdx}-${g.plays}`} drive={g.drive} rotate={madden} onKick={kickFg} team={team} defFor={defFor} counterFor={counterFor} audibles={g.aud} onAudible={useAudible}
          seed={(g.seed + g.plays * 131 + g.driveIdx * 17) >>> 0} onPlay={onPlay} />
      )}
      {stage === 'game' && g && g.between && (
        <section className="hub">
          <h3>Drive over</h3>
          <p className="note">Your drive: <b>{g.between.yours}</b>{g.between.mine ? ` (+${g.between.mine})` : ''}. Their drive: <b>{g.between.theirs}</b>{g.between.tp ? ` (+${g.between.tp})` : ''}.</p>
          <button className="lock" onClick={nextDrive}>{g.driveIdx + 1 >= GAME_DRIVES ? 'Final score' : 'Next drive'}</button>
        </section>
      )}
      {stage === 'game' && g && g.finished && (
        <section className="hub">
          <h3>{g.you > g.them ? 'Win!' : g.you < g.them ? 'Loss' : 'Tie'} {g.you}–{g.them}</h3>
          <p className="note">{team.name}</p>
          <button className="lock" onClick={finishGame}>Back to the season</button>
        </section>
      )}
    </main>
  );
}
