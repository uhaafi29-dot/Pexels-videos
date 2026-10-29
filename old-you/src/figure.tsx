// A minimal faceless silhouette, drawn from a few joint angles so poses can
// blend smoothly into each other. The same figure renders either as a solid
// ivory shape (the person) or as a fine broken contour (an "old self" outline).
import React from 'react';

export const C = {
  night: '#0b1120',
  ivory: '#efe6d6',
  gold: '#cfa75e',
  teal: '#5fb3a8',
};

/**
 * Angles in degrees: 0 = hanging straight down, positive = toward the
 * direction the figure faces. Forearm/shin angles are relative to the
 * upper arm/thigh. `py` is the pelvis height above the anchor (negative = up).
 */
export type Pose = {
  py: number;
  torso: number;
  head: number;
  shF: number; // far arm
  elF: number;
  shN: number; // near arm
  elN: number;
  hpF: number; // far leg
  knF: number;
  hpN: number; // near leg
  knN: number;
};

export const POSES = {
  stand: {py: -190, torso: 0, head: 2, shF: 6, elF: 8, shN: -4, elN: 10, hpF: 2, knF: 0, hpN: -2, knN: 0},
  stretch: {py: -192, torso: -3, head: -12, shF: 172, elF: 2, shN: 166, elN: 4, hpF: 2, knF: 0, hpN: -2, knN: 0},
  phone: {py: -190, torso: 7, head: 30, shF: 22, elF: 96, shN: 27, elN: 92, hpF: 2, knF: 0, hpN: -2, knN: 0},
  // sitting up in bed, back against the headboard, legs along the mattress
  bedPhone: {py: 0, torso: -10, head: 28, shF: 26, elF: 96, shN: 32, elN: 90, hpF: 88, knF: 0, hpN: 92, knN: -4},
  bedRead: {py: 0, torso: -8, head: 18, shF: 34, elF: 70, shN: 38, elN: 66, hpF: 88, knF: 0, hpN: 92, knN: -4},
} satisfies Record<string, Pose>;

export const mixPose = (a: Pose, b: Pose, t: number): Pose => {
  const out = {} as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};

/** A walking pose at a given phase (radians). `carry` bends the near arm to hold something. */
export const walkPose = (phase: number, carry = 0): Pose => {
  const s = Math.sin(phase);
  const legF = 22 * s;
  const legN = -22 * s;
  return {
    py: -188 + Math.abs(Math.cos(phase)) * -3,
    torso: 3,
    head: 4,
    shF: -16 * s,
    elF: 14,
    shN: (16 * s) * (1 - carry) + 30 * carry,
    elN: 14 * (1 - carry) + 62 * carry,
    hpF: legF,
    knF: -Math.max(0, 34 * Math.sin(phase + 1.2)),
    hpN: legN,
    knN: -Math.max(0, 34 * Math.sin(phase + Math.PI + 1.2)),
  };
};

const R = Math.PI / 180;
type P = {x: number; y: number};
const dirv = (deg: number): P => ({x: Math.sin(deg * R), y: Math.cos(deg * R)});
const add = (a: P, d: P, l: number): P => ({x: a.x + d.x * l, y: a.y + d.y * l});

const LEN = {torso: 118, neck: 13, head: 28, upper: 74, fore: 70, thigh: 94, shin: 92};

export const skeleton = (p: Pose) => {
  const pel = {x: 0, y: p.py};
  const up = {x: Math.sin(p.torso * R), y: -Math.cos(p.torso * R)};
  const side = {x: -up.y, y: up.x};
  const neck = add(pel, up, LEN.torso);
  const shoulder = add(pel, up, LEN.torso - 12);
  const headC = add(neck, {x: Math.sin((p.torso + p.head) * R), y: -Math.cos((p.torso + p.head) * R)}, LEN.neck + LEN.head);
  const limb = (o: P, a1: number, a2: number, l1: number, l2: number) => {
    const j = add(o, dirv(a1), l1);
    return [o, j, add(j, dirv(a1 + a2), l2)] as const;
  };
  return {
    pel,
    up,
    side,
    neck,
    headC,
    torso: [add(pel, side, 26), add(shoulder, side, 33), add(shoulder, side, -33), add(pel, side, -26)],
    armF: limb(shoulder, p.shF, p.elF, LEN.upper, LEN.fore),
    armN: limb(shoulder, p.shN, p.elN, LEN.upper, LEN.fore),
    legF: limb(pel, p.hpF, p.knF, LEN.thigh, LEN.shin),
    legN: limb(pel, p.hpN, p.knN, LEN.thigh, LEN.shin),
  };
};

