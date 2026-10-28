import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {DURATION_IN_FRAMES, FPS, PULSES, Route, SCENES, pulseProgress} from '../timeline';
import {Backdrop, Dust, Grade, LightShafts} from './Atmosphere';
import {BrainShell} from './Brain';
import {GlowPoint, GlowPoints} from './Glow';
import {ActivePulse, END, FAMILIAR_CURVE, MAX_PULSES, NEURONS, NEW_CURVE, NeuralWeb, RouteTube, START} from './Pathways';

export const FOV = 34;

export const FAMILIAR_COLOR: [number, number, number] = [0.12, 0.45, 1.0];
export const NEW_COLOR: [number, number, number] = [0.3, 1.0, 0.88];

const ease = Easing.bezier(0.45, 0, 0.25, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Camera path in brain space, one key every 2 seconds (smoothed by a spline).
const CAMERA_KEYS: [number, number, number][] = [
  [5.2, 1.4, 6.6],
  [5.4, 1.2, 5.0],
  [5.2, 0.9, 3.2],
  [4.4, 0.6, 1.6],
  [4.1, 0.45, 0.9],
  [4.0, 0.5, 0.2],
  [4.0, 0.7, -0.5],
  [4.1, 0.6, -0.4],
  [4.6, 0.7, 0.6],
  [5.3, 0.9, 2.0],
  [5.8, 1.1, 3.0],
];
const TARGET_KEYS: [number, number, number][] = [
  [0, 0.1, 0],
  [0.1, 0.1, 0],
  [0.3, 0.1, 0],
  [0.55, 0.1, 0.05],
  [0.55, 0.1, 0.05],
  [0.55, 0.1, -0.05],
  [0.55, 0.1, -0.1],
  [0.55, 0.1, -0.05],
  [0.5, 0.08, 0],
  [0.4, 0.06, 0],
  [0.3, 0.06, 0],
];
const toCurve = (keys: [number, number, number][]) =>
  new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k)), false, 'catmullrom', 0.5);
const CAMERA_CURVE = toCurve(CAMERA_KEYS);
const TARGET_CURVE = toCurve(TARGET_KEYS);

const activePulses = (route: Route, frame: number): ActivePulse[] => {
  const out: ActivePulse[] = [];
  for (const p of PULSES) {
    if (p.route !== route) continue;
    const pos = pulseProgress(p, frame);
    if (pos !== null) out.push({pos, intensity: p.intensity});
  }
  return out.slice(-MAX_PULSES);
};

/** Flash amount at a node shortly after pulses depart (start) or arrive (end). */
const nodeFlash = (frame: number, which: 'start' | 'end', route?: Route) => {
  let f = 0;
  for (const p of PULSES) {
    if (route && p.route !== route) continue;
    const at = which === 'start' ? p.start : p.start + p.duration;
    const dt = frame - at;
    if (dt >= 0 && dt < 30) f = Math.max(f, p.intensity * Math.exp(-dt / 7));
  }
  return f;
};

