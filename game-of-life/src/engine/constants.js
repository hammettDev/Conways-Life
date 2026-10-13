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
