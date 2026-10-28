import {useThree} from '@react-three/fiber';
import {Bloom, EffectComposer, Noise, ToneMapping, Vignette} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {useLayoutEffect, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {cameraAt, figureAt, sceneAt, threadsAt, worldAt} from '../story';
import {FPS} from '../timeline';
import {Figure, applyPose, defaultPose, useRig} from './Character';
import {GlowPoint, GlowPoints} from './Glow';
import {BedroomLight, HotelLight} from './Lighting';
import {Phone} from './Props';
import {BEDROOM, Bedroom, CameraCtx, Corridor, HOTEL_X, Hotel, PHONE_ON_DESK, PHONE_ON_NIGHTSTAND} from './Rooms';
import {Threads} from './Threads';

const v = new THREE.Vector3();

export const Scene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const time = frame / FPS;
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const shot = useMemo(() => cameraAt(frame), [frame]);
  const fig = figureAt(frame);
  const world = worldAt(frame);
  const threads = threadsAt(frame);
  const scene = sceneAt(frame);

  // gentle handheld breathing on every shot
  const cam = shot.pos.clone().add(new THREE.Vector3(Math.sin(time * 0.7) * 0.012, Math.sin(time * 0.9 + 1) * 0.01, Math.cos(time * 0.6) * 0.01));
  useLayoutEffect(() => {
    camera.position.copy(cam);
    camera.lookAt(shot.target);
    camera.fov = shot.fov;
    camera.near = 0.03;
    camera.far = 80;
    camera.updateProjectionMatrix();
  });

  // the main figure is driven directly so its hands and chest can be read back
  const rig = useRig();
  const main = fig.main!;
  applyPose(rig, defaultPose({...main}));
  const chest = rig.bones.Spine2.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(Math.sin(main.heading), 0.05, Math.cos(main.heading)).multiplyScalar(0.12));
  const lh = rig.bones.LeftHand.getWorldPosition(new THREE.Vector3());
  const rh = rig.bones.RightHand.getWorldPosition(new THREE.Vector3());

  // where the phone is
  let phonePos: THREE.Vector3 | null = null;
  let phoneMatrix: THREE.Matrix4 | null = null;
  if (world.phone.where === 'nightstand') phonePos = PHONE_ON_NIGHTSTAND;
  if (world.phone.where === 'desk') phonePos = PHONE_ON_DESK;
  if (world.phone.where === 'hand' || world.phone.where === 'carry') {
    const held = world.phone.where === 'hand' ? lh.clone().lerp(rh, 0.5).add(new THREE.Vector3(0, 0.05, 0)) : rh.clone().add(new THREE.Vector3(0, 0.03, 0));
    const p = PHONE_ON_NIGHTSTAND.clone().lerp(held, world.phone.travel ?? 1);
    const facing = new THREE.Euler(world.phone.where === 'hand' ? -1.0 : -0.2, main.heading, 0, 'YXZ');
    phoneMatrix = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(facing), new THREE.Vector3(1, 1, 1));
  }

  // soft glows where threads meet their cues
  const glows: GlowPoint[] = threads
    .filter((t) => !t.loose && t.reveal > 0.05)
    .map((t) => ({pos: t.from, size: 0.09, color: t.color === 'gold' ? [1, 0.72, 0.38] : [0.3, 0.95, 0.85], intensity: 0.5 * t.intensity * Math.min(1, t.reveal * 3)}));

  const pixelsPerUnit = 1920 / (2 * Math.tan(THREE.MathUtils.degToRad(shot.fov / 2)));
  const inHotel = fig.room === 'hotel';

  return (
    <CameraCtx.Provider value={cam}>
      {inHotel ? <HotelLight time={time} level={world.hotelLevel} /> : <BedroomLight time={time} dawn={world.dawn} mood={world.mood} />}
      <Bedroom
        time={time}
        dawn={world.dawn}
        phonePos={phonePos}
        phoneScreen={world.phone.screen}
        clockText={world.clockText}
        clockGlow={scene === 'mechanism' ? 1 : 0.6}
        lampOn={0}
        curtainOpen={world.curtainOpen}
        chairPos={world.chairPos}
        chairRot={world.chairRot}
        glassOnNightstand={world.glass}
        cueGlow={0}
      />
      <Corridor x={(BEDROOM.door.x0 + BEDROOM.door.x1) / 2} z={BEDROOM.d / 2} warm={false} />
      <Hotel time={time} />
      <Corridor x={HOTEL_X - 1.95} z={2.5} warm />
      {phoneMatrix ? (
        <group matrix={phoneMatrix} matrixAutoUpdate={false}>
          <Phone screen={world.phone.screen} />
        </group>
      ) : null}
      <primitive object={rig.root} />
      {fig.echoes.map((e, i) => (
        <Figure key={i} pose={defaultPose({...e.state, opacity: e.opacity})} />
      ))}
      <Threads threads={threads} chest={chest} time={time} />
      <GlowPoints points={glows} max={16} pixelsPerUnit={pixelsPerUnit} />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.75} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.22} darkness={0.8} />
        <Noise opacity={0.045} />
      </EffectComposer>
    </CameraCtx.Provider>
  );
};

void v;
