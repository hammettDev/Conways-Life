export const P = (role, shape, depth, lat) => ({ role, shape, depth, lat });
export const row = (role, shape, depth, lats) => lats.map((lat) => P(role, shape, depth, lat));

// n players spread evenly across +/-span lanes.
export const spread = (n, span) => {
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, i) => Math.round(-span + (2 * span * i) / (n - 1)));
};

export const build = (id, name, sport, players) => ({ id, name, sport, players });

// Bench: spare blinker walls along the rear edge. They never reach the fight
// but add tiles to the final count, which is how weak builds are levelled up.
export const BENCH_DEPTH = 27;
export const BENCH_MAX = 5;
const BENCH_LANES = [0, -6, 6, -12, 12];
export const benchUnits = (n) =>
  BENCH_LANES.slice(0, Math.min(n, BENCH_MAX)).map((lat) => P('BN', 'bar', BENCH_DEPTH, lat));
