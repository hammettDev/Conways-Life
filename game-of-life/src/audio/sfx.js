// Sound effects: synthesized with the Web Audio API, with an optional recorded
// file that replaces a cue when it is present. Browsers only allow audio after
// a user gesture, so call unlock() from a click/tap handler (e.g. Lock In).

const tone = (ctx, { type, from, to, start = 0, dur, gain = 0.2 }) => {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
};

// file: looked up under public/ (served from the site root). If it is missing
// or fails to decode, the synthesized version plays instead.
export const CUES = {
  lockIn: {
    file: 'sounds/lock-it-up.mp3',
    synth: (ctx) => {
      tone(ctx, { type: 'square', from: 220, to: 70, dur: 0.14, gain: 0.25 }); // the clunk
      tone(ctx, { type: 'triangle', from: 880, to: 1320, start: 0.12, dur: 0.18, gain: 0.18 }); // the click shut
    },
  },
};

export function createSfx({
  AudioContextImpl = globalThis.AudioContext || globalThis.webkitAudioContext,
  fetchImpl = globalThis.fetch,
  baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './',
} = {}) {
  let ctx = null;
  const buffers = new Map();
  const unavailable = new Set();

  async function load(name) {
    const cue = CUES[name];
    if (!ctx || !cue || !cue.file || !fetchImpl || buffers.has(name) || unavailable.has(name)) return false;
    try {
      const res = await fetchImpl(baseUrl + cue.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
      return true;
    } catch {
      unavailable.add(name); // no recording: keep using the synth
      return false;
    }
  }

  function unlock() {
    if (!ctx && AudioContextImpl) {
      ctx = new AudioContextImpl();
      Object.keys(CUES).forEach(load); // fetch any recordings in the background
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return Boolean(ctx);
  }

  // Returns what played: 'file', 'synth', 'unknown' or 'silent'.
  function play(name) {
    const cue = CUES[name];
    if (!cue) return 'unknown';
    if (!unlock()) return 'silent';
    const buffer = buffers.get(name);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start();
      return 'file';
    }
    cue.synth(ctx);
    return 'synth';
  }

  return { unlock, load, play };
}
