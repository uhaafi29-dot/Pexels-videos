import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {BARRIER_Z, GUN_Z, SCREEN_Z, cameraAt, project, screenAX} from '../camera';
import {SCREEN_H} from '../physics';
import {CAPTION_CHUNKS, DURATION_IN_FRAMES, FIRST_SHOT, RUN_B, SCENES, SCENE_TEXT, SceneKey, countA, countB, s} from '../timeline';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const ACCENT = '#7ff3ff';
const WARM = '#ffdb8c';
const glow = '0 0 18px rgba(60,150,255,0.55), 0 2px 8px rgba(0,0,0,0.9)';

const fadeWindow = (frame: number, from: number, to: number, ramp = 10) =>
  interpolate(frame, [from, from + ramp, to - ramp, to], [0, 1, 1, 0], clamp);

// Instagram Reels safe area: keep text out of the top ~200 px (header) and the
// bottom ~450 px (caption, audio row, buttons) and away from the right-hand
// action buttons. Subtitles sit in a centred column above that zone.
const SAFE_TOP = 205;
const SUBTITLE_BOTTOM = 520;
/** Vertical band reserved for the 3D action and its labels. */
const STAGE = {top: 455, bottom: 1240};

// --- Scene titles ------------------------------------------------------------------

const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const items: {text: string; from: number; to: number; size: number; weight: number}[] = (Object.keys(SCENES) as SceneKey[]).map((k) => ({
    text: SCENE_TEXT[k],
    from: SCENES[k].from + (k === 'source' ? 8 : 6),
    to: k === 'compare' ? s(35.9) : SCENES[k].to - 2,
    size: 56,
    weight: 600,
  }));
  // end card: the video title
  items.push({text: 'The Experiment That Changed How We Understand Reality', from: s(35.9), to: DURATION_IN_FRAMES, size: 52, weight: 600});
  return (
    <>
      {items.map((it, i) => {
        const o = fadeWindow(frame, it.from, it.to, 12);
        if (o <= 0) return null;
        const rise = interpolate(frame, [it.from, it.from + 16], [14, 0], {...clamp, easing: Easing.out(Easing.cubic)});
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: SAFE_TOP + 52,
              left: 90,
              right: 90,
              textAlign: 'center',
              fontSize: it.size,
              fontWeight: it.weight,
              lineHeight: 1.16,
              letterSpacing: '-0.01em',
              opacity: o,
              transform: `translateY(${rise}px)`,
              textShadow: glow,
            }}
          >
            {it.text}
          </div>
        );
      })}
    </>
  );
};

// --- Subtitles ----------------------------------------------------------------------

