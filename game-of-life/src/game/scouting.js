// What you can read off the other team's last play: the formation, and the call.
//   run:  which hole (Outside Left, Inside Right, Middle Dive...)
//   pass: which side the target lined up on, and how deep the throw was
import { RUN_PLAYS } from '../engine/footballLive.js';

// lateral distance (cells) -> a depth word; a glider thrown further to the side lands deeper downfield
export const depthWord = (d) => (d < 9 ? 'short' : d < 15 ? 'medium' : 'deep');
export const sideWord = (dy) => (dy < -3 ? 'left' : dy > 3 ? 'right' : 'middle');

// `call` is { off, kind, lane }; `play` the finished live play (for a pass, who it was thrown to).
export function describeCall(call, play) {
  if (call.kind === 'run') return { formation: call.off.name, kind: 'run', label: (RUN_PLAYS[call.lane] || RUN_PLAYS[2]).label };
  const r = play && play.target != null && play.receivers ? play.receivers[play.target] : null;
  if (!r || !play.qb) return { formation: call.off.name, kind: 'pass', label: 'dropped back, no throw' };
  const dy = r.y - play.qb.y;
  return { formation: call.off.name, kind: 'pass', label: `${sideWord(dy)}, ${depthWord(Math.abs(dy))}` };
}
