import { placeFormation } from './formations.js';
import { OBJECT_PRICES } from './objectPrices.js';

// Purchasable objects: single patterns a player buys with in-game currency
// and drags onto their own half. Builds are free; these are the only paid items.
export const MAX_OBJECTS = 3;
export const MIN_PRICE = 5;

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
