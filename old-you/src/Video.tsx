import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile} from 'remotion';
import {Film} from './film';
import {Overlay} from './overlay';
import {CAPTIONS, DURATION_IN_FRAMES, FPS} from './timeline';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Music sits well under the voice and dips further while she speaks. */
const musicVolume = (f: number) => {
  let duck = 0;
  for (const c of CAPTIONS) {
    const end = c.from + c.audioDuration * FPS;
    duck = Math.max(duck, interpolate(f, [c.from - 8, c.from, end, end + 10], [0, 1, 1, 0], clamp));
  }
  const edges = interpolate(f, [0, 10, DURATION_IN_FRAMES - 24, DURATION_IN_FRAMES], [0, 1, 1, 0], clamp);
  return (0.55 - 0.25 * duck) * edges;
};

export const OldYou: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#0b1120'}}>
    <Film />
    <Overlay />
    <Audio src={staticFile('ambient.wav')} volume={musicVolume} />
    {CAPTIONS.map((c) => (
      <Sequence key={c.key} from={c.from} name={`VO ${c.key}`}>
        <Audio src={staticFile(c.file)} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
