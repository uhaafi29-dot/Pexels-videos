// Single source of truth for timing, shared by the video (src/) and the sound
// generator (scripts/generate-ambient.mts). Laid out around the narration.
import VOICEOVER from './voiceover.json' with {type: 'json'};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
// 37 s: the narration (28 s of speech) needs a little room to breathe.
export const DURATION_IN_FRAMES = 37 * FPS;

export const s = (seconds: number) => Math.round(seconds * FPS);

export const SCENES = {
  source: {from: 0, to: s(5.5)}, // 1 – the apparatus
  dots: {from: s(5.5), to: s(12.1)}, // 2 – single detections
  pattern: {from: s(12.1), to: s(21.0)}, // 3 – interference emerges
  measure: {from: s(21.0), to: s(29.2)}, // 4 – which-path information
  compare: {from: s(29.2), to: DURATION_IN_FRAMES}, // 5 – side by side
} as const;
export type SceneKey = keyof typeof SCENES;

export const SCENE_TEXT: Record<SceneKey, string> = {
  source: 'Can one particle behave like a wave?',
  dots: 'One electron at a time.',
  pattern: 'An interference pattern emerges.',
  measure: 'Measurement changes the pattern.',
  compare: 'Quantum physics challenges everyday intuition.',
};

// --- Narration ---------------------------------------------------------------
export type VoKey = keyof typeof VOICEOVER;
export const NARRATION: {key: VoKey; at: number; holdUntil: number}[] = [
  {key: 's1', at: 0.4, holdUntil: 5.4},
  {key: 's2', at: 5.75, holdUntil: 12.0},
  {key: 's3', at: 12.9, holdUntil: 19.3},
  {key: 's4', at: 21.9, holdUntil: 27.5},
  {key: 's5', at: 29.3, holdUntil: 36.6},
];

export type TimedWord = {word: string; from: number; to: number};

export const CAPTIONS = NARRATION.map(({key, at, holdUntil}) => {
  const line = VOICEOVER[key];
  return {
    key,
    text: line.text,
    file: line.file,
    from: s(at),
    to: s(holdUntil),
    audioDuration: line.duration,
    words: line.words.map((w): TimedWord => ({word: w.word, from: (at + w.start) * FPS, to: (at + w.end) * FPS})),
  };
});

// Caption phrases (words per phrase), broken where the narrator pauses.
const PHRASES: Record<VoKey, number[]> = {
  s1: [6, 4, 4], // What happens when we send electrons, | one at a time, | toward two tiny openings?
  s2: [7, 4, 5], // Each electron arrives as a single spot. | But something surprising happens | as the spots build up.
  s3: [6, 3, 4], // Together, they form an interference pattern, | revealing the wave-like | behavior of quantum particles.
  s4: [4, 5, 3], // When the experiment reveals | which slit an electron takes, | that interference disappears.
  s5: [7, 5, 4], // Not because a human mind controls reality, | but because quantum behavior is | different from everyday experience.
};

export const CAPTION_CHUNKS = CAPTIONS.flatMap((c) => {
  const sizes = PHRASES[c.key];
  if (sizes.reduce((a, b) => a + b, 0) !== c.words.length) {
    throw new Error(`PHRASES.${c.key} does not match the narration (${c.words.length} words)`);
  }
  let i = 0;
  const groups = sizes.map((n) => c.words.slice(i, (i += n)));
  return groups.map((words, g) => ({
    key: `${c.key}-${g}`,
    words,
    from: Math.floor(words[0].from) - 2,
    to: g < groups.length - 1 ? Math.floor(groups[g + 1][0].from) - 2 : c.to,
  }));
});

// --- Experiment runs ------------------------------------------------------------
// Run A: no path information (scenes 1–3). Run B: which-path detector on (scene 4).

/** First electron fired in scene 1, shown travelling as a (labelled) metaphor. */
export const FIRST_SHOT = {fire: s(2.2), arrive: s(4.4)};

/**
 * Cumulative number of detections in run A by a given frame: a handful of
 * individual hits first, then faster and faster.
 */
export const countA = (frame: number) => {
  if (frame < FIRST_SHOT.arrive) return 0;
  // a few hits slowly enough to see (and hear) one by one
  if (frame < s(8.0)) return 1 + Math.floor((frame - FIRST_SHOT.arrive) / 9);
  const early = 1 + Math.floor((s(8.0) - FIRST_SHOT.arrive) / 9);
  // then an accelerating build-up to thousands
  const t = Math.min(1, (frame - s(8.0)) / (s(17.0) - s(8.0)));
  return Math.floor(early + (TOTAL_A - early) * Math.pow(t, 2.6));
};
export const TOTAL_A = 7000;

export const RUN_B = {from: s(23.6), to: s(28.6)};
export const TOTAL_B = 7000;
export const countB = (frame: number) => {
  if (frame < RUN_B.from) return 0;
  const t = Math.min(1, (frame - RUN_B.from) / (RUN_B.to - RUN_B.from));
  return Math.floor(TOTAL_B * Math.pow(t, 1.8));
};

/** Birth frame of the n-th detection in a run (inverse of the count function). */
export const birthFrames = (count: (f: number) => number, total: number) => {
  const births = new Float32Array(total).fill(1e9);
  let n = 0;
  for (let f = 0; f < DURATION_IN_FRAMES && n < total; f++) {
    const c = Math.min(total, count(f));
    while (n < c) births[n++] = f + (n % 3) / 3; // spread within the frame
  }
  return births;
};

// The screen moves aside for run B, then both are compared.
export const SCREEN_A_LIFT = {from: s(22.6), to: s(23.8)};
export const DETECTORS_ON = s(22.0);
