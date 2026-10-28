// Single source of truth for timing. Shared by the video (src/) and the
// ambient sound generator (scripts/generate-ambient.ts).

import VOICEOVER from './voiceover.json' with {type: 'json'};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 20 * FPS;

const s = (seconds: number) => Math.round(seconds * FPS);

export const SCENES = {
  intro: {from: s(0), to: s(4)},
  familiar: {from: s(4), to: s(9)},
  newRoute: {from: s(9), to: s(15)},
  repetition: {from: s(15), to: s(20)},
} as const;

export type Route = 'familiar' | 'new';

export type Pulse = {
  route: Route;
  /** Frame at which the signal leaves the start node. */
  start: number;
  /** Frames needed to reach the end node. */
  duration: number;
  /** 0 = smooth glide, approaching 1 = hesitant, stuttering travel. */
  hesitation: number;
  intensity: number;
};

const pulses: Pulse[] = [];

// Scene 2 – the familiar route fires quickly and effortlessly, again and again.
for (let f = s(4.1); f < s(8.7); f += 26) {
  pulses.push({route: 'familiar', start: f, duration: 24, hesitation: 0, intensity: 1});
}

// Scene 3 – as the narrator says "New behaviors…" the signal tries a different
// route: slow, effortful, uncertain. A second try launches on "practice".
pulses.push({route: 'new', start: s(9.45), duration: 84, hesitation: 0.85, intensity: 0.9});
pulses.push({route: 'new', start: s(13.7), duration: 50, hesitation: 0.55, intensity: 1});

// Scene 4 – with repetition the new route speeds up and smooths out; the
// pulses overlap more and more, peaking as the narrator says "familiar".
const practice = [40, 32, 27, 23, 20, 18, 18];
let t = s(15.35);
for (const [i, duration] of practice.entries()) {
  pulses.push({
    route: 'new',
    start: t,
    duration,
    hesitation: Math.max(0, 0.35 - i * 0.08),
    intensity: 1,
  });
  t += Math.round(duration * 0.75);
}
// The familiar route is still there, firing occasionally.
pulses.push({route: 'familiar', start: s(16.0), duration: 24, hesitation: 0, intensity: 0.6});
pulses.push({route: 'familiar', start: s(18.2), duration: 24, hesitation: 0, intensity: 0.5});

export const PULSES = pulses;

/**
 * Position (0..1) along the route for a pulse at a given frame, or null when
 * the pulse is not travelling. Hesitation makes the speed dip three times.
 */
export const pulseProgress = (pulse: Pulse, frame: number): number | null => {
  const raw = (frame - pulse.start) / pulse.duration;
  if (raw < 0 || raw > 1.25) return null; // linger a bit past the end for the tail
  const u = Math.min(raw, 1);
  const k = 6 * Math.PI;
  const eased = u + (pulse.hesitation * Math.sin(k * u)) / k;
  return raw > 1 ? 1 + (raw - 1) : eased;
};

// --- Narration ------------------------------------------------------------
// Line audio + word timings come from scripts/generate_voiceover.py.

export type VoKey = keyof typeof VOICEOVER;
export type CaptionStyle = 'title' | 'subtitle';

/** When each narration line starts (seconds) and how its words are shown. */
export const NARRATION: {key: VoKey; at: number; style: CaptionStyle; holdUntil: number}[] = [
  {key: 'intro', at: 0.8, style: 'title', holdUntil: 3.85},
  {key: 'familiar', at: 4.2, style: 'subtitle', holdUntil: 8.9},
  {key: 'newRoute', at: 9.2, style: 'subtitle', holdUntil: 14.85},
  {key: 'teaser', at: 15.25, style: 'subtitle', holdUntil: 16.45},
  {key: 'repetition', at: 16.55, style: 'title', holdUntil: 19.7},
];

export type TimedWord = {word: string; from: number; to: number};

/** Captions in frames, with absolute per-word timing for synced reveal. */
export const CAPTIONS = NARRATION.map(({key, at, style, holdUntil}) => {
  const line = VOICEOVER[key];
  return {
    key,
    style,
    text: line.text,
    file: line.file,
    from: s(at),
    to: s(holdUntil),
    audioDuration: line.duration,
    words: line.words.map((w): TimedWord => ({word: w.word, from: (at + w.start) * FPS, to: (at + w.end) * FPS})),
  };
});
