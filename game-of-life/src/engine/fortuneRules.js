// The fortune-layer settings the game uses, from scripts/fortune-balance.mjs
// (30-build pool, 3 seeds per pairing, 13,920 matches):
//   pit alone      -> pit flips ~9% of results; a player who learns the matchups
//                     wins 80% (86% choosing among the top three counters);
//                     88% of pairings give the same result every time.
//   + small fence  -> same flip rate, 80% learned counter, 79% consistent.
// Stacks grow 1 chip a tick (2 on a Hot Zone) but still cells go cold after
// 4 quiet ticks; the tallest stack at 25 chips topples (one at a time, 8 ticks
// apart, at most 6 a match); overflow goes down the gutter into a 10x10 pit.
const CORE = {
  threshold: 25,
  cooldown: 8,
  maxCrashes: 6,
  cold: true,
  coldAfter: 4,
  flicker: true, // flashers stay lit, so a blinker's outer cells stack every tick and topple in about 25
  pit: true,
  pitSize: 10,
  splash: 1.6,
  hotValue: 5, // a chip landing on a Hot Spot becomes a stack of 5 of its own colour
  unit: 0.25, // bonus plots = pit tile lead / unit, i.e. 4 plots per tile of lead
  overtime: 150, // a settled board with flashers plays on (up to this many ticks) until the first topple
};

// Strategy-safest: Board 1 is not touched by a topple (the fence is only drawn).
export const FORTUNE_RULES = { ...CORE, fence: false };

// Dramatic: a connected line of up to 15 single cells lands along the fall direction on clear ground on Board 1.
export const FORTUNE_RULES_LIVE_FENCE = { ...CORE, fence: true, spread: true, line: 15, spacing: 4, maxBlocks: 2 };

// The game's default: the live fence is on. Flip `liveFence` off to switch to the
// strategy-safest rules (Board 1 untouched by a topple) without changing anything else.
export const DEFAULT_FORTUNE_RULES = FORTUNE_RULES_LIVE_FENCE;
export const fortuneRulesFor = ({ liveFence = true } = {}) => (liveFence ? FORTUNE_RULES_LIVE_FENCE : FORTUNE_RULES);
