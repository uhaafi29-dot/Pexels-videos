// Single source of truth for timing. Shared by the video (src/) and the
// sound generator (scripts/generate-ambient.mts). Everything is laid out
// around the narration audio (src/voiceover.json).
import VOICEOVER from './voiceover.json' with {type: 'json'};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 20 * FPS;

const s = (seconds: number) => Math.round(seconds * FPS);

// --- Narration placement (seconds) ------------------------------------------
export type VoKey = keyof typeof VOICEOVER;
export const NARRATION: {key: VoKey; at: number; holdUntil: number}[] = [
  {key: 'hook', at: 0.4, holdUntil: 4.3},
  {key: 'familiar', at: 4.6, holdUntil: 9.95},
  {key: 'newRoute', at: 10.3, holdUntil: 15.6},
  {key: 'practice', at: 15.9, holdUntil: 19.7},
];

// --- Three visual sequences ----------------------------------------------------
export const SEQ = {
  /** 1 – close-up of a glowing brain with the question hook */
  hook: {from: 0, to: s(4.5)},
  /** 2 – abstract familiar pathway: smooth, repeated, automatic */
  familiar: {from: s(4.5), to: s(10.1)},
  /** 3 – a new pathway: effortful at first, familiar with repetition */
  newRoute: {from: s(10.1), to: DURATION_IN_FRAMES},
} as const;
/** Inside sequence 3: where practice starts paying off ("But with practice…"). */
export const PRACTICE_FROM = s(15.9);

// Transitions (frames): a dive into the brain, then a whip-pan to the fork.
export const DIVE = {from: s(3.85), cut: SEQ.familiar.from, to: s(4.85)};
export const WHIP = {from: s(9.6), to: s(10.4)};

// --- Signals -------------------------------------------------------------------
export type Route = 'familiar' | 'new';
export type Pulse = {route: Route; start: number; duration: number; hesitation: number; intensity: number};

const pulses: Pulse[] = [];
// Sequence 2: the familiar route fires smoothly, rhythmically, again and again.
for (let f = s(4.75); f < s(9.9); f += 21) {
  pulses.push({route: 'familiar', start: f, duration: 27, hesitation: 0, intensity: 1});
}
// Sequence 3: it keeps firing quietly in the background.
for (let f = s(10.6); f < s(19.4); f += 48) {
  pulses.push({route: 'familiar', start: f, duration: 27, hesitation: 0, intensity: 0.45});
}
// First attempts on the new route: slow, hesitant, stuttering
// (lands on "different route" … "attention, and effort").
pulses.push({route: 'new', start: s(10.75), duration: 96, hesitation: 0.9, intensity: 0.9});
pulses.push({route: 'new', start: s(14.1), duration: 60, hesitation: 0.65, intensity: 1});
// Practice: each repetition is quicker and smoother than the last.
{
  let t = PRACTICE_FROM + 3;
  for (const [i, duration] of [40, 32, 27, 24, 22].entries()) {
    pulses.push({route: 'new', start: t, duration, hesitation: Math.max(0, 0.4 - i * 0.12), intensity: 1});
    t += Math.round(duration * 0.68);
  }
}
export const PULSES = pulses;
export const NEW_PULSES = pulses.filter((p) => p.route === 'new');

/** Position (0..1+) along the route; hesitation makes the speed dip 3 times. */
export const pulseProgress = (pulse: Pulse, frame: number): number | null => {
  const raw = (frame - pulse.start) / pulse.duration;
  if (raw < 0 || raw > 1.25) return null;
  if (raw > 1) return raw;
  const k = 6 * Math.PI;
  return raw + (pulse.hesitation * Math.sin(k * raw)) / k;
};

/** How many repetitions of the new route have been completed (fractional, eased). */
export const practiceLevel = (frame: number) => {
  let level = 0;
  for (const p of NEW_PULSES) {
    const done = (frame - (p.start + p.duration)) / 12;
    level += Math.min(1, Math.max(0, done)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, done)));
  }
  return level / NEW_PULSES.length; // 0 → 1
};

/** Number of attempts on the new route that have started. */
export const attemptCount = (frame: number) => NEW_PULSES.filter((p) => frame >= p.start).length;

// --- Captions ------------------------------------------------------------------
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

// Phone-sized caption phrases (words per phrase), broken where a narrator
// would naturally pause so each one reads at a glance.
const PHRASES: Record<VoKey, number[]> = {
  hook: [5, 4, 6], // Why is it so hard | to change a habit, | even one you want to change?
  familiar: [6, 6, 4], // Each time we repeat a behavior, | it can feel a little easier, | until it's almost automatic.
  newRoute: [3, 4, 4, 4], // A new behavior | takes a different route. | At first, it needs | more attention, and effort.
  practice: [3, 3, 4], // But with practice, | that new route | can become familiar too.
};

/** Each phrase shows from its first spoken word until the next phrase starts. */
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
