import React, { useEffect, useRef, useState } from 'react';
import LiveField from './LiveField.jsx';
import DefendField from './DefendField.jsx';
import Cheer from './Cheer.jsx';
import { botCall } from '../game/botOffence.js';
import { defenceById, DRIVE, fgChance, inFgRange } from '../engine/football.js';
import {
  TEAMS, SEASON_GAMES, PLAYOFF_WINS, newSeason, seasonOver, record, champion, nextTeam, botDrive, teamDefence, bestDefenceFor, scoreText,
} from '../game/season.js';
import { newGame, startPlay, afterPlay, afterSimDrive, savable, clockText, PLAY_SECONDS } from '../game/gameclock.js';
import { TOSS_IDS, TOSS_BEATS, tossBuilds, playToss } from '../game/toss.js';
import { createRng } from '../engine/rng.js';

const startSpot = () => { try { const v = Number(new URLSearchParams(window.location.search).get('spot')); return v > 0 && v < 100 ? v : null; } catch { return null; } }; // ?spot=70 starts every drive there, for testing
const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th'][n];
const spotText = (s) => (s >= DRIVE.goal ? 'Goal' : s <= 50 ? `Own ${s}` : `Opp ${DRIVE.goal - s}`);
const classOf = (r) => (r.kind === 'run' ? 'run' : r.yards > 14 ? 'deep' : r.yards > 7 ? 'mid' : 'short');
const STYLE_TEXT = { run: 'run the ball', short: 'throw short', mid: 'throw over the middle', deep: 'go deep' };

