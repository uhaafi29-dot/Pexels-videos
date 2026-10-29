import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C} from './figure';
import {CAPTION_CHUNKS, DURATION_IN_FRAMES, FPS, lineAt, lineEnd, wordAt} from './timeline';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Cormorant Garamond', 'Times New Roman', serif";
// Instagram Reels safe area: keep text below ~230 px and above the bottom ~500 px.
const SAFE_TOP = 250;
const SUB_BOTTOM = 500;

const fadeIn = (f: number, a: number, b: number, r = 12) => interpolate(f, [a, a + r, b - r, b], [0, 1, 1, 0], clamp);
const s = (sec: number) => Math.round(sec * FPS);

const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const chunk = CAPTION_CHUNKS.find((c) => f >= c.from && f < c.to);
  if (!chunk) return null;
  const enter = interpolate(f, [chunk.from, chunk.from + 6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const exit = interpolate(f, [chunk.to - 4, chunk.to], [1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 90, right: 90, bottom: SUB_BOTTOM, display: 'flex', justifyContent: 'center', opacity: enter * exit, transform: `translateY(${(1 - enter) * 10}px)`}}>
      <div
        style={{
          background: 'rgba(5,8,15,0.66)',
          borderRadius: 20,
          padding: '14px 26px 18px',
          textAlign: 'center',
          fontFamily: SANS,
          fontSize: 54,
          lineHeight: 1.16,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: C.ivory,
          maxWidth: 900,
        }}
      >
        {chunk.words.map((w, i) => {
          const spoken = interpolate(f, [w.from - 2, w.from + 2], [0, 1], clamp);
          const end = Math.max(w.to, w.from + 2);
          const now = interpolate(f, [w.from - 2, w.from + 1, end, end + 5], [0, 1, 1, 0], clamp);
          return (
            <span key={i} style={{display: 'inline-block', marginRight: i < chunk.words.length - 1 ? '0.25em' : 0, opacity: 0.5 + 0.5 * spoken, color: now > 0.5 ? C.gold : C.ivory}}>
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const Small: React.FC<{o: number; children: React.ReactNode}> = ({o, children}) => (
  <div style={{position: 'absolute', top: SAFE_TOP, left: 80, right: 80, textAlign: 'center', fontFamily: SANS, fontSize: 25, fontWeight: 500, letterSpacing: '0.06em', lineHeight: 1.5, color: 'rgba(239,230,214,0.82)', opacity: o}}>
    {children}
  </div>
);

export const Overlay: React.FC = () => {
  const f = useCurrentFrame();
  // research note while the study is described (citation on screen, science in the voice)
  const note = fadeIn(f, s(lineAt('study') + 1.6), s(lineAt('term') - 0.1), 14);
  // the term, set quietly
  const termFrom = s(wordAt('term', 3) - 0.2);
  const term = fadeIn(f, termFrom, s(lineEnd('term') + 0.6), 16);
  const rule = interpolate(f, [termFrom + 4, termFrom + 26], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  // series sign-off
  const ctaFrom = s(lineAt('cta') - 0.1);
  const cta = fadeIn(f, ctaFrom, DURATION_IN_FRAMES + 20, 18);
  const black = Math.max(interpolate(f, [0, 9], [1, 0], clamp), interpolate(f, [DURATION_IN_FRAMES - 14, DURATION_IN_FRAMES - 1], [0, 1], clamp));

  return (
    <AbsoluteFill>
      <Captions />
      {note > 0 ? (
        <Small o={note}>
          <span style={{color: C.gold, letterSpacing: '0.3em', fontWeight: 600, fontSize: 22}}>RESEARCH</span>
          <br />
          Wood, Tam &amp; Witt (2005), Journal of Personality and Social Psychology
          <br />
          <span style={{fontSize: 21, opacity: 0.75}}>The outlines are a visual metaphor for cue-driven habits</span>
        </Small>
      ) : null}
      {term > 0 ? (
        <div style={{position: 'absolute', top: SAFE_TOP, width: '100%', textAlign: 'center', opacity: term}}>
          <div style={{fontFamily: SERIF, fontSize: 68, fontWeight: 600, letterSpacing: '0.08em', color: C.ivory, lineHeight: 1}}>HABIT</div>
          <div style={{fontFamily: SERIF, fontSize: 68, fontWeight: 600, letterSpacing: '0.08em', color: C.ivory, lineHeight: 1.05}}>DISCONTINUITY</div>
          <div style={{margin: '18px auto 0', height: 1.5, width: 300 * rule, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`}} />
        </div>
      ) : null}
      {cta > 0 ? (
        <div style={{position: 'absolute', top: SAFE_TOP, width: '100%', textAlign: 'center', opacity: cta}}>
          <div style={{fontFamily: SANS, fontSize: 22, fontWeight: 600, letterSpacing: '0.42em', paddingLeft: '0.42em', color: C.gold}}>A SERIES</div>
          <div style={{marginTop: 14, fontFamily: SERIF, fontSize: 60, fontWeight: 600, letterSpacing: '0.06em', color: C.ivory, lineHeight: 1.05}}>
            The Psychology
            <br />
            of Becoming
          </div>
        </div>
      ) : null}
      <AbsoluteFill style={{background: 'black', opacity: black}} />
    </AbsoluteFill>
  );
};
