// The guided first match. A new player starts with TUTORIAL_BANKROLL, is forced
// into a TUTORIAL_STAKE bet against a weak showcase formation, and the bet is
// insured (it pays as a win), landing them on the normal STARTING_WALLET.
// Shop pieces and the audible are free here so the numbers stay exact.
export const STEPS = {
  pick: {
    title: 'Welcome to the gridiron',
    text: 'You are blue. Two armies of cells fight on the field, and Conway\'s Life decides who wins. Pick any formation from the sidebar to preview it on your half.',
    wait: 'Choose a formation to continue.',
  },
  hot: {
    title: 'The Hot Zones',
    text: 'The amber pads are Hot Zones. Cells that stand on one build tall stacks. When a stack gets too tall it topples, and its chips spill down the pipes into the pit below the field. Whoever owns more of the pit gets a bonus.',
    next: 'Got it',
  },
  shop: {
    title: 'The shop',
    text: 'The Shop tab sells one piece per match, like a glider, that you drag onto your half. They cost real cash later, but they are free in this lesson. Try one, or skip it.',
    next: 'Continue',
  },
  lock: {
    title: 'Place your bet',
    text: 'Lock In stakes $50 on this match. This first bet is insured: you collect the win whatever happens, so you can learn without risk.',
    wait: 'Press Lock In.',
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
    text: 'Your first bet paid out and your wallet is now $300. Raise or lower your bet before each match, spend on pieces and audibles wisely, and win three matches to unlock a boss fight with a hidden x2 to x20 payout.',
    next: 'Start playing',
  },
};

export const ORDER = Object.keys(STEPS);

// Which step the match state calls for, given where the player is now.
export function stepFor(current, { phase, hasSelection }) {
  if (current === 'pick' && hasSelection) return 'hot';
  if (current === 'snap' && phase === 'draft') return 'lock'; // the bet was cancelled
  if (current === 'lock' && phase === 'locked') return 'snap';
  if ((current === 'snap' || current === 'lock') && phase === 'playing') return 'watch';
  if (current !== 'wrap' && phase === 'done') return 'wrap';
  return current;
}
