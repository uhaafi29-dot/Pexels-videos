import {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {Thread} from '../story';

// Luminous threads between environmental cues and the figure: a VISUAL
// METAPHOR for learned cue → behaviour associations, not neural wiring.

const vertex = /* glsl */ `
  varying float vU;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vU = uv.x;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uReveal;
  uniform float uIntensity;
  uniform float uPulse;
  uniform float uFlicker;
  uniform float uTime;
  uniform float uSeed;
  uniform float uEdge;
  varying float vU;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float shown = 1.0 - smoothstep(uReveal - 0.04, uReveal, vU);
    // a weakening association breaks up and flickers
    float dash = mix(1.0, step(fract(vU * 34.0 + uSeed), 1.0 - 0.55 * uFlicker), step(0.01, uFlicker));
    float flick = 1.0 - uFlicker * 0.5 * (0.5 + 0.5 * sin(uTime * 11.0 + uSeed * 40.0));
    float flow = 0.75 + 0.25 * sin(vU * 30.0 - uTime * 3.0 + uSeed * 9.0);
    float d = vU - uPulse;
    float pulse = uPulse < 0.0 ? 0.0 : exp(-d * d * 400.0) * 2.5;
    float edge = pow(abs(dot(normalize(vN), normalize(-vV))), uEdge);
    vec3 col = uColor * (flow + pulse) * uIntensity * shown * dash * flick * edge;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const COLORS = {teal: new THREE.Color(0.25, 0.95, 0.85), gold: new THREE.Color(1.0, 0.72, 0.38)};

const ThreadMesh: React.FC<{a: THREE.Vector3; b: THREE.Vector3; t: Thread; time: number; seed: number}> = ({a, b, t, time, seed}) => {
  const geos = useMemo(() => {
    const mid = a.clone().lerp(b, 0.5);
    const len = a.distanceTo(b);
    mid.y += 0.1 + len * 0.18;
    mid.x += Math.sin(seed * 7) * 0.12 * len;
    const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).add(new THREE.Vector3(0, 0.05, 0)), mid, mid.clone().lerp(b, 0.5), b], false, 'centripetal');
    return [new THREE.TubeGeometry(curve, 80, 0.0045, 6), new THREE.TubeGeometry(curve, 80, 0.018, 8)];
  }, [a, b, seed]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  const mats = useMemo(
    () =>
      [1.4, 0.35].map(
        (gain, i) =>
          new THREE.ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            uniforms: {
              uColor: {value: new THREE.Color()},
              uReveal: {value: 0},
              uIntensity: {value: 0},
              uPulse: {value: -1},
              uFlicker: {value: 0},
              uTime: {value: 0},
              uSeed: {value: seed},
              uEdge: {value: i === 0 ? 0.4 : 2.0},
              uGain: {value: gain},
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [seed],
  );
  mats.forEach((m, i) => {
    m.uniforms.uColor.value.copy(COLORS[t.color]).multiplyScalar(i === 0 ? 1.0 : 0.22);
    m.uniforms.uReveal.value = t.reveal;
    m.uniforms.uIntensity.value = t.intensity;
    m.uniforms.uPulse.value = t.pulse;
    m.uniforms.uFlicker.value = t.flicker;
    m.uniforms.uTime.value = time;
  });
  if (t.reveal <= 0.001 || t.intensity <= 0.001) return null;
  return (
    <group>
      <mesh geometry={geos[0]} material={mats[0]} renderOrder={30} />
      <mesh geometry={geos[1]} material={mats[1]} renderOrder={31} />
    </group>
  );
};

export const Threads: React.FC<{threads: Thread[]; chest: THREE.Vector3; time: number}> = ({threads, chest, time}) => (
  <>
    {threads.map((t, i) => {
      // loose threads start at the figure and reach out into empty space
      const a = t.loose ? chest.clone() : t.from;
      const b = t.loose ? chest.clone().add(t.from) : chest;

      return <ThreadMesh key={`${t.key}-${i}`} a={a} b={b} t={t} time={time} seed={i * 0.73 + 0.1} />;
    })}
  </>
);