const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const chunk = CAPTION_CHUNKS.find((c) => frame >= c.from && frame < c.to);
  if (!chunk) return null;
  const enter = interpolate(frame, [chunk.from, chunk.from + 6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const exit = interpolate(frame, [chunk.to - 4, chunk.to], [1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 110, right: 110, bottom: SUBTITLE_BOTTOM, display: 'flex', justifyContent: 'center', opacity: enter * exit, transform: `translateY(${(1 - enter) * 16}px)`}}>
      <div
        style={{
          background: 'rgba(2,6,16,0.74)',
          border: '1.5px solid rgba(120,190,255,0.22)',
          borderRadius: 24,
          padding: '18px 30px 22px',
          textAlign: 'center',
          fontSize: 60,
          lineHeight: 1.14,
          fontWeight: 750,
          letterSpacing: '-0.012em',
          maxWidth: 860,
        }}
      >
        {chunk.words.map((w, i) => {
          const spoken = interpolate(frame, [w.from - 2, w.from + 2], [0, 1], clamp);
          const end = Math.max(w.to, w.from + 2);
          const speaking = interpolate(frame, [w.from - 2, w.from + 1, end, end + 5], [0, 1, 1, 0], clamp);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: i < chunk.words.length - 1 ? '0.25em' : 0,
                color: speaking > 0.5 ? ACCENT : 'white',
                opacity: 0.45 + 0.55 * spoken,
                textShadow: speaking > 0.5 ? '0 0 22px rgba(90,220,255,0.7)' : '0 2px 8px rgba(0,0,0,0.8)',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// --- Labels anchored to the 3D apparatus ------------------------------------------------

type Label = {text: string; anchor: (f: number) => THREE.Vector3; from: number; to: number; color?: string; small?: boolean; below?: boolean};

const LABELS: Label[] = [
  {text: 'ELECTRON SOURCE', anchor: () => new THREE.Vector3(0, 0.62, GUN_Z), from: s(0.6), to: s(5.2)},
  {text: 'DOUBLE SLIT', anchor: () => new THREE.Vector3(1.5, 0.5, BARRIER_Z), from: s(1.0), to: s(5.2)},
  {text: 'DETECTOR SCREEN', anchor: () => new THREE.Vector3(1.6, 0.9, SCREEN_Z), from: s(1.4), to: s(3.6)},
  {text: 'TWO SLITS', anchor: () => new THREE.Vector3(0, 0, BARRIER_Z - 0.05), from: s(17.2), to: s(20.8), below: true},
  {text: 'SCREEN', anchor: () => new THREE.Vector3(0, 0, SCREEN_Z + 0.1), from: s(17.2), to: s(20.8)},
  {text: 'WHICH-PATH DETECTOR (IDEALIZED)', anchor: () => new THREE.Vector3(0, 1.3, BARRIER_Z), from: s(22.0), to: s(23.9)},
  {text: 'WITHOUT PATH\nINFORMATION', anchor: (f) => new THREE.Vector3(screenAX(f), -SCREEN_H / 2 - 0.08, SCREEN_Z), from: s(24.9), to: DURATION_IN_FRAMES - 30, below: true},
  {text: 'WITH PATH\nINFORMATION', anchor: () => new THREE.Vector3(0, -SCREEN_H / 2 - 0.08, SCREEN_Z), from: s(24.9), to: DURATION_IN_FRAMES - 30, below: true},
];

const Labels: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const shot = cameraAt(frame);
  return (
    <>
      {LABELS.map((l, i) => {
        const o = fadeWindow(frame, l.from, l.to, 10);
        if (o <= 0) return null;
        const p = project(shot, l.anchor(frame), width, height);
        // hide labels whose object is out of shot; keep the rest inside the stage
        if (!p.visible || p.x < 0 || p.x > width) return null;
        const lines = l.text.split('\n').length;
        const h = 60 + 34 * lines;
        if ((l.below ? p.y + h : p.y) > STAGE.bottom || (l.below ? p.y : p.y - h) < STAGE.top) return null;
        const y = p.y;
        const color = l.color ?? 'rgba(200,232,255,0.95)';
        // keep the whole label on screen
        const half = (Math.max(...l.text.split('\n').map((t) => t.length)) * 21 + 28) / 2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: Math.max(half + 30, Math.min(width - half - 30, p.x)),
              top: y,
              transform: l.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              opacity: o,
              display: 'flex',
              flexDirection: l.below ? 'column-reverse' : 'column',
              alignItems: 'center',
              gap: 8,
              maxWidth: 700,
            }}
          >
            <div
              style={{
                fontSize: l.small ? 24 : 27,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color,
                whiteSpace: 'pre',
                textAlign: 'center',
                padding: '6px 14px',
                background: 'rgba(2,8,20,0.6)',
                borderRadius: 10,
                textShadow: '0 1px 6px rgba(0,0,0,0.9)',
              }}
            >
              {l.text}
            </div>
            <div style={{width: 2, height: 22, background: `linear-gradient(${l.below ? 'transparent' : color}, ${l.below ? color : 'transparent'})`}} />
          </div>
        );
      })}
    </>
  );
};

// --- Counters & notes ----------------------------------------------------------------------

const Counter: React.FC = () => {
  const frame = useCurrentFrame();
  const runA = fadeWindow(frame, SCENES.dots.from + 10, s(15.7), 10);
  const runB = fadeWindow(frame, RUN_B.from - 6, SCENES.compare.from + 10, 10);
  const value = runB > 0 ? countB(frame) : countA(frame);
  const o = Math.max(runA, runB);
  if (o <= 0) return null;
  return (
    <div style={{position: 'absolute', top: SAFE_TOP + 240, width: '100%', textAlign: 'center', opacity: o}}>
      <span style={{fontSize: 26, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(190,220,255,0.85)'}}>ELECTRONS DETECTED&nbsp;&nbsp;</span>
      <span style={{fontSize: 40, fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums'}}>{value.toLocaleString('en-US')}</span>
    </div>
  );
};

const Notes: React.FC = () => {
  const frame = useCurrentFrame();
  const metaphor = fadeWindow(frame, FIRST_SHOT.fire, SCENES.source.to - 2, 10);
  const field = fadeWindow(frame, s(16.6), SCENES.pattern.to, 10);
  const key = fadeWindow(frame, s(13.5), s(16.4), 10);
  const simulated = Math.min(fadeWindow(frame, SCENES.dots.from + 20, DURATION_IN_FRAMES - 30, 12), 1 - field, 1 - key);
  const style: React.CSSProperties = {
    position: 'absolute',
    bottom: SUBTITLE_BOTTOM - 70,
    left: 120,
    right: 120,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 500,
    letterSpacing: '0.04em',
    color: 'rgba(185,212,248,0.9)',
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  };
  return (
    <>
      {metaphor > 0 ? <div style={{...style, opacity: metaphor}}>Flight drawn as a metaphor: only the arrival is detected</div> : null}
      {simulated > 0 ? <div style={{...style, opacity: simulated}}>Idealized simulation of the quantum prediction, not lab data</div> : null}
      {key > 0 ? (
        <div style={{...style, opacity: key}}>
          Dots: simulated detections · <span style={{color: WARM}}>Gold line: predicted probability</span>
        </div>
      ) : null}
      {field > 0 ? <div style={{...style, opacity: field}}>Glow = calculated probability: a visualization, not a water wave</div> : null}
    </>
  );
};

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const kicker = fadeWindow(frame, 6, SCENES.source.to - 4, 12);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: 'white'}}>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.6) 82%, rgba(0,0,0,0.75) 100%)',
        }}
      />
      <Labels />
      <div style={{position: 'absolute', top: SAFE_TOP, width: '100%', textAlign: 'center', fontSize: 27, fontWeight: 600, letterSpacing: '0.4em', color: ACCENT, opacity: kicker, paddingLeft: '0.4em'}}>
        THE DOUBLE-SLIT EXPERIMENT
      </div>
      <SceneTitle />
      <Counter />
      <Notes />
      <Subtitles />
    </AbsoluteFill>
  );
};
