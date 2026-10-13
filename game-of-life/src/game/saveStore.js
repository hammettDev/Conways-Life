import { newSave, newPlayerSave, SAVE_VERSION } from './wallet.js';

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
    balance: num(raw.balance, fresh.balance),
    bailouts: num(raw.bailouts, 0),
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

export function persistSave(save, storage = globalThis.localStorage) {
  try {
    if (storage) storage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
