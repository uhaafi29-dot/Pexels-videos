import {Composition} from 'remotion';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timeline';
import {OldLife} from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="OldLife"
    component={OldLife}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
