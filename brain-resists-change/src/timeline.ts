// Single source of truth for timing. Shared by the video (src/) and the
// ambient sound generator (scripts/generate-ambient.ts).

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

// Scene 3 – the signal tries a different route: slow, effortful, uncertain.
pulses.push({route: 'new', start: s(9.4), duration: 84, hesitation: 0.85, intensity: 0.9});
pulses.push({route: 'new', start: s(12.6), duration: 62, hesitation: 0.55, intensity: 1});

// Scene 4 – with repetition the new route speeds up and smooths out.
const practice = [44, 36, 30, 26, 24, 22];
let t = s(15.1);
for (const [i, duration] of practice.entries()) {
  pulses.push({
    route: 'new',
    start: t,
    duration,
    hesitation: Math.max(0, 0.35 - i * 0.08),
    intensity: 1,
  });
  t += duration + 2;
}
// The familiar route is still there, firing occasionally.
pulses.push({route: 'familiar', start: s(16.2), duration: 24, hesitation: 0, intensity: 0.6});
pulses.push({route: 'familiar', start: s(18.4), duration: 24, hesitation: 0, intensity: 0.5});

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

export const CAPTIONS = [
  {
    kind: 'title' as const,
    from: s(0.5),
    to: s(3.85),
    text: 'Why does change feel so difficult?',
  },
  {
    kind: 'narration' as const,
    from: s(4.3),
    to: s(8.8),
    text: 'Repeated behaviors can become easier and more automatic.',
  },
  {
    kind: 'narration' as const,
    from: s(9.3),
    to: s(14.8),
    text: 'New behaviors often require more attention and practice.',
  },
  {
    kind: 'title' as const,
    from: s(15.4),
    to: s(19.6),
    text: 'Repetition helps new habits become familiar.',
  },
];
