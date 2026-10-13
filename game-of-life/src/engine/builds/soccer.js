import { P, spread, build } from './helpers.js';

const SPAN = { 1: 0, 2: 9, 3: 13, 4: 15, 5: 17 };
const D = { F: 0, AM: 5, M: 8, DM: 11, D: 15, GK: 21 };
const SHAPE = { F: 'dart', AM: 'bar', M: 'bar', DM: 'bar', D: 'ell', GK: 'ell' };

// lines: [[line, count], ...]; always ends with a keeper.
const S = (id, name, lines) => build(id, name, 'soccer', [
  ...lines.flatMap(([line, n]) => spread(n, SPAN[n]).map((lat) => P(line, SHAPE[line], D[line], lat))),
  P('GK', SHAPE.GK, D.GK, 0),
]);

export const SOCCER = [
  S('sc-4-4-2', '4-4-2', [['F', 2], ['M', 4], ['D', 4]]),
  S('sc-4-3-3', '4-3-3', [['F', 3], ['M', 3], ['D', 4]]),
  S('sc-3-5-2', '3-5-2', [['F', 2], ['M', 5], ['D', 3]]),
  S('sc-4-2-3-1', '4-2-3-1', [['F', 1], ['AM', 3], ['DM', 2], ['D', 4]]),
  S('sc-5-3-2', '5-3-2', [['F', 2], ['M', 3], ['D', 5]]),
  S('sc-4-5-1', '4-5-1', [['F', 1], ['M', 5], ['D', 4]]),
  S('sc-3-4-3', '3-4-3', [['F', 3], ['M', 4], ['D', 3]]),
  S('sc-4-1-4-1', '4-1-4-1', [['F', 1], ['AM', 4], ['DM', 1], ['D', 4]]),
  S('sc-diamond', 'Diamond 4-4-2', [['F', 2], ['AM', 1], ['M', 2], ['DM', 1], ['D', 4]]),
  S('sc-christmas-tree', 'Christmas Tree 4-3-2-1', [['F', 1], ['AM', 2], ['M', 3], ['D', 4]]),
  S('sc-2-3-5', 'Pyramid 2-3-5', [['F', 5], ['M', 3], ['D', 2]]),
];
