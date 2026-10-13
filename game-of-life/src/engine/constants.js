export const COLS = 80;
export const ROWS = 60;
export const FIELD_COLS = 60;
export const FIELD_ROWS = 40;
export const FIELD_X0 = (COLS - FIELD_COLS) / 2;
export const FIELD_Y0 = (ROWS - FIELD_ROWS) / 2;
export const FIELD_X1 = FIELD_X0 + FIELD_COLS;
export const FIELD_Y1 = FIELD_Y0 + FIELD_ROWS;

export const WAGER = 100;
export const MAX_DRAFT = 50;

// Tutorial lesson 5: a forced, insured first bet. Starting from $250 and
// winning an even-money $50 stake lands the player on the normal $300 stack.
// The wallet bailout must never exceed STARTING_WALLET, so busting out can
// never leave a player better off than a fresh start.
export const TUTORIAL_BANKROLL = 250;
export const TUTORIAL_STAKE = 50;
export const STARTING_WALLET = 300;

// Beating a boss pays this many times the wager (losing still costs one wager).
export const BOSS_PAYOUT = 5;

export const DEAD = 0;
export const BLUE = 1;
export const RED = 2;

export const HOT_BONUS = 2;
export const BASE_GAIN = 1;
export const MAX_TICKS = 500;
export const MAX_PERIOD = 3;

// Audible: after you lock in, the bot's formation is revealed and you may pay
// AUDIBLE_PRICE to switch yours (pay-per-use, so you only call it when you are
// in a bad matchup). If you call one, the bot may answer with its own hidden
// counter-audible with probability BOT_AUDIBLE_CHANCE, which caps a perfect
// counter-picker at roughly 75-80% instead of 90%. Simulated on the 30-build pool.
// Bosses can be audibled against too, but The Scout always answers: calling an
// audible against it just burns the fee, so you have to out-vary it instead.
export const AUDIBLE_PRICE = 50;
export const BOT_AUDIBLE_CHANCE = 0.3;
export const SCOUT_BOSS_AUDIBLE_CHANCE = 1;

// Bailout: when the wallet cannot cover a bet, a player can take a bailout, but it
// shrinks every time so going broke is never better than playing well, and it never
// exceeds STARTING_WALLET (so busting out cannot beat a fresh start).
export const BAILOUT_START = 300;
export const BAILOUT_STEP = 100;
export const BAILOUT_MIN = 100;
