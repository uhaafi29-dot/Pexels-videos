// Timing for the whole reel, anchored to the recorded narration.
import VOICEOVER from './voiceover.json';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type VoKey = keyof typeof VOICEOVER;

// [line, pause before it in seconds]. Slightly longer pauses before the
// science and before the payoff give those moments room to land.
const ORDER: [VoKey, number][] = [
  ['hook', 0.4],
  ['rising', 0.4],
  ['conflict', 0.5],
  ['study', 0.6],
  ['term', 0.55],
  ['action', 0.6],
  ['agency', 0.45],
  ['cta', 0.6],
];
const TAIL = 1.2;

export const NARRATION = (() => {
  let t = 0;
  return ORDER.map(([key, gap]) => {
    const at = t + gap;
    t = at + VOICEOVER[key].duration;
    return {key, at, end: t};
  });
})();
const line = (k: VoKey) => NARRATION.find((n) => n.key === k)!;

export const DURATION_S = NARRATION[NARRATION.length - 1].end + TAIL;
export const DURATION_IN_FRAMES = Math.round(DURATION_S * FPS);

/** Seconds at which word `i` of line `k` begins. */
export const wordAt = (k: VoKey, i: number) => line(k).at + VOICEOVER[k].words[Math.min(i, VOICEOVER[k].words.length - 1)].start;
export const lineAt = (k: VoKey) => line(k).at;
export const lineEnd = (k: VoKey) => line(k).end;

// --- Captions ------------------------------------------------------------------
export type TimedWord = {word: string; from: number; to: number}; // frames

export const CAPTIONS = NARRATION.map(({key, at}, i) => {
  const next = NARRATION[i + 1];
  const v = VOICEOVER[key];
  return {
    key,
    text: v.text,
    file: v.file,
    from: Math.round(at * FPS),
    to: next ? Math.round(next.at * FPS) - 3 : Math.round((line(key).end + 0.8) * FPS),
    audioDuration: v.duration,
    words: v.words.map((w): TimedWord => ({word: w.word, from: (at + w.start) * FPS, to: (at + w.end) * FPS})),
  };
});

// Words per caption card, broken where the narrator breathes.
const PHRASES: Record<VoKey, number[]> = {
  hook: [6, 4, 5, 4, 6], // On vacation, you're a different person. | You wake up early. | You barely touch your phone. | Then you get home, | and the old you is waiting.
  rising: [3, 6, 5, 5], // You try harder. | It works, for a few days. | Then one night, you're scrolling | in bed without deciding to.
  conflict: [5, 4, 4, 6, 3], // It feels like weak willpower. | But a strong habit | doesn't wait for permission. | Its cues can set it off, | whatever you intend.
  study: [4, 6, 5, 4, 6], // When researchers followed students | who moved to a new university, | their old habits fell apart, | except where parts of | the old setting stayed the same.
  term: [5, 5, 3], // Psychologists call this habit discontinuity. | New cues open a window | to choose again.
  action: [5, 6], // So tonight, try an experiment: | charge your phone outside the bedroom.
  agency: [6, 7], // You can't always out-will a cue. | But you can choose where it lives.
  cta: [5], // Follow The Psychology of Becoming.
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
