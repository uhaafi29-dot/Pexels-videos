import {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {mulberry32} from './math';

export const MAX_PULSES = 4;

export type ActivePulse = {pos: number; intensity: number};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Both routes connect the same two "neurons" – same starting point, same goal,
// different way of getting there. Coordinates are in brain space (+z = front).
export const START = v(0.52, 0.52, 0.12);
export const END = v(0.6, -0.32, -0.12);

// Familiar route arcs toward the front, the new route toward the back.
export const FAMILIAR_CURVE = new THREE.CatmullRomCurve3(
  [START, v(0.6, 0.42, 0.38), v(0.66, 0.18, 0.5), v(0.68, -0.06, 0.42), v(0.66, -0.24, 0.18), END],
  false,
  'centripetal',
);

export const NEW_CURVE = new THREE.CatmullRomCurve3(
  [START, v(0.56, 0.5, -0.18), v(0.62, 0.3, -0.42), v(0.66, 0.04, -0.52), v(0.66, -0.2, -0.4), END],
  false,
  'centripetal',
);

const tubeVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const tubeFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBase;
  uniform float uReveal;
  uniform float uGhost;
  uniform float uTime;
  uniform float uEdgePower;
  uniform float uPulseGain;
  uniform float uWhite;
  uniform vec2 uPulses[${MAX_PULSES}];
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    float x = vUv.x;
    float revealed = 1.0 - smoothstep(uReveal - 0.015, uReveal + 0.015, x);
    float shimmer = 0.85 + 0.15 * sin(x * 60.0 - uTime * 4.0);
    float steady = uBase * revealed * shimmer + uGhost * (1.0 - revealed);
    float p = 0.0;
    for (int i = 0; i < ${MAX_PULSES}; i++) {
      vec2 pulse = uPulses[i];
      float d = x - pulse.x;
      float fadeOut = clamp(1.0 - (pulse.x - 1.0) * 4.0, 0.0, 1.0);
      float head = exp(-d * d * 2200.0);
      float tail = d < 0.0 ? exp(d * 9.0) * 0.55 : 0.0;
      p += pulse.y * fadeOut * (head + tail);
    }
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    float edge = pow(abs(dot(n, v)), uEdgePower);
    vec3 col = uColor * (steady + p * uPulseGain) + vec3(1.0) * p * p * uWhite;
    gl_FragColor = vec4(col * edge, 1.0);
  }
`;

const makeTubeMaterial = (color: THREE.Vector3, edgePower: number, pulseGain: number, white: number) =>
  new THREE.ShaderMaterial({
    vertexShader: tubeVertex,
    fragmentShader: tubeFragment,
    uniforms: {
      uColor: {value: color},
      uBase: {value: 0},
      uReveal: {value: 1},
      uGhost: {value: 0},
      uTime: {value: 0},
      uEdgePower: {value: edgePower},
      uPulseGain: {value: pulseGain},
      uWhite: {value: white},
      uPulses: {value: Array.from({length: MAX_PULSES}, () => new THREE.Vector2(-10, 0))},
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

export const RouteTube: React.FC<{
  curve: THREE.Curve<THREE.Vector3>;
  color: [number, number, number];
  base: number;
  reveal: number;
  ghost: number;
  pulses: ActivePulse[];
  time: number;
}> = ({curve, color, base, reveal, ghost, pulses, time}) => {
  const layers = useMemo(() => {
    const c = new THREE.Vector3(...color);
    return [
      // radius, material: hot core, inner glow, wide haze
      {radius: 0.01, material: makeTubeMaterial(c.clone().multiplyScalar(1.3), 0.5, 1.5, 1.0)},
      {radius: 0.03, material: makeTubeMaterial(c.clone().multiplyScalar(0.7), 1.4, 1.1, 0.2)},
      {radius: 0.095, material: makeTubeMaterial(c.clone().multiplyScalar(0.22), 2.2, 1.0, 0)},
    ].map((l) => ({...l, geometry: new THREE.TubeGeometry(curve, 220, l.radius, 12, false)}));
  }, [curve, color]);

  for (const l of layers) {
    const u = l.material.uniforms;
    u.uBase.value = base;
    u.uReveal.value = reveal;
    u.uGhost.value = ghost;
    u.uTime.value = time;
    for (let i = 0; i < MAX_PULSES; i++) {
      const p = pulses[i];
      u.uPulses.value[i].set(p ? p.pos : -10, p ? p.intensity : 0);
    }
  }
  return (
    <group>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.geometry} material={l.material} renderOrder={5 + i} />
      ))}
    </group>
  );
};

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
