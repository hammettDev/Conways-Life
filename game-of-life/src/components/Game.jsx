import React, { useMemo, useState } from 'react';
import LiveField from './LiveField.jsx';
import { DEFENCES, defenceById, newDrive, advance, DRIVE } from '../engine/football.js';
import {
  TEAMS, GAME_DRIVES, SEASON_GAMES, PLAYOFF_WINS, WEAK, newSeason, seasonOver, record, champion, nextTeam,
  drivePoints, driveNote, botDrive, teamDefence, scoreText,
} from '../game/season.js';
import { createRng } from '../engine/rng.js';

const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th'][n];
const spotText = (s) => (s >= DRIVE.goal ? 'Goal' : s <= 50 ? `Own ${s}` : `Opp ${DRIVE.goal - s}`);
const classOf = (r) => (r.kind === 'run' ? 'run' : r.yards > 14 ? 'deep' : r.yards > 7 ? 'mid' : 'short');
const strongVs = (id) => WEAK[id][WEAK[id].length - 1];
const weakVs = (id) => WEAK[id][0];

// The football game: a season of 8 games. Each game is 6 drives each; you play yours by hand, the opponent's are simulated
// against the defence you call.
export default function Game({ season, onSeason, onExit }) {
  const [stage, setStage] = useState('hub');         // hub -> plan -> game -> final
  const [g, setG] = useState(null);
  const [plan, setPlan] = useState('fb-cover-3');
  const [leaving, setLeaving] = useState(false);
  const cur = season || null;
  const team = cur ? nextTeam(cur) : null;

  const startSeason = () => onSeason(newSeason((Math.random() * 2 ** 31) >>> 0));

  const startGame = () => {
    const seed = (cur.seed + cur.week * 7919) >>> 0;
    const rng = createRng(seed);
    setG({ seed, rng, you: 0, them: 0, driveIdx: 0, drive: newDrive(), classes: [], plays: 0, defId: teamDefence(rng, team, []), between: null, planRepeats: 0, lastPlan: plan });
    setStage('game');
  };

  const onPlay = (result, call) => {
    setG((s) => {
      const outcome = { kind: result.kind, yards: result.yards, note: result.note };
      const drive = advance(s.drive, outcome);
      const classes = [...s.classes, classOf(result)];
      const plays = s.plays + 1;
      if (!drive.over) return { ...s, drive, classes, plays, defId: teamDefence(s.rng, team, classes) };
      // your drive is over: score it, then the opponent runs theirs against your plan
      const mine = drivePoints(drive);
      const repeats = plan === s.lastPlan ? s.planRepeats + 1 : 0;
      const theirs = botDrive((s.seed ^ Math.imul(s.driveIdx + 1, 0x9e3779b1)) >>> 0, team, plan, repeats);
      const tp = drivePoints(theirs);
      return {
        ...s, drive, classes, plays, you: s.you + mine, them: s.them + tp, planRepeats: repeats, lastPlan: plan,
        between: { yours: driveNote(drive), mine, theirs: driveNote(theirs), tp },
      };
    });
  };

  const nextDrive = () => {
    setG((s) => {
      const idx = s.driveIdx + 1;
      if (idx >= GAME_DRIVES) return { ...s, driveIdx: idx, between: null, finished: true };
      return { ...s, driveIdx: idx, drive: newDrive(), classes: [], between: null, defId: teamDefence(s.rng, team, []) };
    });
  };
  const finishGame = () => {
    const res = { team: team.id, you: g.you, them: g.them };
    onSeason({ ...cur, week: cur.week + 1, results: [...cur.results, res] });
    setG(null); setStage('hub');
  };

  const def = useMemo(() => (g ? defenceById(g.defId) : null), [g && g.defId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = cur ? record(cur) : null;

  return (
    <main className="drive">
      <div className="drivehead">
        <div className="driveinfo">
          {stage === 'game' && g ? (
            <>
              <b>{g.finished ? 'Final' : g.between ? 'Drive over' : `${ordinal(g.drive.down)} & ${g.drive.toGo}`}</b>
              <span>{g.finished || g.between ? `Drive ${Math.min(g.driveIdx + 1, GAME_DRIVES)} of ${GAME_DRIVES}` : `${spotText(g.drive.spot)} · drive ${g.driveIdx + 1}/${GAME_DRIVES}`}</span>
            </>
          ) : <><b>Football season</b><span>{cur ? `Week ${Math.min(cur.week + 1, SEASON_GAMES)} of ${SEASON_GAMES}` : 'New'}</span></>}
        </div>
        {stage === 'game' && g ? (
          <div className="scoreline"><span className="you">You {g.you}</span><span className="vs">–</span><span className="them">{g.them} {team.name.split(' ').pop()}</span></div>
        ) : <div className="scoreline" />}
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
              <p className="note">Record {rec.wins}-{rec.losses}{rec.ties ? `-${rec.ties}` : ''}. {team.level === 0 ? 'A friendly start.' : team.level === 1 ? 'A real test.' : 'The best in the league.'} They usually line up in {team.def.map((id) => defenceById(id).name).join(', ')}.</p>
              <button className="lock" onClick={() => setStage('plan')}>Play week {cur.week + 1}</button>
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

      {stage === 'plan' && (
        <section className="hub">
          <h3>Your defence</h3>
          <p className="note">Pick the formation your defence will line up in against {team.name}. Each is strong against one kind of play and weak to another, and the opponent reads a formation you keep repeating.</p>
          <div className="drivepick">
            {DEFENCES.map((d) => <button key={d.id} className={plan === d.id ? 'chip on' : 'chip'} onClick={() => setPlan(d.id)}>{d.name}</button>)}
          </div>
          <p className="note">{defenceById(plan).name}: strong against the <b>{strongVs(plan)}</b>, weak to the <b>{weakVs(plan)}</b>.</p>
          <button className="lock" onClick={startGame}>Kick off</button>
        </section>
      )}

      {stage === 'game' && g && !g.finished && !g.between && def && (
        <LiveField key={`${g.driveIdx}-${g.plays}`} def={def} seed={(g.seed + g.plays * 131 + g.driveIdx * 17) >>> 0} onPlay={onPlay} />
      )}
      {stage === 'game' && g && g.between && (
        <section className="hub">
          <h3>Drive over</h3>
          <p className="note">Your drive: <b>{g.between.yours}</b>{g.between.mine ? ` (+${g.between.mine})` : ''}. Their drive: <b>{g.between.theirs}</b>{g.between.tp ? ` (+${g.between.tp})` : ''}.</p>
          <p className="note">Change your defence for their next drive if you like.</p>
          <div className="drivepick">
            {DEFENCES.map((d) => <button key={d.id} className={plan === d.id ? 'chip on' : 'chip'} onClick={() => setPlan(d.id)}>{d.name}</button>)}
          </div>
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
