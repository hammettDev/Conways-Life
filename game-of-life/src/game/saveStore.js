import { newSave, newPlayerSave, SAVE_VERSION } from './wallet.js';
import { checkCustom, CUSTOM_SHAPES } from '../engine/custom.js';
import { designHash } from '../engine/rating.js';
import { CHIP_STYLES } from './cosmetics.js';
import { TABLES } from './tables.js';
import { MAX_CUSTOM, MAX_CUSTOM_UNITS, CUSTOM_RATING_CAP } from '../engine/constants.js';

const KEY = 'gcw.save';
const PREFIX = 'GCW1';

// A small non-cryptographic checksum, so a mistyped or edited code is caught.
// (Progress is just virtual currency, so this is about typos, not security.)
export function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const b64 = {
  enc: (s) => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')),
  dec: (s) => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary')),
};

const cellList = (list) => (Array.isArray(list)
  ? list.filter((c) => Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] >= 0 && c[0] < 80 && c[1] >= 0 && c[1] < 100).slice(0, 1500).map((c) => [c[0], c[1]])
  : []);

function sanitizePending(p) {
  if (!p || typeof p !== 'object' || !Number.isFinite(p.seed) || !Number.isFinite(p.wager) || p.wager < 0) return null;
  const blue = cellList(p.blue);
  const red = cellList(p.red);
  if (!blue.length || !red.length) return null;
  const out = { seed: Math.floor(p.seed) & 0x7fffffff, wager: Math.floor(p.wager), boss: typeof p.boss === 'string' ? p.boss : null, blue, red };
  if (p.mode === '4p') {
    const green = cellList(p.green);
    const violet = cellList(p.violet);
    if (!green.length || !violet.length) return null;
    return { ...out, mode: '4p', green, violet };
  }
  return out;
}

function sanitizeStyle(s) {
  const x = s && typeof s === 'object' ? s : {};
  const known = new Set(CHIP_STYLES.map((c) => c.id));
  const owned = Array.isArray(x.owned) ? x.owned.filter((id) => known.has(id)) : [];
  if (!owned.includes('classic')) owned.unshift('classic');
  return { owned: [...new Set(owned)], equipped: owned.includes(x.equipped) ? x.equipped : 'classic' };
}

// A saved custom formation only survives if it still passes the designer's own rules.
function sanitizeCustom(c) {
  const x = c && typeof c === 'object' ? c : {};
  const list = [];
  for (const f of Array.isArray(x.list) ? x.list.slice(0, MAX_CUSTOM) : []) {
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || !Array.isArray(f.players)) continue;
    const players = f.players.slice(0, MAX_CUSTOM_UNITS)
      .filter((p) => p && CUSTOM_SHAPES.includes(p.shape) && Number.isInteger(p.depth) && Number.isInteger(p.lat))
      .map((p) => ({ shape: p.shape, depth: p.depth, lat: p.lat }));
    // it must still be legal, and carry a rating under the cap that matches its design
    const rating = f.rating;
    if (!Number.isFinite(rating) || rating > CUSTOM_RATING_CAP + 1e-9 || f.hash !== designHash(players, rating)) continue;
    const spec = { id: f.id.slice(0, 30), name: f.name.slice(0, 24), players, rating, hash: f.hash };
    if (checkCustom(spec).ok) list.push(spec);
  }
  return { unlocked: x.unlocked === true, list };
}

function sanitizeBoss(b) {
  const x = b && typeof b === 'object' ? b : {};
  const beaten = Array.isArray(x.beaten) ? x.beaten.filter((id) => typeof id === 'string').slice(0, 20) : [];
  return {
    wins: Number.isFinite(x.wins) && x.wins >= 0 ? Math.min(99, Math.floor(x.wins)) : 0,
    beaten,
    last: typeof x.last === 'string' ? x.last : null,
    since: Number.isFinite(x.since) && x.since >= 0 ? Math.min(999, Math.floor(x.since)) : 0,
  };
}

function sanitizeSeason(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.results)) return null;
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const results = x.results.slice(0, 16).map((r) => ({ team: typeof r.team === 'string' ? r.team : '', you: n(r.you), them: n(r.them) }));
  return { seed: n(x.seed), week: Math.min(n(x.week), results.length), results };
}

// Anything that is not a sane save falls back to a fresh one.
export function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return null;
  const fresh = newSave();
  const num = (x, d) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : d);
  const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  const played = num(st.played, 0);
  return {
    v: SAVE_VERSION,
    tutorialDone: raw.tutorialDone === true || played > 0, // older saves predate the tutorial
    boss: sanitizeBoss(raw.boss),
    custom: sanitizeCustom(raw.custom),
    peak: Math.max(num(raw.peak, fresh.peak), num(raw.balance, fresh.balance)),
    recent: Array.isArray(raw.recent) ? raw.recent.filter((id) => typeof id === 'string').slice(-8) : [],
    pieceStreak: raw.pieceStreak && typeof raw.pieceStreak.id === 'string' && Number.isInteger(raw.pieceStreak.n) && raw.pieceStreak.n > 0
      ? { id: raw.pieceStreak.id, n: Math.min(raw.pieceStreak.n, 99) } : null,
    table: TABLES.some((t) => t.id === raw.table) ? raw.table : 'rookie',
    style: sanitizeStyle(raw.style),
    rev: num(raw.rev, 0),
    sid: num(raw.sid, 0),
    pending: sanitizePending(raw.pending),
    balance: num(raw.balance, fresh.balance),
    bailouts: num(raw.bailouts, 0),
    season: sanitizeSeason(raw.season),
    stats: {
      played, wins: num(st.wins, 0), losses: num(st.losses, 0),
      pushes: num(st.pushes, 0), streak: num(st.streak, 0), bestStreak: num(st.bestStreak, 0),
    },
  };
}

export function exportCode(save) {
  const body = b64.enc(JSON.stringify(save));
  return `${PREFIX}.${body}.${checksum(body)}`;
}

export function importCode(code) {
  try {
    const [prefix, body, sum] = String(code).trim().split('.');
    if (prefix !== PREFIX || !body || checksum(body) !== sum) return null;
    return sanitize(JSON.parse(b64.dec(body)));
  } catch {
    return null;
  }
}

// localStorage can be missing, full or blocked (private windows); every access is guarded.
export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    return (raw && sanitize(JSON.parse(raw))) || newPlayerSave();
  } catch {
    return newPlayerSave();
  }
}

// The highest revision this browser has ever held. A save code at or below it is
// older than what is already here, so it cannot be used to roll the save back.
const REV_KEY = 'gcw.maxRev';
export function loadMaxRev(storage = globalThis.localStorage) {
  try { return Number(storage && storage.getItem(REV_KEY)) || 0; } catch { return 0; }
}

export const acceptImport = (imported, current, maxRev) => imported.rev > Math.max(current.rev, maxRev);

export function persistSave(save, storage = globalThis.localStorage) {
  try {
    if (storage) {
      storage.setItem(KEY, JSON.stringify(save));
      if (save.rev > loadMaxRev(storage)) storage.setItem(REV_KEY, String(save.rev));
    }
    return true;
  } catch {
    return false;
  }
}
