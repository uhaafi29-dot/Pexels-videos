import {useMemo} from 'react';
import * as THREE from 'three';
import {BARRIER_Z, GUN_Z, SCREEN_Z, SLIT_X} from '../camera';
import {SCREEN_H, SCREEN_W} from '../physics';

// The experimental apparatus: electron source, double-slit barrier, detector
// screen(s) and the which-path detector. Precise and clean, like a diagram
// built in light.

export const CYAN: [number, number, number] = [0.32, 0.86, 1.0];
export const BLUE: [number, number, number] = [0.15, 0.45, 1.0];

// --- Materials ----------------------------------------------------------------

const panelVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;
const panelFragment = /* glsl */ `
  uniform vec3 uFill;
  uniform vec3 uRim;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(-vViewPos)));
    float rim = pow(1.0 - facing, 3.0);
    vec3 col = uFill + uRim * rim;
    gl_FragColor = vec4(col, uOpacity);
  }
`;
/** Dark, slightly glassy solid with a cool rim light. */
const panelMaterial = (opacity: number, rim = 0.35) =>
  new THREE.ShaderMaterial({
    vertexShader: panelVertex,
    fragmentShader: panelFragment,
    uniforms: {
      uFill: {value: new THREE.Vector3(0.02, 0.05, 0.11)},
      uRim: {value: new THREE.Vector3(0.16, 0.5, 0.95).multiplyScalar(rim / 0.35)},
      uOpacity: {value: opacity},
    },
    transparent: true,
    depthWrite: false,
  });

const glowLineMaterial = (color: [number, number, number], intensity: number) =>
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(color[0] * intensity, color[1] * intensity, color[2] * intensity),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

/** Thin glowing outline of an axis-aligned rectangle in the XY plane. */
const rectOutline = (w: number, h: number, r: number) => {
  const pts = [
    new THREE.Vector3(-w / 2, -h / 2, 0),
    new THREE.Vector3(w / 2, -h / 2, 0),
    new THREE.Vector3(w / 2, h / 2, 0),
    new THREE.Vector3(-w / 2, h / 2, 0),
    new THREE.Vector3(-w / 2, -h / 2, 0),
  ];
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < 4; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, 64, r, 6, true);
};

// --- Electron source --------------------------------------------------------------

export const ElectronGun: React.FC<{flicker: number; opacity: number}> = ({flicker, opacity}) => {
  const parts = useMemo(() => {
    const body = new THREE.CylinderGeometry(0.34, 0.4, 1.5, 48, 1);
    body.rotateX(Math.PI / 2);
    const nozzle = new THREE.CylinderGeometry(0.1, 0.2, 0.4, 32, 1);
    nozzle.rotateX(Math.PI / 2);
    const ring = new THREE.TorusGeometry(0.38, 0.012, 8, 64);
    return {body, nozzle, ring, panel: panelMaterial(0.92, 0.55), glow: glowLineMaterial(CYAN, 0.9)};
  }, []);
  parts.panel.uniforms.uOpacity.value = 0.92 * opacity;
  parts.glow.opacity = opacity;
  return (
    <group position={[0, 0, GUN_Z]}>
      <mesh geometry={parts.body} material={parts.panel} renderOrder={2} />
      <mesh geometry={parts.nozzle} material={parts.panel} position={[0, 0, 0.95]} renderOrder={2} />
      {[-0.45, -0.15, 0.15, 0.45].map((z, i) => (
        <mesh key={i} geometry={parts.ring} material={parts.glow} position={[0, 0, z]} scale={1 + flicker * 0.04} renderOrder={3} />
      ))}
    </group>
  );
};

export const NOZZLE = new THREE.Vector3(0, 0, GUN_Z + 1.18);

// --- Optical bench: a rail with tick marks under the beam line ------------------------------

