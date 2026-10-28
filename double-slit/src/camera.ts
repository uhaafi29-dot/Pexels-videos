// Camera direction for the whole film, as a pure function of the frame so the
// 3D scene and the DOM labels (which project 3D anchor points) always agree.
import {Easing, interpolate} from 'remotion';
import * as THREE from 'three';
import {SCENES, SCREEN_A_LIFT, s} from './timeline';

// World layout: the beam travels along +z.
export const GUN_Z = -5.2;
export const BARRIER_Z = -1.6;
export const SCREEN_Z = 2.6;
export const SLIT_X = 0.18; // slits at x = ±0.18
/** Screen A slides out of the beam to the left for run B (side by side). */
export const SCREEN_A_SHIFT_X = -3.45;

/**
 * Lens shift (px): the optical centre sits above the frame centre so the 3D
 * action lands in the "stage" between the titles and the subtitles.
 */
export const LENS_SHIFT = 110;
export const applyLens = (cam: THREE.PerspectiveCamera, width: number, height: number) => cam.setViewOffset(width, height, 0, LENS_SHIFT, width, height);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const smooth = Easing.bezier(0.45, 0, 0.25, 1);
const w = (f: number, a: number, b: number, easing = smooth) => interpolate(f, [a, b], [0, 1], {...clamp, easing});
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export type Shot = {pos: THREE.Vector3; target: THREE.Vector3; fov: number};
const mix = (a: Shot, b: Shot, t: number): Shot => ({
  pos: a.pos.clone().lerp(b.pos, t),
  target: a.target.clone().lerp(b.target, t),
  fov: a.fov + (b.fov - a.fov) * t,
});

/** Horizontal offset of screen A (moved aside for run B). */
export const screenAX = (frame: number) => SCREEN_A_SHIFT_X * w(frame, SCREEN_A_LIFT.from, SCREEN_A_LIFT.to);

// Orbit from above the source, round the side, to the front of the screen.
const ORBIT = new THREE.CatmullRomCurve3([V(1.2, 4.2, -7.6), V(6.0, 2.4, -1.0), V(4.6, 1.2, 7.4), V(0.25, 0.7, 13.4)], false, 'centripetal');

export const cameraAt = (frame: number): Shot => {
  const f = frame;
  // 1 – establishing shot looking down the beam line (source at the bottom of
  //     frame, screen at the top), pushing in toward the slits.
  const wide: Shot = {pos: V(2.2, 9.5, -14.8), target: V(0, -0.35, -2.5), fov: 40};
  const slits: Shot = {pos: V(1.2, 4.2, -7.6), target: V(0, -0.1, -1.2), fov: 40};
  let shot = mix(wide, slits, w(f, 0, SCENES.source.to - 6));

  // 2 – orbit round to face the detector screen, then a slow push-in.
  const orbitT = w(f, SCENES.dots.from - 6, s(7.4), Easing.inOut(Easing.cubic));
  if (orbitT > 0) {
    const p = ORBIT.getPoint(orbitT);
    const target = V(0, -0.1, -1.2).lerp(V(0, 0.5, SCREEN_Z), Math.min(1, orbitT * 1.5));
    shot = {pos: p, target, fov: 40 - 4 * orbitT};
  }
  shot.pos.z -= 0.8 * w(f, s(7.4), SCENES.dots.to);

  // 3 – hold on the pattern while the theory curve draws, then crane up over
  //     the screen to look down on the calculated probability between slits
  //     and screen (slits at the bottom of frame, screen at the top).
  const crane: Shot = {pos: V(0.0, 13.6, -0.6), target: V(0, 0, 0.5), fov: 40};
  shot = mix(shot, crane, w(f, s(15.5), s(18.2)));

  // 4 – down to the slits, where the which-path detector switches on…
  const detectors: Shot = {pos: V(1.45, 1.75, -4.1), target: V(0, 0.15, -1.6), fov: 40};
  shot = mix(shot, detectors, w(f, SCENES.measure.from - 8, s(22.4)));
  // …then out front to watch run B build up, the earlier result beside it.
  const front: Shot = {pos: V(-0.2, 0.75, 12.8), target: V(-0.2, 0.55, SCREEN_Z), fov: 36};
  shot = mix(shot, front, w(f, s(23.9), s(25.9)));

  // 5 – a slow cinematic pull-back until both results sit side by side.
  const both: Shot = {pos: V(-1.95, 0.75, 21.0), target: V(-1.725, 0.6, SCREEN_Z), fov: 36};
  shot = mix(shot, both, w(f, SCENES.compare.from - 10, SCENES.compare.to - 20, Easing.inOut(Easing.sin)));
  return shot;
};

/** Project a world point to pixel coordinates for a given shot. */
export const project = (shot: Shot, p: THREE.Vector3, width: number, height: number) => {
  const cam = new THREE.PerspectiveCamera(shot.fov, width / height, 0.02, 80);
  cam.position.copy(shot.pos);
  cam.lookAt(shot.target);
  applyLens(cam, width, height);
  cam.updateMatrixWorld();
  const v = p.clone().project(cam);
  return {x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, visible: v.z < 1};
};
