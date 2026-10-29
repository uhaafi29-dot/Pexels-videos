// The whole reel as one continuous stage. Everything is a function of time
// (seconds), anchored to the narration, so picture and voice stay in sync.
//
// Composition: the floor line sits at the same height on screen in every
// shot (FLOOR_SCREEN), just above a fixed caption band, so captions never
// cover the figure. The camera frames each beat closely and glides between
// framings instead of cutting.
import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {A} from './anchors';
import {C, Figure, FigureDefs, Held, Outline, POSES, Pose, handOf, headOf, mixPose, walkPose} from './figure';
import {FPS, HEIGHT, WIDTH, lineEnd} from './timeline';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const soft = Easing.bezier(0.45, 0, 0.2, 1);
/** 0→1 between a and b (seconds), eased. */
const k = (t: number, a: number, b: number, e = soft) => interpolate(t, [a, b], [0, 1], {...clamp, easing: e});
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// --- world layout (one long stage: vacation on the left, home on the right) -----------------
const FLOOR = 1150;
export const FLOOR_SCREEN = 1185; // the floor line's height on screen, in every shot
const SPOT_PHONE = 1262; // where the old self stands at the nightstand
const BED_HIP = {x: 1464, y: 1030};
const SHELF = {x: 985, y: 1010};
const PHONE_STAND = {x: 1336, y: 1046};

// --- the person ------------------------------------------------------------------------------
type Main = {x: number; y: number; pose: Pose; dir: number; opacity: number; held: Held};

const walk = (t: number, a: number, b: number, x0: number, x1: number) => {
  const u = k(t, a, b, Easing.bezier(0.35, 0, 0.65, 1));
  const x = lerp(x0, x1, u);
  const moving = Math.min(k(t, a - 0.1, a + 0.35), 1 - k(t, b - 0.35, b + 0.1));
  const phase = (Math.abs(x - x0) / 78) * Math.PI;
  return {x, moving, phase};
};

const mainAt = (t: number): Main => {
  const breathe = Math.sin(t * 1.6) * 1.2;
  const stand = {...POSES.stand, torso: POSES.stand.torso + breathe * 0.3};
  const holdPhone = mixPose(POSES.stand, walkPose(0.4, 1), 1);

  // HOOK — vacation: a morning stretch in open space
  if (t < 5.25) {
    const up = interpolate(t, [0.2, 0.9, 3.2, 4.0], [0, 1, 1, 0], {...clamp, easing: soft});
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
    const w = walk(t, A.study + 0.5, A.study + 2.5, SPOT_PHONE, 1480);
    const pose = mixPose(mixPose(POSES.phone, holdPhone, k(t, A.study + 0.3, A.study + 0.7)), walkPose(w.phase, 1), w.moving);
    return {x: w.x, y: FLOOR, pose, dir: 1, opacity: 1, held: 'phone-dark'};
  }
  // …turns toward the new window, lowering the phone: a window to choose again
  if (t < A.action + 0.9) {
    const turn = k(t, A.newCues + 0.1, A.newCues + 0.9);
    return {x: 1480, y: FLOOR, pose: mixPose(holdPhone, stand, k(t, A.newCues + 0.3, A.newCues + 1.2)), dir: lerp(1, -1, turn), opacity: 1, held: t < A.newCues + 0.8 ? 'phone-dark' : null};
  }
  // RESOLUTION — tonight's experiment: the phone goes outside the bedroom
  if (t < A.charge + 1.6) {
    const w = walk(t, A.action + 0.9, A.charge + 1.0, 1480, 1040);
    const settle = 1 - k(t, A.charge + 1.0, A.charge + 1.4);
    return {x: w.x, y: FLOOR, pose: mixPose(mixPose(POSES.stand, holdPhone, settle), walkPose(w.phase, 1), w.moving), dir: -1, opacity: 1, held: t < A.charge + 1.25 ? 'phone-dark' : null};
  }
  // …back into the room, to the bedside
  if (t < A.choose + 0.35) {
    const turn = k(t, A.charge + 1.6, A.charge + 2.0);
    const w = walk(t, A.charge + 1.8, A.choose + 0.2, 1040, 1590);
    return {x: w.x, y: FLOOR, pose: mixPose(stand, walkPose(w.phase), w.moving), dir: lerp(-1, 1, turn), opacity: 1, held: null};
  }
  // …and sits down into the new outline with the book (a real motion, not a dissolve)
  const sit = k(t, A.choose + 0.35, A.choose + 1.35, Easing.bezier(0.4, 0, 0.2, 1));
  return {
    x: lerp(1590, BED_HIP.x, sit),
    y: lerp(FLOOR, BED_HIP.y, sit),
    pose: mixPose(stand, POSES.bedRead, sit),
    dir: 1,
    opacity: 1,
    held: sit > 0.55 ? 'book' : null,
  };
};

