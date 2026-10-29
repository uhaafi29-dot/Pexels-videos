import {Composition} from 'remotion';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timeline';
import {OldYou} from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition id="OldYou" component={OldYou} durationInFrames={DURATION_IN_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
