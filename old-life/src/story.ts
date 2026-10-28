// The film, frame by frame. A pure function of the frame number returns the
// camera, the figure, the props, the light and the cue threads, so the 3D
// scene and the text overlay always agree, and every render is identical.
import {Easing, interpolate} from 'remotion';
import * as THREE from 'three';
import {BEDROOM, CLOCK_POS, HOTEL_X, PHONE_ON_DESK, PHONE_ON_NIGHTSTAND} from './three/Rooms';
import {FPS, SCENES, SceneKey, lineAt, lineEnd, s, wordAt} from './timeline';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const smooth = Easing.bezier(0.42, 0, 0.25, 1);
export const ramp = (f: number, a: number, b: number, easing = smooth) => interpolate(f, [a, b], [0, 1], {...clamp, easing});
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const sceneAt = (f: number): SceneKey => (Object.keys(SCENES) as SceneKey[]).find((k) => f >= SCENES[k].from && f < SCENES[k].to) ?? 'payoff';

// --- Camera -------------------------------------------------------------------------
export type Shot = {pos: THREE.Vector3; target: THREE.Vector3; fov: number};
const shot = (pos: THREE.Vector3, target: THREE.Vector3, fov = 42): Shot => ({pos, target, fov});
const mixShot = (a: Shot, b: Shot, t: number): Shot => ({pos: a.pos.clone().lerp(b.pos, t), target: a.target.clone().lerp(b.target, t), fov: lerp(a.fov, b.fov, t)});
/** Smooth move through several framings over a frame range. */
const move = (f: number, from: number, to: number, keys: Shot[], easing = smooth) => {
  const t = ramp(f, from, to, easing) * (keys.length - 1);
  const i = Math.min(keys.length - 2, Math.floor(t));
  return mixShot(keys[i], keys[i + 1], t - i);
};

// --- The figure ------------------------------------------------------------------------
const STRIDE = 1.15; // metres travelled per second of the walk clip

type Walk = {from: number; to: number; path: THREE.Vector3[]};
const walkState = (f: number, w: Walk) => {
  const curve = new THREE.CatmullRomCurve3(w.path, false, 'centripetal');
  const u = interpolate(f, [w.from, w.to], [0, 1], {...clamp, easing: Easing.bezier(0.3, 0, 0.7, 1)});
  const pos = curve.getPointAt(u);
  const tan = curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
  const dist = curve.getLength() * u;
  // feet stop gradually at both ends
  const moving = Math.min(ramp(f, w.from - 2, w.from + 8), 1 - ramp(f, w.to - 8, w.to + 2));
  return {pos, heading: Math.atan2(tan.x, tan.z), walk: moving, walkTime: dist / STRIDE};
};

export type FigureState = {
  pos: THREE.Vector3;
  heading: number;
  walk: number;
  walkTime: number;
  idleTime: number;
  slump: number;
  phone: number;
  carry: number;
  stretch: number;
};

const turnTo = (from: number, to: number, t: number) => {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return from + d * t;
};

// Paths (world coordinates).
const HOTEL_WINDOW_SPOT = V(HOTEL_X - 0.4, 0, -1.95);
const HOTEL_WALK: Walk = {from: s(3.5), to: s(6.4), path: [V(HOTEL_X + 2.0, 0, -1.55), V(HOTEL_X + 0.4, 0, -1.65), V(HOTEL_X - 1.3, 0, -1.5)]};
const HOTEL_EXIT: Walk = {from: s(6.9), to: s(10.35), path: [V(HOTEL_X - 1.3, 0, -1.5), V(HOTEL_X - 1.75, 0, -0.2), V(HOTEL_X - 1.95, 0, 1.6), V(HOTEL_X - 1.95, 0, 2.62)]};
const HOME_ENTER: Walk = {from: s(10.1) - 3, to: s(13.4), path: [V(-0.8, 0, 2.62), V(-0.75, 0, 1.6), V(-0.1, 0, 0.55), V(0.95, 0, -0.1), V(1.62, 0, -0.75)]};
const LOOP: Walk = {from: s(13.4), to: s(16.0), path: [V(-0.8, 0, 2.0), V(-0.4, 0, 1.0), V(0.6, 0, 0.1), V(1.62, 0, -0.75)]};
const NIGHTSTAND_SPOT = V(1.62, 0, -1.38);
const APPROACH: Walk = {from: s(46.7), to: s(48.7), path: [V(0.7, 0, 0.9), V(1.35, 0, -0.4), NIGHTSTAND_SPOT]};
const TO_DESK: Walk = {from: s(49.4), to: s(52.8), path: [NIGHTSTAND_SPOT, V(1.1, 0, -0.1), V(-0.2, 0, 0.6), V(-1.0, 0, 0.75)]};
const TO_WINDOW: Walk = {from: s(55.6), to: s(57.4), path: [V(-1.0, 0, 0.75), V(-1.0, 0, -0.6), V(-1.0, 0, -1.55)]};
const NEW_ROOM_WALK: Walk = {from: s(37.2), to: s(41.2), path: [V(HOTEL_X - 1.95, 0, 3.2), V(HOTEL_X - 1.95, 0, 1.8), V(HOTEL_X - 0.9, 0, 0.3), V(HOTEL_X - 0.2, 0, -1.0)]};

