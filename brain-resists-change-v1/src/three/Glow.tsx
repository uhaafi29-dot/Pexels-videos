import {useMemo} from 'react';
import * as THREE from 'three';

export type GlowPoint = {
  pos: THREE.Vector3;
  /** World-space diameter. */
  size: number;
  color: [number, number, number];
  intensity: number;
};

const vertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelsPerUnit;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelsPerUnit / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 28.0);
    float halo = exp(-d * d * 5.0) * 0.45;
    float tail = pow(1.0 - d, 3.0) * 0.15;
    vec3 col = vColor * (halo + tail) + mix(vColor, vec3(1.0), 0.7) * core;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Soft additive light blobs: neurons, signal heads, synapse flashes. */
export const GlowPoints: React.FC<{points: GlowPoint[]; max: number; pixelsPerUnit: number}> = ({
  points,
  max,
  pixelsPerUnit,
}) => {
  const {geometry, material} = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {uPixelsPerUnit: {value: 1}},
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return {geometry: g, material: m};
  }, [max]);

  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const size = geometry.getAttribute('aSize') as THREE.BufferAttribute;
  const color = geometry.getAttribute('aColor') as THREE.BufferAttribute;
  const n = Math.min(points.length, max);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    pos.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
    size.setX(i, p.size);
    color.setXYZ(i, p.color[0] * p.intensity, p.color[1] * p.intensity, p.color[2] * p.intensity);
  }
  pos.needsUpdate = true;
  size.needsUpdate = true;
  color.needsUpdate = true;
  geometry.setDrawRange(0, n);
  material.uniforms.uPixelsPerUnit.value = pixelsPerUnit;

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />;
};
