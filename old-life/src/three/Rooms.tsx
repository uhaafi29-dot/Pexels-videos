import {createContext, useContext, useMemo} from 'react';
import * as THREE from 'three';
import {useTexture} from './assets';
import {mulberry32} from './math';
import {Bed, Clock, Lamp, Model, Phone, duvetGeometry, fabric, mat, rbox} from './Props';

/** The current camera position, so walls between camera and subject can open up. */
export const CameraCtx = createContext(new THREE.Vector3());

type Hole = [number, number, number, number]; // x0, y0, x1, y1 in wall-local coords (x from left edge)

const wallGeometry = (w: number, h: number, holes: Hole[] = []) => {
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(w, 0), new THREE.Vector2(w, h), new THREE.Vector2(0, h)]);
  for (const [x0, y0, x1, y1] of holes) {
    shape.holes.push(new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, y0)]));
  }
  const g = new THREE.ShapeGeometry(shape);
  g.translate(-w / 2, 0, 0);
  return g;
};

/**
 * A wall that disappears when the camera is on its outer side, like a film
 * set with a wild wall pulled out for the shot.
 */
const Wall: React.FC<{w: number; h: number; pos: [number, number, number]; rotY: number; material: THREE.Material; holes?: Hole[]; force?: boolean}> = ({w, h, pos, rotY, material, holes, force}) => {
  const cam = useContext(CameraCtx);
  const geo = useMemo(() => wallGeometry(w, h, holes), [w, h, holes]);
  const normal = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)); // inward
  const outside = cam.clone().sub(new THREE.Vector3(...pos)).dot(normal) < -0.05;
  if (outside && !force) return null;
  return <mesh geometry={geo} material={material} position={pos} rotation={[0, rotY, 0]} receiveShadow castShadow />;
};

const Frame: React.FC<{w: number; h: number; depth: number; t: number; material: THREE.Material}> = ({w, h, depth, t, material}) => (
  <group>
    <mesh material={material} position={[-w / 2 - t / 2, h / 2, 0]} castShadow>
      <boxGeometry args={[t, h + t, depth]} />
    </mesh>
    <mesh material={material} position={[w / 2 + t / 2, h / 2, 0]} castShadow>
      <boxGeometry args={[t, h + t, depth]} />
    </mesh>
    <mesh material={material} position={[0, h + t / 2, 0]} castShadow>
      <boxGeometry args={[w + 2 * t, t, depth]} />
    </mesh>
  </group>
);

/** Sheer curtain: a pleated, gently swaying cloth. */
const Curtain: React.FC<{w: number; h: number; material: THREE.Material; time: number; open?: number}> = ({w, h, material, time, open = 0}) => {
  const geo = useMemo(() => new THREE.PlaneGeometry(1, h, 60, 20), [h]);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const width = w * (1 - 0.65 * open);
  for (let i = 0; i < p.count; i++) {
    const u = (i % 61) / 60;
    const y = p.getY(i);
    const folds = 12 + 8 * open;
    const sway = Math.sin(time * 0.8 + u * 3 + y * 0.6) * 0.012 * (0.5 + 0.5 * (h / 2 - y) / h);
    p.setXYZ(i, (u - 0.5) * width, y, Math.sin(u * folds * Math.PI) * (0.025 + 0.03 * open) + sway);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return <mesh geometry={geo} material={material} castShadow receiveShadow />;
};

// ---------------------------------------------------------------------------------
// Light shafts: an additive volume from a window along the light direction.

const shaftVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  varying vec3 vWorld;
  void main() {
    vT = aT;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const shaftFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying float vT;
  varying vec3 vWorld;
  void main() {
    float fall = (1.0 - vT) * smoothstep(0.0, 0.08, vT);
    float streak = 0.75 + 0.25 * sin(vWorld.x * 7.0 + vWorld.z * 5.0 + uTime * 0.3);
    gl_FragColor = vec4(uColor * fall * streak * uIntensity, 1.0);
  }
`;

export const Shaft: React.FC<{corners: THREE.Vector3[]; dir: THREE.Vector3; length: number; color: THREE.ColorRepresentation; intensity: number; time: number}> = ({corners, dir, length, color, intensity, time}) => {
  const {geo, material} = useMemo(() => {
    const far = corners.map((c) => c.clone().addScaledVector(dir, length));
    const pts = [...corners, ...far];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 1, 1, 1], 1));
    // four side faces of the prism
    const idx: number[] = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      idx.push(i, j, j + 4, i, j + 4, i + 4);
    }
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      uniforms: {uColor: {value: new THREE.Color(color)}, uIntensity: {value: 0}, uTime: {value: 0}},
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    return {geo: g, material: m};
  }, [corners, dir, length, color]);
  material.uniforms.uIntensity.value = intensity;
  material.uniforms.uTime.value = time;
  if (intensity <= 0.001) return null;
  return <mesh geometry={geo} material={material} renderOrder={20} />;
};

/** Dust motes drifting in a box, lit only where they catch the light. */
export const Motes: React.FC<{min: THREE.Vector3; max: THREE.Vector3; time: number; color: THREE.ColorRepresentation; intensity: number; count?: number}> = ({min, max, time, color, intensity, count = 500}) => {
  const {geo, material} = useMemo(() => {
    const rand = mulberry32(9);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = min.x + rand() * (max.x - min.x);
      pos[i * 3 + 1] = min.y + rand() * (max.y - min.y);
      pos[i * 3 + 2] = min.z + rand() * (max.z - min.z);
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.08;
          p.y += sin(uTime * 0.13 + aSeed * 50.0) * 0.06 + uTime * 0.01;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.2 + 2.2 * fract(aSeed * 7.0)) * 2.4 / max(-mv.z, 0.4);
          vA = 0.5 + 0.5 * sin(uTime * (0.5 + aSeed) + aSeed * 40.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uIntensity; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
          gl_FragColor = vec4(uColor * (1.0 - d) * vA * uIntensity, 1.0); }`,
      uniforms: {uTime: {value: 0}, uColor: {value: new THREE.Color(color)}, uIntensity: {value: 1}},
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return {geo: g, material: m};
  }, [min, max, color, count]);
  material.uniforms.uTime.value = time;
  material.uniforms.uIntensity.value = intensity;
  if (intensity <= 0.001) return null;
  return <points geometry={geo} material={material} renderOrder={21} />;
};

