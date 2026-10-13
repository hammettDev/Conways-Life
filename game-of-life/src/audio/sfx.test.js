import { describe, it, expect } from 'vitest';
import { createSfx } from './sfx.js';

// Minimal Web Audio fake that records what was started.
class FakeCtx {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; this.started = []; }
  createOscillator() { const o = { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start: () => this.started.push('osc'), stop() {} }; return o; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createBufferSource() { return { connect() {}, start: () => this.started.push('file') }; }
  async decodeAudioData() { return { decoded: true }; }
}
const okFetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
const missingFetch = async () => ({ ok: false, status: 404 });

describe('sfx', () => {
  it('is silent when the browser has no Web Audio', () => {
    expect(createSfx({ AudioContextImpl: undefined }).play('lockIn')).toBe('silent');
  });

  it('ignores unknown cues', () => {
    expect(createSfx({ AudioContextImpl: FakeCtx, useFiles: true, fetchImpl: missingFetch }).play('nope')).toBe('unknown');
  });

  it('plays the synthesized lock-in when no recording exists', async () => {
    const sfx = createSfx({ AudioContextImpl: FakeCtx, useFiles: true, fetchImpl: missingFetch });
    expect(sfx.play('lockIn')).toBe('synth');
    await sfx.load('lockIn');
    expect(sfx.play('lockIn')).toBe('synth'); // still synth: the file 404s
  });

  it('switches to the recording once it has loaded', async () => {
    const sfx = createSfx({ AudioContextImpl: FakeCtx, useFiles: true, fetchImpl: okFetch });
    expect(sfx.play('lockIn')).toBe('synth'); // first press: file still loading
    await sfx.load('lockIn');
    expect(sfx.play('lockIn')).toBe('file');
  });

  it('does not request any file unless recordings are enabled', async () => {
    let requests = 0;
    const sfx = createSfx({ AudioContextImpl: FakeCtx, fetchImpl: async () => { requests++; return okFetch(); } });
    expect(sfx.play('lockIn')).toBe('synth');
    await sfx.load('lockIn');
    expect(requests).toBe(0);
  });
});
