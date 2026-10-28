import {Config} from '@remotion/cli/config';

// WebGL in headless Chrome: "angle" uses the GPU when present; on GPU-less
// machines (CI, cloud containers) pass --gl=swangle for software rendering.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
