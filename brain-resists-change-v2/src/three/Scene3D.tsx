import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {
  DIVE,
  DURATION_IN_FRAMES,
  FPS,
  NEW_PULSES,
  PULSES,
  PRACTICE_FROM,
  Route,
  SEQ,
  WHIP,
  practiceLevel,
  pulseProgress,
} from '../timeline';
import {Backdrop, Dust, Grade, LightShafts} from './Atmosphere';
import {BrainShell} from './Brain';
import {NEURONS, NeuralWeb} from './BrainWeb';
import {GlowPoint, GlowPoints} from './Glow';
import {mulberry32} from './math';
import {ActivePulse, Bundle, END, FAMILIAR_CURVE, FIELD, FieldWeb, MAX_PULSES, NEW_CURVE, START} from './World';

export const FAMILIAR_COLOR: [number, number, number] = [0.12, 0.45, 1.0];
export const NEW_COLOR: [number, number, number] = [0.3, 1.0, 0.88];

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const smooth = Easing.bezier(0.45, 0, 0.25, 1);
const w = (frame: number, a: number, b: number, easing = smooth) => interpolate(frame, [a, b], [0, 1], {...clamp, easing});
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Shot = {pos: THREE.Vector3; target: THREE.Vector3; fov: number};
const mix = (a: Shot, b: Shot, t: number): Shot => ({
  pos: a.pos.clone().lerp(b.pos, t),
  target: a.target.clone().lerp(b.target, t),
  fov: a.fov + (b.fov - a.fov) * t,
});

/** Slow turn of the brain in sequence 1. */
const brainRotation = (frame: number) => -0.95 + 0.4 * (frame / SEQ.hook.to);

const chase = (curve: THREE.Curve<THREE.Vector3>, c: number, offset: THREE.Vector3, fov: number): Shot => ({
  pos: curve.getPointAt(Math.min(1, Math.max(0, c))).add(offset),
  target: curve.getPointAt(Math.min(1, Math.max(0, c + 0.16))),
  fov,
});

/** The whole film's camera direction, shot by shot. */
const cameraAt = (frame: number): Shot => {
  if (frame < SEQ.hook.to) {
    // 1 – macro on the cortex surface, pulling back to a close-up, then a dive inside.
    const macro: Shot = {pos: V(1.15, 0.68, 1.3), target: V(0.4, 0.3, 0.35), fov: 34};
    const close: Shot = {pos: V(2.25, 0.75, 2.55), target: V(0.0, 0.02, 0), fov: 34};
    const inside: Shot = {pos: V(0.32, 0.18, 0.38), target: V(-0.2, 0.0, -0.3), fov: 82};
    let shot = mix(macro, close, w(frame, 0, DIVE.from - 5));
    shot = mix(shot, inside, w(frame, DIVE.from, DIVE.cut, Easing.in(Easing.cubic)));
    const rot = new THREE.Euler(0.05, brainRotation(frame), 0);
    return {pos: shot.pos.applyEuler(rot), target: shot.target.applyEuler(rot), fov: shot.fov};
  }
  const f = frame;
  // 2 – arrive mid-motion, chasing the signal down the familiar route…
  const c = interpolate(f, [SEQ.familiar.from, s(7.4)], [0.0, 0.62], {...clamp, easing: Easing.out(Easing.quad)});
  let shot = chase(FAMILIAR_CURVE, c, V(0.75, 0.85, 1.25), 52);
  // …settle into a hero view of the whole, well-worn route.
  const hero: Shot = {pos: V(-3.1 + (f - s(6.5)) * 0.004, 0.7, 5.6), target: V(-0.45, -0.05, 0), fov: 40};
  shot = mix(shot, hero, w(f, s(6.6), s(8.3)));
  // Whip-pan back to the start, where a second route branches off.
  const fork: Shot = {pos: V(1.95, 3.15, 2.35), target: V(0.4, 1.55, 0), fov: 46};
  shot = mix(shot, fork, w(f, WHIP.from, WHIP.from + 18, Easing.inOut(Easing.cubic)));
  // 3 – follow the first, hesitant attempt along the new route…
  const first = NEW_PULSES[0];
  const nc = interpolate(f, [first.start, first.start + first.duration], [0.0, 0.8], clamp);
  shot = mix(shot, chase(NEW_CURVE, nc, V(1.35, 1.0, 2.0), 50), w(f, s(10.35), s(11.4)));
  // …step back to see the whole new route as it is practised…
  const medium: Shot = {pos: V(3.5, 0.15, 4.4), target: V(0.6, -0.1, 0), fov: 40};
  shot = mix(shot, medium, w(f, s(13.6), s(15.0)));
  // …and pull out wide: both routes, side by side, equally bright.
  const wide: Shot = {pos: V(0.25 - (f - PRACTICE_FROM) * 0.002, -0.2, 10.2 + (f - PRACTICE_FROM) * 0.005), target: V(0, -0.45, 0), fov: 39};
  shot = mix(shot, wide, w(f, s(15.6), s(18.0)));
  return shot;
};

