// The fortune-layer settings the game uses, from scripts/fortune-balance.mjs
// (30-build pool, 3 seeds per pairing, 13,920 matches):
//   pit alone      -> pit flips ~9% of results; a player who learns the matchups
//                     wins 80% (86% choosing among the top three counters);
//                     88% of pairings give the same result every time.
//   + small fence  -> same flip rate, 80% learned counter, 79% consistent.
// Stacks grow 1 chip a tick (2 on a Hot Zone) but still cells go cold after
// 4 quiet ticks; the tallest stack at 25 chips topples (one at a time, 8 ticks
// apart, no limit); overflow goes down the gutter into a 10x10 pit.
const CORE = {
  threshold: 25,
  cooldown: 8,
  maxCrashes: Infinity, // no topple limit: every stack that reaches 25 falls
  shed: true, // a topple drops the bottom 25 chips; anything above stays to topple again
  cold: true,
  coldAfter: 4,
  flicker: true, // flashers stay lit, so a blinker's outer cells stack every tick and topple in about 25
  pit: true,
  pitSize: 10,
  splash: 1.6,
  hotValue: 5, // a chip landing on a Hot Spot becomes a stack of 5 of its own colour
  unit: 3, // bonus plots = pit tile lead / unit, i.e. 1 plot per 3 tiles of lead
  overtime: 150, // a settled board with flashers plays on (up to this many ticks) until the first topple
};

// Strategy-safest: Board 1 is not touched by a topple (the fence is only drawn).
export const FORTUNE_RULES = { ...CORE, fence: false };

// Dramatic: a connected line of up to 15 single cells lands along the fall direction on clear ground on Board 1.
export const FORTUNE_RULES_LIVE_FENCE = { ...CORE, fence: true, spread: true, line: 15, spacing: 4, maxBlocks: 2 };

// The game's default: no live fence (Board 1 is untouched by a topple; sweeps showed a
// live fence turns results into a coin flip). `liveFence` brings it back for experiments.
export const DEFAULT_FORTUNE_RULES = FORTUNE_RULES;
export const fortuneRulesFor = ({ liveFence = false } = {}) => (liveFence ? FORTUNE_RULES_LIVE_FENCE : FORTUNE_RULES);
