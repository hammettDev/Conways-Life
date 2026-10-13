// Unit shapes as [du, dv] offsets. du runs along the depth axis (+ = away
// from the enemy), dv along the lateral (y) axis. Moving shapes are written so
// they travel toward the enemy (decreasing du).

// Convert screen-space cells (x grows toward the enemy, y down) into (du, dv).
const toward = (cells) => {
  const maxX = Math.max(...cells.map(([x]) => x));
  return cells.map(([x, y]) => [maxX - x, y]);
};

// The standard spaceship patterns fly toward their sparse side, i.e. the
// opposite way to how they are drawn here, so mirror them before use.
const mirrored = (cells) => {
  const maxX = Math.max(...cells.map(([x]) => x));
  return cells.map(([x, y]) => [maxX - x, y]);
};

export const SHAPES = {
  // --- players ---
  bar: [[0, -1], [0, 0], [0, 1]], // 3 cells across the line (blinker wall)
  dart: [[-1, 0], [0, 0], [1, 0]], // 3 cells pointed at the enemy
  ell: [[0, 0], [1, 0], [0, 1]], // 3-cell L: settles into a block
  block: [[0, 0], [1, 0], [0, 1], [1, 1]],
  tub: [[1, 0], [0, 1], [2, 1], [1, 2]],
  boat: [[0, 0], [1, 0], [0, 1], [2, 1], [1, 2]],
  hive: [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]],
  loaf: [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [3, 2], [2, 3]],
  toad: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]],
  toadv: [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2]],
  beacon: [[0, 0], [1, 0], [0, 1], [3, 2], [2, 3], [3, 3]],

  // --- weapons ---
  glider: toward([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]),
  lwss: toward(mirrored([[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]])),
  mwss: toward(mirrored([[3, 0], [1, 1], [5, 1], [0, 2], [0, 3], [5, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]])),
  hwss: toward(mirrored([[3, 0], [4, 0], [1, 1], [6, 1], [0, 2], [0, 3], [6, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4]])),
  acorn: [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]],
  rpent: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
};

// Tiles each shape claims when left alone (all phases of its cycle).
export const UNIT_TILES = {
  bar: 5, dart: 5, ell: 4, block: 4, tub: 4, boat: 5, hive: 6, loaf: 7,
  toad: 10, toadv: 10, beacon: 8,
};