export const Scene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const time = frame / FPS;
  const pixelsPerUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

  // Brain slowly turns: a graceful reveal in scene 1, then a gentle drift.
  const rotY =
    interpolate(frame, [0, SCENES.intro.to + 20], [-1.15, -0.2], {...clamp, easing: ease}) + time * 0.012;
  const rotation = useMemo(() => new THREE.Euler(), []);
  rotation.set(0.05, rotY, 0);

  useLayoutEffect(() => {
    const t = interpolate(frame, [0, DURATION_IN_FRAMES - 1], [0, 1], clamp);
    const pos = CAMERA_CURVE.getPoint(t).applyEuler(rotation);
    const target = TARGET_CURVE.getPoint(t).applyEuler(rotation);
    // tiny handheld-like float
    pos.x += Math.sin(time * 0.9) * 0.03;
    pos.y += Math.sin(time * 0.7 + 1) * 0.03;
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.fov = FOV;
    camera.near = 0.05;
    camera.far = 60;
    camera.updateProjectionMatrix();
  }, [frame, camera, rotation, time]);

  // --- route brightness over time -------------------------------------------
  const familiarBase = interpolate(
    frame,
    [0, SCENES.familiar.from, SCENES.familiar.from + 30, SCENES.newRoute.from, SCENES.newRoute.from + 40, DURATION_IN_FRAMES],
    [0.25, 0.3, 0.95, 0.95, 0.65, 0.7],
    clamp,
  );
  const firstNew = PULSES.find((p) => p.route === 'new')!;
  const newReveal = interpolate(frame, [firstNew.start, firstNew.start + firstNew.duration], [0, 1], clamp);
  const revealPos = frame < firstNew.start ? 0 : pulseProgress(firstNew, Math.min(frame, firstNew.start + firstNew.duration)) ?? 1;
  const newBase = interpolate(
    frame,
    [firstNew.start, SCENES.repetition.from, DURATION_IN_FRAMES - 15],
    [0.22, 0.38, 1.05],
    {...clamp, easing: Easing.inOut(Easing.quad)},
  );
  const newGhost = interpolate(frame, [SCENES.newRoute.from - 10, SCENES.newRoute.from + 15], [0, 0.04], clamp);

  const sweep = interpolate(frame, [0, 110], [-1.2, 1.4], clamp);
  const fade = interpolate(frame, [0, 18, DURATION_IN_FRAMES - 18, DURATION_IN_FRAMES - 1], [0, 1, 1, 0], clamp);
  const camDist = camera.position.length();
  // The shell steps back while the pathways tell the story.
  const shellOpacity = interpolate(
    frame,
    [0, 45, SCENES.familiar.from - 10, SCENES.familiar.from + 30, SCENES.repetition.from, SCENES.repetition.from + 60],
    [0.3, 1, 1, 0.5, 0.5, 0.75],
    {...clamp, easing: Easing.inOut(Easing.sin)},
  );
  const webOpacity = interpolate(frame, [10, 70, SCENES.familiar.from, SCENES.familiar.from + 30], [0, 1, 1, 0.6], clamp);

  // --- glowing nodes -----------------------------------------------------------
  const nodes: GlowPoint[] = [];
  const startFlash = nodeFlash(frame, 'start');
  const endFlash = nodeFlash(frame, 'end');
  nodes.push({pos: START, size: 0.14 + startFlash * 0.12, color: [0.4, 0.75, 1], intensity: 0.8 + startFlash * 1.2});
  nodes.push({pos: END, size: 0.14 + endFlash * 0.2, color: [0.4, 0.8, 1], intensity: 0.8 + endFlash * 1.6});
  for (const [route, curve, color] of [
    ['familiar', FAMILIAR_CURVE, FAMILIAR_COLOR],
    ['new', NEW_CURVE, NEW_COLOR],
  ] as const) {
    for (const p of activePulses(route, frame)) {
      if (p.pos > 1) continue;
      nodes.push({pos: curve.getPointAt(p.pos), size: 0.12, color: [...color], intensity: 1.3 * p.intensity});
    }
    // synapse waypoints along each route
    const visible = route === 'familiar' ? familiarBase : newReveal > 0 ? newBase : 0;
    for (const u of [0.25, 0.5, 0.75]) {
      if (route === 'new' && u > revealPos) continue;
      nodes.push({pos: curve.getPointAt(u), size: 0.06, color: [...color], intensity: visible * 0.6});
    }
  }
  // ambient neurons twinkle
  NEURONS.forEach((p, i) => {
    const tw = 0.5 + 0.5 * Math.sin(time * (0.6 + (i % 7) * 0.13) + i * 1.7);
    nodes.push({pos: p, size: 0.035, color: [0.25, 0.55, 1], intensity: 0.12 + 0.3 * tw * tw});
  });

  return (
    <>
      <Backdrop time={time} glow={interpolate(frame, [0, 60], [0.4, 1], clamp)} />
      <LightShafts time={time} intensity={interpolate(frame, [0, 90, 450, 600], [0.3, 1, 0.8, 1.1], clamp)} />
      <Dust time={time} pixelsPerUnit={pixelsPerUnit} focus={camDist} opacity={1} />
      <group rotation={rotation}>
        <BrainShell time={time} sweep={sweep} opacity={shellOpacity} />
        <NeuralWeb time={time} opacity={webOpacity} />
        <RouteTube
          curve={FAMILIAR_CURVE}
          color={FAMILIAR_COLOR}
          base={familiarBase}
          reveal={1}
          ghost={0}
          pulses={activePulses('familiar', frame)}
          time={time}
        />
        <RouteTube
          curve={NEW_CURVE}
          color={NEW_COLOR}
          base={newBase}
          reveal={revealPos}
          ghost={newGhost}
          pulses={activePulses('new', frame)}
          time={time}
        />
        <GlowPoints points={nodes} max={400} pixelsPerUnit={pixelsPerUnit} />
      </group>
      <Grade frame={frame} fade={fade} />
    </>
  );
};
