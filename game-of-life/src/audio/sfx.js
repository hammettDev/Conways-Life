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

// Scores. Built from the same oscillators so there is nothing to download; drop a file at public/sounds/<name>.mp3 to replace any of them.
const thump = (ctx, start = 0) => tone(ctx, { type: 'sine', from: 140, to: 45, start, dur: 0.22, gain: 0.35 });
CUES.touchdown = {
  file: 'sounds/touchdown.mp3',
  synth: (ctx) => {
    thump(ctx);
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, { type: 'square', from: f, to: f * 1.01, start: 0.12 + i * 0.11, dur: 0.16, gain: 0.16 }));
    [523, 659, 784].forEach((f) => tone(ctx, { type: 'triangle', from: f * 2, to: f * 2, start: 0.6, dur: 0.7, gain: 0.12 })); // the held chord
    tone(ctx, { type: 'square', from: 1047, to: 1047, start: 0.6, dur: 0.7, gain: 0.1 });
  },
};
CUES.fieldGoal = {
  file: 'sounds/field-goal.mp3',
  synth: (ctx) => {
    thump(ctx);
    tone(ctx, { type: 'square', from: 784, to: 790, start: 0.14, dur: 0.14, gain: 0.15 });
    tone(ctx, { type: 'square', from: 1047, to: 1055, start: 0.3, dur: 0.4, gain: 0.15 });
    tone(ctx, { type: 'triangle', from: 1568, to: 1568, start: 0.3, dur: 0.4, gain: 0.1 });
  },
};
CUES.theirScore = {
  file: 'sounds/their-score.mp3',
  synth: (ctx) => {
    tone(ctx, { type: 'sawtooth', from: 349, to: 340, dur: 0.22, gain: 0.12 });
    tone(ctx, { type: 'sawtooth', from: 262, to: 200, start: 0.24, dur: 0.45, gain: 0.12 });
  },
};
CUES.victory = {
  file: 'sounds/victory.mp3',
  synth: (ctx) => {
    thump(ctx); thump(ctx, 0.3);
    // a rising run, then a big held chord with a sparkle on top
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(ctx, { type: 'square', from: f, to: f * 1.01, start: 0.15 + i * 0.12, dur: 0.18, gain: 0.15 }));
    [523, 659, 784, 1047].forEach((f) => tone(ctx, { type: 'triangle', from: f, to: f, start: 0.95, dur: 1.4, gain: 0.14 }));
    [2093, 2637, 3136].forEach((f, i) => tone(ctx, { type: 'sine', from: f, to: f * 0.98, start: 1.0 + i * 0.18, dur: 0.5, gain: 0.07 }));
    thump(ctx, 0.95);
  },
};

// Recorded files are opt-in so a default build makes no failed requests: set
// VITE_SFX_FILES=true (e.g. in .env.local) after adding files to public/sounds.
const FILES_ENABLED = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SFX_FILES === 'true';

export function createSfx({
  AudioContextImpl = globalThis.AudioContext || globalThis.webkitAudioContext,
  useFiles = FILES_ENABLED,
  fetchImpl = globalThis.fetch,
  baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './',
} = {}) {
  let ctx = null;
  const buffers = new Map();
  const unavailable = new Set();

  async function load(name) {
    const cue = CUES[name];
    if (!ctx || !useFiles || !cue || !cue.file || !fetchImpl || buffers.has(name) || unavailable.has(name)) return false;
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

  let muted = false;

  // Returns what played: 'file', 'synth', 'unknown' or 'silent'.
  function play(name) {
    const cue = CUES[name];
    if (!cue) return 'unknown';
    if (muted || !unlock()) return 'silent';
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

  return {
    unlock, load, play,
    setMuted: (value) => { muted = Boolean(value); },
    isMuted: () => muted,
  };
}
