import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion';
import {DURATION_IN_FRAMES, SCENES} from './timeline';
import {Overlay} from './overlay/Text';
import {FOV, Scene3D} from './three/Scene3D';

export type VideoProps = {
  /** Ambient bed in /public. Regenerate with `npm run audio`. */
  ambient: string | null;
  /**
   * Voiceover placeholders: drop recorded lines into public/voiceover/ and
   * set the file names here (or via --props). null = no voiceover yet.
   */
  voiceover: Record<keyof typeof SCENES, string | null>;
};

export const defaultProps: VideoProps = {
  ambient: 'ambient.wav',
  voiceover: {intro: null, familiar: null, newRoute: null, repetition: null},
};

export const BrainResistsChange: React.FC<VideoProps> = ({ambient, voiceover}) => {
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

      {ambient ? (
        <Audio
          src={staticFile(ambient)}
          volume={(f) => interpolate(f, [0, 20, DURATION_IN_FRAMES - 25, DURATION_IN_FRAMES], [0, 0.9, 0.9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      ) : null}
      {(Object.keys(SCENES) as (keyof typeof SCENES)[]).map((scene) =>
        voiceover[scene] ? (
          <Sequence key={scene} from={SCENES[scene].from + 6}>
            <Audio src={staticFile(`voiceover/${voiceover[scene]}`)} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
};
