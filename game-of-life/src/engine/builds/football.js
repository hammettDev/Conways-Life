import { P, row, build } from './helpers.js';

// Seven on the line, then four more. Every player is a 3-cell unit.
const oline = (s = 5, d = 0) =>
  [-3, -2, -1, 0, 1, 2, 3].map((i) => P(Math.abs(i) === 3 ? 'TE' : 'OL', 'bar', d, i * s));
const dline = (s = 5, linebackerDepth = 0) =>
  [-3, -2, -1, 0, 1, 2, 3].map((i) =>
    P(i % 2 ? 'DL' : 'LB', 'bar', i % 2 ? 0 : linebackerDepth, i * s));

const F = (id, name, players) => build(id, name, 'football', players);

export const FOOTBALL = [
  // ---- offense ----
  F('fb-shotgun', 'Shotgun', [...oline(), P('QB', 'ell', 7, 0), P('RB', 'ell', 7, 5), P('WR', 'dart', 3, -18), P('WR', 'dart', 3, 18)]),
  F('fb-shotgun-trips', 'Shotgun Trips', [...oline(), P('QB', 'ell', 7, 0), P('WR', 'dart', 3, 18), P('WR', 'dart', 8, 12), P('WR', 'dart', 7, 7)]),
  F('fb-pistol', 'Pistol', [...oline(), P('QB', 'ell', 4, 0), P('RB', 'ell', 8, 0), P('WR', 'dart', 3, -18), P('WR', 'dart', 3, 18)]),
  F('fb-pistol-split', 'Pistol Split Backs', [...oline(), P('QB', 'ell', 4, 0), P('RB', 'ell', 8, -5), P('RB', 'ell', 8, 5), P('WR', 'dart', 3, 18)]),
  F('fb-i-form', 'I-Formation', [...oline(), P('QB', 'ell', 4, 0), P('FB', 'ell', 8, 0), P('RB', 'ell', 13, 0), P('WR', 'dart', 3, 18)]),
  F('fb-strong-i', 'Strong I', [...oline(), P('QB', 'ell', 4, 0), P('FB', 'ell', 8, 5), P('RB', 'ell', 13, 0), P('WR', 'dart', 3, 18)]),
  F('fb-weak-i', 'Weak I', [...oline(), P('QB', 'ell', 4, 0), P('FB', 'ell', 8, -5), P('RB', 'ell', 13, 0), P('WR', 'dart', 3, 18)]),
  F('fb-full-house', 'Full House', [...oline(), P('QB', 'ell', 4, 0), P('FB', 'ell', 8, 0), P('HB', 'ell', 8, -6), P('HB', 'ell', 8, 6)]),
  F('fb-wishbone', 'Wishbone', [...oline(), P('QB', 'ell', 4, 0), P('FB', 'ell', 8, 0), P('HB', 'ell', 11, -7), P('HB', 'ell', 11, 7)]),
  F('fb-flexbone', 'Flexbone', [...oline(), P('QB', 'ell', 4, 0), P('FB', 'ell', 8, 0), P('SB', 'dart', 5, -9), P('SB', 'dart', 5, 9)]),
  F('fb-singleback', 'Singleback Ace', [...oline(), P('QB', 'ell', 4, 0), P('RB', 'ell', 8, 0), P('WR', 'dart', 3, -18), P('WR', 'dart', 3, 18)]),
  F('fb-empty', 'Empty Set', [...oline(), P('WR', 'dart', 3, -18), P('WR', 'dart', 8, -12), P('WR', 'dart', 8, 12), P('WR', 'dart', 3, 18)]),
  F('fb-bunch', 'Bunch Left', [...oline(), P('QB', 'ell', 7, 0), P('WR', 'dart', 4, -19), P('WR', 'dart', 8, -14), P('WR', 'dart', 4, -9)]),
  F('fb-goal-line', 'Goal Line', [...oline(), P('QB', 'ell', 4, 0), P('FB', 'ell', 8, -4), P('HB', 'ell', 8, 4), P('HB', 'ell', 12, 0)]),
  F('fb-hail-mary', 'Hail Mary', [...oline(6), P('QB', 'ell', 10, 0), P('WR', 'dart', 5, -18), P('WR', 'dart', 5, 18), P('WR', 'dart', 5, 0)]),

  // ---- defense ----
  F('fb-4-3-over', '4-3 Over', [...dline(), P('CB', 'dart', 3, -18), P('CB', 'dart', 3, 18), P('S', 'ell', 12, -6), P('S', 'ell', 12, 6)]),
  F('fb-4-3-under', '4-3 Under', [...dline(5, 2), P('CB', 'dart', 4, -18), P('CB', 'dart', 4, 18), P('S', 'ell', 11, -8), P('S', 'ell', 11, 8)]),
  F('fb-3-4', '3-4 Odd', [
    ...row('DL', 'bar', 0, [-10, 0, 10]), ...row('LB', 'bar', 6, [-14, -5, 5, 14]),
    P('CB', 'dart', 4, -19), P('CB', 'dart', 4, 18), P('S', 'ell', 13, -4), P('S', 'ell', 13, 6),
  ]),
  F('fb-nickel', 'Nickel', [...dline(5, 1), P('CB', 'dart', 3, -18), P('CB', 'dart', 3, 18), P('NB', 'dart', 6, 11), P('S', 'ell', 13, 0)]),
  F('fb-dime', 'Dime Shell', [...dline(), P('CB', 'dart', 5, -18), P('CB', 'dart', 5, 18), P('S', 'dart', 10, -12), P('S', 'dart', 10, 12)]),
  F('fb-46-bear', '46 Bear', [...dline(5), P('CB', 'dart', 3, -18), P('CB', 'dart', 3, 18), P('S', 'ell', 5, -8), P('S', 'ell', 5, 8)]),
  F('fb-cover-0', 'Cover 0 Blitz', [...dline(), P('CB', 'dart', 3, -18), P('CB', 'dart', 3, 18), P('S', 'ell', 7, -4), P('S', 'ell', 7, 4)]),
  F('fb-cover-1', 'Cover 1 Man', [...dline(), P('CB', 'dart', 3, -18), P('CB', 'dart', 3, 18), P('S', 'ell', 7, -9), P('S', 'ell', 14, 0)]),
  F('fb-cover-2', 'Cover 2', [...dline(), P('CB', 'dart', 3, -18), P('CB', 'dart', 3, 18), P('S', 'ell', 14, -8), P('S', 'ell', 14, 8)]),
  F('fb-cover-3', 'Cover 3', [...dline(), P('CB', 'dart', 4, -18), P('CB', 'dart', 4, 18), P('S', 'ell', 12, 0), P('S', 'ell', 8, 10)]),
  F('fb-tampa-2', 'Tampa 2', [...dline(5, 1), P('CB', 'dart', 4, -18), P('CB', 'dart', 4, 18), P('S', 'ell', 14, -9), P('S', 'ell', 14, 9)]),
  F('fb-goal-line-d', 'Goal Line D', [...dline(), P('CB', 'dart', 3, -18), P('CB', 'dart', 3, 18), P('S', 'ell', 5, -2), P('S', 'ell', 5, 3)]),
  F('fb-prevent', 'Prevent', [...dline(6), P('CB', 'dart', 12, -18), P('CB', 'dart', 12, 18), P('S', 'ell', 18, -8), P('S', 'ell', 18, 8)]),
];
