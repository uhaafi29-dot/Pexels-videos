// Single source of truth for timing, shared by the film (src/) and the sound
// generator (scripts/generate-ambient.mts). Everything hangs off the narration.
import VOICEOVER from './voiceover.json';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const s = (seconds: number) => Math.round(seconds * FPS);

export type VoKey = keyof typeof VOICEOVER;

// Lines in order, with the pause (seconds) before each one: short within a
// thought, longer at the turns of the story.
const ORDER: [VoKey, number][] = [
  ['l01', 0.35],
  ['l02', 0.25],
  ['l03', 0.45], // return home
  ['l04', 0.35],
  ['l05', 0.45], // the mechanism
  ['l06', 0.25],
  ['l07', 0.3],
  ['l08', 0.35],
  ['l09', 0.6], // the science
  ['l10', 0.3],
  ['l11', 0.3],
  ['l12', 0.6], // the experiment
  ['l13', 0.3],
  ['l14', 0.3],
  ['l15', 0.3],
  ['l16', 0.6], // the payoff
];

export const NARRATION = (() => {
  let t = 0;
  return ORDER.map(([key, gap]) => {
    const at = t + gap;
    t = at + VOICEOVER[key].duration;
    return {key, at, end: t};
  });
})();
const line = (k: VoKey) => NARRATION.find((n) => n.key === k)!;

export const DURATION_IN_FRAMES = s(line('l16').end + 1.6);

// --- Six scenes, cut on the narration -------------------------------------------
export const SCENES = {
  hook: {from: 0, to: s(line('l03').at - 0.35)},
  ret: {from: s(line('l03').at - 0.35), to: s(line('l05').at - 0.3)},
  mechanism: {from: s(line('l05').at - 0.3), to: s(line('l09').at - 0.45)},
  science: {from: s(line('l09').at - 0.45), to: s(line('l12').at - 0.45)},
  experiment: {from: s(line('l12').at - 0.45), to: s(line('l16').at - 0.45)},
  payoff: {from: s(line('l16').at - 0.45), to: DURATION_IN_FRAMES},
} as const;
export type SceneKey = keyof typeof SCENES;

/** Frame at which a given word of a line is spoken (0-based word index). */
export const wordAt = (k: VoKey, word: number) => s(line(k).at + VOICEOVER[k].words[Math.min(word, VOICEOVER[k].words.length - 1)].start);
export const lineAt = (k: VoKey) => s(line(k).at);
export const lineEnd = (k: VoKey) => s(line(k).end);

// --- Captions ------------------------------------------------------------------------
export type TimedWord = {word: string; from: number; to: number};

export const CAPTIONS = NARRATION.map(({key, at, end}, i) => {
  const next = NARRATION[i + 1];
  const v = VOICEOVER[key];
  return {
    key,
    text: v.text,
    file: v.file,
    from: s(at),
    // hold until just before the next line (or a beat after the last one)
    to: next ? s(next.at) - 3 : s(end + 0.9),
    audioDuration: v.duration,
    words: v.words.map((w): TimedWord => ({word: w.word, from: (at + w.start) * FPS, to: (at + w.end) * FPS})),
  };
});

// Phrases (words per caption card), broken where the narrator breathes.
const PHRASES: Record<VoKey, number[]> = {
  l01: [5, 4, 5], // Have you noticed how changing | your life can feel | easier when you're somewhere new?
  l02: [6, 3, 5], // On vacation, you wake up differently. | You think differently. | Sometimes, you even behave differently.
  l03: [4, 2, 7], // Then you return home... | and somehow, | the old version of you returns too.
  l04: [4], // Here's why that's fascinating.
  l05: [4, 3], // Your habits aren't stored | in willpower alone.
  l06: [6], // They're strongly connected to your environment.
  l07: [3, 3, 3], // The same room. | The same time. | The same cues.
  l08: [6, 4, 5], // Over time, familiar surroundings can trigger | familiar behaviors before you've | consciously decided what to do.
  l09: [4, 4], // Psychologists study something called | the habit discontinuity effect.
  l10: [4, 3, 5], // When your environment changes, | old cues can | lose some of their power.
  l11: [5, 4], // And that creates an opportunity | to establish new routines.
  l12: [5], // So here's something to try.
  l13: [7], // Choose one habit you've struggled to change.
  l14: [6, 6], // Instead of promising yourself more discipline, | change one cue that triggers it.
  l15: [7, 4, 4], // Move your phone away from your bed. | Change where you work. | Rearrange your morning routine.
  l16: [5, 4, 4], // Sometimes, becoming someone new starts | with making your old | routine harder to repeat.
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