export const figureAt = (f: number): {main: FigureState | null; echoes: {state: FigureState; opacity: number}[]; room: 'hotel' | 'bedroom'} => {
  const t = f / FPS;
  const base = (p: Partial<FigureState>): FigureState => ({pos: V(0, 0, 0), heading: 0, walk: 0, walkTime: 0, idleTime: t, slump: 0, phone: 0, carry: 0, stretch: 0, ...p});
  const scene = sceneAt(f);

  if (scene === 'hook') {
    if (f < HOTEL_WALK.from) {
      // morning stretch at the glass
      const stretch = interpolate(f, [s(0.9), s(1.6), s(2.6), s(3.3)], [0, 1, 1, 0], {...clamp, easing: smooth});
      return {main: base({pos: HOTEL_WINDOW_SPOT.clone().add(V(2.4, 0, 0.4)), heading: Math.PI, stretch}), echoes: [], room: 'hotel'};
    }
    const w = f < HOTEL_EXIT.from ? walkState(f, HOTEL_WALK) : walkState(f, HOTEL_EXIT);
    const brisk = {...w, walkTime: w.walkTime * 1.12};
    return {main: base(brisk), echoes: [], room: 'hotel'};
  }

  if (scene === 'ret') {
    if (f < LOOP.from) {
      const w = walkState(f, HOME_ENTER);
      return {main: base({...w, slump: ramp(f, s(10.3), s(12.4)) * 0.85}), echoes: [], room: 'bedroom'};
    }
    // the same walk, again and again: translucent echoes trail the figure
    const w = walkState(f, LOOP);
    const echoes = [1, 2, 3].map((k) => {
      const lag = k * 16;
      const e = walkState(f - lag, {...LOOP, from: LOOP.from, to: LOOP.to});
      return {state: base({...e, slump: 0.85}), opacity: interpolate(f, [LOOP.from + lag - 4, LOOP.from + lag + 6], [0, 0.32 - k * 0.07], clamp)};
    });
    const settle = ramp(f, LOOP.to - 6, LOOP.to + 10);
    return {main: base({...w, slump: 0.85, heading: turnTo(w.heading, Math.PI, settle)}), echoes, room: 'bedroom'};
  }

  if (scene === 'mechanism') {
    // facing the nightstand; the phone lights up and the hands come up before any "decision"
    const phone = ramp(f, s(26.9), s(27.7));
    return {main: base({pos: NIGHTSTAND_SPOT, heading: Math.PI, slump: 0.85 * (1 - phone * 0.4), phone}), echoes: [], room: 'bedroom'};
  }

  if (scene === 'science') {
    if (f < NEW_ROOM_WALK.from - 10) {
      return {main: base({pos: NIGHTSTAND_SPOT, heading: Math.PI, slump: 0.5, phone: 1 - ramp(f, SCENES.science.from, SCENES.science.from + 20)}), echoes: [], room: 'bedroom'};
    }
    const w = walkState(f, NEW_ROOM_WALK);
    return {main: base({...w, slump: 0.6 * (1 - ramp(f, NEW_ROOM_WALK.from, NEW_ROOM_WALK.to))}), echoes: [], room: 'hotel'};
  }

  if (scene === 'experiment') {
    if (f < APPROACH.to) {
      const w = walkState(f, APPROACH);
      return {main: base({...w, heading: turnTo(w.heading, Math.PI, ramp(f, APPROACH.to - 10, APPROACH.to)), slump: 0.35}), echoes: [], room: 'bedroom'};
    }
    if (f < TO_DESK.from) {
      // standing at the nightstand, deciding; then picks the phone up to carry it
      const carry = ramp(f, TO_DESK.from - 14, TO_DESK.from);
      return {main: base({pos: NIGHTSTAND_SPOT, heading: Math.PI, slump: 0.35, carry, idleTime: t}), echoes: [], room: 'bedroom'};
    }
    if (f < TO_WINDOW.from) {
      const w = walkState(f, TO_DESK);
      const putDown = ramp(f, TO_DESK.to - 2, TO_DESK.to + 10);
      return {main: base({...w, heading: turnTo(w.heading, -Math.PI / 2, ramp(f, TO_DESK.to - 6, TO_DESK.to + 8)), carry: 1 - putDown, slump: 0.25 * (1 - putDown)}), echoes: [], room: 'bedroom'};
    }
    const w = walkState(f, TO_WINDOW);
    return {main: base({...w}), echoes: [], room: 'bedroom'};
  }

  // payoff: at the open window in the morning light, a slow stretch
  const stretch = interpolate(f, [SCENES.payoff.from + 20, SCENES.payoff.from + 60, SCENES.payoff.from + 130, SCENES.payoff.from + 170], [0, 0.8, 0.8, 0], {...clamp, easing: smooth});
  return {main: base({pos: V(-1.0, 0, -1.55), heading: Math.PI, stretch}), echoes: [], room: 'bedroom'};
};

