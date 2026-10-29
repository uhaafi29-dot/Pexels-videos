import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useHdr} from './assets';
import {BEDROOM, HOTEL, HOTEL_X, Motes, Shaft} from './Rooms';

const lerpColor = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/** Sets scene background + environment (image-based lighting). */
export const Environment: React.FC<{file: string; background: boolean; intensity: number; rotation?: number; bgIntensity?: number}> = ({file, background, intensity, rotation = 0, bgIntensity = 1}) => {
  const tex = useHdr(file);
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    scene.environment = tex;
    scene.background = background ? tex : new THREE.Color('#020306');
    scene.environmentIntensity = intensity;
    scene.backgroundIntensity = bgIntensity;
    scene.environmentRotation.set(0, rotation, 0);
    scene.backgroundRotation.set(0, rotation, 0);
  });
  return null;
};

const Sun: React.FC<{pos: THREE.Vector3; target: THREE.Vector3; color: THREE.Color; intensity: number; area: number}> = ({pos, target, color, intensity, area}) => {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight();
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
    return l;
  }, []);
  light.position.copy(pos);
  light.target.position.copy(target);
  light.color.copy(color);
  light.intensity = intensity;
  const cam = light.shadow.camera as THREE.OrthographicCamera;
  cam.left = -area;
  cam.right = area;
  cam.top = area;
  cam.bottom = -area;
  cam.near = 0.5;
  cam.far = 40;
  cam.updateProjectionMatrix();
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  );
};

/** Golden morning in the hotel suite: low sun through the glass wall. */
export const HotelLight: React.FC<{time: number; level?: number}> = ({time, level = 1}) => {
  const sunDir = useMemo(() => new THREE.Vector3(0.45, -0.42, 1).normalize(), []);
  const corners = useMemo(() => {
    const z = -HOTEL.d / 2;
    return [
      new THREE.Vector3(HOTEL_X - 2.6, 0.2, z),
      new THREE.Vector3(HOTEL_X + 1.2, 0.2, z),
      new THREE.Vector3(HOTEL_X + 1.2, HOTEL.h - 0.1, z),
      new THREE.Vector3(HOTEL_X - 2.6, HOTEL.h - 0.1, z),
    ];
  }, []);
  return (
    <>
      <Environment file="assets/spruit_sunrise_1k.hdr" background intensity={0.42 * level} rotation={2.2} bgIntensity={0.7 * level} />
      <Sun pos={new THREE.Vector3(HOTEL_X - 4.5, 4.4, -10)} target={new THREE.Vector3(HOTEL_X, 0, 0)} color={new THREE.Color('#ffc98a')} intensity={3.1 * level} area={6} />
      <hemisphereLight args={['#ffe2bf', '#6b5440', 0.28 * level]} />
      <Shaft corners={corners} dir={sunDir} length={5.5} color="#ffcf96" intensity={0.05 * level} time={time} />
      <Motes min={new THREE.Vector3(HOTEL_X - 2.5, 0.2, -2.4)} max={new THREE.Vector3(HOTEL_X + 2.5, 2.6, 2)} time={time} color="#ffd9a8" intensity={0.6 * level} />
    </>
  );
};

/**
 * The bedroom. `dawn` blends midnight blue moonlight into warm sunrise
 * coming through the same window.
 */
export const BedroomLight: React.FC<{time: number; dawn: number; mood?: number}> = ({time, dawn, mood = 1}) => {
  const {window: win, d} = BEDROOM;
  const dir = useMemo(() => new THREE.Vector3(0.35, -0.5, 1).normalize(), []);
  const corners = useMemo(
    () => [
      new THREE.Vector3(win.x0, win.y0, -d / 2),
      new THREE.Vector3(win.x1, win.y0, -d / 2),
      new THREE.Vector3(win.x1, win.y1, -d / 2),
      new THREE.Vector3(win.x0, win.y1, -d / 2),
    ],
    [win, d],
  );
  const sunColor = lerpColor('#7f9ee6', '#ffbf7a', dawn);
  return (
    <>
      <Environment file={dawn > 0.5 ? 'assets/spruit_sunrise_1k.hdr' : 'assets/moonless_golf_1k.hdr'} background={false} intensity={(0.5 + 0.1 * dawn) * mood} />
      <Sun pos={new THREE.Vector3(-1.0 - 2.5, 3.6 + dawn * 0.5, -2.3 - 6)} target={new THREE.Vector3(0.2, 0, 0)} color={sunColor} intensity={(2.4 + 2.2 * dawn) * mood} area={4} />
      <hemisphereLight args={[lerpColor('#1c2a4a', '#ffdcb8', dawn), lerpColor('#05070c', '#4a3a2c', dawn), (0.75 + 0.1 * dawn) * mood]} />
      {/* soft cool fill from the corridor side so the night stays readable */}
      <pointLight color={lerpColor('#5d7bc4', '#ffd2a0', dawn)} intensity={(3.5 - 1.5 * dawn) * mood} distance={8} decay={2} position={[-0.8, 2.3, 1.8]} />
      <Shaft corners={corners} dir={dir} length={4.2} color={sunColor} intensity={(0.03 + 0.07 * dawn) * mood} time={time} />
      <Motes min={new THREE.Vector3(-1.9, 0.2, -2.2)} max={new THREE.Vector3(1.9, 2.4, 2.2)} time={time} color={sunColor} intensity={(0.25 + 0.6 * dawn) * mood} count={350} />
    </>
  );
};
