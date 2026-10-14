import { FREE_BUILDS } from './library.js';
import { placeFormation } from './formations.js';
import { createEngine } from './engine.js';
import { DEFAULT_FORTUNE_RULES } from './fortuneRules.js';
import { RED } from './constants.js';
import { checkCustom, buildCustom } from './custom.js';

// How strong is a formation? Its win rate as the player (blue) against every formation in
// the bot pool, on a fixed set of seeds, under the shipped rules. The seeds are fixed, so a
// design always gets the same rating. The custom formation designer refuses designs above
// CUSTOM_RATING_CAP; this is the same measure the built-in formations are balanced with.
export const RATING_SEEDS = [201, 202, 203, 204, 205, 206];

export function rateCells(mine, onProgress) {
  let pts = 0;
  let n = 0;
  FREE_BUILDS.forEach((opp, i) => {
    const red = placeFormation(opp, RED);
    for (const seed of RATING_SEEDS) {
      const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
      e.loadTeams([...mine, ...red]);
      const r = e.runToEnd();
      pts += r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0;
      n++;
    }
    if (onProgress) onProgress(i + 1, FREE_BUILDS.length);
  });
  return pts / n;
}

// Rate a custom design (units as placed). Returns null if the design is not legal.
export function ratePlayers(players, onProgress) {
  const spec = { id: 'rate', name: 'rate', players };
  if (!checkCustom(spec).ok) return null;
  return rateCells(placeFormation(buildCustom(spec), 1), onProgress);
}

// A checksum over the design and its rating, stored with a saved formation so that a
// hand-edited save cannot claim a better rating. (Like the save code, a typo guard and a
// speed bump, not security: the game runs in the player's own browser.)
export function designHash(players, rating) {
  const body = JSON.stringify([...players].map((p) => [p.shape, p.depth, p.lat]).sort()) + `|${Math.round(rating * 1000)}|gcw`;
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) { h ^= body.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
