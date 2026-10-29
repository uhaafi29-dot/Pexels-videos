import {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {mulberry32} from './math';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Background neural web: many faint connections with slow ambient firing.

const insideBrain = (p: THREE.Vector3) => {
  const side = p.x >= 0 ? 1 : -1;
  const lx = (p.x - side * 0.3) / 0.5;
  const ly = p.y / 0.6;
  const lz = p.z / 0.9;
  return Math.abs(p.x) > 0.1 && lx * lx + ly * ly + lz * lz < 1;
};

export const NEURONS: THREE.Vector3[] = (() => {
  const rand = mulberry32(42);
  const out: THREE.Vector3[] = [];
  while (out.length < 260) {
    const p = v(rand() * 1.8 - 0.9, rand() * 1.4 - 0.7, rand() * 2 - 1);
    if (insideBrain(p)) out.push(p);
  }
  return out;
})();

const webVertex = /* glsl */ `
  attribute float aPhase;
  attribute float aSpeed;
  varying float vU;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vU = uv.x;
    vPhase = aPhase;
    vSpeed = aSpeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const webFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying float vU;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    // Each connection fires once per cycle; most of the cycle it rests.
    float cyc = fract(uTime * vSpeed + vPhase) * 3.0 - 1.0;
    float d = vU - cyc;
    float pulse = exp(-d * d * 300.0) + (d < 0.0 ? exp(d * 12.0) * 0.3 : 0.0);
    pulse *= step(-0.2, cyc) * step(cyc, 1.2);
    float edge = abs(dot(normalize(vNormal), normalize(-vViewPos)));
    float ends = smoothstep(0.0, 0.15, vU) * smoothstep(1.0, 0.85, vU);
    vec3 col = uColor * (0.22 * ends + pulse * 1.4);
    gl_FragColor = vec4(col * edge * uOpacity, 1.0);
  }
`;

export const NeuralWeb: React.FC<{time: number; opacity: number}> = ({time, opacity}) => {
  const {geometry, material} = useMemo(() => {
    const rand = mulberry32(7);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < NEURONS.length; i++) {
      const a = NEURONS[i];
      // connect to the two nearest neighbours to keep the web local and organic
      const near = NEURONS.map((b, j) => ({j, d: a.distanceTo(b)}))
        .filter((o) => o.j > i && o.d < 0.42)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      for (const {j} of near) {
        const b = NEURONS[j];
        const mid = a.clone().lerp(b, 0.5).add(v(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.15));
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const tube = new THREE.TubeGeometry(curve, 24, 0.0035, 5, false);
        const count = tube.getAttribute('position').count;
        const phase = rand();
        const speed = 0.08 + rand() * 0.18;
        tube.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(count).fill(phase), 1));
        tube.setAttribute('aSpeed', new THREE.BufferAttribute(new Float32Array(count).fill(speed), 1));
        parts.push(tube);
      }
    }
    const g = mergeGeometries(parts)!;
    const m = new THREE.ShaderMaterial({
      vertexShader: webVertex,
      fragmentShader: webFragment,
      uniforms: {
        uColor: {value: new THREE.Vector3(0.18, 0.45, 1.0)},
        uTime: {value: 0},
        uOpacity: {value: 1},
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return {geometry: g, material: m};
  }, []);
  material.uniforms.uTime.value = time;
  material.uniforms.uOpacity.value = opacity;
  return <mesh geometry={geometry} material={material} renderOrder={4} />;
};
