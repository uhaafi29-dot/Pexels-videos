// The whole reel as one continuous stage. Everything is a function of time
// (seconds), anchored to the narration, so picture and voice stay in sync.
import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, Figure, FigureDefs, Held, Outline, POSES, Pose, headOf, mixPose, walkPose} from './figure';
import {A} from './anchors';
import {FPS, HEIGHT, WIDTH, lineEnd} from './timeline';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const soft = Easing.bezier(0.45, 0, 0.2, 1);
/** 0→1 between a and b (seconds), eased. */
const k = (t: number, a: number, b: number, e = soft) => interpolate(t, [a, b], [0, 1], {...clamp, easing: e});
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// --- world layout (one long stage: vacation on the left, home on the right) -----------------
const FLOOR = 1150;
const SPOT_PHONE = 1262; // where the old self stands at the nightstand
const BED_HIP = {x: 1464, y: 1030};
const SHELF = {x: 985, y: 1010};

// --- the person ------------------------------------------------------------------------------
type Main = {x: number; y: number; pose: Pose; dir: number; opacity: number; held: Held};

const walk = (t: number, a: number, b: number, x0: number, x1: number, carry = 0) => {
  const u = k(t, a, b, Easing.bezier(0.35, 0, 0.65, 1));
  const x = lerp(x0, x1, u);
  const moving = Math.min(k(t, a - 0.1, a + 0.35), 1 - k(t, b - 0.35, b + 0.1));
  const phase = (Math.abs(x - x0) / 78) * Math.PI;
  return {x, moving, phase, carry};
};

const mainAt = (t: number): Main => {
  const breathe = Math.sin(t * 1.6) * 1.2;
  const stand = {...POSES.stand, torso: POSES.stand.torso + breathe * 0.3};

  // HOOK — vacation: a morning stretch in open space
  if (t < 5.25) {
    const up = interpolate(t, [0.4, 1.3, 2.2, 3.1], [0, 1, 1, 0], {...clamp, easing: soft});
    return {x: 760, y: FLOOR, pose: mixPose(stand, POSES.stretch, up), dir: -1, opacity: 1, held: null};
  }
  // …walks home, past the door, to the foot of the bed
  if (t < 8.7) {
    const turn = k(t, 5.25, 5.6);
    const w = walk(t, 5.45, 8.6, 760, 1850);
    return {x: w.x, y: FLOOR, pose: mixPose(stand, walkPose(w.phase), w.moving), dir: lerp(-1, 1, turn), opacity: 1, held: null};
  }
  // RISING — tries harder (facing the window, upright) …
  if (t < A.night + 0.6) {
    const turn = k(t, 8.6, 9.0);
    return {x: 1850, y: FLOOR, pose: stand, dir: lerp(1, -1, turn), opacity: 1, held: null};
  }
  // …then one night it fades into the outline in the bed (it *becomes* the old self)
  if (t < A.willpower) {
    return {x: 1850, y: FLOOR, pose: stand, dir: -1, opacity: 1 - k(t, A.night + 0.6, A.night + 1.4), held: null};
  }
  // CONFLICT — standing by the door, intending to leave…
  if (t < A.cues) {
    return {x: 1214, y: FLOOR, pose: stand, dir: -1, opacity: k(t, A.willpower + 0.3, A.willpower + 1.0), held: null};
  }
  // …but the cue turns it, and the hands come up into the old outline
  if (t < A.study + 0.4) {
    const u = k(t, A.cues, A.cues + 0.9);
    return {x: lerp(1214, SPOT_PHONE, u), y: FLOOR, pose: mixPose(stand, POSES.phone, k(t, A.cues + 0.25, A.cues + 1.0)), dir: lerp(-1, 1, k(t, A.cues, A.cues + 0.5)), opacity: 1, held: u > 0.55 ? 'phone' : null};
  }
  // CLIMAX — a new place: carries the phone into an unfamiliar room
  if (t < A.newCues) {
    const w = walk(t, A.study + 0.4, A.study + 2.3, SPOT_PHONE, 1480, 1);
    const pose = mixPose(mixPose(POSES.phone, POSES.stand, k(t, A.study + 0.3, A.study + 0.6)), walkPose(w.phase, 1), w.moving);
    return {x: w.x, y: FLOOR, pose: w.moving > 0.05 ? pose : mixPose(POSES.stand, walkPose(0.4, 1), 1), dir: 1, opacity: 1, held: 'phone-dark'};
  }
  // …turns toward the new window: a window to choose again
  if (t < A.action + 0.9) {
    const turn = k(t, A.newCues, A.newCues + 0.7);
    return {x: 1480, y: FLOOR, pose: mixPose(walkPose(0.4, 1), stand, k(t, A.newCues, A.newCues + 0.8)), dir: lerp(1, -1, turn), opacity: 1, held: t < A.newCues + 0.4 ? 'phone-dark' : 'phone-dark'};
  }
  // RESOLUTION — tonight's experiment: the phone goes outside the bedroom
  if (t < A.charge + 1.6) {
    const w = walk(t, A.action + 0.9, A.charge + 1.0, 1480, 1040, 1);
    return {x: w.x, y: FLOOR, pose: mixPose(mixPose(POSES.stand, walkPose(0.4, 1), 1 - k(t, A.charge + 1.0, A.charge + 1.4)), walkPose(w.phase, 1), w.moving), dir: -1, opacity: 1, held: t < A.charge + 1.25 ? 'phone-dark' : null};
  }
  // …back into the room, to the bed
  if (t < A.choose + 0.2) {
    const turn = k(t, A.charge + 1.6, A.charge + 2.0);
    const w = walk(t, A.charge + 1.8, A.choose, 1040, 1560);
    return {x: w.x, y: FLOOR, pose: mixPose(stand, walkPose(w.phase), w.moving), dir: lerp(-1, 1, turn), opacity: 1, held: null};
  }
  // …and settles, reading: the solid figure hands over to the seated reader
  return {x: 1560, y: FLOOR, pose: stand, dir: 1, opacity: 1 - k(t, A.choose + 0.2, A.choose + 0.9), held: null};
};

