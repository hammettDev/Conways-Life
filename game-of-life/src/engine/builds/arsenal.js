import { P, row, build } from './helpers.js';

// Weapon packs: mobile or explosive patterns. These are meant to be strong,
// so they are priced from their measured win rate (see library.js).
const A = (id, name, players) => build(id, name, 'arsenal', players);
const line = (s = 5) => [-3, -2, -1, 0, 1, 2, 3].map((i) => P('OL', 'bar', 0, i * s));

export const ARSENAL = [
  A('ar-glider-trio', 'Glider Trio', row('GL', 'glider', 6, [-10, 0, 10])),
  A('ar-glider-squadron', 'Glider Squadron', [...row('GL', 'glider', 6, [-15, -9, -3, 3, 9, 15])]),
  A('ar-glider-barrage', 'Glider Barrage', [...row('GL', 'glider', 4, [-19, -14, -9, -4, 1, 6, 11, 16])]),
  A('ar-light-convoy', 'Light Convoy', row('LW', 'lwss', 5, [-12, 0, 12])),
  A('ar-medium-convoy', 'Medium Convoy', row('MW', 'mwss', 5, [-12, 0, 12])),
  A('ar-heavy-convoy', 'Heavy Convoy', row('HW', 'hwss', 5, [-12, 0, 12])),
  A('ar-acorn-bombs', 'Acorn Bombs', row('AB', 'acorn', 2, [-12, 0, 12])),
  A('ar-pentomino-salvo', 'R-Pentomino Salvo', row('RP', 'rpent', 2, [-16, -8, 0, 8, 16])),
  A('ar-blitz-convoy', 'Blitz Convoy', [...line(), ...row('LW', 'lwss', 6, [-12, 0, 12])]),
  A('ar-glider-line', 'Glider Line', [...line(), ...row('GL', 'glider', 5, [-15, -7, 0, 7, 15])]),
];
