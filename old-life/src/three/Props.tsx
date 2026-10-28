import {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {noise3} from './math';
import {useGltf} from './assets';

// Small building blocks for the two rooms: soft furniture, devices, glass.

export const rbox = (w: number, h: number, d: number, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);

export const mat = (color: THREE.ColorRepresentation, roughness = 0.7, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({color, roughness, metalness: 0, ...extra});

export const fabric = (color: THREE.ColorRepresentation) =>
  new THREE.MeshPhysicalMaterial({color, roughness: 0.92, sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.4)});

/** A soft rumpled cover: a dense plane draped over a box with noise folds. */
export const duvetGeometry = (w: number, l: number, drop: number, seed: number, rumple = 1) => {
  const g = new THREE.PlaneGeometry(w + 2 * drop, l + drop, 90, 110);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    // fold the overhanging edges down the sides of the mattress
    const ox = Math.max(0, Math.abs(x) - w / 2);
    const oz = Math.max(0, z - (l / 2 - drop / 2));
    let y = 0;
    let nx = x;
    let nz = z;
    if (ox > 0) {
      y -= ox;
      nx = Math.sign(x) * (w / 2 + 0.015 + ox * 0.08);
    }
    if (oz > 0) {
      y -= oz;
      nz = l / 2 - drop / 2 + 0.015 + oz * 0.08;
    }
    const n = noise3(x * 2.2 + seed, z * 1.6, seed) * 0.045 + noise3(x * 6 + seed, z * 5, 3 + seed) * 0.012;
    const ridge = Math.max(0, Math.sin(z * 4.3 + noise3(x, z, seed) * 3)) ** 3 * 0.03;
    p.setXYZ(i, nx, y + (n + ridge) * rumple * (ox > 0 || oz > 0 ? 0.4 : 1), nz);
  }
  g.computeVertexNormals();
  return g;
};

export const Bed: React.FC<{
  w: number;
  l: number;
  top: number;
  frame: THREE.Material;
  sheet: THREE.Material;
  pillow: THREE.Material;
  seed?: number;
  rumple?: number;
}> = ({w, l, top, frame, sheet, pillow, seed = 1, rumple = 1}) => {
  const g = useMemo(
    () => ({
      base: rbox(w + 0.08, top - 0.2, l + 0.06, 0.03),
      mattress: rbox(w, 0.22, l, 0.07, 4),
      head: rbox(w + 0.2, 1.05, 0.09, 0.03),
      pillow: rbox(0.62, 0.14, 0.42, 0.07, 4),
      duvet: duvetGeometry(w, l * 0.72, 0.28, seed, rumple),
    }),
    [w, l, top, seed, rumple],
  );
  return (
    <group>
      <mesh geometry={g.base} material={frame} position={[0, (top - 0.2) / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.mattress} material={sheet} position={[0, top - 0.11, 0]} castShadow receiveShadow />
      <mesh geometry={g.head} material={frame} position={[0, top + 0.3, -l / 2 - 0.02]} castShadow receiveShadow />
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} geometry={g.pillow} material={pillow} position={[x * (w / 1.6), top + 0.06, -l / 2 + 0.3]} rotation={[0.25, x * 0.1, 0]} castShadow receiveShadow />
      ))}
      <mesh geometry={g.duvet} material={sheet} position={[0, top + 0.03, l * 0.14]} castShadow receiveShadow />
    </group>
  );
};

/** Digital clock face rendered to a canvas texture (deterministic text). */
const clockTextures = new Map<string, THREE.CanvasTexture>();
export const clockTexture = (text: string, color: string) => {
  const key = text + color;
  if (!clockTextures.has(key)) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, 256, 96);
    ctx.font = '600 70px "Inter", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 52);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    clockTextures.set(key, t);
  }
  return clockTextures.get(key)!;
};

export const Clock: React.FC<{text: string; glow: number}> = ({text, glow}) => {
  const body = useMemo(() => ({g: rbox(0.17, 0.075, 0.07, 0.015), m: mat('#14171c', 0.4)}), []);
  const face = useMemo(() => new THREE.MeshBasicMaterial({toneMapped: false}), []);
  face.map = clockTexture(text, '#ff9f6b');
  face.color.setScalar(0.6 + glow);
  return (
    <group>
      <mesh geometry={body.g} material={body.m} position={[0, 0.0375, 0]} castShadow />
      <mesh position={[0, 0.0375, 0.0352]}>
        <planeGeometry args={[0.14, 0.05]} />
        <primitive object={face} attach="material" />
      </mesh>
    </group>
  );
};

export const Phone: React.FC<{screen: number}> = ({screen}) => {
  const parts = useMemo(
    () => ({
      body: rbox(0.075, 0.009, 0.155, 0.004),
      bodyMat: mat('#0b0d10', 0.25, {clearcoat: 1, clearcoatRoughness: 0.05}),
      screenMat: new THREE.MeshBasicMaterial({color: '#a9d6ff', toneMapped: false}),
    }),
    [],
  );
  parts.screenMat.color.setRGB(0.55 * screen, 0.8 * screen, 1.0 * screen);
  return (
    <group>
      <mesh geometry={parts.body} material={parts.bodyMat} position={[0, 0.0045, 0]} castShadow />
      <mesh material={parts.screenMat} position={[0, 0.0095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.066, 0.142]} />
      </mesh>
      {screen > 0.05 ? <pointLight color="#9cc9ff" intensity={0.35 * screen} distance={1.6} decay={2} position={[0, 0.08, 0]} /> : null}
    </group>
  );
};

export const Lamp: React.FC<{on: number}> = ({on}) => {
  const parts = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(0.06, 0.08, 0.04, 32),
      stem: new THREE.CylinderGeometry(0.008, 0.008, 0.32, 12),
      shade: new THREE.CylinderGeometry(0.1, 0.14, 0.18, 40, 1, true),
      metal: mat('#3b3f45', 0.35, {metalness: 0.8}),
      shadeMat: new THREE.MeshPhysicalMaterial({color: '#e8dccb', roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color('#ffb067'), emissiveIntensity: 0}),
    }),
    [],
  );
  parts.shadeMat.emissiveIntensity = on * 1.6;
  return (
    <group>
      <mesh geometry={parts.base} material={parts.metal} position={[0, 0.02, 0]} castShadow />
      <mesh geometry={parts.stem} material={parts.metal} position={[0, 0.2, 0]} castShadow />
      <mesh geometry={parts.shade} material={parts.shadeMat} position={[0, 0.4, 0]} castShadow />
      {on > 0.02 ? <pointLight color="#ffb46e" intensity={2.2 * on} distance={4} decay={2} position={[0, 0.38, 0]} castShadow={false} /> : null}
    </group>
  );
};

/** A loaded glTF model, cloned so it can be placed more than once. */
export const Model: React.FC<{file: string; scale?: number; shadow?: boolean} & JSX.IntrinsicElements['group']> = ({file, scale = 1, shadow = true, ...rest}) => {
  const gltf = useGltf(file);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = shadow;
        m.receiveShadow = true;
      }
    });
    return o;
  }, [gltf, shadow]);
  return (
    <group {...rest}>
      <primitive object={obj} scale={scale} />
    </group>
  );
};