// --- Props, light and mood -------------------------------------------------------------------
export type World = {
  room: 'hotel' | 'bedroom';
  dawn: number;
  /** overall exposure of the "science" stylisation: 1 = normal, lower = darker room */
  mood: number;
  hotelLevel: number;
  phone: {where: 'nightstand' | 'hand' | 'desk' | 'carry'; screen: number; travel?: number};
  clockText: string;
  curtainOpen: number;
  chairPos: THREE.Vector3;
  chairRot: number;
  glass: number;
};

const CHAIR_HOME = BEDROOM.chair;
const CHAIR_WINDOW = V(-1.0, 0, -1.0);

export const worldAt = (f: number): World => {
  const scene = sceneAt(f);
  const fig = figureAt(f);
  const room = fig.room;

  // phone: lights up when it "calls" (mechanism), lifted, then carried to the desk
  let phone: World['phone'] = {where: 'nightstand', screen: 0.25};
  if (scene === 'ret') phone = {where: 'nightstand', screen: 0.35};
  if (scene === 'mechanism') {
    const ping = interpolate(f, [s(25.9), s(26.2), s(26.9)], [0.3, 1.4, 1.0], clamp);
    phone = f < s(27.1) ? {where: 'nightstand', screen: f > s(25.9) ? ping : 0.3} : {where: 'hand', screen: 1, travel: ramp(f, s(27.1), s(27.6))};
  }
  if (scene === 'science') phone = {where: f < SCENES.science.from + 18 ? 'hand' : 'nightstand', screen: 0.6, travel: 1};
  if (scene === 'experiment') {
    if (f < TO_DESK.from - 8) phone = {where: 'nightstand', screen: 0.9};
    else if (f < TO_DESK.to + 4) phone = {where: 'carry', screen: 0.7};
    else phone = {where: 'desk', screen: interpolate(f, [TO_DESK.to + 4, TO_DESK.to + 40], [0.6, 0.05], clamp)};
  }
  if (scene === 'payoff') phone = {where: 'desk', screen: 0.0};

  // the clock: always 11:47 at night; a time-lapse to morning during the experiment
  let clockText = '11:47';
  const lapse = ramp(f, s(53.9), s(55.4), Easing.linear);
  if (scene === 'experiment' && lapse > 0) {
    const minutes = Math.round(lerp(11 * 60 + 47, 24 * 60 + 6 * 60 + 52, lapse)) % (24 * 60);
    clockText = `${Math.floor(minutes / 60) % 24 === 0 ? 12 : ((Math.floor(minutes / 60) - 1) % 12) + 1}:${String(minutes % 60).padStart(2, '0')}`;
  }
  if (scene === 'payoff') clockText = '6:58';

  const dawn = scene === 'experiment' ? ramp(f, s(54.0), s(57.4)) * 0.75 : scene === 'payoff' ? lerp(0.75, 1, ramp(f, SCENES.payoff.from, SCENES.payoff.from + 90)) : 0;
  const mood = scene === 'science' && room === 'bedroom' ? 1 - 0.55 * ramp(f, SCENES.science.from, SCENES.science.from + 40) : 1;
  const hotelLevel = scene === 'science' ? 0.75 : 1;

  return {
    room,
    dawn,
    mood,
    hotelLevel,
    phone,
    clockText,
    curtainOpen: scene === 'payoff' ? 1 : scene === 'experiment' ? ramp(f, s(56.6), s(57.6)) : 0,
    chairPos: CHAIR_HOME.clone().lerp(CHAIR_WINDOW, scene === 'payoff' ? 1 : scene === 'experiment' ? ramp(f, s(54.8), s(55.9)) : 0),
    chairRot: lerp(-Math.PI / 2, Math.PI * 0.85, scene === 'payoff' ? 1 : scene === 'experiment' ? ramp(f, s(54.8), s(55.9)) : 0),
    glass: scene === 'payoff' ? 1 : scene === 'experiment' ? ramp(f, s(55.3), s(55.8)) : 0,
  };
};

