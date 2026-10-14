import {
  WAGER, MIN_BET, STARTING_WALLET, CUSTOM_PRICE, MAX_CUSTOM, TUTORIAL_BANKROLL, BAILOUT_START, BAILOUT_STEP, BAILOUT_MIN,
} from '../engine/constants.js';

// The player's save: wallet, bailout count and a few stats. All functions are
// pure and return a new save, so the UI can keep it in React state and persist it.
export const SAVE_VERSION = 1;

export const newSave = () => ({
  v: SAVE_VERSION,
  balance: STARTING_WALLET,
  tutorialDone: true,
  rev: 0,          // goes up with every change, so an older save code can be told from a newer one
  sid: 0,          // per-save id that seeds the opponents, so cancelling or reloading cannot reroll them
  pending: null,   // a locked-in match that has not finished; it settles itself if the page is closed
  boss: { wins: 0, beaten: [], last: null },
  custom: { unlocked: false, list: [] }, // the formation designer and the formations you saved with it
  bailouts: 0,
  stats: { played: 0, wins: 0, losses: 0, pushes: 0, streak: 0, bestStreak: 0 },
});

// A brand-new player starts with the tutorial bankroll; finishing (or skipping)
// the tutorial tops them up to STARTING_WALLET.
export const newPlayerSave = () => ({ ...newSave(), balance: TUTORIAL_BANKROLL, tutorialDone: false });

export function finishTutorial(save) {
  return { ...save, tutorialDone: true, balance: Math.max(save.balance, STARTING_WALLET) };
}

// Boss progress: wins since the last boss fight, the bosses beaten, and the
// formation used last match (some bosses counter-pick it).
export const noteFormation = (save, id) => ({ ...save, boss: { ...save.boss, last: id } });

export function noteResult(save, outcome, bossId = null) {
  const boss = { ...save.boss };
  if (bossId) {
    boss.wins = 0;
    if (outcome === 'win' && !boss.beaten.includes(bossId)) boss.beaten = [...boss.beaten, bossId];
  } else if (outcome === 'win') {
    boss.wins = Math.min(boss.wins + 1, 99);
  }
  return { ...save, boss };
}

// The seed for the next match is fixed by the save and how many matches it has played,
// so cancelling and locking in again (or reloading) faces exactly the same opponent.
export function matchSeed(save, salt = 0) {
  let h = (save.sid ^ Math.imul(save.stats.played + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) & 0x7fffffff;
}

export const setPending = (save, pending) => ({ ...save, pending });
export const clearPending = (save) => (save.pending ? { ...save, pending: null } : save);

// Pay a fee out of whatever is left (a cancelled lock-in forfeits the re-pick fee, never more than you have).
export const forfeit = (save, amount) => ({ ...save, balance: save.balance - Math.min(amount, save.balance) });

// The custom formation designer is a one-off purchase; formations you design are saved with the game.
export function buyCustom(save) {
  if (save.custom.unlocked || save.balance < CUSTOM_PRICE) return null;
  return { ...save, balance: save.balance - CUSTOM_PRICE, custom: { ...save.custom, unlocked: true } };
}

export function saveCustom(save, spec) {
  if (!save.custom.unlocked) return null;
  const rest = save.custom.list.filter((c) => c.id !== spec.id);
  if (rest.length >= MAX_CUSTOM) return null;
  return { ...save, custom: { ...save.custom, list: [...rest, spec] } };
}

export const deleteCustom = (save, id) => ({ ...save, custom: { ...save.custom, list: save.custom.list.filter((c) => c.id !== id) } });

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
export const bailoutAvailable = (save) => save.balance < MIN_BET;

export function takeBailout(save) {
  if (!bailoutAvailable(save)) return null;
  const amount = bailoutAmount(save);
  return { save: { ...save, balance: save.balance + amount, bailouts: save.bailouts + 1 }, amount };
}
