export const P = (role, shape, depth, lat) => ({ role, shape, depth, lat });
export const row = (role, shape, depth, lats) => lats.map((lat) => P(role, shape, depth, lat));

// n players spread evenly across +/-span lanes.
export const spread = (n, span) => {
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, i) => Math.round(-span + (2 * span * i) / (n - 1)));
};

export const build = (id, name, sport, players) => ({ id, name, sport, players });

// Reserves: still-life units on the rear row, sized to top a build up to an
// exact tile total. They never reach the fight, so every free build claims
// the same number of tiles and only the clash decides a match.
export const RESERVE_DEPTH = 25;
const RESERVE_LANES = [-18, -12, -6, 0, 6, 12];
const RESERVE_SHAPE = { 4: 'block', 5: 'boat', 6: 'hive', 7: 'loaf' };

export function reserveUnits(deficit) {
  if (deficit <= 0) return [];
  if (deficit < 4) throw new Error(`cannot reserve ${deficit} tiles`);
  let parts;
  if (deficit <= 7) parts = [deficit];
  else if (deficit <= 14) parts = [Math.ceil(deficit / 2), Math.floor(deficit / 2)];
  else throw new Error(`reserve of ${deficit} tiles is too large`);
  return parts.map((t, i) => P('RS', RESERVE_SHAPE[t], RESERVE_DEPTH, RESERVE_LANES[i]));
}