// --- Cue threads (visual metaphor for learned cue → behaviour associations) ------------------------
export type Thread = {key: string; from: THREE.Vector3; reveal: number; intensity: number; pulse: number; flicker: number; color: 'teal' | 'gold'; loose?: THREE.Vector3};

const CUES = {
  phone: () => PHONE_ON_NIGHTSTAND.clone().add(V(0, 0.02, 0)),
  clock: () => CLOCK_POS.clone().add(V(0, 0.05, 0)),
  bed: () => V(0.55, 0.62, -1.1),
  desk: () => V(BEDROOM.desk.x, 0.8, BEDROOM.desk.z),
  chair: () => BEDROOM.chair.clone().add(V(0, 0.75, 0)),
  lamp: () => V(1.78, 0.95, -2.08),
};
export type CueKey = keyof typeof CUES;

export const threadsAt = (f: number): Thread[] => {
  const scene = sceneAt(f);
  const out: Thread[] = [];
  const pulseAt = (start: number, period: number) => (f < start ? -1 : ((f - start) % period) / period);
  if (scene === 'mechanism' || (scene === 'science' && figureAt(f).room === 'bedroom')) {
    const order: CueKey[] = ['bed', 'clock', 'lamp', 'desk', 'chair', 'phone'];
    order.forEach((k, i) => {
      const start = s(18.0) + i * 9;
      const beat = k === 'clock' ? wordAt('l07', 5) : k === 'phone' ? wordAt('l07', 8) : k === 'bed' ? wordAt('l07', 2) : -999;
      const flash = beat > 0 ? Math.exp(-Math.max(0, f - beat) / 10) * (f >= beat ? 1 : 0) : 0;
      out.push({
        key: k,
        from: CUES[k](),
        reveal: ramp(f, start, start + 40),
        intensity: 0.55 + 1.2 * flash + (k === 'phone' ? 0.35 : 0),
        pulse: k === 'phone' && f > s(25.9) ? pulseAt(s(25.9), 24) : pulseAt(s(19.5) + i * 7, 70),
        flicker: 0,
        color: 'teal',
      });
    });
  }
  if (scene === 'science' && figureAt(f).room === 'hotel') {
    // old associations: the threads search for their cues and find none
    const lose = ramp(f, s(37.4), s(40.6));
    (['bed', 'clock', 'phone', 'desk', 'chair'] as CueKey[]).forEach((k, i) => {
      const a = (i / 5) * Math.PI * 2 + f * 0.01;
      out.push({key: k, from: V(Math.cos(a) * 0.9, 0.9 + 0.3 * Math.sin(a * 2), Math.sin(a) * 0.9), loose: V(0, 0, 0), reveal: 1 - lose * 0.75, intensity: 0.9 * (1 - lose * 0.85), pulse: -1, flicker: lose, color: 'teal'});
    });
    // …and an opening: a faint new thread toward the morning light
    out.push({key: 'new', from: V(HOTEL_X - 0.1, 1.6, -2.4), reveal: ramp(f, wordAt('l11', 3), wordAt('l11', 3) + 45), intensity: 0.9, pulse: -1, flicker: 0, color: 'gold'});
  }
  if (scene === 'experiment') {
    const phonePos = f < TO_DESK.from - 8 ? CUES.phone() : f > TO_DESK.to + 4 ? PHONE_ON_DESK.clone().add(V(0, 0.02, 0)) : null;
    if (phonePos) {
      const weaken = ramp(f, TO_DESK.to + 4, TO_DESK.to + 60);
      out.push({key: 'phone', from: phonePos, reveal: 1, intensity: 1.2 * (1 - 0.7 * weaken), pulse: weaken > 0.5 ? -1 : (((f - SCENES.experiment.from) % 28) / 28), flicker: weaken, color: 'teal'});
    }
    out.push({key: 'clock', from: CUES.clock(), reveal: 1, intensity: 0.5 * (1 - ramp(f, s(55.0), s(56.5))), pulse: -1, flicker: 0, color: 'teal'});
    // new cues forming, faint (a new routine takes repetition)
    out.push({key: 'window', from: V(-1.0, 1.5, -2.25), reveal: ramp(f, s(56.4), s(57.6)), intensity: 0.5, pulse: -1, flicker: 0, color: 'gold'});
    out.push({key: 'glass', from: V(1.5, 0.66, -1.82), reveal: ramp(f, s(55.6), s(56.6)), intensity: 0.35, pulse: -1, flicker: 0, color: 'gold'});
  }
  if (scene === 'payoff') {
    const t = ramp(f, SCENES.payoff.from, SCENES.payoff.from + 60);
    out.push({key: 'window', from: V(-1.0, 1.5, -2.25), reveal: 1, intensity: 0.6 + 0.3 * t, pulse: ((f % 40) / 40), flicker: 0, color: 'gold'});
    out.push({key: 'glass', from: V(1.5, 0.66, -1.82), reveal: 1, intensity: 0.45, pulse: -1, flicker: 0, color: 'gold'});
    out.push({key: 'phone', from: PHONE_ON_DESK.clone().add(V(0, 0.02, 0)), reveal: 1, intensity: 0.22 * (1 - t * 0.6), pulse: -1, flicker: 0.6, color: 'teal'});
  }
  return out;
};

