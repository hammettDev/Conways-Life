import { createEngine } from '../engine/engine.js';
import { DEFAULT_FORTUNE_RULES } from '../engine/fortuneRules.js';
import { createRng } from '../engine/rng.js';
import { BLUE, RED } from '../engine/constants.js';
import { settle, noteResult, clearPending } from './wallet.js';
import { getBoss, rollMultiplier } from './bosses.js';

// A locked-in match is written into the save with everything needed to replay it:
// the seed and both lineups. The engine is deterministic, so if the page is closed
// before the result, the match simply finishes on the next load with the same outcome.
export const packMatch = (seed, wager, bossId, blue, red) => ({
  seed, wager, boss: bossId || null,
  blue: blue.map((c) => [c.x, c.y]),
  red: red.map((c) => [c.x, c.y]),
});

// The boss payout roll is seeded too, so a reload cannot reroll it.
export const bossMultiplier = (seed, boss, outcome) => (boss && outcome === 'win' ? rollMultiplier(createRng(seed ^ 0x7f4a7c15), boss.rolls) : 1);

export function resolvePending(save) {
  const p = save.pending;
  if (!p) return null;
  const e = createEngine({ seed: p.seed, fortune: DEFAULT_FORTUNE_RULES });
  e.loadTeams([...p.blue.map(([x, y]) => ({ x, y, team: BLUE })), ...p.red.map(([x, y]) => ({ x, y, team: RED }))]);
  const r = e.runToEnd();
  const boss = p.boss ? getBoss(p.boss) : null;
  const mult = bossMultiplier(p.seed, boss, r.outcome);
  const settled = noteResult(settle(clearPending(save), r.outcome, p.wager, mult), r.outcome, boss ? boss.id : null);
  return { save: { ...settled, rev: save.rev + 1 }, outcome: r.outcome, wager: p.wager, mult };
}
