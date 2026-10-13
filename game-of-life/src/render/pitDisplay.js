// The pit as the player sees it. The engine lands a topple's chips the instant it
// happens, but on screen they should first run down the gutter and only then
// drop onto their tiles. This keeps a display copy of the pit and applies each
// topple's landings once its animation has finished.

export const TRAVEL_MS = 1500; // time a chip takes to run the gutter
export const STAGGER_MS = 110; // gap between chips of the same spill

// When the last chip of a spill reaches the pit.
export const landsAt = (spill) => spill.born + TRAVEL_MS + (Math.min(6, Math.max(1, spill.crash.spilled)) - 1) * STAGGER_MS;

export function createPitDisplay(size) {
  const n = size * size;
  const blue = new Uint16Array(n);
  const red = new Uint16Array(n);
  const arrays = { 1: blue, 2: red };
  return {
    blue,
    red,
    // Land every spill whose animation has finished (or all of them, with force).
    update(spills, now, force = false) {
      let applied = 0;
      for (const sp of spills) {
        if (sp.landed) continue;
        if (!force && now < landsAt(sp)) continue;
        for (const [team, tile, add] of sp.crash.landings || []) arrays[team][tile] += add;
        sp.landed = true;
        applied++;
      }
      return applied;
    },
    reset() { blue.fill(0); red.fill(0); },
  };
}

// Tiles each colour holds in a pit (more chips owns the tile), as the engine counts them.
export function pitLead(blue, red) {
  let b = 0;
  let r = 0;
  for (let k = 0; k < blue.length; k++) {
    if (blue[k] > red[k]) b++;
    else if (red[k] > blue[k]) r++;
  }
  return { blue: b, red: r };
}