// ---------------------------------------------------------------------------------
// The familiar bedroom (origin) — 4.0 × 4.6 m, 2.6 m ceiling.

export const BEDROOM = {
  w: 4.0,
  d: 4.6,
  h: 2.6,
  door: {x0: -1.25, x1: -0.35, h: 2.1}, // in the front wall (z = +2.3)
  window: {x0: -1.55, x1: -0.45, y0: 0.85, y1: 2.25}, // in the back wall (z = -2.3)
  bed: new THREE.Vector3(0.55, 0, -1.25), // centre of the bed footprint
  nightstand: new THREE.Vector3(1.62, 0, -1.95),
  desk: new THREE.Vector3(-1.62, 0, 0.35),
  chair: new THREE.Vector3(-1.05, 0, 0.35),
};
export const NIGHTSTAND_TOP = 0.55;
export const DESK_TOP = 0.75;
export const PHONE_ON_NIGHTSTAND = new THREE.Vector3(1.52, NIGHTSTAND_TOP, -1.9);
export const PHONE_ON_DESK = new THREE.Vector3(-1.55, DESK_TOP, 0.75);
export const CLOCK_POS = new THREE.Vector3(1.72, NIGHTSTAND_TOP, -2.05);

const nightCity = /* glsl */ `
  uniform float uDawn; uniform float uTime; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec3 night = mix(vec3(0.01, 0.02, 0.05), vec3(0.04, 0.07, 0.15), vUv.y);
    vec3 dawn = mix(vec3(0.95, 0.62, 0.36), vec3(0.45, 0.62, 0.85), smoothstep(0.1, 0.9, vUv.y));
    vec3 col = mix(night, dawn, uDawn);
    // distant city: windows of light below a skyline
    vec2 g = vec2(vUv.x * 60.0, vUv.y * 40.0);
    vec2 id = floor(g);
    float sky = 0.25 + 0.2 * h(vec2(id.x, 0.0));
    float lit = step(vUv.y, sky) * step(0.82, h(id)) * (0.6 + 0.4 * sin(uTime * 0.5 + h(id) * 20.0));
    float bld = step(vUv.y, sky);
    col = mix(col, col * 0.35, bld * (1.0 - uDawn * 0.6));
    col += vec3(1.0, 0.75, 0.45) * lit * 0.9 * (1.0 - uDawn);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const Bedroom: React.FC<{
  time: number;
  dawn: number; // 0 = night, 1 = morning
  phonePos: THREE.Vector3 | null; // null = the phone is in someone's hand
  phoneScreen: number;
  clockText: string;
  clockGlow: number;
  lampOn: number;
  curtainOpen: number;
  chairPos: THREE.Vector3;
  chairRot: number;
  glassOnNightstand: number; // 0..1, the new morning cue (a glass of water)
  cueGlow: number; // 0..1 stylised rim glow on the cue objects (science scene)
}> = (p) => {
  const floorMap = useTexture('assets/hardwood2_diffuse.jpg', true, [3, 3]);
  const floorRough = useTexture('assets/hardwood2_roughness.jpg', false, [3, 3]);
  const floorBump = useTexture('assets/hardwood2_bump.jpg', false, [3, 3]);
  const m = useMemo(
    () => ({
      wall: mat('#5b6068', 0.92),
      ceiling: mat('#4a4f57', 0.95),
      trim: mat('#2a2d32', 0.6),
      wood: mat('#3a2a20', 0.55),
      darkWood: mat('#241a14', 0.5),
      sheet: fabric('#7d8896'),
      pillow: fabric('#9aa3ad'),
      rug: fabric('#2f3a45'),
      curtain: new THREE.MeshPhysicalMaterial({color: '#c9c3b8', roughness: 0.95, side: THREE.DoubleSide, sheen: 1, sheenColor: new THREE.Color('#ffffff'), transparent: true, opacity: 0.88}),
      glass: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.06, depthWrite: false}),
      sky: new THREE.ShaderMaterial({vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}', fragmentShader: nightCity, uniforms: {uDawn: {value: 0}, uTime: {value: 0}}}),
      floor: new THREE.MeshPhysicalMaterial({roughness: 0.6, color: '#8a7a6c'}),
      water: new THREE.MeshPhysicalMaterial({color: '#dff3ff', roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1}),
      laptop: mat('#9aa0a8', 0.35, {metalness: 0.7}),
      mug: mat('#d9d2c6', 0.4),
      book: mat('#7a2f2a', 0.8),
      art: mat('#20252c', 0.6),
    }),
    [],
  );
  if (!m.floor.map) {
    m.floor.map = floorMap;
    m.floor.roughnessMap = floorRough;
    m.floor.bumpMap = floorBump;
    m.floor.bumpScale = 0.6;
    m.floor.needsUpdate = true;
  }
  m.sky.uniforms.uDawn.value = p.dawn;
  m.sky.uniforms.uTime.value = p.time;
  const {w, d, h, door, window: win} = BEDROOM;
  const holesBack: Hole[] = useMemo(() => [[win.x0 + w / 2, win.y0, win.x1 + w / 2, win.y1]], [w, win]);
  const holesFront: Hole[] = useMemo(() => [[w / 2 - door.x1, 0.001, w / 2 - door.x0, door.h]], [w, door]);
  const winW = win.x1 - win.x0;
  const winH = win.y1 - win.y0;
  const winCx = (win.x0 + win.x1) / 2;
  const deskTop = useMemo(() => rbox(0.62, 0.04, 1.3, 0.01), []);
  const leg = useMemo(() => rbox(0.04, DESK_TOP - 0.04, 0.04, 0.008), []);
  const ns = useMemo(() => rbox(0.46, NIGHTSTAND_TOP, 0.42, 0.02), []);
  const rumpled = useMemo(() => duvetGeometry(1.1, 0.9, 0, 4, 0.6), []);
  return (
    <group>
      {/* floor, rug, ceiling */}
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh geometry={rumpled} material={m.rug} position={[0.4, 0.004, 0.15]} scale={[1.9, 0.05, 1.9]} receiveShadow />
      <Wall w={w} h={h} pos={[0, 0, -d / 2]} rotY={0} material={m.wall} holes={holesBack} />
      <Wall w={w} h={h} pos={[0, 0, d / 2]} rotY={Math.PI} material={m.wall} holes={holesFront} />
      <Wall w={d} h={h} pos={[-w / 2, 0, 0]} rotY={Math.PI / 2} material={m.wall} />
      <Wall w={d} h={h} pos={[w / 2, 0, 0]} rotY={-Math.PI / 2} material={m.wall} />
      <CeilingIfInside h={h} w={w} d={d} material={m.ceiling} />

      {/* window: frame, glass, outside, curtains */}
      <group position={[winCx, win.y0, -d / 2]}>
        <Frame w={winW} h={winH} depth={0.14} t={0.05} material={m.trim} />
        <mesh material={m.trim} position={[0, -0.03, 0.06]}>
          <boxGeometry args={[winW + 0.14, 0.05, 0.2]} />
        </mesh>
        <mesh material={m.glass} position={[0, winH / 2, -0.02]}>
          <planeGeometry args={[winW, winH]} />
        </mesh>
        <mesh material={m.sky} position={[0, winH / 2, -1.5]}>
          <planeGeometry args={[winW * 4, winH * 3]} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (winW / 2 + 0.05 - 0.18 * p.curtainOpen), winH / 2 - 0.2, 0.18]}>
            <Curtain w={0.62} h={winH + 0.75} material={m.curtain} time={p.time} open={p.curtainOpen} />
          </group>
        ))}
      </group>

      {/* door frame */}
      <group position={[(door.x0 + door.x1) / 2, 0, d / 2]}>
        <Frame w={door.x1 - door.x0} h={door.h} depth={0.16} t={0.06} material={m.trim} />
      </group>

      {/* bed, nightstand, lamp, clock, phone */}
      <group position={[BEDROOM.bed.x, 0, BEDROOM.bed.z]}>
        <Bed w={1.6} l={2.05} top={0.55} frame={m.darkWood} sheet={m.sheet} pillow={m.pillow} seed={2} />
      </group>
      <mesh geometry={ns} material={m.wood} position={[BEDROOM.nightstand.x, NIGHTSTAND_TOP / 2, BEDROOM.nightstand.z]} castShadow receiveShadow />
      <group position={[1.78, NIGHTSTAND_TOP, -2.08]}>
        <Lamp on={p.lampOn} />
      </group>
      <group position={CLOCK_POS} rotation={[0, -0.35, 0]}>
        <Clock text={p.clockText} glow={p.clockGlow} />
      </group>
      {p.phonePos ? (
        <group position={p.phonePos} rotation={[0, 0.3, 0]}>
          <Phone screen={p.phoneScreen} />
        </group>
      ) : null}
      {p.glassOnNightstand > 0 ? (
        <mesh material={m.water} position={[1.5, NIGHTSTAND_TOP + 0.06 * p.glassOnNightstand, -1.82]} castShadow>
          <cylinderGeometry args={[0.035, 0.03, 0.12 * p.glassOnNightstand, 24]} />
        </mesh>
      ) : null}

      {/* desk, laptop, mug, books, chair */}
      <group position={[BEDROOM.desk.x, 0, BEDROOM.desk.z]}>
        <mesh geometry={deskTop} material={m.wood} position={[0, DESK_TOP - 0.02, 0]} castShadow receiveShadow />
        {[
          [-0.27, -0.6],
          [0.27, -0.6],
          [-0.27, 0.6],
          [0.27, 0.6],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={leg} material={m.trim} position={[x, (DESK_TOP - 0.04) / 2, z]} castShadow />
        ))}
        <mesh material={m.laptop} position={[0.02, DESK_TOP + 0.01, -0.2]} castShadow>
          <boxGeometry args={[0.24, 0.018, 0.33]} />
        </mesh>
        <mesh material={m.mug} position={[0.12, DESK_TOP + 0.05, -0.5]} castShadow>
          <cylinderGeometry args={[0.04, 0.038, 0.1, 24]} />
        </mesh>
        <mesh material={m.book} position={[-0.1, DESK_TOP + 0.02, 0.15]} rotation={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.16, 0.035, 0.23]} />
        </mesh>
      </group>
      <group position={p.chairPos} rotation={[0, p.chairRot, 0]}>
        <Model file="assets/SheenChair.glb" scale={1.05} />
      </group>
      {/* wall art above the bed */}
      <mesh material={m.art} position={[BEDROOM.bed.x, 1.65, -d / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.03]} />
      </mesh>
    </group>
  );
};

const CeilingIfInside: React.FC<{h: number; w: number; d: number; material: THREE.Material}> = ({h, w, d, material}) => {
  const cam = useContext(CameraCtx);
  if (cam.y > h - 0.05) return null;
  return (
    <mesh material={material} position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------------
// The hotel suite / "somewhere new" — centred at x = 12. Floor-to-ceiling glass.

export const HOTEL_X = 6.8;
export const HOTEL = {w: 6, d: 5, h: 2.9, door: {x0: -2.4, x1: -1.5, h: 2.15}};

export const Hotel: React.FC<{time: number}> = ({time}) => {
  const m = useMemo(
    () => ({
      floor: mat('#cbbba6', 0.35, {clearcoat: 0.3, clearcoatRoughness: 0.4}),
      wall: mat('#e8dfd2', 0.9),
      ceiling: mat('#efe8de', 0.95),
      trim: mat('#1d1b19', 0.4, {metalness: 0.6}),
      oak: mat('#a27b55', 0.55),
      sheet: fabric('#f4efe6'),
      pillow: fabric('#ffffff'),
      throw: fabric('#b98a4e'),
      rug: fabric('#d6c7ad'),
      curtain: new THREE.MeshPhysicalMaterial({color: '#f6efe2', roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.55, sheen: 1, depthWrite: false}),
      glass: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.04, depthWrite: false}),
    }),
    [],
  );
  const {w, d, h, door} = HOTEL;
  const holesFront: Hole[] = useMemo(() => [[w / 2 - door.x1, 0.001, w / 2 - door.x0, door.h]], [w, door]);
  const throwGeo = useMemo(() => duvetGeometry(1.8, 0.5, 0.25, 7, 0.8), []);
  return (
    <group position={[HOTEL_X, 0, 0]}>
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh material={m.rug} position={[0.3, 0.005, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.2, 2.4]} />
      </mesh>
      {/* glass wall: mullions only */}
      {Array.from({length: 7}, (_, i) => -w / 2 + i * (w / 6)).map((x) => (
        <mesh key={x} material={m.trim} position={[x, h / 2, -d / 2]} castShadow>
          <boxGeometry args={[0.05, h, 0.08]} />
        </mesh>
      ))}
      <mesh material={m.trim} position={[0, 0.02, -d / 2]} castShadow>
        <boxGeometry args={[w, 0.04, 0.1]} />
      </mesh>
      <mesh material={m.trim} position={[0, h - 0.02, -d / 2]} castShadow>
        <boxGeometry args={[w, 0.04, 0.1]} />
      </mesh>
      <mesh material={m.glass} position={[0, h / 2, -d / 2 - 0.01]}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <Wall w={w} h={h} pos={[0, 0, d / 2]} rotY={Math.PI} material={m.wall} holes={holesFront} />
      <Wall w={d} h={h} pos={[-w / 2, 0, 0]} rotY={Math.PI / 2} material={m.wall} />
      <Wall w={d} h={h} pos={[w / 2, 0, 0]} rotY={-Math.PI / 2} material={m.wall} />
      <CeilingIfInside h={h} w={w} d={d} material={m.ceiling} />
      <group position={[(door.x0 + door.x1) / 2, 0, d / 2]}>
        <Frame w={door.x1 - door.x0} h={door.h} depth={0.18} t={0.06} material={m.trim} />
      </group>
      {/* sheer curtains gathered at both ends of the glass */}
      {[-w / 2 + 0.4, w / 2 - 0.4].map((x) => (
        <group key={x} position={[x, h / 2 - 0.02, -d / 2 + 0.2]}>
          <Curtain w={0.8} h={h - 0.1} material={m.curtain} time={time} open={0.4} />
        </group>
      ))}
      {/* bed against the right wall, headboard on the wall */}
      <group position={[1.5, 0, 0.55]} rotation={[0, -Math.PI / 2, 0]}>
        <group position={[0, 0, 0]}>
          <Bed w={1.9} l={2.1} top={0.6} frame={m.oak} sheet={m.sheet} pillow={m.pillow} seed={11} rumple={1.6} />
          <mesh geometry={throwGeo} material={m.throw} position={[0, 0.66, 0.65]} castShadow receiveShadow />
        </group>
      </group>
      <group position={[-1.6, 0, -1.35]} rotation={[0, 0.5, 0]}>
        <Model file="assets/GlamVelvetSofa.glb" scale={0.95} />
      </group>
      <Model file="assets/DiffuseTransmissionPlant.glb" scale={2.1} position={[-2.6, 0, -2.1]} />
      <Model file="assets/DiffuseTransmissionPlant.glb" scale={1.6} position={[2.55, 0, -2.05]} rotation={[0, 1.4, 0]} />
    </group>
  );
};

/** A short corridor outside a door, so the camera has somewhere to stand. */
export const Corridor: React.FC<{x: number; z: number; warm: boolean}> = ({x, z, warm}) => {
  const m = useMemo(() => ({floor: mat(warm ? '#b8a48c' : '#2a2c30', 0.6), wall: mat(warm ? '#d9cdbd' : '#3b3f46', 0.9)}), [warm]);
  const cam = useContext(CameraCtx);
  // only exists when the camera is standing in (or looking down) the corridor
  if (cam.z < z - 0.3 || Math.abs(cam.x - x) > 2.2 || cam.y > 2.4) return null;
  return (
    <group position={[x, 0, z]}>
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 1.6]} receiveShadow>
        <planeGeometry args={[2.2, 3.2]} />
      </mesh>
      {[-1.1, 1.1].map((dx) => (
        <mesh key={dx} material={m.wall} position={[dx, 1.3, 1.6]} rotation={[0, dx < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[3.2, 2.6]} />
        </mesh>
      ))}
      <pointLight color={warm ? '#ffd7a8' : '#6d86c4'} intensity={warm ? 4 : 1.6} distance={5} decay={2} position={[0, 2.3, 1.6]} />
    </group>
  );
};
