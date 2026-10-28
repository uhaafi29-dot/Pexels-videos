import {Composition} from 'remotion';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timeline';
import {DoubleSlit, defaultProps} from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="DoubleSlit"
    component={DoubleSlit}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={defaultProps}
  />
);
