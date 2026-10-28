import {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {mulberry32} from './math';

// The abstract "pathway world" for sequences 2 and 3. Both routes link the
// same two points: same goal, different way of getting there. This is a
// visual metaphor, not a map of real brain anatomy.

export const MAX_PULSES = 6;
export type ActivePulse = {pos: number; intensity: number};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const START = v(0, 2.2, 0);
export const END = v(0, -2.2, 0);

/** The well-worn route: one smooth, direct sweep. */
export const FAMILIAR_CURVE = new THREE.CatmullRomCurve3(
  [START, v(-0.7, 1.4, 0.3), v(-1.0, 0.3, 0.5), v(-0.85, -0.9, 0.3), v(-0.4, -1.8, 0.1), END],
  false,
  'centripetal',
);

/** The new route: longer and more winding. */
export const NEW_CURVE = new THREE.CatmullRomCurve3(
  [START, v(0.6, 1.65, -0.4), v(1.15, 0.7, -0.2), v(0.75, -0.2, 0.35), v(1.15, -1.15, 0), v(0.55, -1.9, -0.2), END],
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
  uniform float uFill;
  uniform float uGhost;
  uniform float uSeed;
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
    float revealed = 1.0 - smoothstep(uReveal - 0.01, uReveal + 0.01, x);
    // Gaps: an unpractised route is broken into fragments that join up as
    // uFill approaches 1.
    float cell = fract(x * 26.0 + uSeed);
    float gap = mix(smoothstep(uFill, uFill - 0.08, cell), 1.0, smoothstep(0.92, 1.0, uFill));
    float shimmer = 0.85 + 0.15 * sin(x * 70.0 - uTime * 5.0 + uSeed * 6.0);
    // the not-yet-travelled part is a faint, broken hint of what could be
    float steady = uBase * revealed * shimmer * gap + uGhost * (1.0 - revealed) * gap;
    float p = 0.0;
    for (int i = 0; i < ${MAX_PULSES}; i++) {
      vec2 pulse = uPulses[i];
      float d = x - pulse.x;
      float fadeOut = clamp(1.0 - (pulse.x - 1.0) * 4.0, 0.0, 1.0);
      float head = exp(-d * d * 2500.0);
      float tail = d < 0.0 ? exp(d * 10.0) * 0.5 : 0.0;
      p += pulse.y * fadeOut * (head + tail * mix(0.35, 1.0, gap));
    }
    float edge = pow(abs(dot(normalize(vNormal), normalize(-vViewPos))), uEdgePower);
    vec3 col = uColor * (steady + p * uPulseGain) + vec3(1.0) * p * p * uWhite;
    gl_FragColor = vec4(col * edge, 1.0);
  }
`;

const tubeMaterial = (color: THREE.Vector3, edgePower: number, pulseGain: number, white: number, seed: number) =>
  new THREE.ShaderMaterial({
    vertexShader: tubeVertex,
    fragmentShader: tubeFragment,
    uniforms: {
      uColor: {value: color},
      uBase: {value: 0},
      uReveal: {value: 1},
      uFill: {value: 1},
      uGhost: {value: 0},
      uSeed: {value: seed},
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

/** A strand that spirals around the route's centre line, pinched at both ends. */
const strandCurve = (curve: THREE.Curve<THREE.Vector3>, radius: number, phase: number, twist: number) => {
  const n = 160;
  const frames = curve.computeFrenetFrames(n, false);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = phase + twist * u * Math.PI * 2;
    const r = radius * Math.pow(Math.sin(Math.PI * u), 0.6);
    pts.push(
      curve
        .getPointAt(u)
        .add(frames.normals[i].clone().multiplyScalar(Math.cos(a) * r))
        .add(frames.binormals[i].clone().multiplyScalar(Math.sin(a) * r)),
    );
  }
  return new THREE.CatmullRomCurve3(pts);
};

/**
 * A route drawn as a glowing fibre bundle: a hot core, a soft halo and
 * several twisting strands. `strands` (0..N, fractional) controls how many
 * strands are lit, so a route can visibly thicken with practice.
 */
export const Bundle: React.FC<{
  curve: THREE.Curve<THREE.Vector3>;
  color: [number, number, number];
  base: number;
  reveal: number;
  fill: number;
  ghost?: number;
  strands: number;
  pulses: ActivePulse[];
  time: number;
  seed: number;
}> = ({curve, color, base, reveal, fill, ghost = 0, strands, pulses, time, seed}) => {
  const layers = useMemo(() => {
    const c = new THREE.Vector3(...color);
    const out: {geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial; strand: number}[] = [
      {geometry: new THREE.TubeGeometry(curve, 260, 0.014, 10), material: tubeMaterial(c.clone().multiplyScalar(1.3), 0.5, 1.6, 1.0, seed), strand: -1},
      {geometry: new THREE.TubeGeometry(curve, 260, 0.045, 12), material: tubeMaterial(c.clone().multiplyScalar(0.6), 1.4, 1.1, 0.2, seed), strand: -1},
      {geometry: new THREE.TubeGeometry(curve, 260, 0.16, 14), material: tubeMaterial(c.clone().multiplyScalar(0.16), 2.2, 1.0, 0, seed), strand: -1},
    ];
    for (let i = 0; i < 6; i++) {
      const sc = strandCurve(curve, 0.075 + (i % 2) * 0.025, (i / 6) * Math.PI * 2, 2.2 + (i % 3) * 0.4);
      out.push({
        geometry: new THREE.TubeGeometry(sc, 260, 0.006, 6),
        material: tubeMaterial(c.clone().multiplyScalar(0.9), 0.7, 1.2, 0.4, seed + i * 0.37),
        strand: i,
      });
    }
    return out;
  }, [curve, color, seed]);

  for (const l of layers) {
    const u = l.material.uniforms;
    // strands light up one by one as `strands` grows
    const strandOn = l.strand < 0 ? 1 : Math.min(1, Math.max(0, strands - l.strand));
    u.uBase.value = base * strandOn;
    u.uReveal.value = reveal;
    u.uFill.value = fill;
    u.uGhost.value = l.strand < 0 ? ghost : 0;
    u.uTime.value = time;
    for (let i = 0; i < MAX_PULSES; i++) {
      const p = pulses[i];
      u.uPulses.value[i].set(p ? p.pos : -10, p ? p.intensity * (l.strand < 0 ? 1 : strandOn) : 0);
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
// Background neuron field: depth-layered nodes with faint links and slow
// ambient firing, so the routes live inside a larger network.

export const FIELD: THREE.Vector3[] = (() => {
  const rand = mulberry32(2024);
  const out: THREE.Vector3[] = [];
  while (out.length < 420) {
    const p = v((rand() - 0.5) * 9, (rand() - 0.5) * 11, -rand() * 9 + 2.2);
    // keep a clear corridor around the routes
    if (Math.abs(p.x) < 1.6 && Math.abs(p.z) < 0.8 && Math.abs(p.y) < 2.6) continue;
    out.push(p);
  }
  return out;
})();

const webVertex = /* glsl */ `
  attribute float aPhase;
  attribute float aSpeed;
  varying float vU;
  varying float vPhase;
  varying float vSpeed;
  varying float vDepth;
  void main() {
    vU = uv.x;
    vPhase = aPhase;
    vSpeed = aSpeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
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
  varying float vDepth;
  void main() {
    float cyc = fract(uTime * vSpeed + vPhase) * 3.0 - 1.0;
    float d = vU - cyc;
    float pulse = exp(-d * d * 300.0) * step(-0.2, cyc) * step(cyc, 1.2);
    float ends = smoothstep(0.0, 0.2, vU) * smoothstep(1.0, 0.8, vU);
    float fog = exp(-max(vDepth - 4.0, 0.0) * 0.12);
    gl_FragColor = vec4(uColor * (0.18 * ends + pulse) * fog * uOpacity, 1.0);
  }
`;

export const FieldWeb: React.FC<{time: number; opacity: number}> = ({time, opacity}) => {
  const {geometry, material} = useMemo(() => {
    const rand = mulberry32(5);
    const parts: THREE.BufferGeometry[] = [];
    FIELD.forEach((a, i) => {
      const near = FIELD.map((b, j) => ({j, d: a.distanceTo(b)}))
        .filter((o) => o.j > i && o.d < 1.6)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      for (const {j} of near) {
        const b = FIELD[j];
        const mid = a.clone().lerp(b, 0.5).add(v(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.5));
        const tube = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 20, 0.008, 4);
        const n = tube.getAttribute('position').count;
        tube.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n).fill(rand()), 1));
        tube.setAttribute('aSpeed', new THREE.BufferAttribute(new Float32Array(n).fill(0.1 + rand() * 0.2), 1));
        parts.push(tube);
      }
    });
    return {
      geometry: mergeGeometries(parts)!,
      material: new THREE.ShaderMaterial({
        vertexShader: webVertex,
        fragmentShader: webFragment,
        uniforms: {uColor: {value: new THREE.Vector3(0.16, 0.42, 1.0)}, uTime: {value: 0}, uOpacity: {value: 1}},
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    };
  }, []);
  material.uniforms.uTime.value = time;
  material.uniforms.uOpacity.value = opacity;
  return <mesh geometry={geometry} material={material} renderOrder={4} />;
};