export const Bench: React.FC = () => {
  const parts = useMemo(() => {
    const rail = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, -1.35, GUN_Z - 1), new THREE.Vector3(0, -1.35, SCREEN_Z + 0.6)), 4, 0.01, 6);
    const ticks: THREE.BufferGeometry[] = [];
    for (let z = Math.ceil(GUN_Z - 1); z <= SCREEN_Z + 0.5; z += 0.5) {
      ticks.push(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-0.12, -1.35, z), new THREE.Vector3(0.12, -1.35, z)), 2, 0.005, 4).translate(0, 0, 0));
    }
    const beam = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, GUN_Z + 1.2), new THREE.Vector3(0, 0, SCREEN_Z)), 4, 0.004, 4);
    return {rail, ticks, beam, mat: glowLineMaterial(BLUE, 0.6), beamMat: glowLineMaterial(BLUE, 0.22)};
  }, []);
  return (
    <group>
      <mesh geometry={parts.rail} material={parts.mat} renderOrder={1} />
      {parts.ticks.map((t, i) => (
        <mesh key={i} geometry={t} material={parts.mat} renderOrder={1} />
      ))}
      <mesh geometry={parts.beam} material={parts.beamMat} renderOrder={1} />
    </group>
  );
};

// --- Double-slit barrier ---------------------------------------------------------------

const BARRIER_W = 3.0;
const BARRIER_H = 2.3;
const SLIT_W = 0.06;
const SLIT_H = 1.45;

export const Barrier: React.FC<{opacity: number}> = ({opacity}) => {
  const parts = useMemo(() => {
    const t = 0.06;
    const boxes: {geo: THREE.BufferGeometry; pos: [number, number, number]}[] = [];
    const sideW = BARRIER_W / 2 - SLIT_X - SLIT_W / 2;
    const midW = 2 * SLIT_X - SLIT_W;
    const capH = (BARRIER_H - SLIT_H) / 2;
    boxes.push({geo: new THREE.BoxGeometry(sideW, SLIT_H, t), pos: [-(SLIT_X + SLIT_W / 2 + sideW / 2), 0, 0]});
    boxes.push({geo: new THREE.BoxGeometry(sideW, SLIT_H, t), pos: [SLIT_X + SLIT_W / 2 + sideW / 2, 0, 0]});
    boxes.push({geo: new THREE.BoxGeometry(midW, SLIT_H, t), pos: [0, 0, 0]});
    boxes.push({geo: new THREE.BoxGeometry(BARRIER_W, capH, t), pos: [0, SLIT_H / 2 + capH / 2, 0]});
    boxes.push({geo: new THREE.BoxGeometry(BARRIER_W, capH, t), pos: [0, -(SLIT_H / 2 + capH / 2), 0]});
    return {
      boxes,
      panel: panelMaterial(0.9),
      slit: rectOutline(SLIT_W, SLIT_H, 0.006),
      frame: rectOutline(BARRIER_W, BARRIER_H, 0.007),
      glow: glowLineMaterial(CYAN, 1.6),
      dim: glowLineMaterial(BLUE, 0.7),
    };
  }, []);
  parts.panel.uniforms.uOpacity.value = 0.9 * opacity;
  parts.glow.opacity = opacity;
  parts.dim.opacity = opacity;
  return (
    <group position={[0, 0, BARRIER_Z]}>
      {parts.boxes.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={parts.panel} position={b.pos} renderOrder={2} />
      ))}
      <mesh geometry={parts.frame} material={parts.dim} position={[0, 0, 0.035]} renderOrder={3} />
      {[-SLIT_X, SLIT_X].map((x) => (
        <mesh key={x} geometry={parts.slit} material={parts.glow} position={[x, 0, 0.035]} renderOrder={3} />
      ))}
    </group>
  );
};

// --- Which-path detector (idealised) ------------------------------------------------------

export const WhichPathDetector: React.FC<{on: number; flashL: number; flashR: number}> = ({on, flashL, flashR}) => {
  const parts = useMemo(() => {
    const ring = new THREE.TorusGeometry(0.13, 0.014, 10, 48);
    ring.scale(0.6, 1.0, 1.0);
    const housing = new THREE.BoxGeometry(0.22, 0.16, 0.16);
    return {ring, housing, panel: panelMaterial(0.9, 0.6), L: glowLineMaterial(CYAN, 1), R: glowLineMaterial(CYAN, 1)};
  }, []);
  parts.panel.uniforms.uOpacity.value = 0.9 * on;
  parts.L.color.setRGB(CYAN[0] * (0.5 + 2.5 * flashL), CYAN[1] * (0.5 + 2.5 * flashL), CYAN[2] * (0.5 + 2.5 * flashL));
  parts.R.color.setRGB(CYAN[0] * (0.5 + 2.5 * flashR), CYAN[1] * (0.5 + 2.5 * flashR), CYAN[2] * (0.5 + 2.5 * flashR));
  parts.L.opacity = on;
  parts.R.opacity = on;
  if (on <= 0) return null;
  return (
    <group position={[0, 0, BARRIER_Z + 0.12]} scale={0.6 + 0.4 * on}>
      {[
        [-SLIT_X, parts.L],
        [SLIT_X, parts.R],
      ].map(([x, m]) => (
        <group key={x as number} position={[x as number, 0, 0]}>
          <mesh geometry={parts.ring} material={m as THREE.Material} renderOrder={4} />
          <mesh geometry={parts.housing} material={parts.panel} position={[0, SLIT_H / 2 + 0.12, 0]} renderOrder={2} />
          <mesh geometry={parts.ring} material={m as THREE.Material} position={[0, SLIT_H / 2 + 0.12, 0.09]} scale={0.35} renderOrder={4} />
        </group>
      ))}
    </group>
  );
};

