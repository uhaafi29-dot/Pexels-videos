import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {CAPTIONS, SCENES} from '../timeline';
import {FAMILIAR_COLOR, NEW_COLOR} from '../three/Scene3D';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const rgb = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

/** Words drift up out of a soft blur, one after another, and exit together. */
const RevealWords: React.FC<{text: string; from: number; to: number; stagger: number; style: React.CSSProperties}> = ({
  text,
  from,
  to,
  stagger,
  style,
}) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [to - 14, to], [1, 0], clamp);
  return (
    <div style={{...style, opacity: out}}>
      {text.split(' ').map((word, i) => {
        const t = interpolate(frame, [from + i * stagger, from + i * stagger + 16], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: '0.28em',
              opacity: t,
              filter: `blur(${(1 - t) * 10}px)`,
              transform: `translateY(${(1 - t) * 18}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const glow = '0 0 18px rgba(60,150,255,0.55), 0 0 42px rgba(30,110,255,0.35), 0 2px 6px rgba(0,0,0,0.8)';

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();

  const kicker = interpolate(frame, [8, 30, 105, 118], [0, 1, 1, 0], clamp);
  const disclaimer = interpolate(frame, [20, 40, 100, 116], [0, 0.6, 0.6, 0], clamp);
  const legend = interpolate(frame, [SCENES.newRoute.from + 20, SCENES.newRoute.from + 40, 585, 598], [0, 1, 1, 0], clamp);
  const familiarLegend = interpolate(frame, [SCENES.familiar.from + 10, SCENES.familiar.from + 30, 585, 598], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{fontFamily: FONT, color: 'white'}}>
      {/* soft shade so captions stay legible over the glowing brain */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.7) 88%)',
        }}
      />
      {/* Scene 1 kicker */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          width: '100%',
          textAlign: 'center',
          fontSize: 26,
          letterSpacing: '0.42em',
          fontWeight: 500,
          color: 'rgba(150,200,255,0.85)',
          opacity: kicker,
          textShadow: glow,
        }}
      >
        THE SCIENCE OF HABITS
      </div>

      {CAPTIONS.map((c, i) =>
        frame >= c.from - 1 && frame <= c.to + 1 ? (
          c.kind === 'title' ? (
            <RevealWords
              key={i}
              text={c.text}
              from={c.from}
              to={c.to}
              stagger={4}
              style={{
                position: 'absolute',
                top: 310,
                left: 90,
                right: 90,
                textAlign: 'center',
                fontSize: 76,
                lineHeight: 1.15,
                fontWeight: 300,
                letterSpacing: '-0.01em',
                textShadow: glow,
              }}
            />
          ) : (
            <RevealWords
              key={i}
              text={c.text}
              from={c.from}
              to={c.to}
              stagger={3}
              style={{
                position: 'absolute',
                bottom: 300,
                left: 110,
                right: 110,
                textAlign: 'center',
                fontSize: 50,
                lineHeight: 1.3,
                fontWeight: 400,
                textShadow: glow,
              }}
            />
          )
        ) : null,
      )}

      {/* Route legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 170,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 56,
          fontSize: 25,
          letterSpacing: '0.2em',
          fontWeight: 500,
          color: 'rgba(210,230,255,0.85)',
        }}
      >
        <Legend color={rgb(FAMILIAR_COLOR)} label="FAMILIAR ROUTE" opacity={familiarLegend} />
        <div style={{maxWidth: legend * 360, overflow: 'hidden', whiteSpace: 'nowrap', marginLeft: (legend - 1) * 56}}>
          <Legend color={rgb(NEW_COLOR)} label="NEW ROUTE" opacity={legend} />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 120,
          width: '100%',
          textAlign: 'center',
          fontSize: 22,
          letterSpacing: '0.12em',
          color: 'rgba(170,200,240,1)',
          opacity: disclaimer,
        }}
      >
        Conceptual visualization · not an anatomical simulation
      </div>
    </AbsoluteFill>
  );
};

const Legend: React.FC<{color: string; label: string; opacity: number}> = ({color, label, opacity}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 16, opacity}}>
    <div
      style={{
        width: 44,
        height: 5,
        borderRadius: 3,
        background: color,
        boxShadow: `0 0 12px ${color}, 0 0 24px ${color}`,
      }}
    />
    {label}
  </div>
);
