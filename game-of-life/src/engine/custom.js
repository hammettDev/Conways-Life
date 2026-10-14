import { SHAPES, UNIT_TILES } from './shapes.js';
import { TARGET_TILES, footprintOf } from './library.js';
import { reserveUnits } from './builds/helpers.js';
import { placeFormation, validateDraft } from './formations.js';
import { createEngine } from './engine.js';
import { BLUE, MAX_CUSTOM_UNITS } from './constants.js';

// Custom formations: the player places units (still lifes and small oscillators) on their
// own half. They play by the same rules as every built-in formation: the same tile budget
// (topped up with rear reserves to TARGET_TILES), own half only, and inert when left alone.
export const CUSTOM_SHAPES = ['bar', 'dart', 'ell', 'block', 'tub', 'boat', 'hive', 'loaf', 'toad', 'toadv', 'beacon'];
export const MAX_DEPTH = 20; // how far back a unit's front edge may sit

// Reserves can only top up a deficit of 4..14 tiles, so the units must claim 46-56 or exactly 60.
export const footprintOk = (fp) => fp === TARGET_TILES || (fp >= TARGET_TILES - 14 && fp <= TARGET_TILES - 4);

export function buildCustom(spec) {
  const players = spec.players.map((p) => ({ role: 'CU', shape: p.shape, depth: p.depth, lat: p.lat }));
  const deficit = TARGET_TILES - footprintOf(players);
  return {
    id: spec.id, name: spec.name, sport: 'custom', tier: 'custom', winRate: null,
    players: [...players, ...(footprintOk(footprintOf(players)) ? reserveUnits(deficit) : [])],
  };
}

// Is this a legal custom formation? Returns { ok, reason, footprint }.
export function checkCustom(spec) {
  const units = spec.players || [];
  if (!units.length) return { ok: false, reason: 'Place at least one unit.', footprint: 0 };
  if (units.length > MAX_CUSTOM_UNITS) return { ok: false, reason: `At most ${MAX_CUSTOM_UNITS} units.`, footprint: 0 };
  for (const p of units) {
    if (!CUSTOM_SHAPES.includes(p.shape) || !Number.isInteger(p.depth) || !Number.isInteger(p.lat)) return { ok: false, reason: 'Unknown unit.', footprint: 0 };
  }
  const footprint = footprintOf(units);
  if (!footprintOk(footprint)) {
    return { ok: false, footprint, reason: footprint > TARGET_TILES ? `Over budget: ${footprint} of ${TARGET_TILES} tiles.` : `Use 46 to 56 tiles, or exactly 60 (you have ${footprint}).` };
  }
  const reach = Math.max(...units.map((p) => p.depth + Math.max(...SHAPES[p.shape].map(([du]) => du))));
  if (reach > MAX_DEPTH || units.some((p) => p.depth < 0)) return { ok: false, footprint, reason: 'Keep every unit between the line and 20 back.' };
  const build = buildCustom({ id: 'check', name: 'check', players: units });
  for (const flip of [false, true]) {
    const v = validateDraft(placeFormation(build, BLUE, { flip }), BLUE);
    if (!v.ok) return { ok: false, footprint, reason: v.reason === 'duplicate tile' ? 'Two units overlap.' : `Does not fit: ${v.reason}.` };
  }
  // Inert alone: left to itself the formation settles at once and keeps exactly its tiles.
  const e = createEngine({ seed: 1, freezeUnderworld: true });
  e.loadTeams(placeFormation(build, BLUE));
  const r = e.runToEnd();
  if (!(r.status === 'stable' && r.ticks <= 4 && r.score.blue === TARGET_TILES)) {
    return { ok: false, footprint, reason: 'Units too close: the formation does not hold still on its own.' };
  }
  return { ok: true, footprint, reason: '' };
}

export const customId = (n) => `custom-${n}`;
export { UNIT_TILES };