// --- the room(s) -------------------------------------------------------------------------------
const Path: React.FC<{d: string; draw?: number; o?: number; w?: number; color?: string}> = ({d, draw = 1, o = 1, w = 3, color = C.ivory}) =>
  draw <= 0.001 || o <= 0.001 ? null : (
    <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />
  );

const HOME = [
  `M1110 ${FLOOR} H1990`,
  `M1110 ${FLOOR} V840 H1210 V${FLOOR}`,
  `M1300 ${FLOOR} V1050 H1372 V${FLOOR} M1308 1094 H1364`,
  `M1400 ${FLOOR} V888 H1420 V${FLOOR}`,
  `M1420 1030 H1750 Q1762 1030 1762 1042 V1070 Q1762 1080 1750 1080 H1420 M1750 1080 V${FLOOR}`,
  'M1428 1030 Q1430 1008 1458 1008 Q1496 1009 1496 1030',
  'M1530 900 V722 H1680 V900 Z M1605 722 V900 M1518 906 H1692',
];
const NEW_ROOM = [
  `M1110 ${FLOOR} H1990`,
  'M1150 1000 V800 Q1150 702 1225 702 Q1300 702 1300 800 V1000 Z M1225 702 V1000 M1138 1006 H1312',
  `M1580 ${FLOOR} V1012 H1820 V${FLOOR} M1580 1024 H1820`,
  'M1785 1012 V942 L1767 922 M1749 922 H1797 L1787 898 H1759 Z',
  `M1612 ${FLOOR} V1078 H1668 V${FLOOR} M1668 1078 V996`,
];
const ARCH = 'M1150 1000 V800 Q1150 702 1225 702 Q1300 702 1300 800 V1000 Z';

