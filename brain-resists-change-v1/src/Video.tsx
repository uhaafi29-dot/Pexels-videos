import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion';
import {CAPTIONS, DURATION_IN_FRAMES, FPS} from './timeline';
import {Overlay} from './overlay/Text';
import {FOV, Scene3D} from './three/Scene3D';

export type VideoProps = {
  /** Original ambient music bed in /public (regenerate with `npm run audio`). */
  ambient: string;
  /** Music level while the narrator speaks / between lines. */
  musicUnderVoice: number;
  musicAlone: number;
};

export const defaultProps: VideoProps = {
  ambient: 'ambient.wav',
  musicUnderVoice: 0.22,
  musicAlone: 0.45,
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Music level per frame: ducked smoothly under each narration line. */
const musicVolume = (f: number, under: number, alone: number) => {
  let duck = 0;
  for (const c of CAPTIONS) {
    const end = c.from + c.audioDuration * FPS;
    duck = Math.max(duck, interpolate(f, [c.from - 8, c.from, end, end + 12], [0, 1, 1, 0], clamp));
  }
  const fade = interpolate(f, [0, 20, DURATION_IN_FRAMES - 25, DURATION_IN_FRAMES], [0, 1, 1, 0], clamp);
  return (alone + (under - alone) * duck) * fade;
};

export const BrainResistsChange: React.FC<VideoProps> = ({ambient, musicUnderVoice, musicAlone}) => {
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: '#010205'}}>
      <ThreeCanvas
        width={width}
        height={height}
        linear
        flat
        dpr={1}
        gl={{antialias: true, alpha: false, preserveDrawingBuffer: true}}
        camera={{fov: FOV, position: [5, 1, 6], near: 0.05, far: 60}}
      >
        <Scene3D />
      </ThreeCanvas>
      <Overlay />

      <Audio src={staticFile(ambient)} volume={(f) => musicVolume(f, musicUnderVoice, musicAlone)} />
      {CAPTIONS.map((c) => (
        <Sequence key={c.key} from={c.from} name={`VO: ${c.key}`}>
          <Audio src={staticFile(c.file)} volume={1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
