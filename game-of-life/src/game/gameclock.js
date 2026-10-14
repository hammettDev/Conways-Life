// The clock and the ball for a football game. Pure functions over a plain, savable object, so a game can be
// put down mid-quarter and picked up from the save.
//   - every play takes 15 seconds of game clock, a quarter is 4 minutes (16 plays), a game is 4 quarters
//   - the ball changes hands on a score, a turnover or turnover on downs; after the half the other team receives
import { newDrive, advance, DRIVE, inFgRange } from '../engine/football.js';
import { drivePoints, driveNote } from './season.js';

export const PLAY_SECONDS = 15;
export const QUARTER_SECONDS = 240;
export const AUDIBLES = 4;
export const other = (side) => (side === 'you' ? 'them' : 'you');
export const clockText = (secs) => `${Math.floor(Math.max(0, secs) / 60)}:${String(Math.max(0, secs) % 60).padStart(2, '0')}`;

const freshAt = (spot) => ({ ...newDrive(), spot });

export const newGame = (seed, teamId) => ({
  teamId, seed: seed >>> 0, phase: 'toss', q: 1, clock: QUARTER_SECONDS, you: 0, them: 0, poss: null, first: null,
  drive: null, aud: AUDIBLES, plays: 0, classes: [], note: '', pending: false, cheer: null, td: 0, fg: 0, toss: null,
});

export const startPlay = (g, firstSide, spotOverride = null) => ({ ...g, phase: 'play', poss: firstSide, first: firstSide, drive: freshAt(spotOverride || DRIVE.startSpot) });

// Close out `secs` seconds on the clock, with the drive `drive` as it now stands (over or not).
function settle(g, drive, secs, spotOverride = null) {
  let { q, clock, you, them, poss, classes, td, fg } = g;
  td = td || 0; fg = fg || 0;
  const notes = [];
  let cheer = null;
  clock -= secs;
  let d = drive;
  if (d.over) {
    const pts = drivePoints(d);
    if (poss === 'you') { you += pts; if (d.over === 'td') td += 1; else if (d.over === 'fg') fg += 1; } else them += pts;
    notes.push(`${poss === 'you' ? 'Your' : 'Their'} drive: ${driveNote(d)}${pts ? ` (+${pts})` : ''}.`);
    if (pts > 0) cheer = { side: poss, pts, kind: d.over === 'td' ? 'td' : 'fg' };
    const scored = d.over === 'td' || d.over === 'fg';
    const spot = scored ? DRIVE.startSpot : d.over === 'punt' ? d.puntTo : Math.max(20, Math.min(80, DRIVE.goal - d.spot));
    poss = other(poss);
    d = freshAt(spotOverride || spot);
    classes = [];
  }
  let phase = 'play';
  if (clock <= 0) {
    if (q === 2) { // halftime: the team that kicked off gets the ball
      notes.push('Halftime. The ball switches.');
      poss = other(g.first); d = freshAt(spotOverride || DRIVE.startSpot); classes = []; q = 3; clock = QUARTER_SECONDS;
    } else if (q === 4) {
      phase = 'final'; clock = 0;
      notes.push('That is the game.');
    } else {
      notes.push(`End of quarter ${q}.`);
      q += 1; clock = QUARTER_SECONDS;
    }
  }
  return { ...g, td, fg, q, clock, you, them, poss, drive: { ...d, log: [] }, phase, classes, plays: g.plays + 1, note: notes.join(' '), pending: notes.length > 0, cheer };
}

// One play of the game (a pass, a run, a kick) with its outcome from the engine.
export function afterPlay(g, outcome, spotOverride = null) {
  const drive = advance(g.drive, outcome);
  const g2 = settle(g, drive, PLAY_SECONDS, spotOverride);
  return g2;
}

// A whole drive settled at once (the "sim the rest of their drive" shortcut): `result` is { over, spot } and `plays`
// how many snaps it took.
export function afterSimDrive(g, result, plays, spotOverride = null) {
  return settle(g, { ...g.drive, ...result, plays: g.drive.plays + plays }, PLAY_SECONDS * plays, spotOverride);
}

// What the bot does on its own 4th down: 'kick', 'punt' or 'go' (run the play). Normally it kicks in range and punts on a
// long way to go; late in the game it plays to win. In the 4th quarter, trailing by more than a field goal it needs a
// touchdown, so it goes for it rather than kick or punt; trailing at all with under 90 seconds left it goes for it too.
export function botFourthDown(g) {
  const trailBy = g.you - g.them; // the bot is `them`
  if (g.q === 4 && trailBy > 3) return 'go';
  if (g.q === 4 && trailBy > 0 && g.clock <= 90) return 'go';
  if (inFgRange(g.drive.spot)) return 'kick';
  return g.drive.toGo > 5 ? 'punt' : 'go';
}

export const finalResult = (g) => ({ team: g.teamId, you: g.you, them: g.them });
// strip what need not be saved
export const savable = (g) => ({ ...g, cheer: null, drive: g.drive ? { ...g.drive, log: [] } : null });
