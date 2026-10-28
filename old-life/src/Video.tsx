import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {Scene3D} from './three/Scene3D';
import {Overlay} from './overlay/Text';
import {CAPTIONS, DURATION_IN_FRAMES, FPS} from './timeline';
import {usePreload} from './three/assets';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Music and room sound sit under the voice, dipping a little more while she speaks. */
const musicVolume = (f: number) => {
  let duck = 0;
  for (const c of CAPTIONS) {
    const end = c.from + c.audioDuration * FPS;
    duck = Math.max(duck, interpolate(f, [c.from - 8, c.from, end, end + 10], [0, 1, 1, 0], clamp));
  }
  const edges = interpolate(f, [0, 12, DURATION_IN_FRAMES - 20, DURATION_IN_FRAMES], [0, 1, 1, 0], clamp);
  return (0.62 - 0.27 * duck) * edges;
};

export const OldLife: React.FC = () => {
  const {width, height} = useVideoConfig();
  const ready = usePreload();
  return (
    <AbsoluteFill style={{backgroundColor: '#020306'}}>
      {ready ? (
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        shadows="soft"
        gl={{antialias: false, alpha: false, preserveDrawingBuffer: true, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace}}
        camera={{fov: 45, position: [0, 1.5, 3], near: 0.05, far: 100}}
      >
        <Scene3D />
      </ThreeCanvas>
      ) : null}
      <Overlay />
      <Audio src={staticFile('ambient.wav')} volume={musicVolume} />
      {CAPTIONS.map((c) => (
        <Sequence key={c.key} from={c.from} name={`VO ${c.key}`}>
          <Audio src={staticFile(c.file)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
