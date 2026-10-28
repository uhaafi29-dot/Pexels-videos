import {useMemo} from 'react';
import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {noise3} from './math';

// A procedural, stylised "glass" brain. Not anatomically exact – it only has
// to read as a brain: two hemispheres with folds, a cerebellum and a stem.

const sculpt = (
  detail: number,
  shape: (dir: THREE.Vector3) => {pos: THREE.Vector3; groove: number; dim?: number},
) => {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const grooves = new Float32Array(pos.count);
  const dims = new Float32Array(pos.count);
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const out = shape(dir);
    pos.setXYZ(i, out.pos.x, out.pos.y, out.pos.z);
    grooves[i] = out.groove;
    dims[i] = out.dim ?? 1;
  }
  geo.setAttribute('aGroove', new THREE.BufferAttribute(grooves, 1));
  geo.setAttribute('aDim', new THREE.BufferAttribute(dims, 1));
  geo.computeVertexNormals();
  return geo;
};

const hemisphere = (side: 1 | -1) =>
  sculpt(70, (d) => {
    // Meandering grooves along noise zero-crossings read as sulci.
    const o = side * 11.3;
    const n = noise3(d.x * 3.1 + o, d.y * 3.1, d.z * 3.1) + 0.45 * noise3(d.x * 6.7, d.y * 6.7 + o, d.z * 6.7);
    let groove = Math.pow(1 - Math.min(1, Math.abs(n) * 2.2), 5);
    // Lateral (Sylvian-like) fissure for a recognisable silhouette.
    const fissure = Math.exp(-Math.pow((d.y + 0.05 + 0.32 * d.z) * 9, 2)) * Math.max(0, d.x * side) * (d.z > -0.5 ? 1 : 0);
    groove = Math.max(groove, fissure);
    // Longitudinal fissure: medial side flattened.
    let x = d.x;
    if (x * side < 0) x *= 0.32;
    let y = d.y;
    if (y < 0) y *= 0.72;
    const z = d.z;
    const r = 1 - 0.065 * groove;
    const pos = new THREE.Vector3(
      x * 0.6 * (1 - 0.1 * z),
      y * 0.72 * (1 - 0.1 * Math.max(0, z)) + 0.05 * z,
      z * 1.0,
    ).multiplyScalar(r);
    pos.x += side * 0.27;
    // The flat medial wall would otherwise draw a hard rim through the middle.
    const dim = 1 - 0.85 * Math.min(1, Math.max(0, -d.x * side * 3));
    return {pos, groove, dim};
  });

const cerebellum = () =>
  sculpt(40, (d) => {
    const folia = Math.pow(Math.abs(Math.sin(d.y * 22 + noise3(d.x * 3, d.y * 3, d.z * 3) * 1.5)), 6);
    const r = 1 - 0.05 * folia;
    const pos = new THREE.Vector3(d.x * 0.52, d.y * 0.26, d.z * 0.36).multiplyScalar(r);
    pos.add(new THREE.Vector3(0, -0.42, -0.62));
    return {pos, groove: folia, dim: 0.55};
  });

const stem = () =>
  sculpt(24, (d) => {
    const taper = 1 - 0.35 * Math.max(0, -d.y);
    const pos = new THREE.Vector3(d.x * 0.14 * taper, d.y * 0.36, d.z * 0.14 * taper);
    pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.3);
    pos.add(new THREE.Vector3(0, -0.6, -0.28));
    // fade the lower end so the stem dissolves instead of ending in a point
    return {pos, groove: 0, dim: 0.3 * Math.min(1, Math.max(0, d.y + 0.9))};
  });

const vertex = /* glsl */ `
  attribute float aGroove;
  attribute float aDim;
  varying float vDim;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocal;
  varying float vGroove;
  void main() {
    vGroove = aGroove;
    vDim = aDim;
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform float uOpacity;
  uniform float uSweep;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocal;
  varying float vGroove;
  varying float vDim;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    float facing = abs(dot(n, v));
    float fres = pow(1.0 - facing, 2.4);
    float groove = smoothstep(0.25, 0.95, vGroove);
    // Soft key light from upper right gives the folds some relief.
    float key = pow(max(dot(n, normalize(vec3(0.5, 0.8, 0.4))), 0.0), 2.0);
    // A slow band of light scanning through the tissue.
    float band = vLocal.y * 0.9 + vLocal.z * 0.35;
    float sweep = exp(-pow((band - uSweep) * 4.0, 2.0));
    float breathe = 0.92 + 0.08 * sin(uTime * 1.3 + vLocal.z * 3.0);
    vec3 col = uDeep * 0.06
      + uColor * fres * 0.95
      + uColor * groove * (0.12 + 0.35 * fres)
      + uColor * key * 0.07
      + uColor * sweep * (0.10 + 0.45 * groove);
    gl_FragColor = vec4(col * uOpacity * breathe * vDim, 1.0);
  }
`;

export const BrainShell: React.FC<{time: number; sweep: number; opacity: number}> = ({time, sweep, opacity}) => {
  const geometries = useMemo(() => [hemisphere(1), hemisphere(-1), cerebellum(), stem()], []);
  const [front, back] = useMemo(() => {
    const make = (side: THREE.Side, scale: number) =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uColor: {value: new THREE.Vector3(0.22, 0.55, 1.0).multiplyScalar(scale)},
          uDeep: {value: new THREE.Vector3(0.05, 0.18, 0.5)},
          uOpacity: {value: 1},
          uSweep: {value: 0},
          uTime: {value: 0},
        },
        side,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    return [make(THREE.FrontSide, 1), make(THREE.BackSide, 0.45)];
  }, []);
  for (const m of [front, back]) {
    m.uniforms.uTime.value = time;
    m.uniforms.uSweep.value = sweep;
    m.uniforms.uOpacity.value = opacity;
  }
  return (
    <group>
      {geometries.map((g, i) => (
        <group key={i}>
          <mesh geometry={g} material={back} renderOrder={1} />
          <mesh geometry={g} material={front} renderOrder={2} />
        </group>
      ))}
    </group>
  );
};