// Gridiron Cellular Warfare: a season of 8 games. A game is four 4-minute quarters with 15 seconds a play; a quick game of
// Conway's Takeover decides who receives; you play offence live and defence play by play. The game and the season live in
// the save, so you can put it down at any play and carry on later.
export default function Game({ season, onSeason, onExit }) {
  const [madden, setMadden] = useState(() => { try { return localStorage.getItem('fbview') !== 'side'; } catch { return true; } });
  const toggleView = () => setMadden((m) => { try { localStorage.setItem('fbview', m ? 'side' : 'madden'); } catch { /* storage unavailable */ } return !m; });
  const cur = season || null;
  const team = cur ? nextTeam(cur) : null;
  const [g, setG] = useState(() => (cur && cur.game && !seasonOver(cur) ? cur.game : null)); // a saved game resumes at once
  const curRef = useRef(cur);
  curRef.current = cur;
  const saved = useRef(false);

  // every change to the game goes to the save
  useEffect(() => {
    if (!g) return;
    if (!saved.current) { saved.current = true; if (curRef.current && curRef.current.game === g) return; }
    onSeason({ ...curRef.current, game: savable(g) });
  }, [g]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSeason = () => onSeason(newSeason((Math.random() * 2 ** 31) >>> 0));
  const startGame = () => { saved.current = false; setG(newGame((cur.seed + cur.week * 7919) >>> 0, team.id)); };
  const rngFor = (tag) => createRng((g.seed ^ Math.imul(g.plays + 1, 0x9e3779b1) ^ tag) >>> 0);

  // ---- the coin toss: a quick game of Conway's Takeover ----------------------------------------------------------
  const pickToss = (id) => setG((s) => ({ ...s, toss: { pick: id, ...playToss((s.seed ^ 0x7055) >>> 0, id) } }));
  const kickoff = () => setG((s) => startPlay(s, s.toss.winner, startSpot()));

  // ---- the plays ---------------------------------------------------------------------------------------------------
  const onPlay = (result) => {
    setG((s) => {
      const n = afterPlay(s, { kind: result.kind, yards: result.yards, note: result.note }, startSpot());
      // the defence reads how you have been calling it, while the drive lasts
      return n.poss === 'you' && n.drive.plays > 0 ? { ...n, classes: [...s.classes, classOf(result)] } : n;
    });
  };
  const onFoePlay = (result) => {
    setG((s) => {
      let n = afterPlay(s, { kind: result.kind, yards: result.yards, note: result.note }, startSpot());
      // a team in range on 4th down kicks
      if (n.poss === 'them' && n.drive.down === 4 && inFgRange(n.drive.spot) && n.phase === 'play') {
        const r = createRng((s.seed ^ Math.imul(s.plays + 7, 0x85ebca6b)) >>> 0);
        n = afterPlay(n, { kind: 'kick', made: r() < fgChance(n.drive.spot), yards: 0 }, startSpot());
      }
      return n;
    });
  };
  const kickFg = () => setG((s) => (inFgRange(s.drive.spot) ? afterPlay(s, { kind: 'kick', made: createRng((s.seed ^ Math.imul(s.plays + 3, 0x27d4eb2f)) >>> 0)() < fgChance(s.drive.spot), yards: 0 }, startSpot()) : s));
  const simFoe = (defId) => setG((s) => {
    const r = createRng((s.seed ^ Math.imul(s.plays + 11, 0x165667b1)) >>> 0);
    const d = botDrive((s.seed ^ Math.imul(s.plays + 5, 0x9e3779b1)) >>> 0, team, defId, 0);
    return afterSimDrive(s, d, 3 + Math.floor(r() * 4), startSpot());
  });
  const useAudible = () => setG((s) => ({ ...s, aud: Math.max(0, s.aud - 1) }));
  const ack = () => setG((s) => ({ ...s, pending: false }));
  const cheerDone = () => setG((s) => (s && s.cheer ? { ...s, cheer: null } : s));
  const counterFor = (call) => { const r = rngFor(0xc0de); return r() < team.scout ? defenceById(bestDefenceFor(team, call.kind, r)) : null; };
  const defFor = () => defenceById(teamDefence(rngFor(0xdef), team, g.classes));

  const finishGame = () => {
    onSeason({ ...cur, week: cur.week + 1, results: [...cur.results, { team: g.teamId, you: g.you, them: g.them }], game: null });
    setG(null);
  };

  const rec = cur ? record(cur) : null;
  const inGame = Boolean(g);
  const hasSaved = Boolean(cur && cur.game);

  return (
    <main className="drive">
      <div className="drivehead">
        <div className="driveinfo">
          {inGame && g.phase === 'play' ? (
            <>
              <b>{`Q${g.q} ${clockText(g.clock)}`} · {g.poss === 'you' ? '' : 'Their '}{ordinal(g.drive.down)} & {g.drive.toGo}</b>
              <span>{g.poss === 'you' ? spotText(g.drive.spot) : `Ball on ${g.drive.spot <= 50 ? `their ${g.drive.spot}` : `your ${DRIVE.goal - g.drive.spot}`} · you defend`}</span>
            </>
          ) : inGame && g.phase === 'toss' ? <><b>Coin toss</b><span>Gridiron Graffiti</span></>
            : inGame ? <><b>Final</b><span>{team.name}</span></>
              : <><b>Football season</b><span>{cur ? `Week ${Math.min(cur.week + 1, SEASON_GAMES)} of ${SEASON_GAMES}` : 'New'}</span></>}
        </div>
        {inGame && g.phase !== 'toss' ? (
          <div className="scoreline"><span className="aud" title="Audibles left">A{g.aud}</span><span className="you">You {g.you}</span><span className="vs">–</span><span className="them">{g.them} {team.name.split(' ').pop()}</span></div>
        ) : <div className="scoreline" />}
        <button className="ghost small" onClick={toggleView}>View: {madden ? 'Madden' : 'Sideways'}</button>
        <button className="ghost small" title="Your game is saved" onClick={() => { setG(null); onExit(); }}>Save &amp; exit</button>
      </div>

      {!inGame && (
        <section className="hub">
          {!cur ? (
            <>
              <h3>Gridiron Cellular Warfare</h3>
              <p className="note">A football season on a Life board: eight games against tougher and tougher teams. Each game is four 4-minute quarters, 15 seconds a play. A quick game of Conway's Takeover decides who receives. You play your offence live and call your defence play by play. Win {PLAYOFF_WINS} to be champions. Your season saves as you go, so put it down any time.</p>
              <p className="note"><b>Controls.</b> Space locks in, snaps and throws. On a pass your receivers are light spaceships and the ball is a glider you fire from the quarterback: pick a receiver (1-4 or arrows) and press Space when the dashed line turns green. Taps work too.</p>
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
              <p className="note">Record {rec.wins}-{rec.losses}{rec.ties ? `-${rec.ties}` : ''}. {team.level === 0 ? 'A friendly start.' : team.level === 1 ? 'A real test.' : 'The best in the league.'} They love to {STYLE_TEXT[team.style]}, and they usually line up in {team.def.map((id) => defenceById(id).name).join(', ')}.</p>
              {hasSaved
                ? <button className="lock" onClick={() => setG(cur.game)}>Continue game · Q{cur.game.q} {clockText(cur.game.clock)} · You {cur.game.you}–{cur.game.them}</button>
                : <button className="lock" onClick={startGame}>Play week {cur.week + 1}</button>}
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

      {inGame && g.cheer && <Cheer side={g.cheer.side} pts={g.cheer.pts} kind={g.cheer.kind} teamName={team.name} onDone={cheerDone} />}

      {inGame && g.phase === 'toss' && (
        <section className="hub">
          <h3>Who gets the ball?</h3>
          {!g.toss ? (
            <>
              <p className="note">A quick game of Conway's Takeover decides it. Pick one of three formations; each beats one of the others and loses to the other. {team.name} pick one too, and the board settles it. The winner receives.</p>
              <div className="drivepick" role="group" aria-label="Coin toss formation">
                {tossBuilds().map((b) => <button key={b.id} className="chip" onClick={() => pickToss(b.id)}>{b.name}</button>)}
              </div>
            </>
          ) : (
            <>
              <p className="note">You picked <b>{tossBuilds().find((b) => b.id === g.toss.pick)?.name}</b>; {team.name} picked <b>{tossBuilds().find((b) => b.id === g.toss.botId)?.name}</b>. {g.toss.outcome === 'win' ? 'Your formation took the board.' : g.toss.outcome === 'lose' ? 'Theirs took the board.' : 'It was a stalemate: decided by the flip of a coin.'}</p>
              <p className="note">{TOSS_IDS.map((id) => `${tossBuilds().find((b) => b.id === id).name} beats ${tossBuilds().find((b) => b.id === TOSS_BEATS[id]).name}`).join(' · ')}</p>
              <p className="verdict win">{g.toss.winner === 'you' ? 'You receive.' : `${team.name} receive.`}</p>
              <button className="lock" onClick={kickoff}>Kick off</button>
            </>
          )}
        </section>
      )}

      {inGame && g.phase === 'play' && g.pending && (
        <section className="hub">
          <h3>{g.note.includes('Halftime') ? 'Halftime' : g.note.includes('End of quarter') ? 'End of the quarter' : 'Drive over'}</h3>
          <p className="note">{g.note}</p>
          <p className="note">{g.poss === 'you' ? 'You have the ball.' : `${team.name} have the ball.`} Q{g.q} · {clockText(g.clock)} · You {g.you}, {g.them}.</p>
          <button className="lock" onClick={ack}>Continue</button>
        </section>
      )}
      {inGame && g.phase === 'play' && !g.pending && g.poss === 'them' && (
        <DefendField key={`d${g.plays}`} drive={g.drive} rotate={madden} call={botCall(rngFor(0xb07), team)} team={team} audibles={g.aud} onAudible={useAudible}
          seed={(g.seed + g.plays * 977) >>> 0} onPlay={onFoePlay} onSim={simFoe} />
      )}
      {inGame && g.phase === 'play' && !g.pending && g.poss === 'you' && (
        <LiveField key={`o${g.plays}`} drive={g.drive} rotate={madden} onKick={kickFg} team={team} defFor={defFor} counterFor={counterFor} audibles={g.aud} onAudible={useAudible}
          seed={(g.seed + g.plays * 131) >>> 0} onPlay={onPlay} />
      )}
      {inGame && g.phase === 'final' && (
        <section className="hub">
          <h3>{g.you > g.them ? 'Win!' : g.you < g.them ? 'Loss' : 'Tie'} {g.you}–{g.them}</h3>
          <p className="note">{team.name}. {g.note}</p>
          <button className="lock" onClick={finishGame}>Back to the season</button>
        </section>
      )}
    </main>
  );
}
