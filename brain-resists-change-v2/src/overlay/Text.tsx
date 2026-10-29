import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {CAPTION_CHUNKS, DIVE, DURATION_IN_FRAMES, NEW_PULSES, SEQ, WHIP, attemptCount, practiceLevel} from '../timeline';
import {FAMILIAR_COLOR, NEW_COLOR} from '../three/Scene3D';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const rgb = (c: [number, number, number], a = 1) => `rgba(${c.map((v) => Math.round(v * 255)).join(',')},${a})`;
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const ACCENT = '#7ff3ff';

/** Fade in at `from`, out at `to`. */
const window_ = (frame: number, from: number, to: number, ramp = 10) =>
  interpolate(frame, [from, from + ramp, to - ramp, to], [0, 1, 1, 0], clamp);

// --- Captions ------------------------------------------------------------------

/**
 * Large, high-contrast captions for phones: one short phrase at a time on a
 * dark plate; each word lights up exactly when it is spoken.
 */
const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const chunk = CAPTION_CHUNKS.find((c) => frame >= c.from && frame < c.to);
  if (!chunk) return null;
  const enter = interpolate(frame, [chunk.from, chunk.from + 6], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const exit = interpolate(frame, [chunk.to - 4, chunk.to], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        bottom: 400,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(enter, 1) * exit,
        transform: `translateY(${(1 - enter) * 24}px) scale(${0.94 + 0.06 * enter})`,
      }}
    >
      <div
        style={{
          background: 'rgba(2,6,16,0.72)',
          border: '1.5px solid rgba(120,190,255,0.22)',
          borderRadius: 28,
          padding: '22px 34px 26px',
          boxShadow: '0 18px 60px rgba(0,0,0,0.6)',
          textAlign: 'center',
          fontSize: 74,
          lineHeight: 1.12,
          fontWeight: 800,
          letterSpacing: '-0.015em',
          maxWidth: 960,
        }}
      >
        {chunk.words.map((w, i) => {
          const spoken = interpolate(frame, [w.from - 2, w.from + 2], [0, 1], clamp);
          const end = Math.max(w.to, w.from + 2); // very short words ("a") still get a beat
          const speaking = interpolate(frame, [w.from - 2, w.from + 1, end, end + 5], [0, 1, 1, 0], clamp);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: i < chunk.words.length - 1 ? '0.26em' : 0,
                color: speaking > 0.5 ? ACCENT : 'white',
                opacity: 0.45 + 0.55 * spoken,
                transform: `scale(${1 + speaking * 0.06})`,
                textShadow: speaking > 0.5 ? '0 0 26px rgba(90,220,255,0.75)' : '0 2px 10px rgba(0,0,0,0.8)',
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

// --- Chapter titles -----------------------------------------------------------------

const CHAPTERS = [
  {n: '01', title: 'THE QUESTION', from: 6, to: 110},
  {n: '02', title: 'THE FAMILIAR PATH', from: SEQ.familiar.from + 8, to: SEQ.familiar.from + 80},
  {n: '03', title: 'A NEW ROUTE', from: SEQ.newRoute.from + 10, to: SEQ.newRoute.from + 82},
];

const Chapter: React.FC<{n: string; title: string; from: number; to: number}> = ({n, title, from, to}) => {
  const frame = useCurrentFrame();
  const o = window_(frame, from, to, 12);
  const line = interpolate(frame, [from, from + 18], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  if (o <= 0) return null;
  return (
    <div style={{position: 'absolute', top: 190, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: o}}>
      <div style={{fontSize: 30, fontWeight: 600, letterSpacing: '0.42em', color: 'rgba(160,210,255,0.95)', paddingLeft: '0.42em'}}>
        <span style={{color: ACCENT}}>{n}</span>
        <span style={{opacity: 0.5}}> — </span>
        {title}
      </div>
      <div style={{marginTop: 18, height: 2, width: 280 * line, background: 'linear-gradient(90deg, transparent, rgba(127,243,255,0.9), transparent)'}} />
    </div>
  );
};

// --- Sequence 3 HUD: legend + repetition counter -------------------------------------

const PracticeHud: React.FC = () => {
  const frame = useCurrentFrame();
  const o = window_(frame, SEQ.newRoute.from + 84, DURATION_IN_FRAMES - 4, 12);
  if (o <= 0) return null;
  const count = attemptCount(frame);
  const level = practiceLevel(frame);
  const bump = NEW_PULSES.reduce((m, p) => {
    const dt = frame - p.start;
    return dt >= 0 && dt < 12 ? Math.max(m, 1 - dt / 12) : m;
  }, 0);
  return (
    <div style={{position: 'absolute', top: 190, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: o}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 34, fontSize: 28, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(225,238,255,0.95)'}}>
        <Swatch color={rgb(FAMILIAR_COLOR)} label="FAMILIAR" />
        <Swatch color={rgb(NEW_COLOR)} label="NEW" />
        <div style={{width: 2, height: 34, background: 'rgba(150,200,255,0.3)'}} />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontWeight: 600, color: 'rgba(200,225,255,0.85)'}}>REPS</span>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: ACCENT,
              display: 'inline-block',
              minWidth: 64,
              transform: `scale(${1 + bump * 0.3})`,
              textShadow: `0 0 ${10 + bump * 30}px rgba(90,220,255,0.8)`,
            }}
          >
            ×{count}
          </span>
        </div>
      </div>
      <div style={{width: 420, height: 7, borderRadius: 4, background: 'rgba(120,180,255,0.18)', overflow: 'hidden'}}>
        <div style={{width: `${Math.max(3, level * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${rgb(NEW_COLOR, 0.6)}, ${rgb(NEW_COLOR)})`, boxShadow: `0 0 14px ${rgb(NEW_COLOR)}`}} />
      </div>
    </div>
  );
};

const Swatch: React.FC<{color: string; label: string}> = ({color, label}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
    <div style={{width: 46, height: 7, borderRadius: 4, background: color, boxShadow: `0 0 12px ${color}, 0 0 26px ${color}`}} />
    {label}
  </div>
);

// --- Transitions ---------------------------------------------------------------------

/** 1 → 2: the camera dives into the brain and bursts through into the network. */
const DiveFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [DIVE.from + 8, DIVE.cut, DIVE.to], [0, 1, 0], {...clamp, easing: Easing.inOut(Easing.quad)});
  if (o <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        opacity: o,
        background: 'radial-gradient(circle at 50% 46%, rgba(235,250,255,1) 0%, rgba(120,200,255,0.9) 22%, rgba(30,90,220,0.55) 50%, rgba(0,10,40,0) 80%)',
      }}
    />
  );
};