const Limb: React.FC<{pts: readonly P[]; w1: number; w2: number; color: string; gap?: string}> = ({pts, w1, w2, color, gap}) => (
  <>
    {gap ? (
      <>
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={gap} strokeWidth={w1 + 7} strokeLinecap="round" />
        <line x1={pts[1].x} y1={pts[1].y} x2={pts[2].x} y2={pts[2].y} stroke={gap} strokeWidth={w2 + 7} strokeLinecap="round" />
      </>
    ) : null}
    <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={color} strokeWidth={w1} strokeLinecap="round" />
    <line x1={pts[1].x} y1={pts[1].y} x2={pts[2].x} y2={pts[2].y} stroke={color} strokeWidth={w2} strokeLinecap="round" />
  </>
);

/** The figure's shapes in local coordinates (facing +x, anchor at 0,0). */
export const FigureShapes: React.FC<{pose: Pose; color?: string; separate?: boolean}> = ({pose, color = C.ivory, separate = true}) => {
  const k = skeleton(pose);
  const gap = separate ? C.night : undefined;
  return (
    <g>
      <Limb pts={k.legF} w1={40} w2={30} color={color} />
      <Limb pts={k.armF} w1={25} w2={20} color={color} />
      <polygon points={k.torso.map((p) => `${p.x},${p.y}`).join(' ')} fill={color} stroke={color} strokeWidth={14} strokeLinejoin="round" />
      <line x1={k.neck.x} y1={k.neck.y + 6} x2={k.headC.x} y2={k.headC.y} stroke={color} strokeWidth={18} strokeLinecap="round" />
      <circle cx={k.headC.x} cy={k.headC.y} r={LEN.head} fill={color} />
      <Limb pts={k.legN} w1={40} w2={30} color={color} />
      <Limb pts={k.armN} w1={25} w2={20} color={color} gap={gap} />
    </g>
  );
};

/** Where the near hand is, in local coordinates (for things held). */
export const handOf = (pose: Pose) => {
  const k = skeleton(pose);
  const [, elbow, hand] = k.armN;
  return {x: hand.x, y: hand.y, angle: Math.atan2(hand.y - elbow.y, hand.x - elbow.x) / R};
};
export const headOf = (pose: Pose) => skeleton(pose).headC;

export type Held = 'phone' | 'phone-dark' | 'book' | null;

const HeldThing: React.FC<{pose: Pose; held: Held}> = ({pose, held}) => {
  if (!held) return null;
  const h = handOf(pose);
  if (held === 'book') {
    return <rect x={h.x - 6} y={h.y - 20} width={40} height={28} rx={3} fill={C.gold} transform={`rotate(${-12} ${h.x} ${h.y})`} />;
  }
  const lit = held === 'phone';
  return (
    <g transform={`translate(${h.x + 4} ${h.y - 6}) rotate(${h.angle - 90})`}>
      {lit ? <circle r={46} fill="url(#tealGlow)" /> : null}
      <rect x={-9} y={-15} width={18} height={30} rx={4} fill={C.night} stroke={C.ivory} strokeWidth={2} />
      <rect x={-6} y={-12} width={12} height={24} rx={2} fill={lit ? C.teal : '#1d2a3c'} />
    </g>
  );
};

export type FigureProps = {
  x: number;
  y: number;
  pose: Pose;
  /** facing: 1 = right, -1 = left; values between flip smoothly through a turn */
  dir?: number;
  opacity?: number;
  held?: Held;
};

