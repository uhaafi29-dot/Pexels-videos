import {useMemo} from 'react';
import * as THREE from 'three';
import {mulberry32} from './math';

const screenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const useScreenMaterial = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending) =>
  useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        blending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

const quad = new THREE.PlaneGeometry(2, 2);

/** Deep black backdrop with a faint, slowly breathing blue haze behind the brain. */
export const Backdrop: React.FC<{time: number; glow: number}> = ({time, glow}) => {
  const material = useScreenMaterial(
    /* glsl */ `
    uniform float uTime;
    uniform float uGlow;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - vec2(0.5, 0.5)) * vec2(1.0, 1.78);
      float r = length(p);
      float haze = exp(-r * r * 3.2) * (0.9 + 0.1 * sin(uTime * 0.7));
      float floorGlow = exp(-pow((vUv.y - 0.1) * 5.0, 2.0)) * 0.15;
      vec3 col = vec3(0.004, 0.008, 0.02)
        + vec3(0.02, 0.07, 0.2) * haze * uGlow
        + vec3(0.01, 0.03, 0.08) * floorGlow;
      gl_FragColor = vec4(col, 1.0);
    }`,
    {uTime: {value: 0}, uGlow: {value: 1}},
    THREE.NoBlending,
  );
  material.uniforms.uTime.value = time;
  material.uniforms.uGlow.value = glow;
  return <mesh geometry={quad} material={material} frustumCulled={false} renderOrder={-10} />;
};

/** Soft volumetric-looking shafts of light falling from above. */
export const LightShafts: React.FC<{time: number; intensity: number}> = ({time, intensity}) => {
  const material = useScreenMaterial(
    /* glsl */ `
    uniform float uTime;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      // fan of rays from a source above the top edge
      vec2 src = vec2(0.62, 1.25);
      vec2 d = vUv - src;
      float ang = atan(d.x, -d.y);
      float rays = 0.0;
      rays += pow(0.5 + 0.5 * sin(ang * 23.0 + uTime * 0.15), 6.0) * 0.6;
      rays += pow(0.5 + 0.5 * sin(ang * 41.0 - uTime * 0.11 + 1.7), 8.0) * 0.4;
      float cone = exp(-ang * ang * 9.0);
      float fall = smoothstep(1.3, 0.25, length(d));
      vec3 col = vec3(0.12, 0.3, 0.75) * rays * cone * fall * uIntensity * 0.16;
      gl_FragColor = vec4(col, 1.0);
    }`,
    {uTime: {value: 0}, uIntensity: {value: 1}},
    THREE.AdditiveBlending,
  );
  material.uniforms.uTime.value = time;
  material.uniforms.uIntensity.value = intensity;
  return <mesh geometry={quad} material={material} frustumCulled={false} renderOrder={0} />;
};

/** Final pass: vignette, gentle grain and a global fade (to/from black). */
export const Grade: React.FC<{frame: number; fade: number}> = ({frame, fade}) => {
  const material = useScreenMaterial(
    /* glsl */ `
    uniform float uFrame;
    uniform float uFade;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    void main() {
      vec2 p = (vUv - 0.5) * vec2(1.0, 1.4);
      float vig = smoothstep(0.35, 0.95, length(p));
      float grain = hash(vUv * vec2(1080.0, 1920.0) + mod(uFrame, 64.0) * 17.0) - 0.5;
      float darkness = clamp(vig * 0.75 + (1.0 - uFade), 0.0, 1.0);
      // black overlay (alpha) + tiny additive grain baked into colour
      gl_FragColor = vec4(vec3(0.5 + grain * 0.6) * 0.03, darkness + 0.0);
    }`,
    {uFrame: {value: 0}, uFade: {value: 1}},
    THREE.NormalBlending,
  );
  material.uniforms.uFrame.value = frame;
  material.uniforms.uFade.value = fade;
  return <mesh geometry={quad} material={material} frustumCulled={false} renderOrder={100} />;
};

const dustVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelsPerUnit;
  uniform float uFocus;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.21 + aSeed * 40.0) * 0.15;
    p.y += uTime * (0.03 + 0.04 * fract(aSeed * 13.0)) + cos(uTime * 0.17 + aSeed * 23.0) * 0.1;
    p.y = mod(p.y + 6.0, 12.0) - 6.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    // out-of-focus particles become large, faint bokeh discs
    float blur = clamp(abs(depth - uFocus) * 0.55, 0.0, 3.5);
    vSoft = blur;
    float size = (0.012 + 0.018 * fract(aSeed * 7.0)) * (1.0 + blur * 3.0);
    gl_PointSize = size * uPixelsPerUnit / depth;
    float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + aSeed) + aSeed * 90.0);
    vAlpha = twinkle / (1.0 + blur * blur * 2.5) * smoothstep(0.4, 1.5, depth);
    gl_Position = projectionMatrix * mv;
  }
`;

const dustFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float hard = 1.0 - smoothstep(0.2, 1.0, d);
    float disc = smoothstep(1.0, 0.75, d) * 0.6 + 0.4 * (1.0 - d);
    float shape = mix(hard * hard, disc, clamp(vSoft / 1.5, 0.0, 1.0));
    gl_FragColor = vec4(vec3(0.35, 0.65, 1.0) * shape * vAlpha * uOpacity * 0.55, 1.0);
  }
`;

export const Dust: React.FC<{time: number; pixelsPerUnit: number; focus: number; opacity: number}> = ({
  time,
  pixelsPerUnit,
  focus,
  opacity,
}) => {
  const {geometry, material} = useMemo(() => {
    const rand = mulberry32(99);
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 9;
      pos[i * 3 + 1] = (rand() - 0.5) * 12;
      pos[i * 3 + 2] = (rand() - 0.5) * 12;
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: {
        uTime: {value: 0},
        uPixelsPerUnit: {value: 1},
        uFocus: {value: 6},
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
  material.uniforms.uPixelsPerUnit.value = pixelsPerUnit;
  material.uniforms.uFocus.value = focus;
  material.uniforms.uOpacity.value = opacity;
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
};