/** 2 → 3: a whip-pan, sold with a sweeping light streak. */
const WhipStreak: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [WHIP.from + 2, WHIP.from + 20], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const o = interpolate(frame, [WHIP.from + 2, WHIP.from + 8, WHIP.from + 16, WHIP.from + 22], [0, 0.85, 0.85, 0], clamp);
  if (o <= 0) return null;
  return (
    <AbsoluteFill style={{opacity: o, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          top: -200,
          bottom: -200,
          width: 900,
          left: -900 + t * 2900,
          transform: 'skewX(-14deg)',
          background: 'linear-gradient(90deg, rgba(60,140,255,0) 0%, rgba(110,200,255,0.35) 40%, rgba(230,250,255,0.75) 50%, rgba(110,200,255,0.35) 60%, rgba(60,140,255,0) 100%)',
          filter: 'blur(18px)',
        }}
      />
    </AbsoluteFill>
  );
};

// --- Overlay -----------------------------------------------------------------------------

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const series = window_(frame, 4, DIVE.from, 14);
  const metaphor = window_(frame, SEQ.familiar.from + 40, SEQ.familiar.from + 150, 12);
  const endNote = window_(frame, DURATION_IN_FRAMES - 45, DURATION_IN_FRAMES - 2, 10);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: 'white'}}>
      {/* shading keeps text legible over the brightest parts of the frame */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      {CHAPTERS.map((c) => (
        <Chapter key={c.n} {...c} />
      ))}
      <div
        style={{
          position: 'absolute',
          top: 300,
          width: '100%',
          textAlign: 'center',
          fontSize: 50,
          fontWeight: 300,
          letterSpacing: '0.02em',
          opacity: series,
          textShadow: '0 0 24px rgba(60,150,255,0.6)',
        }}
      >
        Why Your Brain Resists Change
      </div>
      <PracticeHud />
      <Captions />
      {[metaphor, endNote].map((o, i) =>
        o > 0 ? (
          <div
            key={i}
            style={{position: 'absolute', bottom: 330, width: '100%', textAlign: 'center', fontSize: 27, fontWeight: 500, letterSpacing: '0.06em', color: 'rgba(190,215,250,0.92)', opacity: o}}
          >
            Pathways shown are a visual metaphor, not literal brain anatomy
          </div>
        ) : null,
      )}
      <DiveFlash />
      <WhipStreak />
    </AbsoluteFill>
  );
};