function s(seconds: number) {
  return Math.round(seconds * FPS);
}

const activePulses = (route: Route, frame: number): ActivePulse[] => {
  const out: ActivePulse[] = [];
  for (const p of PULSES) {
    if (p.route !== route) continue;
    const pos = pulseProgress(p, frame);
    if (pos !== null) out.push({pos, intensity: p.intensity});
  }
  return out.slice(-MAX_PULSES);
};

const flashAt = (frame: number, at: number, intensity: number) => {
  const dt = frame - at;
  return dt >= 0 && dt < 30 ? intensity * Math.exp(-dt / 7) : 0;
};

export const Scene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const time = frame / FPS;
  const shot = useMemo(() => cameraAt(frame), [frame]);
  const pixelsPerUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(shot.fov / 2)));

  useLayoutEffect(() => {
    // gentle handheld float; a little more nervous while the new route is unsure
    const nervous = interpolate(frame, [SEQ.newRoute.from, SEQ.newRoute.from + 20, PRACTICE_FROM, PRACTICE_FROM + 40], [1, 2.2, 2.2, 1], clamp);
    camera.position.copy(shot.pos);
    camera.position.x += Math.sin(time * 0.9) * 0.025 * nervous;
    camera.position.y += Math.sin(time * 0.7 + 1) * 0.025 * nervous;
    camera.lookAt(shot.target);
    camera.fov = shot.fov;
    camera.near = 0.02;
    camera.far = 60;
    camera.updateProjectionMatrix();
  }, [frame, camera, shot, time]);

  const fade = interpolate(frame, [0, 12, DURATION_IN_FRAMES - 14, DURATION_IN_FRAMES - 1], [0, 1, 1, 0], clamp);
  const inHook = frame < SEQ.hook.to;

  return (
    <>
      <Backdrop time={time} glow={inHook ? interpolate(frame, [0, 60], [0.5, 1], clamp) : 1.25} />
      <LightShafts time={time} intensity={inHook ? interpolate(frame, [0, 90], [0.4, 1], clamp) : 0.55} />
      <Dust time={time} pixelsPerUnit={pixelsPerUnit} focus={shot.pos.distanceTo(shot.target)} opacity={inHook ? 1 : 0.8} />
      {inHook ? <HookSequence frame={frame} time={time} pixelsPerUnit={pixelsPerUnit} /> : <PathwaySequence frame={frame} time={time} pixelsPerUnit={pixelsPerUnit} />}
      <Grade frame={frame} fade={fade} />
    </>
  );
};

// --- Sequence 1: the brain -------------------------------------------------------

const SPARKS = (() => {
  const rand = mulberry32(31);
  return Array.from({length: 26}, () => ({
    at: Math.floor(rand() * 130),
    neuron: Math.floor(rand() * NEURONS.length),
  }));
})();

const HookSequence: React.FC<{frame: number; time: number; pixelsPerUnit: number}> = ({frame, time, pixelsPerUnit}) => {
  const rotation = useMemo(() => new THREE.Euler(0.05, brainRotation(frame), 0), [frame]);
  const nodes: GlowPoint[] = NEURONS.map((p, i) => {
    const tw = 0.5 + 0.5 * Math.sin(time * (0.6 + (i % 7) * 0.13) + i * 1.7);
    return {pos: p, size: 0.035, color: [0.25, 0.55, 1], intensity: 0.15 + 0.35 * tw * tw};
  });
  // random flickers of activity – "a brain at work"
  for (const sp of SPARKS) {
    const fl = flashAt(frame, sp.at, 1.4);
    if (fl > 0.02) nodes.push({pos: NEURONS[sp.neuron], size: 0.09 + fl * 0.08, color: [0.45, 0.8, 1], intensity: fl});
  }
  return (
    <group rotation={rotation}>
      <BrainShell time={time} sweep={interpolate(frame, [0, 110], [-1.2, 1.4], clamp)} opacity={interpolate(frame, [0, 30], [0.4, 1], clamp)} />
      <NeuralWeb time={time} opacity={interpolate(frame, [0, 40], [0.3, 1], clamp)} />
      <GlowPoints points={nodes} max={320} pixelsPerUnit={pixelsPerUnit} />
    </group>
  );
};

