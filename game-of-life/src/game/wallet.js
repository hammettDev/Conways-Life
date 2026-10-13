import {
  WAGER, STARTING_WALLET, BAILOUT_START, BAILOUT_STEP, BAILOUT_MIN,
} from '../engine/constants.js';

// The player's save: wallet, bailout count and a few stats. All functions are
// pure and return a new save, so the UI can keep it in React state and persist it.
export const SAVE_VERSION = 1;

export const newSave = () => ({
  v: SAVE_VERSION,
  balance: STARTING_WALLET,
  bailouts: 0,
  stats: { played: 0, wins: 0, losses: 0, pushes: 0, streak: 0, bestStreak: 0 },
});

export const canAfford = (save, cost) => save.balance >= cost;

// Money held while a match is being set up: the bet plus a bought object.
// Returns the new save, or null if the player cannot cover it.
export function placeBet(save, cost) {
  if (!Number.isFinite(cost) || cost < 0 || save.balance < cost) return null;
  return { ...save, balance: save.balance - cost };
}

export function refund(save, amount) {
  return { ...save, balance: save.balance + amount };
}

// Pay a fee that is not refunded (an audible).
export function spend(save, amount) {
  return placeBet(save, amount);
}

// Settle a finished match. The wager was already taken at lock-in, so a win
// returns the stake plus winnings, a push returns the stake, a loss returns nothing.
export function settle(save, outcome, wager = WAGER, multiplier = 1) {
  const stats = { ...save.stats, played: save.stats.played + 1 };
  let back = 0;
  if (outcome === 'win') {
    back = wager + wager * multiplier;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else if (outcome === 'push') {
    back = wager;
    stats.pushes++;
  } else {
    stats.losses++;
    stats.streak = 0;
  }
  return { ...save, balance: save.balance + back, stats };
}

export const bailoutAmount = (save) => Math.max(BAILOUT_MIN, BAILOUT_START - BAILOUT_STEP * save.bailouts);
export const bailoutAvailable = (save) => save.balance < WAGER;

export function takeBailout(save) {
  if (!bailoutAvailable(save)) return null;
  const amount = bailoutAmount(save);
  return { save: { ...save, balance: save.balance + amount, bailouts: save.bailouts + 1 }, amount };
}