// --- Detector screen with accumulated hits ----------------------------------------------------

const hitVertex = /* glsl */ `
  attribute float aBirth;
  uniform float uFrame;
  uniform float uPixelsPerUnit;
  varying float vFlash;
  varying float vAlive;
  void main() {
    float age = uFrame - aBirth;
    vAlive = step(0.0, age);
    vFlash = vAlive * exp(-max(age, 0.0) / 5.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = (0.014 + 0.05 * vFlash) * vAlive;
    gl_PointSize = size * uPixelsPerUnit / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const hitFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGain;
  varying float vFlash;
  varying float vAlive;
  void main() {
    if (vAlive < 0.5) discard;
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 7.0);
    vec3 col = mix(uColor, vec3(1.0), 0.3 + 0.5 * vFlash) * core * (uGain + 1.6 * vFlash);
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }
`;

export const DetectorScreen: React.FC<{
  xs: Float32Array;
  ys: Float32Array;
  births: Float32Array;
  frame: number;
  pixelsPerUnit: number;
  x: number;
  opacity: number;
  curve: (x: number) => number;
  curveReveal: number;
  curveMax: number;
}> = ({xs, ys, births, frame, pixelsPerUnit, x, opacity, curve, curveReveal, curveMax}) => {
  const parts = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(xs.length * 3);
    for (let i = 0; i < xs.length; i++) {
      pos[i * 3] = xs[i];
      pos[i * 3 + 1] = ys[i];
      pos[i * 3 + 2] = 0.02;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aBirth', new THREE.BufferAttribute(births, 1));
    const hits = new THREE.ShaderMaterial({
      vertexShader: hitVertex,
      fragmentShader: hitFragment,
      uniforms: {
        uFrame: {value: 0},
        uPixelsPerUnit: {value: 1},
        uColor: {value: new THREE.Vector3(...CYAN)},
        uOpacity: {value: 1},
        uGain: {value: 0.55},
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    // the theory curve drawn above the screen, kept separate from the hits
    const n = 240;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const x = -SCREEN_W / 2 + (i / n) * SCREEN_W;
      pts.push(new THREE.Vector3(x, SCREEN_H / 2 + 0.16 + 0.62 * (curve(x) / curveMax), 0.02));
    }
    const curveGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 480, 0.008, 6);
    const baseline = new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(-SCREEN_W / 2, SCREEN_H / 2 + 0.16, 0.02), new THREE.Vector3(SCREEN_W / 2, SCREEN_H / 2 + 0.16, 0.02)),
      8,
      0.004,
      4,
    );
    return {
      hitsGeo: g,
      hits,
      backing: new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
      backingMat: new THREE.MeshBasicMaterial({color: new THREE.Color(0.006, 0.014, 0.035), transparent: true, opacity: 0.97, depthWrite: false}),
      frame: rectOutline(SCREEN_W, SCREEN_H, 0.008),
      frameMat: glowLineMaterial(BLUE, 0.8),
      curveGeo,
      baseline,
      curveMat: new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `varying float vX; void main(){ vX = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: /* glsl */ `uniform float uReveal; uniform float uOpacity; varying float vX;
          void main(){ float on = 1.0 - smoothstep(uReveal - 0.01, uReveal, vX); gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * 1.3 * on * uOpacity, 1.0);} `,
        uniforms: {uReveal: {value: 0}, uOpacity: {value: 1}},
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
      baseMat: glowLineMaterial([1.0, 0.86, 0.55], 0.35),
    };
  }, [xs, ys, births, curve, curveMax]);

  parts.hits.uniforms.uFrame.value = frame;
  parts.hits.uniforms.uPixelsPerUnit.value = pixelsPerUnit;
  parts.hits.uniforms.uOpacity.value = opacity;
  parts.backingMat.opacity = 0.97 * opacity;
  parts.frameMat.opacity = opacity;
  parts.curveMat.uniforms.uReveal.value = curveReveal;
  parts.curveMat.uniforms.uOpacity.value = opacity;
  parts.baseMat.opacity = Math.min(1, curveReveal * 4) * opacity;
  if (opacity <= 0) return null;
  return (
    <group position={[x, 0, SCREEN_Z]}>
      <mesh geometry={parts.backing} material={parts.backingMat} renderOrder={6} />
      <mesh geometry={parts.frame} material={parts.frameMat} renderOrder={7} />
      <points geometry={parts.hitsGeo} material={parts.hits} frustumCulled={false} renderOrder={8} />
      {curveReveal > 0 ? (
        <>
          <mesh geometry={parts.baseline} material={parts.baseMat} renderOrder={9} />
          <mesh geometry={parts.curveGeo} material={parts.curveMat} renderOrder={9} />
        </>
      ) : null}
    </group>
  );
};

// --- Calculated probability between slits and screen (visualisation) ----------------------------

const fieldFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uMix; // 0 = no path information (interference), 1 = with path information
  uniform float uK;
  uniform float uSlit;
  uniform float uBarrierZ;
  uniform float uScreenZ;
  uniform float uEnvelope;
  varying vec3 vWorld;
  float sinc2(float u) { if (abs(u) < 1e-4) return 1.0; float a = 3.14159265 * u; return pow(sin(a) / a, 2.0); }
  void main() {
    float z = vWorld.z - uBarrierZ;
    if (z <= 0.0) discard;
    vec2 p = vec2(vWorld.x, z);
    float r1 = length(p - vec2(-uSlit, 0.0));
    float r2 = length(p - vec2(uSlit, 0.0));
    // two cylindrical waves from the slits; time-averaged probability density
    float c = cos(uK * r1) / sqrt(r1) + cos(uK * r2) / sqrt(r2);
    float sn = sin(uK * r1) / sqrt(r1) + sin(uK * r2) / sqrt(r2);
    float iCoh = c * c + sn * sn;              // |ψ1 + ψ2|²  ('coherent' is a GLSL keyword)
    float iInc = 1.0 / r1 + 1.0 / r2;          // |ψ1|² + |ψ2|²
    float I = mix(iCoh, iInc, uMix); // equal on average: same envelope, no fringes
    float sinT = vWorld.x / length(p);
    I *= sinc2(sinT * (uScreenZ - uBarrierZ) / uEnvelope);
    I *= pow(length(p), 0.85) * 0.55;          // compensate the 1/r fall-off for legibility
    float nearSlits = smoothstep(0.05, 0.6, z);
    float nearScreen = smoothstep(uScreenZ - uBarrierZ, uScreenZ - uBarrierZ - 0.15, z);
    vec3 col = vec3(0.2, 0.7, 1.0) * pow(clamp(I, 0.0, 3.0), 0.9) * 0.5;
    gl_FragColor = vec4(col * uOpacity * nearSlits * nearScreen, 1.0);
  }
`;

export const ProbabilityField: React.FC<{opacity: number; mix: number; envelope: number; fringe: number}> = ({opacity, mix, envelope, fringe}) => {
  const {geo, mat} = useMemo(() => {
    const L = SCREEN_Z - BARRIER_Z;
    const g = new THREE.PlaneGeometry(SCREEN_W, L, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, (BARRIER_Z + SCREEN_Z) / 2);
    // wavelength chosen so the far-field fringe spacing matches the screen pattern
    const lambda = (fringe * 2 * SLIT_X) / L;
    const m = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: fieldFragment,
      uniforms: {
        uOpacity: {value: 0},
        uMix: {value: 0},
        uK: {value: (2 * Math.PI) / lambda},
        uSlit: {value: SLIT_X},
        uBarrierZ: {value: BARRIER_Z},
        uScreenZ: {value: SCREEN_Z},
        uEnvelope: {value: envelope},
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    return {geo: g, mat: m};
  }, [envelope, fringe]);
  mat.uniforms.uOpacity.value = opacity;
  mat.uniforms.uMix.value = mix;
  if (opacity <= 0) return null;
  return <mesh geometry={geo} material={mat} renderOrder={5} />;
};
