import { P, build } from './helpers.js';

// Five players, each a 6-cell toad (guards/wings flat, bigs upright).
const G = (d, l) => P('G', 'toad', d, l);
const W = (d, l) => P('W', 'toad', d, l);
const B = (d, l) => P('B', 'toadv', d, l);
const K = (id, name, players) => build(id, name, 'basketball', players);

export const BASKETBALL = [
  K('bb-2-3-zone', '2-3 Zone', [G(0, -8), G(0, 6), B(9, -14), B(9, -2), B(9, 11)]),
  K('bb-3-2-zone', '3-2 Zone', [G(0, -13), G(0, -2), G(0, 9), B(9, -8), B(9, 6)]),
  K('bb-1-3-1', '1-3-1 Trap', [G(0, -2), W(6, -14), W(6, -2), W(6, 10), B(13, -2)]),
  K('bb-1-2-2', '1-2-2 Zone', [G(0, -2), W(5, -9), W(5, 6), B(12, -10), B(12, 7)]),
  K('bb-2-1-2', '2-1-2 Zone', [G(0, -8), G(0, 6), W(6, -2), B(11, -10), B(11, 7)]),
  K('bb-box-and-one', 'Box-and-One', [W(0, -3), W(0, 8), B(9, -9), B(9, 12), G(4, -16)]),
  K('bb-triangle-2', 'Triangle-and-2', [G(0, -14), G(0, 12), B(7, -6), B(7, 6), B(12, 0)]),
  K('bb-four-out', '4-Out 1-In', [G(0, -17), W(0, -7), W(0, 5), G(0, 14), B(10, -2)]),
  K('bb-five-out', '5-Out Motion', [G(0, -17), W(0, -8), W(0, 0), W(0, 8), G(0, 16)]),
  K('bb-full-press', 'Full-Court Press', [G(0, -14), G(0, 10), W(5, -2), W(9, -10), B(13, 4)]),
  K('bb-stack', 'Pick-and-Roll Stack', [G(0, -2), B(7, -2), W(0, 11), W(8, -14), W(8, 14)]),
];