// --- frame ------------------------------------------------------------------------------------------
export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const m = mainAt(t);

  // light and place
  const warmth = 1 - k(t, 5.6, 8.4);
  const homeIn = interpolate(t, [A.reveal, A.reveal + 0.9, 5.4, 7.6], [0, 0.32, 0.32, 0.62], clamp);
  const leaveHome = k(t, A.study + 0.2, A.study + 1.4);
  const backHome = k(t, A.action + 0.1, A.action + 1.2);
  const homeO = homeIn * (1 - leaveHome) + 0.62 * backHome;
  const homeDraw = t < A.study ? k(t, A.reveal, A.reveal + 1.0) : t < A.action ? 1 - leaveHome : backHome;
  const newDraw = k(t, A.study + 1.0, A.study + 2.4) * (1 - backHome);
  const archGold = k(t, A.newCues, A.newCues + 1.1) * (1 - backHome);
  // a few days of trying: the window brightens three times, a small gold tick each day
  const dayPulse = (i: number) => interpolate(t, [A.works + i * 0.55, A.works + i * 0.55 + 0.22, A.works + i * 0.55 + 0.5], [0, 1, 0], clamp);
  const days = [0, 1, 2].map(dayPulse);
  const dayGlow = Math.max(...days);
  const night = k(t, A.night, A.night + 0.8);

  // the waiting outline in bed
  const bedReveal = k(t, A.reveal, A.reveal + 0.9);
  const bedBright = lerp(0.42, 0.62, k(t, A.waiting - 0.2, A.waiting + 0.8));
  const bedFill = interpolate(t, [A.night + 0.6, A.night + 1.5, A.willpower + 0.1, A.willpower + 0.9], [0, 1, 1, 0], {...clamp, easing: soft});
  const crumble = k(t, A.fellApart - 0.1, A.fellApart + 1.4);
  const bedBack = k(t, A.action + 0.6, A.action + 1.6); // the cue is still there at home…
  const bedOld = (1 - crumble) * (t < A.study + 1 ? bedBright : 0.42) + bedBack * lerp(0.26, 0.1, k(t, A.choose, A.choose + 1.2));
  const bedGap = t < A.study ? 0.35 : t < A.action ? lerp(0.35, 0.9, crumble) : lerp(0.5, 0.7, k(t, A.choose, A.choose + 1.2));
  const bedDrift = t < A.action ? crumble * 40 : 0;

  // the worn-in outlines at the nightstand (one per repetition)
  const stackIn = k(t, A.strong, A.strong + 0.9);
  const cueOn = k(t, A.permission, A.permission + 0.5) * (1 - k(t, A.study, A.study + 0.6));
  const stackO = stackIn * (1 - crumble);
  // …and the one that survives: it travels with the phone
  const carried = k(t, A.except + 0.2, A.except + 1.0) * (1 - backHome * 0) * (t < A.action + 0.9 ? 1 : 1);
  const onShelf = k(t, A.charge + 1.1, A.charge + 1.9);

  // phone placement
  const phoneOnStand = t < A.cues + 0.45 || (t > A.action + 0.4 && false);
  const phoneLit = (t > A.permission && t < A.study) || (t > A.night + 0.6 && t < A.willpower + 0.6);
  const bookIn = k(t, A.choose - 0.2, A.choose + 0.6);

  // the new self at the end: seated, reading; a new outline starts to form in gold
  const reader = k(t, A.choose + 0.2, A.choose + 0.9);
  const goldDraw = k(t, A.choose + 0.8, lineEnd('cta') + 0.4, Easing.bezier(0.3, 0, 0.4, 1)) * 0.72;

  // intention vs habit
  const spark = interpolate(t, [A.tryHarder + 0.15, A.tryHarder + 0.6, A.night, A.night + 0.6], [0, 1, 1, 0], clamp);
  const arrow = interpolate(t, [A.willpower + 0.7, A.willpower + 1.4, A.intend, A.intend + 0.8], [0, 1, 1, 0.22], clamp) * (1 - k(t, A.study, A.study + 0.5));
  const decision = interpolate(t, [A.intend - 0.15, A.intend + 0.35, A.study, A.study + 0.4], [0, 1, 1, 0], clamp);

  // camera: centre x, zoom (y fixed)
  const cam = (() => {
    const keys: [number, number, number][] = [
      [0, 760, 1.12],
      [A.reveal, 790, 1.12],
      [A.reveal + 0.95, 1150, 0.98],
      [5.4, 1150, 0.98],
      [8.4, 1548, 1.18],
      [A.action + 0.8, 1548, 1.18],
      [A.charge + 0.6, 1330, 1.05],
      [A.charge + 2.0, 1330, 1.05],
      [A.choose + 0.3, 1548, 1.18],
      [lineEnd('cta'), 1548, 1.18],
      [lineEnd('cta') + 1.2, 1548, 1.12],
    ];
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, x0, z0] = keys[i];
    const [t1, x1, z1] = keys[i + 1];
    const u = k(t, t0, t1);
    return {x: lerp(x0, x1, u), z: lerp(z0, z1, u)};
  })();
  const camY = 950;
  const world = `translate(${WIDTH / 2} 900) scale(${cam.z}) translate(${-cam.x} ${-camY})`;

  const headWorld = (x: number, y: number, pose: Pose, dir: number) => {
    const h = headOf(pose);
    return {x: x + h.x * dir, y: y + h.y};
  };
  const mh = headWorld(m.x, m.y, m.pose, m.dir);

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{position: 'absolute', inset: 0}}>
      <FigureDefs />
      <defs>
        <radialGradient id="warm" cx="0.35" cy="0.42" r="0.75">
          <stop offset="0" stopColor="#3c2f22" />
          <stop offset="1" stopColor={C.night} />
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.gold} stopOpacity="0.45" />
          <stop offset="1" stopColor={C.gold} stopOpacity="0" />
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(frame / 2) % 12} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0" />
        </filter>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill={C.night} />
      <rect width={WIDTH} height={HEIGHT} fill="url(#warm)" opacity={warmth} />

      <g transform={world}>
        {/* vacation: open space, a low sun, a horizon line */}
        <circle cx={470} cy={760} r={300} fill="url(#sunGlow)" opacity={warmth} />
        <Path d={`M-300 ${FLOOR} H1100`} o={0.22 + 0.1 * warmth} w={2} />

        {/* home */}
        <g transform={`translate(0 ${leaveHome * 24 * (1 - backHome)})`}>
          {HOME.map((d, i) => (
            <Path key={i} d={d} draw={homeDraw} o={homeO} />
          ))}
          {/* the window: dark at night, briefly bright on each "day" of trying */}
          <rect x={1531} y={723} width={148} height={176} fill={C.gold} opacity={dayGlow * 0.28 * homeO * 1.6} />
          {days.map((d, i) => (
            <path key={i} d={`M${1700 + i * 16} 920 v18`} stroke={C.gold} strokeWidth={3} strokeLinecap="round" opacity={Math.min(1, (t - (A.works + i * 0.55)) * 4) * (1 - night * 0.6) * (t < A.willpower ? 1 : 0) * homeO * 1.6} />
          ))}
          {/* phone on the nightstand */}
          {phoneOnStand && homeO > 0.01 ? (
            <g opacity={Math.min(1, homeO * 1.6)}>
              {phoneLit && t > A.permission ? <circle cx={1336} cy={1040} r={70} fill="url(#tealGlow)" /> : null}
              <rect x={1318} y={1042} width={36} height={8} rx={2} fill={C.night} stroke={C.ivory} strokeWidth={2} />
              {phoneLit && t > A.permission ? <rect x={1322} y={1043} width={28} height={3} fill={C.teal} /> : null}
            </g>
          ) : null}
          {/* tonight's experiment: a shelf outside the bedroom door, the phone charging there */}
          <Path d="M935 1010 H1035 M951 1010 L967 1032" draw={k(t, A.action + 0.6, A.action + 1.4)} o={0.62 * backHome} />
          {onShelf > 0 ? (
            <g opacity={onShelf}>
              <circle cx={SHELF.x} cy={1000} r={40} fill="url(#tealGlow)" opacity={0.6} />
              <rect x={SHELF.x - 18} y={1001} width={36} height={8} rx={2} fill={C.night} stroke={C.ivory} strokeWidth={2} />
              <path d={`M${SHELF.x + 18} 1006 q 26 2 30 40 v 24`} stroke={C.teal} strokeWidth={2} fill="none" opacity={0.7} />
            </g>
          ) : null}
          {/* a book where the phone used to be */}
          {bookIn > 0 ? <rect x={1313} y={1036 + (1 - bookIn) * 8} width={46} height={13} rx={2} fill={C.gold} opacity={bookIn} /> : null}
        </g>

        {/* the new place */}
        {NEW_ROOM.map((d, i) => (
          <Path key={i} d={d} draw={newDraw} o={0.6 * newDraw} />
        ))}
        {archGold > 0 ? (
          <g opacity={archGold}>
            <path d={ARCH} fill={C.gold} opacity={0.32} />
            <path d={`M1152 1000 L1298 1000 L1400 ${FLOOR} L1060 ${FLOOR} Z`} fill="url(#beam)" opacity={0.7} />
            <circle cx={1225} cy={850} r={210} fill="url(#goldGlow)" opacity={0.6} />
          </g>
        ) : null}

        {/* the old self, already waiting in bed */}
        <Outline
          id="bed"
          x={BED_HIP.x}
          y={BED_HIP.y}
          pose={POSES.bedPhone}
          dir={1}
          opacity={bedOld}
          gap={bedGap}
          fill={bedFill}
          drift={bedDrift}
          reveal={t < A.study ? bedReveal : 1}
          held={bedFill > 0.3 || (t > A.night && t < A.willpower + 0.5) ? 'phone' : 'phone-dark'}
        />

        {/* worn in by repetition: older copies stacked behind the nightstand outline */}
        {[2, 1].map((i) => (
          <Outline key={i} id={`stack${i}`} x={SPOT_PHONE - i * 16} y={FLOOR} pose={POSES.phone} dir={1} opacity={stackO * (0.16 + 0.1 * (2 - i))} gap={0.45 + crumble * 0.4} drift={crumble * 50} />
        ))}
        <Outline
          id="cue"
          x={SPOT_PHONE}
          y={FLOOR}
          pose={POSES.phone}
          dir={1}
          color={cueOn > 0.5 ? 'teal' : 'ivory'}
          opacity={stackO * (0.42 + 0.35 * cueOn) * (1 - k(t, A.cues + 0.6, A.cues + 1.0) * 0.85)}
          gap={0.35}
          held={cueOn > 0.2 ? 'phone' : 'phone-dark'}
        />

        {/* the one that survives the move: it travels with the phone */}
        {carried > 0 && t < A.charge + 1.0 ? (
          <Outline id="carried" x={m.x + 74} y={FLOOR} pose={POSES.phone} dir={1} color="teal" opacity={carried * 0.5 * (1 - k(t, A.charge + 0.6, A.charge + 1.0))} gap={0.4} held="phone-dark" />
        ) : null}
        {/* …and once the phone lives outside, so does its outline: faint, still there */}
        {onShelf > 0 ? <Outline id="shelfcue" x={SHELF.x - 70} y={FLOOR} pose={POSES.phone} dir={1} opacity={onShelf * 0.32} gap={0.45} /> : null}

        {/* the person */}
        <Figure x={m.x} y={m.y} pose={m.pose} dir={m.dir} opacity={m.opacity} held={m.held} />

        {/* the new routine: seated, reading, a new outline beginning in gold */}
        {reader > 0 ? (
          <>
            <Figure x={BED_HIP.x} y={BED_HIP.y} pose={POSES.bedRead} dir={1} opacity={reader} held="book" />
            <Outline id="gold" x={BED_HIP.x} y={BED_HIP.y} pose={POSES.bedRead} dir={1} color="gold" opacity={0.85 * reader} gap={0.4} reveal={goldDraw} drift={0} />
          </>
        ) : null}

        {/* intention marks (gold): trying harder, the intention to leave, the late "decision" */}
        {spark > 0 ? <Spark x={mh.x} y={mh.y - 70} o={spark} /> : null}
        {arrow > 0 ? (
          <g opacity={arrow}>
            <Path d={`M${m.x - 46} ${mh.y - 4} H${m.x - 128} M${m.x - 112} ${mh.y - 16} L${m.x - 130} ${mh.y - 4} L${m.x - 112} ${mh.y + 8}`} draw={k(t, A.willpower + 0.7, A.willpower + 1.3)} color={C.gold} w={3.5} />
          </g>
        ) : null}
        {decision > 0 ? (
          <g opacity={decision}>
            <circle cx={mh.x} cy={mh.y - 74} r={24} fill="url(#goldGlow)" />
            <circle cx={mh.x} cy={mh.y - 74} r={6} fill={C.gold} />
          </g>
        ) : null}
      </g>

      <rect width={WIDTH} height={HEIGHT} filter="url(#grain)" opacity={0.055} />
    </svg>
  );
};

const Spark: React.FC<{x: number; y: number; o: number}> = ({x, y, o}) => (
  <g transform={`translate(${x} ${y})`} opacity={o}>
    <circle r={26} fill="url(#goldGlow)" />
    <path d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill={C.gold} />
  </g>
);
