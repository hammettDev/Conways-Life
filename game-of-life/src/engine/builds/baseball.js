import { P, build } from './helpers.js';

// Nine fielders: infielders are blinker walls, outfielders point at the batter,
// and the pitcher is a toad.
const T = (role, d, l) => P(role, d >= 12 ? 'dart' : 'bar', d, l);
const M = (id, name, [p, c, b1, b2, ss, b3, lf, cf, rf]) =>
  build(id, name, 'baseball', [
    P('P', 'toad', p[0], p[1]), T('C', c[0], c[1]), T('1B', b1[0], b1[1]), T('2B', b2[0], b2[1]),
    T('SS', ss[0], ss[1]), T('3B', b3[0], b3[1]), T('LF', lf[0], lf[1]), T('CF', cf[0], cf[1]), T('RF', rf[0], rf[1]),
  ]);

export const BASEBALL = [
  M('bs-standard', 'Standard Alignment', [[6, 0], [14, 0], [2, 10], [2, 5], [2, -5], [2, -11], [15, -16], [19, 0], [15, 16]]),
  M('bs-infield-in', 'Infield In', [[6, 0], [14, 0], [0, 9], [0, 4], [0, -5], [0, -10], [15, -16], [19, 0], [15, 16]]),
  M('bs-shift-right', 'Pull Shift Right', [[6, 0], [14, 0], [2, 12], [2, 7], [2, 3], [2, -6], [15, -12], [19, 4], [15, 16]]),
  M('bs-shift-left', 'Pull Shift Left', [[6, 0], [14, 0], [2, 5], [1, -4], [2, -9], [2, -14], [15, -18], [19, -4], [15, 12]]),
  M('bs-no-doubles', 'No-Doubles Deep', [[6, 0], [14, 0], [2, 10], [2, 5], [2, -5], [2, -11], [19, -17], [20, 0], [19, 17]]),
  M('bs-bunt-defense', 'Bunt Defense', [[4, 0], [11, 0], [0, 10], [2, 6], [2, -6], [0, -11], [16, -16], [20, 0], [16, 16]]),
  M('bs-double-play', 'Double-Play Depth', [[6, 0], [14, 0], [2, 10], [2, 4], [2, -4], [2, -11], [15, -16], [19, 0], [15, 16]]),
  M('bs-squeeze', 'Squeeze Watch', [[4, 0], [11, 0], [0, 10], [0, 5], [0, -5], [0, -10], [15, -15], [19, 0], [15, 15]]),
  M('bs-shallow-outfield', 'Shallow Outfield', [[6, 0], [18, 0], [2, 10], [2, 5], [2, -5], [2, -11], [10, -16], [13, 0], [10, 16]]),
];
