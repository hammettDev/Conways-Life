// The guided first match. A new player starts with TUTORIAL_BANKROLL, is forced
// into a TUTORIAL_STAKE bet against a weak showcase formation, and the bet is
// insured (it pays as a win), landing them on the normal STARTING_WALLET.
// Shop pieces and the audible are free here so the numbers stay exact.
export const STEPS = {
  pick: {
    title: "Welcome to Conway's Takeover",
    text: 'You are blue. Two armies of cells fight on the field, and Conway\'s Life decides who wins. Pick any formation from the sidebar to preview it on your half.',
    wait: 'Choose a formation to continue.',
  },
  rules: {
    title: "The rules of Life",
    text: "Every cell on the board follows the same four rules, once per tick. Each cell looks at the 8 tiles around it:",
    rules: [
      'A live cell with 2 or 3 live neighbours survives.',
      'With fewer than 2 it dies of loneliness.',
      'With more than 3 it dies of crowding.',
      'An empty tile with exactly 3 live neighbours comes alive. A newborn takes the colour most of its parents had.',
    ],
    after: 'That is all of Conway\'s Game of Life. Nobody moves the cells: the rules do, and a glider like this one walks across the board by itself.',
    demo: 'glider',
    next: 'Got it',
  },
  hot: {
    title: 'The Hot Zones',
    text: 'The amber pads are Hot Zones. Cells that stand on one build tall stacks. When a stack gets too tall it topples, and its chips spill down the pipes into the pit below the field. Whoever owns more of the pit gets a bonus.',
    next: 'Got it',
  },
  shop: {
    title: 'The shop',
    text: 'The Shop tab sells one piece per match, like a glider, that you drag onto your half. They cost in-game cash later (it is all play money), but they are free in this lesson. Try one, or skip it.',
    next: 'Continue',
  },
  lock: {
    title: 'Place your bet',
    text: 'Lock In stakes $50 on this match. This first bet is insured: you collect the win whatever happens, so you can learn without risk.',
    wait: 'Press Lock In.',
    practice: 'Lock In starts the match. This is a practice run, so no money moves.',
  },
  snap: {
    title: 'Read the matchup',
    text: 'The bot\'s formation is revealed. Not happy with the matchup? An Audible lets you switch formations (free now, $50 later), but the bot may answer with a hidden audible of its own. Press Snap when ready.',
    wait: 'Press Snap to start.',
  },
  watch: {
    title: 'Watch it unfold',
    text: 'Cells live and die by Life\'s rules. Stacks rise on the Hot Zones and topple into the pit. When the board settles, the side with more ground, plus the pit bonus, wins.',
    wait: 'Wait for the result.',
  },
  wrap: {
    title: 'That is the game',
    text: 'Your first bet paid out and your wallet is now $300. Raise or lower your bet before each match, spend on pieces and audibles wisely, and watch out: a boss can show up at any time, the arena turns red, and beating one pays a hidden x2 to x20.',
    next: 'Start playing',
    practice: 'That is the game. This was a practice run, so your wallet is unchanged. A boss can show up at any time, the arena turns red, and beating one pays a hidden x2 to x20.',
  },
};

export const ORDER = Object.keys(STEPS);

// Which step the match state calls for, given where the player is now.
export function stepFor(current, { phase, hasSelection }) {
  if (current === 'pick' && hasSelection) return 'rules';
  if (current === 'snap' && phase === 'draft') return 'lock'; // the bet was cancelled
  if (current === 'lock' && phase === 'locked') return 'snap';
  if ((current === 'snap' || current === 'lock') && phase === 'playing') return 'watch';
  if (current !== 'wrap' && phase === 'done') return 'wrap';
  return current;
}
