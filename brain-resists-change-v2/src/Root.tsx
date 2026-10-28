import {Composition} from 'remotion';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timeline';
import {BrainResistsChange, defaultProps} from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="BrainResistsChange"
    component={BrainResistsChange}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={defaultProps}
  />
);