// --- Sequences 2 & 3: the pathway world ----------------------------------------------

const PathwaySequence: React.FC<{frame: number; time: number; pixelsPerUnit: number}> = ({frame, time, pixelsPerUnit}) => {
  const level = practiceLevel(frame);
  const first = NEW_PULSES[0];
  const inThree = frame >= SEQ.newRoute.from;

  const familiarBase = interpolate(frame, [SEQ.familiar.from, SEQ.familiar.from + 25, SEQ.newRoute.from, SEQ.newRoute.from + 30], [0.45, 1, 1, 0.7], clamp);
  // The new route: hinted at during the whip-pan, drawn by the first attempt,
  // then filled in, brightened and thickened by every repetition.
  const newReveal = frame < first.start ? 1 : Math.min(1, pulseProgress(first, Math.min(frame, first.start + first.duration)) ?? 1);
  const hint = interpolate(frame, [WHIP.from + 8, WHIP.to], [0, 1], clamp);
  const newBase = frame < first.start ? 0.07 * hint : 0.3 + 0.75 * level;
  const newFill = 0.4 + 0.6 * level;
  const newStrands = level * 6.5;

  const nodes: GlowPoint[] = [];
  FIELD.forEach((p, i) => {
    const tw = 0.5 + 0.5 * Math.sin(time * (0.5 + (i % 5) * 0.17) + i * 2.3);
    nodes.push({pos: p, size: 0.07, color: [0.25, 0.5, 1], intensity: 0.12 + 0.3 * tw * tw});
  });
  const arrivals = (route: Route) => PULSES.filter((p) => p.route === route).reduce((m, p) => Math.max(m, flashAt(frame, p.start + p.duration, p.intensity)), 0);
  const departures = PULSES.reduce((m, p) => Math.max(m, flashAt(frame, p.start, p.intensity * 0.8)), 0);
  const endFlash = Math.max(arrivals('familiar'), arrivals('new'));
  nodes.push({pos: START, size: 0.42 + departures * 0.25, color: [0.45, 0.8, 1], intensity: 0.9 + departures});
  nodes.push({pos: END, size: 0.42 + endFlash * 0.35, color: [0.45, 0.85, 1], intensity: 0.9 + endFlash * 1.4});

  const rand = mulberry32(frame + 7);
  for (const [route, curve, color] of [
    ['familiar', FAMILIAR_CURVE, FAMILIAR_COLOR],
    ['new', NEW_CURVE, NEW_COLOR],
  ] as const) {
    for (const p of activePulses(route, frame)) {
      if (p.pos > 1) continue;
      const head = curve.getPointAt(p.pos);
      nodes.push({pos: head, size: 0.3, color: [...color], intensity: 1.3 * p.intensity});
      // an unpractised route crackles: sparks scatter off the signal
      if (route === 'new' && level < 0.6) {
        for (let k = 0; k < 3; k++) {
          const off = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.35 * (1 - level));
          nodes.push({pos: head.clone().add(off), size: 0.08, color: [...color], intensity: rand() * (1 - level) * 1.2});
        }
      }
    }
  }

  return (
    <group>
      <FieldWeb time={time} opacity={0.9} />
      <Bundle
        curve={FAMILIAR_CURVE}
        color={FAMILIAR_COLOR}
        base={familiarBase}
        reveal={1}
        fill={1}
        strands={6.5}
        pulses={activePulses('familiar', frame)}
        time={time}
        seed={0.1}
      />
      {frame >= WHIP.from ? (
        <Bundle
          curve={NEW_CURVE}
          color={NEW_COLOR}
          base={newBase}
          reveal={inThree ? newReveal : 1}
          fill={newFill}
          ghost={0.1 * hint}
          strands={newStrands}
          pulses={activePulses('new', frame)}
          time={time}
          seed={0.6}
        />
      ) : null}
      <GlowPoints points={nodes} max={520} pixelsPerUnit={pixelsPerUnit} />
    </group>
  );
};