// --- the room(s) -------------------------------------------------------------------------------
const Path: React.FC<{d: string; draw?: number; o?: number; w?: number; color?: string; dx?: number; dy?: number}> = ({d, draw = 1, o = 1, w = 3, color = C.ivory, dx = 0, dy = 0}) =>
  draw <= 0.001 || o <= 0.001 ? null : (
    <path
      d={d}
      transform={dx || dy ? `translate(${dx} ${dy})` : undefined}
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - draw}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={o}
    />
  );

// Each piece of the home flies apart in its own direction when the setting changes.
const HOME: {d: string; fly: [number, number]}[] = [
  {d: `M1110 ${FLOOR} H1990`, fly: [0, 60]},
  {d: `M1110 ${FLOOR} V840 H1210 V${FLOOR}`, fly: [-170, 30]},
  {d: `M1300 ${FLOOR} V1050 H1372 V${FLOOR} M1308 1094 H1364`, fly: [-90, 120]},
  {d: `M1400 ${FLOOR} V888 H1420 V${FLOOR}`, fly: [-20, 150]},
  {d: `M1420 1030 H1750 Q1762 1030 1762 1042 V1070 Q1762 1080 1750 1080 H1420 M1750 1080 V${FLOOR}`, fly: [80, 170]},
  {d: 'M1428 1030 Q1430 1008 1458 1008 Q1496 1009 1496 1030', fly: [40, 140]},
  {d: 'M1530 900 V722 H1680 V900 Z M1605 722 V900 M1518 906 H1692', fly: [150, -120]},
];
const NEW_ROOM = [
  `M1050 ${FLOOR} H1990`,
  'M1150 1000 V800 Q1150 702 1225 702 Q1300 702 1300 800 V1000 Z M1225 702 V1000 M1138 1006 H1312',
  `M1580 ${FLOOR} V1012 H1820 V${FLOOR} M1580 1024 H1820`,
  'M1785 1012 V942 L1767 922 M1749 922 H1797 L1787 898 H1759 Z',
  `M1612 ${FLOOR} V1078 H1668 V${FLOOR} M1668 1078 V996`,
];
const ARCH = 'M1150 1000 V800 Q1150 702 1225 702 Q1300 702 1300 800 V1000 Z';

// --- camera -------------------------------------------------------------------------------------------
// [time, centre x, zoom]. Zoom is chosen per beat; the floor stays at FLOOR_SCREEN.
const cameraAt = (t: number) => {
  const keys: [number, number, number][] = [
    [0, 760, 1.45], // the figure in warm light, large
    [1.25, 800, 1.45],
    [2.2, 1520, 1.62], // glide to the dark room: the outline is already there
    [3.4, 1520, 1.6],
    [4.7, 1190, 0.98], // pull back: both of them in one frame
    [5.5, 1190, 0.98],
    [8.4, 1640, 1.6], // home: the bed, the window, the foot of the bed
    [A.willpower - 0.2, 1640, 1.6],
    [A.willpower + 0.9, 1335, 1.6], // the door, the nightstand, the outline
    [A.study + 0.3, 1335, 1.6],
    [A.university, 1490, 1.12], // the room comes apart: pull back to the new place
    [A.term, 1460, 1.18],
    [A.newCues + 1.6, 1420, 1.3], // a slow push toward the opening window
    [A.action + 0.8, 1400, 1.3],
    [A.charge + 0.6, 1160, 1.35], // the phone goes outside
    [A.charge + 1.9, 1160, 1.35],
    [A.choose + 0.4, 1505, 1.6], // back to the bed
    [lineEnd('agency') + 0.2, 1505, 1.6],
    [lineEnd('cta') + 0.6, 1375, 1.25], // pull back: phone outside, new routine inside
  ];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, x0, z0] = keys[i];
  const [t1, x1, z1] = keys[i + 1];
  const u = k(t, t0, t1);
  const z = lerp(z0, z1, u);
  return {x: lerp(x0, x1, u), z, y: FLOOR - (FLOOR_SCREEN - 900) / z};
};

