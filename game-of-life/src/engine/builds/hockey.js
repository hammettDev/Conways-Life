import { P, build } from './helpers.js';

// Five skaters and a goalie. Four skaters are toads, the fifth a blinker
// wall, and the goalie a beacon.
const H = (id, name, skaters) => build(id, name, 'hockey', [
  ...skaters.map(([d, l], i) => P('SK', i === 0 ? 'bar' : 'toad', d, l)),
  P('G', 'beacon', 19, 0),
]);

export const HOCKEY = [
  H('hk-1-2-2', '1-2-2 Forecheck', [[0, -2], [5, -10], [5, 7], [11, -8], [11, 6]]),
  H('hk-2-1-2', '2-1-2 Forecheck', [[0, -9], [0, 6], [6, -2], [11, -8], [11, 6]]),
  H('hk-1-3-1', '1-3-1 Power Play', [[0, -2], [5, -14], [5, -2], [5, 10], [12, -2]]),
  H('hk-trap', 'Neutral Zone Trap', [[0, -2], [6, -14], [6, -2], [6, 10], [12, -2]]),
  H('hk-box', 'Box Penalty Kill', [[2, -9], [2, 7], [9, -9], [9, 7], [5, -2]]),
  H('hk-diamond', 'Diamond Penalty Kill', [[0, -2], [5, -10], [5, 7], [13, -2], [6, -2]]),
  H('hk-umbrella', 'Umbrella Power Play', [[0, -12], [0, -2], [0, 9], [8, -9], [8, 6]]),
  H('hk-wall', 'Boards Wall', [[1, -16], [1, 13], [7, -16], [7, 13], [12, -2]]),
];
