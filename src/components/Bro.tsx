// Bro, the mascot: a cast-iron kettlebell in a lime sweatband. Drawn on a 120×120 grid from a few
// plain shapes, so it stays crisp from a 28px avatar to a full-screen moment. scripts/make-icons.mjs
// draws the same geometry for the app icon; keep the two in step when changing the body, handle or face.
import { useId, type CSSProperties } from 'react';

export type BroMood = 'happy' | 'hype' | 'wink' | 'focus' | 'sleep';

// Iron for the body, the app's lime for the band. The face is drawn light so it reads on dark iron.
const IRON_HI = '#7c8492', IRON = '#4d525d', IRON_LO = '#30343c', HANDLE = '#5c626e', FIST = '#737a88';
const BAND = '#c3f73a', LIGHT = '#f2f4f6', DARK = '#101216';
// Rounder on top than underneath: the flatter base is what makes it a weight on the floor, not a ball.
const BODY = 'M19 80A34 34 0 0 1 53 46H67A34 34 0 0 1 101 80V92A22 22 0 0 1 79 114H41A22 22 0 0 1 19 92Z';

const eye = (cx: number, cy = 84, ry = 7) => (
  <>
    <ellipse cx={cx} cy={cy} rx={5.8} ry={ry} fill="#fff" />
    <circle cx={cx + 0.8} cy={cy + 0.8} r={3.3} fill={DARK} />
    <circle cx={cx + 2} cy={cy - 0.8} r={1.1} fill="#fff" />
  </>
);
const line = { fill: 'none', stroke: LIGHT, strokeWidth: 3.5, strokeLinecap: 'round' } as const;

const EYES: Record<BroMood, React.ReactNode> = {
  happy: <>{eye(46)}{eye(74)}</>,
  hype: <path d="M40 86q6-8 12 0M68 86q6-8 12 0" {...line} />,
  wink: <>{eye(46)}<path d="M68 85q6-6 12 0" {...line} /></>,
  focus: <>{eye(46, 85.5, 6)}{eye(74, 85.5, 6)}<path d="M38.5 74.5l12 3M81.5 74.5l-12 3" {...line} /></>,
  sleep: <path d="M40 84q6 5 12 0M68 84q6 5 12 0" {...line} />,
};

const smile = <path d="M53 95q7 6.5 14 0" {...line} />;
const MOUTH: Record<BroMood, React.ReactNode> = {
  happy: smile,
  wink: smile,
  hype: <><path d="M51 93h18a9 9 0 0 1-18 0z" fill={DARK} /><path d="M55.5 99.2a6 4 0 0 1 9 0a8.6 8.6 0 0 1-9 0z" fill="#ff7a6b" /></>,
  focus: <path d="M54 97q6 3.5 12 0" {...line} />,
  sleep: <ellipse cx={60} cy={97} rx={3.2} ry={3.6} fill={LIGHT} />,
};

// Each arm is a curve from the body to a fist: [path, fist x, fist y].
type Arm = [string, number, number];
const DOWN_L: Arm = ['M21 86q-11 4-11 15', 10, 101], UP_L: Arm = ['M21 80q-13-2-12-18', 9, 62];
const UP_R: Arm = ['M99 80q13-2 12-18', 111, 62];
const REST_L: Arm = ['M21 90q-9 6-8 14', 13, 104], REST_R: Arm = ['M99 90q9 6 8 14', 107, 104];
const ARMS: Record<BroMood, [Arm, Arm]> = {
  happy: [DOWN_L, UP_R], // a wave
  wink: [DOWN_L, UP_R],
  hype: [UP_L, UP_R], // both up
  focus: [UP_L, UP_R],
  sleep: [REST_L, REST_R],
};

/** The mascot. `arms` adds the little arms (best from about 48px up); `alive` adds a slow bob and a blink. */
export function Bro({ mood = 'happy', size = 64, arms = false, alive = false, className = '', style }: {
  mood?: BroMood;
  size?: number;
  arms?: boolean;
  alive?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId();
  const [l, r] = ARMS[mood];
  return (
    <svg className={`bro${alive ? ' alive' : ''} ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" style={style}>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={IRON_HI} />
          <stop offset="0.45" stopColor={IRON} />
          <stop offset="1" stopColor={IRON_LO} />
        </linearGradient>
        <clipPath id={`${id}c`}><path d={BODY} /></clipPath>
      </defs>
      {arms && (
        <>
          <g fill="none" stroke={IRON} strokeWidth="9" strokeLinecap="round"><path d={l[0]} /><path d={r[0]} /></g>
          <circle cx={l[1]} cy={l[2]} r="7" fill={FIST} />
          <circle cx={r[1]} cy={r[2]} r="7" fill={FIST} />
        </>
      )}
      <path d="M35 60V39a13 13 0 0 1 13-13h24a13 13 0 0 1 13 13V60" fill="none" stroke={HANDLE} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {/* The hairline rim keeps dark iron from melting into dark sheets and cards. */}
      <path d={BODY} fill={`url(#${id}b)`} stroke="#fff" strokeOpacity="0.16" strokeWidth="1" />
      <g clipPath={`url(#${id}c)`}>
        <rect x="10" y="57" width="100" height="11" fill={BAND} />
        <rect x="10" y="65.5" width="100" height="2.5" fill="#000" opacity="0.14" />
        <ellipse cx="60" cy="121" rx="46" ry="12" fill="#000" opacity="0.12" />
      </g>
      <path d="M28 87q-1.5-8 2.5-14" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="4.5" strokeLinecap="round" />
      <g className="bro-eyes">{EYES[mood]}</g>
      {MOUTH[mood]}
      {mood === 'sleep' && (
        <g className="bro-zz" fill="#fff" opacity="0.85" fontFamily="ui-rounded, system-ui" fontWeight="900">
          <text x="94" y="34" fontSize="15">z</text>
          <text x="105" y="21" fontSize="11">z</text>
        </g>
      )}
    </svg>
  );
}