// --- frame ------------------------------------------------------------------------------------------
export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const m = mainAt(t);
  const cam = cameraAt(t);
  const toScreen = (x: number, y: number) => ({x: (x - cam.x) * cam.z + WIDTH / 2, y: (y - cam.y) * cam.z + 900});

  // light and place
  const warmth = 1 - k(t, 5.6, 8.4);
  const homeIn = interpolate(t, [A.reveal - 0.1, A.reveal + 0.7, 5.4, 7.6], [0, 0.38, 0.38, 0.62], clamp);
  const apart = k(t, A.study + 0.25, A.university + 0.3, Easing.bezier(0.5, 0, 0.3, 1)); // the old setting comes apart
  const backHome = k(t, A.action + 0.1, A.action + 1.2);
  const homeO = t < A.action ? homeIn * (1 - apart) : 0.62 * backHome;
  const homeDraw = t < A.study ? k(t, A.reveal - 0.1, A.reveal + 0.9) : t < A.action ? 1 : backHome;
  const newDraw = k(t, A.study + 1.1, A.university + 1.0) * (1 - backHome);
  const archGold = k(t, A.newCues - 0.1, A.newCues + 1.3) * (1 - backHome);
  const flood = k(t, A.newCues + 0.2, A.newCues + 2.2) * (1 - backHome);
  // the dark room at the reveal gets a cold, quiet glow of its own
  const coldPool = interpolate(t, [A.reveal - 0.1, A.reveal + 0.8, 4.4, 5.6], [0, 1, 1, 0.35], clamp) * (1 - k(t, 8, 9.5));
  // a few days of trying: the window brightens three times, a small gold tick each day
  const dayPulse = (i: number) => interpolate(t, [A.works + i * 0.55, A.works + i * 0.55 + 0.22, A.works + i * 0.55 + 0.5], [0, 1, 0], clamp);
  const days = [0, 1, 2].map(dayPulse);
  const dayGlow = Math.max(...days);
  const night = k(t, A.night, A.night + 0.8);

  // the waiting outline in bed: drawn in bright, then settles
  const bedReveal = k(t, A.reveal, A.reveal + 0.85, Easing.bezier(0.3, 0, 0.3, 1));
  const revealFlash = interpolate(t, [A.reveal, A.reveal + 0.8, A.reveal + 2.4], [0.4, 0.95, 0.6], clamp);
  const bedBright = t < A.waiting - 0.2 ? revealFlash : lerp(0.6, 0.7, k(t, A.waiting - 0.2, A.waiting + 0.8));
  const bedFill = interpolate(t, [A.night + 0.6, A.night + 1.5, A.willpower + 0.1, A.willpower + 0.9], [0, 1, 1, 0], {...clamp, easing: soft});
  const crumble = k(t, A.fellApart - 0.2, A.fellApart + 1.3, Easing.bezier(0.5, 0, 0.6, 1));
  const bedOld = (1 - crumble) * (t < A.study + 1 ? bedBright : 0.5);
  const bedGap = lerp(0.35, 0.95, crumble);

  // the worn-in outlines at the nightstand (one per repetition)
  const stackIn = k(t, A.strong, A.strong + 0.9);
  const cueOn = k(t, A.permission, A.permission + 0.5) * (1 - k(t, A.study, A.study + 0.6));
  const stackO = stackIn * (1 - crumble);
  // …and the one that survives the move: it travels with the phone
  const carried = k(t, A.except + 0.1, A.except + 0.9);
  const carriedFade = 1 - 0.55 * flood; // a new setting takes some of its pull
  const onShelf = k(t, A.charge + 1.1, A.charge + 1.9);
  // "except where parts of the old setting stayed the same": everything else dims
  const spotlight = interpolate(t, [A.except, A.except + 0.6, A.term - 0.2, A.term + 0.6], [0, 1, 1, 0], clamp);

  // phone placement
  const phoneOnStand = t < A.cues + 0.45;
  const phoneLit = (t > A.permission && t < A.study) || (t > A.night + 0.6 && t < A.willpower + 0.6);
  const bookIn = k(t, A.choose - 0.3, A.choose + 0.3);

  // the ending: an open invitation (a faint gold outline in the bed) appears
  // first; the figure sits into it; the outline stays unfinished, still forming
  const invite = k(t, A.choose - 0.2, A.choose + 0.6);
  // it grows a little as the reel closes, but stays open near the head: begun, not finished
  const inviteDraw = lerp(0, 0.36, k(t, A.choose - 0.2, A.choose + 0.8)) + 0.12 * k(t, lineAt_cta() - 0.2, lineEnd('cta') + 0.6);

  // intention vs habit
  const spark = interpolate(t, [A.tryHarder + 0.15, A.tryHarder + 0.6, A.night, A.night + 0.6], [0, 1, 1, 0], clamp);
  const arrow = interpolate(t, [A.willpower + 0.7, A.willpower + 1.4, A.intend, A.intend + 0.8], [0, 1, 1, 0.22], clamp) * (1 - k(t, A.study, A.study + 0.5));
  const decision = interpolate(t, [A.intend - 0.15, A.intend + 0.35, A.study, A.study + 0.4], [0, 1, 1, 0], clamp);

  const world = `translate(${WIDTH / 2} 900) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  const headWorld = (x: number, y: number, pose: Pose, dir: number) => {
    const h = headOf(pose);
    return {x: x + h.x * dir, y: y + h.y};
  };
  const mh = headWorld(m.x, m.y, m.pose, m.dir);
  const hand = handOf(m.pose);
  const handScreen = toScreen(m.x + hand.x * m.dir + 40, m.y + hand.y);

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{position: 'absolute', inset: 0}}>
      <FigureDefs />
      <defs>
        <radialGradient id="warm" cx="0.35" cy="0.42" r="0.75">
          <stop offset="0" stopColor="#3c2f22" />
          <stop offset="1" stopColor={C.night} />
        </radialGradient>
        <radialGradient id="cold" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1b2a44" stopOpacity="0.9" />
          <stop offset="1" stopColor="#1b2a44" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.gold} stopOpacity="0.5" />
          <stop offset="1" stopColor={C.gold} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="floodG" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.gold} stopOpacity="0.32" />
          <stop offset="0.6" stopColor={C.gold} stopOpacity="0.1" />
          <stop offset="1" stopColor={C.gold} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="spot" cx={handScreen.x / WIDTH} cy={handScreen.y / HEIGHT} r="0.42" gradientUnits="objectBoundingBox">
          <stop offset="0.3" stopColor={C.night} stopOpacity="0" />
          <stop offset="1" stopColor={C.night} stopOpacity="0.72" />
        </radialGradient>
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

        {/* the dark room's own cold pool of light at the reveal */}
        <ellipse cx={1520} cy={960} rx={420} ry={330} fill="url(#cold)" opacity={coldPool} />

        {/* home: drawn in at the reveal; flies apart when the setting changes */}
        {HOME.map(({d, fly}, i) => (
          <Path key={i} d={d} draw={homeDraw} o={homeO} dx={t < A.action ? fly[0] * apart : 0} dy={t < A.action ? fly[1] * apart : 0} />
        ))}
        {/* the window: dark at night, briefly bright on each "day" of trying */}
        <rect x={1531} y={723} width={148} height={176} fill={C.gold} opacity={dayGlow * 0.3 * homeO * 1.6} />
        {days.map((d, i) => (
          <path key={i} d={`M${1700 + i * 16} 920 v18`} stroke={C.gold} strokeWidth={3} strokeLinecap="round" opacity={Math.min(1, (t - (A.works + i * 0.55)) * 4) * (1 - night * 0.6) * (t < A.willpower ? 1 : 0) * homeO * 1.6} />
        ))}
        {/* phone on the nightstand */}
        {phoneOnStand && homeO > 0.01 ? (
          <g opacity={Math.min(1, homeO * 1.6)}>
            {phoneLit && t > A.permission ? <circle cx={PHONE_STAND.x} cy={PHONE_STAND.y - 6} r={80} fill="url(#tealGlow)" /> : null}
            <rect x={1318} y={1042} width={36} height={8} rx={2} fill={C.night} stroke={C.ivory} strokeWidth={2} />
            {phoneLit && t > A.permission ? <rect x={1322} y={1043} width={28} height={3} fill={C.teal} /> : null}
          </g>
        ) : null}
        {/* tonight's experiment: a shelf outside the bedroom door, the phone charging there */}
        <Path d="M935 1010 H1035 M951 1010 L967 1032" draw={k(t, A.action + 0.6, A.action + 1.4)} o={0.62 * backHome} />
        {onShelf > 0 ? (
          <g opacity={onShelf}>
            <circle cx={SHELF.x} cy={1000} r={46} fill="url(#tealGlow)" opacity={0.55} />
            <rect x={SHELF.x - 18} y={1001} width={36} height={8} rx={2} fill={C.night} stroke={C.ivory} strokeWidth={2} />
            <path d={`M${SHELF.x + 18} 1006 q 26 2 30 40 v 24`} stroke={C.teal} strokeWidth={2} fill="none" opacity={0.7} />
          </g>
        ) : null}
        {/* a book where the phone used to be */}
        {bookIn > 0 && t < A.choose + 0.9 ? (
          <g opacity={bookIn * (1 - k(t, A.choose + 0.6, A.choose + 0.9))}>
            <circle cx={1336} cy={1040} r={44} fill="url(#goldGlow)" opacity={0.6} />
            <rect x={1313} y={1036 + (1 - bookIn) * 8} width={46} height={13} rx={2} fill={C.gold} />
          </g>
        ) : null}

        {/* the new place */}
        {NEW_ROOM.map((d, i) => (
          <Path key={i} d={d} draw={newDraw} o={0.62 * newDraw} />
        ))}
        {archGold > 0 ? (
          <g opacity={archGold}>
            <path d={ARCH} fill={C.gold} opacity={0.34} />
            <path d={`M1152 1000 L1298 1000 L${1420 + 260 * flood} ${FLOOR} L${1040 - 40 * flood} ${FLOOR} Z`} fill="url(#beam)" opacity={0.75} />
            <circle cx={1225} cy={850} r={220} fill="url(#goldGlow)" opacity={0.6} />
            <ellipse cx={1380} cy={FLOOR - 40} rx={120 + 420 * flood} ry={60 + 170 * flood} fill="url(#floodG)" opacity={flood} />
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
          drift={crumble * 130}
          reveal={t < A.study ? bedReveal : 1}
          held={bedFill > 0.3 || (t > A.night && t < A.willpower + 0.5) || t < 7.8 ? 'phone' : 'phone-dark'}
        />

        {/* worn in by repetition: older copies stacked behind the nightstand outline */}
        {[2, 1].map((i) => (
          <Outline key={i} id={`stack${i}`} x={SPOT_PHONE - i * 16 - crumble * 40 * i} y={FLOOR} pose={POSES.phone} dir={1} opacity={stackO * (0.16 + 0.1 * (2 - i))} gap={0.45 + crumble * 0.5} drift={crumble * 150} />
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
          <Outline id="carried" x={m.x + 74} y={FLOOR} pose={POSES.phone} dir={1} color="teal" opacity={carried * 0.62 * carriedFade * (1 - k(t, A.charge + 0.6, A.charge + 1.0))} gap={0.38} held="phone" />
        ) : null}
        {/* …and once the phone lives outside, so does its outline: faint, still there */}
        {onShelf > 0 ? <Outline id="shelfcue" x={SHELF.x - 70} y={FLOOR} pose={POSES.phone} dir={1} color="teal" opacity={onShelf * 0.34} gap={0.45} /> : null}

        {/* the new routine: an invitation in gold, waiting where the old self waited */}
        {invite > 0 ? <Outline id="invite" x={BED_HIP.x} y={BED_HIP.y} pose={POSES.bedRead} dir={1} color="gold" opacity={0.9 * invite} gap={0.42} reveal={inviteDraw} /> : null}

        {/* the person */}
        <Figure x={m.x} y={m.y} pose={m.pose} dir={m.dir} opacity={m.opacity} held={m.held} />
        {/* the gold outline stays visible around the seated figure: begun, not finished */}
        {invite > 0 && t > A.choose + 1.0 ? <Outline id="invite2" x={BED_HIP.x} y={BED_HIP.y} pose={POSES.bedRead} dir={1} color="gold" opacity={0.95 * k(t, A.choose + 1.0, A.choose + 1.6)} gap={0.45} reveal={inviteDraw} halo /> : null}

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

      {/* what survives the move is singled out: everything else falls into shadow */}
      {spotlight > 0 ? <rect width={WIDTH} height={HEIGHT} fill="url(#spot)" opacity={spotlight} /> : null}
      <rect width={WIDTH} height={HEIGHT} filter="url(#grain)" opacity={0.055} />
    </svg>
  );
};

const lineAt_cta = () => A.cta;

const Spark: React.FC<{x: number; y: number; o: number}> = ({x, y, o}) => (
  <g transform={`translate(${x} ${y})`} opacity={o}>
    <circle r={26} fill="url(#goldGlow)" />
    <path d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill={C.gold} />
  </g>
);
