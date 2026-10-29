// All 3D assets are preloaded once, in the main React tree, before the 3D
// canvas mounts (one delayRender for everything). Components inside the
// canvas then read them synchronously, so every frame renders complete.
import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {GLTF, GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';

const GLTFS = ['assets/Xbot.glb', 'assets/SheenChair.glb', 'assets/GlamVelvetSofa.glb', 'assets/DiffuseTransmissionPlant.glb'];
const HDRS = ['assets/spruit_sunrise_1k.hdr', 'assets/moonless_golf_1k.hdr'];
const TEXTURES = ['assets/hardwood2_diffuse.jpg', 'assets/hardwood2_roughness.jpg', 'assets/hardwood2_bump.jpg'];

const store = {
  gltf: new Map<string, GLTF>(),
  hdr: new Map<string, THREE.DataTexture>(),
  tex: new Map<string, THREE.Texture>(),
};
let loading: Promise<void> | null = null;

const loadAll = () => {
  loading ??= Promise.all([
    ...GLTFS.map(async (f) => store.gltf.set(f, await new GLTFLoader().loadAsync(staticFile(f)))),
    ...HDRS.map(async (f) => {
      const t = await new RGBELoader().loadAsync(staticFile(f));
      t.mapping = THREE.EquirectangularReflectionMapping;
      store.hdr.set(f, t);
    }),
    ...TEXTURES.map(async (f) => store.tex.set(f, await new THREE.TextureLoader().loadAsync(staticFile(f)))),
  ]).then(() => undefined);
  return loading;
};

/** Call once outside the canvas; returns true when everything is loaded. */
export const usePreload = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading 3D assets', {timeoutInMilliseconds: 180000}));
  useEffect(() => {
    loadAll()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        // fail loudly: a missing asset must never silently produce an empty room
        throw err;
      });
  }, [handle]);
  return ready;
};

const need = <T,>(m: Map<string, T>, f: string) => {
  const v = m.get(f);
  if (!v) throw new Error(`Asset not preloaded: ${f}`);
  return v;
};

export const useGltf = (file: string) => need(store.gltf, file);
export const useHdr = (file: string) => need(store.hdr, file);

const texCache = new Map<string, THREE.Texture>();
export const useTexture = (file: string, srgb = true, repeat: [number, number] = [1, 1]) => {
  const key = `${file}:${repeat.join('x')}:${srgb}`;
  if (!texCache.has(key)) {
    const t = need(store.tex, file).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    texCache.set(key, t);
  }
  return texCache.get(key)!;
};