/** The person: a solid ivory silhouette. */
export const Figure: React.FC<FigureProps> = ({x, y, pose, dir = 1, opacity = 1, held = null}) => {
  if (opacity <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1)`} opacity={opacity}>
      <FigureShapes pose={pose} />
      <HeldThing pose={pose} held={held} />
    </g>
  );
};

/**
 * An "old self": the same figure as a fine, broken contour. The solid shape
 * is turned into an edge by the contour filter, then broken into short dashes
 * by a striped mask. `gap` (0..1) widens the breaks so it can crumble away.
 */
export const Outline: React.FC<FigureProps & {id: string; color?: 'ivory' | 'gold' | 'teal'; gap?: number; fill?: number; drift?: number; reveal?: number; halo?: boolean}> = ({
  id,
  x,
  y,
  pose,
  dir = 1,
  opacity = 1,
  color = 'ivory',
  gap = 0.35,
  fill = 0,
  drift = 0,
  reveal = 1,
  held = null,
  halo = false,
}) => {
  if (opacity <= 0.001) return null;
  const stripe = 9;
  return (
    <g transform={`translate(${x} ${y + drift}) scale(${dir} 1)`}>
      <defs>
        <pattern id={`p-${id}`} width={stripe} height={stripe} patternUnits="userSpaceOnUse" patternTransform="rotate(52)">
          <rect width={stripe * (1 - gap)} height={stripe} fill="white" />
        </pattern>
        <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={-400} y={-600} width={800} height={900}>
          <rect x={-400} y={-600} width={800} height={900} fill={`url(#p-${id})`} />
        </mask>
        {/* a wipe from the feet up, for the outline drawing itself in */}
        <clipPath id={`c-${id}`}>
          <rect x={-400} y={60 - 520 * reveal} width={800} height={520 * reveal + 20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#c-${id})`}>
        {fill > 0 ? (
          <g opacity={fill}>
            <FigureShapes pose={pose} />
            <HeldThing pose={pose} held={held} />
          </g>
        ) : null}
        <g opacity={opacity * (1 - fill)}>
          <g mask={`url(#m-${id})`}>
            <g filter={halo ? `url(#halo-${color})` : `url(#contour-${color})`}>
              <FigureShapes pose={pose} separate={false} />
            </g>
          </g>
          {held && held !== 'book' && fill < 1 ? <HeldGhost pose={pose} lit={held === 'phone'} /> : null}
        </g>
      </g>
    </g>
  );
};

/** A faint phone shape in an outline's hands (lit = the cue is "on"). */
const HeldGhost: React.FC<{pose: Pose; lit: boolean}> = ({pose, lit}) => {
  const h = handOf(pose);
  return (
    <g transform={`translate(${h.x + 4} ${h.y - 6}) rotate(${h.angle - 90})`}>
      {lit ? <circle r={34} fill="url(#tealGlow)" /> : null}
      <rect x={-9} y={-15} width={18} height={30} rx={4} fill="none" stroke={lit ? C.teal : C.ivory} strokeWidth={1.6} strokeDasharray="4 3" />
    </g>
  );
};

/** Shared SVG definitions: contour filters and glows. Render once per frame. */
export const FigureDefs: React.FC = () => (
  <defs>
    {(['ivory', 'gold', 'teal'] as const).map((c) => (
      <filter key={c} id={`contour-${c}`} x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="erode" radius="2.4" result="inner" />
        <feComposite in="SourceAlpha" in2="inner" operator="out" result="ring" />
        <feFlood floodColor={C[c]} />
        <feComposite in2="ring" operator="in" />
      </filter>
    ))}
    {/* outer halo contour: drawn just outside the silhouette, for an outline around a solid figure */}
    {(['gold'] as const).map((c) => (
      <filter key={c} id={`halo-${c}`} x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="8" result="outer" />
        <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="inner" />
        <feComposite in="outer" in2="inner" operator="out" result="ring" />
        <feFlood floodColor={C[c]} />
        <feComposite in2="ring" operator="in" />
      </filter>
    ))}
    <radialGradient id="tealGlow">
      <stop offset="0" stopColor={C.teal} stopOpacity="0.55" />
      <stop offset="1" stopColor={C.teal} stopOpacity="0" />
    </radialGradient>
    <radialGradient id="goldGlow">
      <stop offset="0" stopColor={C.gold} stopOpacity="0.55" />
      <stop offset="1" stopColor={C.gold} stopOpacity="0" />
    </radialGradient>
    <radialGradient id="sunGlow">
      <stop offset="0" stopColor="#f1d39a" stopOpacity="0.6" />
      <stop offset="0.5" stopColor="#d9a95f" stopOpacity="0.18" />
      <stop offset="1" stopColor="#d9a95f" stopOpacity="0" />
    </radialGradient>
  </defs>
);
