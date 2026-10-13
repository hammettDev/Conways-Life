import { placeFormation, validateDraft, BLUE_LOS_X, CENTER_Y } from './formations.js';
import { SHAPES } from './shapes.js';
import { BLUE } from './constants.js';
import { OBJECT_PRICES } from './objectPrices.js';

// Purchasable objects: single patterns a player buys with in-game currency
// and drags onto their own half. Builds are free; these are the only paid
// items. One per player per match, so money cannot be stacked into an edge.
export const MAX_OBJECTS = 1;
export const MIN_PRICE = 50;

const O = (id, name, shape, blurb) => ({ id, name, shape, blurb });

export const OBJECT_CATALOG = [
  O('block', 'Sandbag', 'block', 'A still 2x2 wall. Holds its ground.'),
  O('toad', 'Toad', 'toad', 'A flashing blocker that claims extra ground.'),
  O('glider', 'Glider', 'glider', 'Five cells that crawl diagonally into the enemy.'),
  O('rpent', 'R-Pentomino', 'rpent', 'A small spark that grows into a brawl.'),
  O('acorn', 'Acorn', 'acorn', 'A slow-burning bomb that spreads for hundreds of ticks.'),
  O('lwss', 'Light Spaceship', 'lwss', 'Charges straight at the enemy line.'),
  O('mwss', 'Medium Spaceship', 'mwss', 'A heavier charge.'),
  O('hwss', 'Heavy Spaceship', 'hwss', 'The biggest charge you can buy.'),
];

export const OBJECTS = OBJECT_CATALOG.map((o) => ({
  ...o,
  cells: placeObject(o, 1, { depth: 10, lat: 0 }).length,
  price: OBJECT_PRICES[o.id] ?? MIN_PRICE,
}));

export const getObject = (id) => OBJECTS.find((o) => o.id === id);

// Cells of an object dropped at (depth, lat) on `team`'s half. `depth` counts
// back from the front line; `lat` is the lateral offset from the centre row.
export function placeObject(object, team, { depth, lat, flip = false }) {
  return placeFormation({ players: [{ role: 'OBJ', shape: object.shape, depth, lat }] }, team, { flip });
}

// Total price of a shopping list, or null if it breaks the object limit.
export function totalPrice(ids) {
  if (ids.length > MAX_OBJECTS) return null;
  return ids.reduce((n, id) => n + getObject(id).price, 0);
}

// Buying an object swaps out the build's rear-row reserves (the tile padding),
// so an object is worth what it does on the board and not simply the extra
// tiles it adds. Returns the team's full cell list: build + object.
export function cellsWithObject(build, team, object, drop, { flip = false } = {}) {
  const front = { ...build, players: build.players.filter((p) => p.role !== 'RS') };
  return [
    ...placeFormation(front, team, { flip }),
    ...placeObject(object, team, { ...drop, flip }),
  ];
}

// ---------------------------------------------------------------------------
// Placing a bought object on the board.
// ---------------------------------------------------------------------------

// Where a piece lands when the player puts its centre on sim tile (x, y): the
// (depth, lat) drop that placeObject understands.
export function dropAt(object, x, y) {
  const cells = SHAPES[object.shape];
  const meanU = cells.reduce((n, [du]) => n + du, 0) / cells.length;
  const meanV = cells.reduce((n, [, dv]) => n + dv, 0) / cells.length;
  return { depth: Math.round(BLUE_LOS_X - x - meanU), lat: Math.round(y - CENTER_Y - meanV) };
}

// Is this a legal place for a Blue object? Own half, inside the field, and not on
// top of the formation (its reserves are swapped out, so those tiles are free).
export function placementOk(build, object, drop) {
  const cells = placeObject(object, BLUE, drop);
  if (!validateDraft(cells, BLUE).ok) return false;
  const front = placeFormation({ ...build, players: build.players.filter((p) => p.role !== 'RS') }, BLUE);
  const taken = new Set(front.map((c) => `${c.x},${c.y}`));
  return !cells.some((c) => taken.has(`${c.x},${c.y}`));
}
