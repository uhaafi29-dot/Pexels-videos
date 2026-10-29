import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {CAPTION_CHUNKS, DURATION_IN_FRAMES, SCENES, lineAt, lineEnd, s, wordAt} from '../timeline';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Cormorant Garamond', 'Times New Roman', serif";
const GOLD = '#ffd38a';

// Instagram Reels safe area: nothing important above ~210 px (header) or in
// the bottom ~430 px (caption, audio row) or under the right-hand buttons.
const SAFE_TOP = 230;
const SUB_BOTTOM = 500;

const fade = (f: number, a: number, b: number, r = 12) => interpolate(f, [a, a + r, b - r, b], [0, 1, 1, 0], clamp);
const rise = (f: number, a: number) => interpolate(f, [a, a + 20], [16, 0], {...clamp, easing: Easing.out(Easing.cubic)});

const shadow = '0 2px 24px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.9)';
/** A soft pool of shade behind headline type, so it reads over bright windows. */
const plate: React.CSSProperties = {background: 'radial-gradient(ellipse at center, rgba(4,6,10,0.62) 0%, rgba(4,6,10,0.35) 45%, rgba(4,6,10,0) 72%)', padding: '46px 40px'};

/** Word-synced captions: large, high-contrast, one phrase at a time. */
const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const chunk = CAPTION_CHUNKS.find((c) => f >= c.from && f < c.to);
  if (!chunk) return null;
  const enter = interpolate(f, [chunk.from, chunk.from + 6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const exit = interpolate(f, [chunk.to - 4, chunk.to], [1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 90, right: 90, bottom: SUB_BOTTOM, display: 'flex', justifyContent: 'center', opacity: enter * exit, transform: `translateY(${(1 - enter) * 14}px)`}}>
      <div
        style={{
          background: 'rgba(6,8,12,0.62)',
          borderRadius: 22,
          padding: '16px 28px 20px',
          textAlign: 'center',
          fontFamily: SANS,
          fontSize: 56,
          lineHeight: 1.16,
          fontWeight: 700,
          letterSpacing: '-0.012em',
          color: 'white',
          maxWidth: 900,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        {chunk.words.map((w, i) => {
          const spoken = interpolate(f, [w.from - 2, w.from + 2], [0, 1], clamp);
          const end = Math.max(w.to, w.from + 2);
          const now = interpolate(f, [w.from - 2, w.from + 1, end, end + 5], [0, 1, 1, 0], clamp);
          return (
            <span key={i} style={{display: 'inline-block', marginRight: i < chunk.words.length - 1 ? '0.25em' : 0, opacity: 0.5 + 0.5 * spoken, color: now > 0.5 ? GOLD : 'white'}}>
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const Kicker: React.FC<{children: React.ReactNode; opacity: number; top: number}> = ({children, opacity, top}) => (
  <div style={{position: 'absolute', top, width: '100%', textAlign: 'center', fontFamily: SANS, fontSize: 26, fontWeight: 500, letterSpacing: '0.42em', paddingLeft: '0.42em', color: 'rgba(235,225,210,0.9)', opacity, textShadow: shadow}}>
    {children}
  </div>
);

export const Overlay: React.FC = () => {
  const f = useCurrentFrame();

  // 1 — the hook title
  const hook = fade(f, 6, s(3.6), 14);
  // 3 — the metaphor note while the threads first appear
  const note = fade(f, s(17.4), s(21.6), 12);
  // 4 — the term, set like a magazine headline
  const termFrom = wordAt('l09', 4) - 6;
  const term = fade(f, termFrom, s(37.0), 14);
  const rule = interpolate(f, [termFrom + 6, termFrom + 30], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  // 6 — the closing line and the call to action
  const endFrom = lineAt('l16') + s(2.3);
  const end = fade(f, endFrom, DURATION_IN_FRAMES, 16);
  const cta = fade(f, endFrom + 28, DURATION_IN_FRAMES, 14);
  const black = Math.max(interpolate(f, [0, 10], [1, 0], clamp), interpolate(f, [DURATION_IN_FRAMES - 16, DURATION_IN_FRAMES - 1], [0, 1], clamp));

  return (
    <AbsoluteFill style={{color: 'white'}}>
      {/* gentle top and bottom grade keeps text legible over bright frames */}
      <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 100%)'}} />

      {hook > 0 ? (
        <div style={{position: 'absolute', top: SAFE_TOP, left: 30, right: 30, textAlign: 'center', opacity: hook, transform: `translateY(${rise(f, 6)}px)`, ...plate}}>
          <div style={{fontFamily: SERIF, fontSize: 80, fontWeight: 600, lineHeight: 1.02, letterSpacing: '0.04em', textShadow: shadow}}>
            WHY DOES THE
            <br />
            OLD YOU COME BACK?
          </div>
        </div>
      ) : null}

      {note > 0 ? <Kicker opacity={note * 0.85} top={SAFE_TOP + 30}>THREADS = A METAPHOR FOR LEARNED CUES</Kicker> : null}

      {term > 0 ? (
        <div style={{position: 'absolute', top: SAFE_TOP + 20, width: '100%', textAlign: 'center', opacity: term, transform: `translateY(${rise(f, termFrom)}px)`}}>
          <div style={{fontFamily: SANS, fontSize: 24, fontWeight: 600, letterSpacing: '0.46em', paddingLeft: '0.46em', color: GOLD, textShadow: shadow}}>PSYCHOLOGY</div>
          <div style={{margin: '22px auto 0', height: 1.5, width: 360 * rule, background: 'linear-gradient(90deg, transparent, rgba(255,211,138,0.9), transparent)'}} />
          <div style={{marginTop: 22, fontFamily: SERIF, fontSize: 76, fontWeight: 600, lineHeight: 1.0, letterSpacing: '0.06em', textShadow: shadow}}>
            HABIT
            <br />
            DISCONTINUITY
            <br />
            <span style={{fontStyle: 'italic', letterSpacing: '0.02em'}}>effect</span>
          </div>
        </div>
      ) : null}

      {end > 0 ? (
        <div style={{position: 'absolute', top: SAFE_TOP, left: 20, right: 20, textAlign: 'center', opacity: end, transform: `translateY(${rise(f, endFrom)}px)`, ...plate}}>
          <div style={{fontFamily: SERIF, fontSize: 74, fontWeight: 600, lineHeight: 1.05, letterSpacing: '0.05em', textShadow: shadow}}>
            CHANGE THE CUE.
            <br />
            <span style={{color: GOLD}}>CHANGE THE POSSIBILITY.</span>
          </div>
          <div style={{marginTop: 26, fontFamily: SANS, fontSize: 34, fontWeight: 500, letterSpacing: '0.02em', color: 'rgba(240,232,220,0.92)', opacity: cta, textShadow: shadow}}>
            Follow for the hidden science of becoming.
          </div>
        </div>
      ) : null}

      <Captions />
      <AbsoluteFill style={{background: 'black', opacity: black}} />
    </AbsoluteFill>
  );
};

void SCENES;
