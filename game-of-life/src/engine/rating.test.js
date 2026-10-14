import { describe, it, expect } from 'vitest';
import { ratePlayers, designHash, RATING_RUNS } from './rating.js';
import { CUSTOM_RATING_CAP } from './constants.js';
import { importCode, exportCode } from '../game/saveStore.js';
import { newSave, buyCustom, saveCustom } from '../game/wallet.js';
import { getBuild } from './library.js';

const unitsOf = (id) => getBuild(id).players.filter((p) => p.role !== 'RS').map(({ shape, depth, lat }) => ({ shape, depth, lat }));

describe('formation rating', () => {
  it('is deterministic, and ranks a weak formation below a strong one', () => {
    const weak = unitsOf('fb-wishbone');
    const strong = unitsOf('fb-i-form');
    const quick = RATING_RUNS.slice(0, 4); // a smaller sample keeps the test fast
    const a = ratePlayers(weak, null, quick);
    expect(ratePlayers(weak, null, quick)).toBe(a); // fixed seeds: the same design always gets the same rating
    expect(a).toBeLessThan(ratePlayers(strong, null, quick));
    expect(ratePlayers([])).toBeNull(); // an illegal design has no rating
  }, 120000);

  it('the cap sits above the best free built-in formation, so the free pool is never locked out', () => {
    expect(ratePlayers(unitsOf('fb-prevent'))).toBeLessThanOrEqual(CUSTOM_RATING_CAP);
  }, 120000);

  it('rates against the bots both as built and flipped', () => {
    expect(RATING_RUNS.some((r) => r.flip)).toBe(true);
    expect(RATING_RUNS.some((r) => !r.flip)).toBe(true);
  });
});

describe('saved custom formations carry their rating', () => {
  const players = unitsOf('fb-pistol');
  const withCustom = (extra) => {
    const rich = buyCustom({ ...newSave(), balance: 2000000 });
    return { ...saveCustom(rich, { id: 'c1', name: 'Mine', players, ...extra }), };
  };
  const roundTrip = (save) => importCode(exportCode(save)).custom.list;

  it('survives an export when the rating matches the design and is under the cap', () => {
    const rating = 0.6;
    expect(roundTrip(withCustom({ rating, hash: designHash(players, rating) }))).toHaveLength(1);
  });
  it('is dropped when the rating was edited, missing, or over the cap', () => {
    expect(roundTrip(withCustom({ rating: 0.5, hash: designHash(players, 0.6) }))).toHaveLength(0); // hand-edited
    expect(roundTrip(withCustom({}))).toHaveLength(0); // never rated
    const high = 0.9;
    expect(roundTrip(withCustom({ rating: high, hash: designHash(players, high) }))).toHaveLength(0); // too strong
  });
  it('is dropped when the design was changed after rating', () => {
    const rating = 0.6;
    const other = unitsOf('fb-flexbone');
    const rich = buyCustom({ ...newSave(), balance: 2000000 });
    const s = saveCustom(rich, { id: 'c1', name: 'Mine', players: other, rating, hash: designHash(players, rating) });
    expect(roundTrip(s)).toHaveLength(0);
  });
});
