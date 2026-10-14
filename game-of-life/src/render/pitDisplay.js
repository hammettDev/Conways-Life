// The pit as the player sees it. The engine lands a topple's chips the instant it
// happens, but on screen they should first run down the gutter and only then
// drop onto their tiles. This keeps a display copy of the pit and applies each
// topple's landings once its animation has finished.

export const TRAVEL_MS = 1500; // time a chip takes to run the gutter
export const STAGGER_MS = 110; // gap between chips of the same spill

// When the last chip of a spill reaches the pit.
export const landsAt = (spill) => spill.born + TRAVEL_MS + (Math.min(6, Math.max(1, spill.crash.spilled)) - 1) * STAGGER_MS;

export function createPitDisplay(size, teams = 2) {
  const n = size * size;
  const blue = new Uint16Array(n);
  const red = new Uint16Array(n);
  const green = teams > 2 ? new Uint16Array(n) : null;
  const violet = teams > 3 ? new Uint16Array(n) : null;
  const arrays = { 1: blue, 2: red, 3: green, 4: violet };
  const counts = [null, blue, red, green, violet].slice(0, teams + 1); // chip counts per team, indexed by team
  // A cosmetic Life layer so the pit never sits still: cells that are not owned
  // tiles live, die and breed around the owned ones by Conway's rules, and sparks
  // keep dropping next to them. It is drawing only and never touches the score.
  let ghost = new Uint8Array(n);
  let ghostAt = 0;
  // the team with the most chips on a tile (nobody on a tie)
  const owner = (k) => {
    let best = 0; let who = 0; let tied = false;
    for (let t = 1; t <= teams; t++) {
      const c = counts[t][k];
      if (c > best) { best = c; who = t; tied = false; } else if (c === best && c > 0) tied = true;
    }
    return tied ? 0 : who;
  };
  function stepGhost() {
    const next = new Uint8Array(n);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const k = y * size + x;
        if (owner(k)) continue; // owned tiles are the anchors, not ghosts
        let c = 0;
        const votes = [0, 0, 0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
            const j = yy * size + xx;
            const t = owner(j) || ghost[j];
            if (t) { c++; votes[t]++; }
          }
        }
        if (ghost[k] && (c === 2 || c === 3)) next[k] = ghost[k];
        else if (!ghost[k] && c === 3) {
          let w = 1;
          for (let t = 2; t <= teams; t++) if (votes[t] > votes[w]) w = t;
          next[k] = w;
        }
      }
    }
    // sparks: a few new cells beside owned tiles keep the pit moving
    const anchors = [];
    for (let k = 0; k < n; k++) if (owner(k)) anchors.push(k);
    for (let s = 0; s < 3 && anchors.length; s++) {
      const a = anchors[(Math.random() * anchors.length) | 0];
      const x = (a % size) + ((Math.random() * 3) | 0) - 1;
      const y = ((a / size) | 0) + ((Math.random() * 3) | 0) - 1;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const k = y * size + x;
      if (!owner(k)) next[k] = owner(a);
    }
    ghost = next;
  }
  return {
    blue,
    red,
    green,
    violet,
    counts,
    get ghost() { return ghost; },
    // Advance the cosmetic layer about 4 times a second.
    animate(now) {
      if (now - ghostAt < 250) return;
      ghostAt = now;
      stepGhost();
    },
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
    reset() { for (let t = 1; t <= teams; t++) counts[t].fill(0); ghost = new Uint8Array(n); },
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

// Tiles each team holds in a pit of any number of teams: counts[t][k] is the chips of team t on tile k.
export function pitTilesOf(counts) {
  const out = new Array(counts.length).fill(0);
  const n = counts[1].length;
  for (let k = 0; k < n; k++) {
    let best = 0; let who = 0; let tied = false;
    for (let t = 1; t < counts.length; t++) {
      const c = counts[t][k];
      if (c > best) { best = c; who = t; tied = false; } else if (c === best && c > 0) tied = true;
    }
    if (who && !tied) out[who]++;
  }
  return out;
}
