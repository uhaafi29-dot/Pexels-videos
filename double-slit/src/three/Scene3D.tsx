import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {BARRIER_Z, SCREEN_Z, applyLens, cameraAt, screenAX} from '../camera';
import {ENVELOPE, FRINGE, pInterference, pNoInterference, sampleHits} from '../physics';
import {DETECTORS_ON, DURATION_IN_FRAMES, FIRST_SHOT, FPS, RUN_B, SCENES, TOTAL_A, TOTAL_B, birthFrames, countA, countB, s} from '../timeline';
import {Backdrop, Dust, Grade, LightShafts} from './Atmosphere';
import {Barrier, Bench, CYAN, DetectorScreen, ElectronGun, NOZZLE, ProbabilityField, WhichPathDetector} from './Apparatus';
import {GlowPoint, GlowPoints} from './Glow';
import {mulberry32} from './math';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Simulated detections, sampled once from the quantum predictions.
const HITS_A = sampleHits(pInterference, TOTAL_A, 11);
const HITS_B = sampleHits(pNoInterference, TOTAL_B, 23);
const BIRTHS_A = birthFrames(countA, TOTAL_A);
const BIRTHS_B = birthFrames(countB, TOTAL_B);
// The very first hit (scene 1) lands near the centre so the eye finds it.
HITS_A.xs[0] = 0.02;
HITS_A.ys[0] = 0.08;

/** Which slit the idealised detector registers for run-B electrons: 0 = left, 1 = right. */
const PATH_B = (() => {
  const rand = mulberry32(77);
  return Uint8Array.from({length: TOTAL_B}, () => (rand() < 0.5 ? 0 : 1));
})();

/** Recent-hit activity in a run, 0..1, for flickers and detector lamps. */
const recentActivity = (births: Float32Array, frame: number, window = 4) => {
  let n = 0;
  for (let i = 0; i < births.length && births[i] <= frame; i++) {
    if (frame - births[i] < window) n++;
  }
  return Math.min(1, n / 3);
};

export const Scene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const time = frame / FPS;
  const shot = useMemo(() => cameraAt(frame), [frame]);
  const pixelsPerUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(shot.fov / 2)));

  useLayoutEffect(() => {
    camera.position.copy(shot.pos);
    camera.lookAt(shot.target);
    camera.fov = shot.fov;
    camera.near = 0.02;
    camera.far = 80;
    applyLens(camera, width, height);
    camera.updateProjectionMatrix();
  }, [camera, shot, width, height]);

  // --- the experiment's state at this frame -------------------------------------------
  const activityA = recentActivity(BIRTHS_A, frame);
  const activityB = recentActivity(BIRTHS_B, frame);
  const detectorsOn = interpolate(frame, [DETECTORS_ON, DETECTORS_ON + 15], [0, 1], clamp);
  // which-path lamps: light the registered slit of the most recent run-B hits
  let flashL = 0;
  let flashR = 0;
  for (let i = 0; i < TOTAL_B && BIRTHS_B[i] <= frame; i++) {
    const age = frame - (BIRTHS_B[i] - 3); // the slit is registered just before the hit
    if (age < 6) {
      const f = Math.exp(-age / 2.5);
      if (PATH_B[i] === 0) flashL = Math.max(flashL, f);
      else flashR = Math.max(flashR, f);
    }
  }

  const curveA = interpolate(frame, [s(13.4), s(15.4)], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
  const curveB = interpolate(frame, [s(27.6), s(29.2)], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
  // calculated probability: interference fan in scene 3, the smooth version in scene 4
  const fieldA = interpolate(frame, [s(15.9), s(17.6), SCENES.measure.from, SCENES.measure.from + 12], [0, 1, 1, 0], clamp);
  const fieldB = interpolate(frame, [s(22.0), s(22.6), s(24.6), s(25.4)], [0, 0.8, 0.8, 0], clamp);
  const screenBOn = interpolate(frame, [SCENES.measure.from + 30, RUN_B.from], [0, 1], clamp);
  const fade = interpolate(frame, [0, 14, DURATION_IN_FRAMES - 18, DURATION_IN_FRAMES - 1], [0, 1, 1, 0], clamp);

  // --- glowing "events": the first electron shown in flight (as a metaphor) ----------------
  const lights: GlowPoint[] = [];
  const flicker = Math.max(activityA * (frame < RUN_B.from ? 1 : 0), activityB);
  // The source glow is drawn without depth testing, so hide it whenever the
  // camera is in front of the detector screen (it would shine through the
  // screen and look like a permanent hit in the middle).
  const sourceVisible = interpolate(shot.pos.z, [SCREEN_Z - 0.5, SCREEN_Z + 0.5], [1, 0], clamp);
  lights.push({pos: NOZZLE, size: 0.32 + flicker * 0.25, color: [...CYAN], intensity: (0.7 + flicker * 1.2) * sourceVisible});
  const flight = interpolate(frame, [FIRST_SHOT.fire, FIRST_SHOT.fire + 30], [0, 1], clamp);
  if (frame >= FIRST_SHOT.fire && flight < 1) {
    // a packet leaves the source and approaches the barrier…
    const p = NOZZLE.clone().lerp(new THREE.Vector3(0, 0, BARRIER_Z - 0.05), Easing.in(Easing.quad)(flight));
    lights.push({pos: p, size: 0.24, color: [...CYAN], intensity: 1.4});
  }
  // …then a soft, featureless spread toward the screen (no path is drawn through either slit)
  const spread = interpolate(frame, [FIRST_SHOT.fire + 26, FIRST_SHOT.fire + 40, FIRST_SHOT.arrive, FIRST_SHOT.arrive + 8], [0, 0.5, 0.5, 0], clamp);
  const inFlightField = spread;

  return (
    <>
      <Backdrop time={time} glow={0.9} />
      <LightShafts time={time} intensity={0.45} />
      <Dust time={time} pixelsPerUnit={pixelsPerUnit} focus={shot.pos.distanceTo(shot.target)} opacity={0.7} />
      <Bench />
      <ElectronGun flicker={flicker} opacity={1} />
      <Barrier opacity={1} />
      <WhichPathDetector on={detectorsOn} flashL={flashL} flashR={flashR} />
      <ProbabilityField opacity={fieldA} mix={0} envelope={ENVELOPE} fringe={FRINGE} />
      <ProbabilityField opacity={Math.max(fieldB, inFlightField)} mix={1} envelope={ENVELOPE} fringe={FRINGE} />
      <DetectorScreen
        xs={HITS_A.xs}
        ys={HITS_A.ys}
        births={BIRTHS_A}
        frame={frame}
        pixelsPerUnit={pixelsPerUnit}
        x={screenAX(frame)}
        opacity={1}
        curve={pInterference}
        curveReveal={curveA}
        curveMax={1}
      />
      <DetectorScreen
        xs={HITS_B.xs}
        ys={HITS_B.ys}
        births={BIRTHS_B}
        frame={frame}
        pixelsPerUnit={pixelsPerUnit}
        x={0}
        opacity={screenBOn}
        curve={pNoInterference}
        curveReveal={curveB}
        curveMax={1}
      />
      <GlowPoints points={lights} max={8} pixelsPerUnit={pixelsPerUnit} />
      <Grade frame={frame} fade={fade} />
    </>
  );
};

