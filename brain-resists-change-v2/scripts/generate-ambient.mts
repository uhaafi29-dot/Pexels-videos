// Generates an original ambient bed (public/ambient.wav) synced to the
// timeline: a slow evolving pad, airy noise, soft swells at scene changes and
// gentle "synapse" chimes whenever a signal reaches its destination.
// Run: npm run audio
import {writeFileSync} from 'node:fs';
import {DIVE, DURATION_IN_FRAMES, FPS, PRACTICE_FROM, PULSES, WHIP} from '../src/timeline.ts';

const RATE = 48000;
const N = Math.ceil((DURATION_IN_FRAMES / FPS) * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);

let seed = 2024;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

// --- pad: A-minor-add9 voicing, detuned pairs, slow amplitude breathing ------
const pad = [55, 82.41, 110, 130.81, 164.81, 246.94];
for (const [k, f] of pad.entries()) {
  const amp = 0.05 / (1 + k * 0.35);
  for (const detune of [-0.18, 0.21]) {
    const ph = rand() * Math.PI * 2;
    const pan = 0.5 + detune * 1.8;
    for (let i = 0; i < N; i++) {
      const t = i / RATE;
      const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * (0.05 + k * 0.013) * t + k);
      const s = Math.sin(2 * Math.PI * (f + detune) * t + ph) * amp * lfo;
      L[i] += s * (1 - pan);
      R[i] += s * pan;
    }
  }
}

// --- airy filtered noise ------------------------------------------------------
{
  let l = 0;
  let r = 0;
  for (let i = 0; i < N; i++) {
    const t = i / RATE;
    const a = 0.02 + 0.01 * Math.sin(2 * Math.PI * 0.07 * t);
    l += 0.02 * (rand() * 2 - 1 - l);
    r += 0.02 * (rand() * 2 - 1 - r);
    L[i] += l * a * 4;
    R[i] += r * a * 4;
  }
}

// --- swells at scene transitions (low sine sweep + noise breath) -------------
for (const frame of [DIVE.cut, WHIP.from + 10, PRACTICE_FROM]) {
  const c = (frame / FPS) * RATE;
  let lp = 0;
  for (let i = Math.max(0, c - RATE * 1.2); i < Math.min(N, c + RATE * 1.5); i++) {
    const t = (i - c) / RATE;
    const env = t < 0 ? Math.exp(-((t * 2.5) ** 2)) : Math.exp(-t * 2.2);
    lp += 0.05 * (rand() * 2 - 1 - lp);
    const s = (Math.sin(2 * Math.PI * (40 + 15 * env) * t) * 0.09 + lp * 0.35) * env;
    L[i] += s;
    R[i] += s;
  }
}

// --- synapse chimes, with a simple stereo echo ---------------------------------
const chime = (at: number, gain: number, pitch: number, pan: number) => {
  const c = Math.floor(at * RATE);
  for (const [delay, g, p] of [
    [0, 1, pan],
    [0.19, 0.35, 1 - pan],
    [0.38, 0.15, pan],
  ] as const) {
    const start = c + Math.floor(delay * RATE);
    for (let i = start; i < Math.min(N, start + RATE * 1.6); i++) {
      const t = (i - start) / RATE;
      const env = Math.min(1, t * 400) * Math.exp(-t * 3.2);
      const s = (Math.sin(2 * Math.PI * pitch * t) + 0.3 * Math.sin(2 * Math.PI * pitch * 2.01 * t)) * env * gain * g;
      L[i] += s * (1 - p);
      R[i] += s * p;
    }
  }
};
for (const p of PULSES) {
  const arrive = (p.start + p.duration) / FPS;
  const pitch = p.route === 'familiar' ? 659.25 : 880; // E5 vs A5
  chime(arrive, (p.route === 'familiar' ? 0.018 : 0.035) * p.intensity, pitch, p.route === 'familiar' ? 0.35 : 0.65);
}

// --- master: fade, soft clip, write 16-bit WAV ----------------------------------
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(RATE, 24);
out.writeUInt32LE(RATE * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / RATE;
  const fade = Math.min(1, t / 1.5, (N / RATE - t) / 1.2);
  const l = Math.tanh(L[i] * 1.4) * fade * 0.9;
  const r = Math.tanh(R[i] * 1.4) * fade * 0.9;
  out.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
writeFileSync(new URL('../public/ambient.wav', import.meta.url), out);
console.log('wrote public/ambient.wav');