// --- Shots -----------------------------------------------------------------------------------------
export const cameraAt = (f: number): Shot => {
  const fig = figureAt(f).main!;
  const follow = (back: number, height: number, side: number, look = 2.2) => {
    const dir = V(Math.sin(fig.heading), 0, Math.cos(fig.heading));
    const right = V(dir.z, 0, -dir.x);
    return shot(fig.pos.clone().addScaledVector(dir, -back).addScaledVector(right, side).setY(height), fig.pos.clone().addScaledVector(dir, look).setY(1.0), 46);
  };

  // HOOK — golden morning in the suite
  if (f < s(3.5))
    return move(f, 0, s(3.5), [
      shot(V(HOTEL_X + 0.2, 0.95, 2.1), V(HOTEL_X + 2.1, 1.2, -2.2), 44),
      shot(V(HOTEL_X + 0.85, 1.1, 0.9), V(HOTEL_X + 2.15, 1.3, -2.2), 40),
    ]);
  if (f < HOTEL_EXIT.from + 6)
    // tracking alongside the figure past the bed, the sheets in the foreground
    return move(f, s(3.5), HOTEL_EXIT.from + 6, [
      shot(V(HOTEL_X + 2.4, 1.05, 2.0), V(HOTEL_X + 1.6, 0.95, -1.6), 44),
      shot(V(HOTEL_X - 0.2, 1.15, 1.9), V(HOTEL_X - 1.0, 0.95, -1.6), 44),
    ]);
  if (f < SCENES.hook.to) {
    const c = follow(2.9, 1.62, 0.2);
    return c;
  }
  // RETURN — the match cut: same framing, another doorway, another light
  if (f < s(13.0)) {
    const c = follow(2.9, 1.62, 0.2);
    // stop at the threshold and let the figure walk on into the room
    c.pos.z = Math.max(c.pos.z, 2.9);
    c.pos.x = lerp(c.pos.x, -0.6, ramp(f, s(11.2), s(13.0)));
    return c;
  }
  if (f < SCENES.ret.to)
  {
    // high and wide; the frame keeps the figure (and its echoes) in view
    const c = move(f, s(13.0), SCENES.ret.to, [shot(V(2.6, 3.7, 2.7), V(0.3, 0.3, 0.1), 50), shot(V(2.3, 3.4, 2.3), V(0.6, 0.4, -0.4), 48)], Easing.linear);
    c.target.lerp(fig.pos.clone().setY(0.7), 0.55);
    return c;
  }

  // MECHANISM — slow orbit as the threads appear
  if (f < wordAt('l07', 0) - 2) {
    const a = interpolate(f, [SCENES.mechanism.from, wordAt('l07', 0)], [0.2, -0.85], {...clamp, easing: Easing.linear});
    const c = V(1.15, 0.95, -1.2);
    return shot(c.clone().add(V(Math.sin(a) * 2.6, 0.75, Math.cos(a) * 2.6)), c, 48);
  }
  // "The same room."
  if (f < wordAt('l07', 4) - 3) return move(f, wordAt('l07', 0) - 2, wordAt('l07', 4), [shot(V(-1.7, 2.35, 2.1), V(0.6, 0.6, -1.0), 50), shot(V(-1.6, 2.25, 1.9), V(0.6, 0.6, -1.0), 48)], Easing.linear);
  // "The same time." — close on the clock
  if (f < wordAt('l07', 7) - 3) return move(f, wordAt('l07', 4) - 3, wordAt('l07', 7), [shot(V(1.25, 0.7, -1.45), CLOCK_POS.clone().add(V(0, 0.04, 0)), 30), shot(V(1.32, 0.68, -1.55), CLOCK_POS.clone().add(V(0, 0.04, 0)), 26)], Easing.linear);
  // "The same cues." — the phone on the nightstand, its thread taut
  if (f < s(25.7)) return move(f, wordAt('l07', 7) - 3, s(25.7), [shot(V(0.9, 0.85, -1.2), PHONE_ON_NIGHTSTAND.clone(), 34), shot(V(0.95, 0.8, -1.35), PHONE_ON_NIGHTSTAND.clone(), 32)], Easing.linear);
  if (f < SCENES.mechanism.to)
    // the loop runs: from the side to a low close-up of the bowed, phone-lit figure
    return move(f, s(25.7), SCENES.mechanism.to, [
      shot(V(-0.5, 1.5, -0.4), V(1.5, 1.0, -1.5), 46),
      shot(V(-0.05, 1.45, -2.05), V(1.62, 1.1, -1.38), 42),
      shot(V(0.3, 1.38, -2.12), V(1.62, 1.25, -1.4), 36),
    ]);

  // SCIENCE — the room pulls away into a dark, cue-lit miniature…
  if (f < NEW_ROOM_WALK.from - 10)
    return move(f, SCENES.science.from, NEW_ROOM_WALK.from - 10, [shot(V(1.0, 1.4, -0.4), V(1.4, 0.9, -1.4), 42), shot(V(3.6, 5.4, 4.6), V(0.4, 0.4, -0.6), 40)]);
  // …then a different room: the figure walks in, and the old threads find nothing to hold.
  return f < SCENES.science.to
    ? move(f, NEW_ROOM_WALK.from - 10, SCENES.science.to, [
        shot(V(HOTEL_X - 2.2, 4.6, 5.6), V(HOTEL_X - 1.0, 0.6, 0.8), 44),
        shot(V(HOTEL_X - 2.6, 3.4, 3.6), V(HOTEL_X - 0.3, 0.9, -0.9), 42),
      ])
    : experimentCamera(f);
};

const experimentCamera = (f: number): Shot => {
  // EXPERIMENT — night again, close on the cue
  if (f < TO_DESK.from - 4)
    return move(f, SCENES.experiment.from, TO_DESK.from - 4, [shot(V(0.3, 0.85, -1.75), V(1.55, 0.6, -1.92), 34), shot(V(-0.6, 1.55, -1.0), V(1.5, 0.85, -1.65), 44)]);
  // carrying the phone across the room, away from the bed
  if (f < s(53.9)) {
    const c = move(f, TO_DESK.from - 4, s(53.9), [shot(V(1.5, 4.3, 1.7), V(0.3, 0.2, -0.4), 52), shot(V(0.5, 4.1, 2.0), V(-0.6, 0.3, 0.1), 52)]);
    c.target.lerp(figureAt(f).main!.pos.clone().setY(0.5), 0.5);
    return c;
  }
  // time-lapse to morning; the room is rearranged; the curtains open
  if (f < SCENES.experiment.to) return move(f, s(53.9), SCENES.experiment.to, [shot(V(1.45, 1.55, 1.35), V(-0.6, 1.0, -1.4), 46), shot(V(1.2, 1.5, 0.9), V(-0.9, 1.25, -1.8), 42)]);
  // PAYOFF — same room, new light: a slow pull back
  return move(f, SCENES.payoff.from, SCENES.payoff.to, [shot(V(0.2, 1.45, -0.2), V(-1.0, 1.35, -2.0), 40), shot(V(1.7, 1.7, 2.15), V(-0.4, 0.95, -1.2), 46)], Easing.inOut(Easing.sin));
};

export const SHOT_NOTES = {lineAt, lineEnd};
