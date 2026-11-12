// Front and back figures with each of the 18 catalog muscles as a region, shaded by band.
// Hand-drawn on a 120×252 grid per figure: only the right half is defined (x 60–120) and the left
// half is its mirror. A surface-coloured stroke cuts the gaps between neighbouring regions.
import type { CSSProperties } from 'react';
import type { Band, Muscle } from '../lib/muscles';

type Region = [Muscle | null, string];

const HEAD = 'M60 5.5C66.5 5.5 70.5 10.5 70.5 18C70.5 25.5 66.5 31 60 31C53.5 31 49.5 25.5 49.5 18C49.5 10.5 53.5 5.5 60 5.5Z';
const NECK = 'M55 30.5H65V39C62 40.5 58 40.5 55 39Z';
const HAND = 'M98 139C100.5 138 103.5 138.5 105 140C106 145 105.5 150 103.5 153.5C101.5 155 99.5 154.5 98.5 152.5C97.5 148 97.5 143 98 139Z';
const KNEE = 'M67.5 180C71 178.5 77 178.5 80.5 180C81.5 184 81.5 188 80.5 191C77 192.5 71 192.5 67.5 191C66.5 188 66.5 184 67.5 180Z';
const FOOT = 'M70.5 239.5C73.5 238.5 77 238.5 79.5 239.5C81.5 242.5 82.5 245.5 82 248.5H69.5C69 245.5 69.5 242.5 70.5 239.5Z';
// The shoulder cap in two: the inner part is the front delt on the front view and the rear delt on
// the back view, and the outer part is the side delt on both.
const DELT_INNER = 'M80.5 41.5C83 41 85.3 40.7 87.5 40.8C91.5 47 93.6 56 93.4 65.1C92.2 65 91 64.9 90 65C89.5 57 86.5 50.5 80.5 46.5Z';
const DELT_OUTER = 'M87.5 40.8C92.5 41.8 96.8 47 98 56C98.5 60 98 63.5 97 66C95.8 65.5 94.6 65.2 93.4 65.1C93.6 56 91.5 47 87.5 40.8Z';
const UPPER_ARM = 'M90.5 67C93 66 96 66.5 97.5 68C100 76 100.5 86 99.5 96C97 97.5 93.5 97.5 91.5 96C89.5 86 89.5 76 90.5 67Z';
const FOREARM = 'M92 100C94.5 99 98 99 100 100.5C102.5 112 104 124 104 136C102 137.5 99.5 137.5 97.5 136.5C94.5 124 92.5 112 92 100Z';
const SHIN = 'M67.5 195C71 193.5 77.5 193.5 81 195C83 206 82 222 79.5 236C77 237.5 73.5 237.5 71 236C68 222 66.5 206 67.5 195Z';
const CALF = 'M67 195C71 193 78 193 82 195C85 204 83.5 222 79.5 236C77 237.5 73.5 237.5 71 236C67.5 222 65.5 206 67 195Z';

const FRONT: Region[] = [
  [null, HAND], [null, KNEE], [null, FOOT],
  ['Traps', 'M66.5 33C70.5 38 75.5 40.5 80.5 41.5L80.5 44C75 44 70 43.5 66.5 42.5Z'],
  ['Front Delts', DELT_INNER],
  ['Side Delts', DELT_OUTER],
  ['Chest', 'M61.5 45.5C67 44.5 74 44.5 80 46.5C86 50.5 89 57 89.5 65C84 71 72 72.5 61.5 70Z'],
  ['Biceps', UPPER_ARM],
  ['Forearms', FOREARM],
  ['Abdominals', 'M61.5 73.5C65 74.5 69 74.8 72.5 74.5L72.5 117.5C69 120.5 65 123.5 61.5 126Z'],
  ['Abdominals', 'M74.5 74.3C78 73.8 81 72.8 83.5 71.5C84 82 81 94 77.5 104C77.5 108 79 111 80.5 113C78.5 114.8 76.5 116.3 74.5 117.8Z'], // obliques
  ['Quadriceps', 'M64 130C71 126 77 119 81 112C85.5 124 87.5 142 85.5 160C84.5 168 82.5 174 80.5 177.5C76.5 176.5 71.5 176.5 67.5 177.5C65 162 64 146 64 130Z'],
  ['Abductors', 'M79.5 113C84.5 115 88 121 88.5 130C88.5 136 87.5 141 86 145C81.5 137 78.5 126 79.5 113Z'],
  ['Adductors', 'M61.5 129C64 129.5 66.5 131 68 133.5C68.5 146 68.5 160 67.5 173C64.5 162 62.5 146 61.5 129Z'],
  ['Calves', SHIN],
];

const BACK: Region[] = [
  [null, HAND], [null, KNEE], [null, FOOT],
  ['Middle Back', 'M64 50C72 45.5 81 45 88.5 49C89.5 56 89.5 62 88.5 68C80 70.5 71 73 63.5 76Z'],
  ['Lats', 'M88.5 69.5C88.5 81 83.5 93 77.5 103.8C72 103.8 66.5 101.5 61.5 98.5L61.5 78.5C70 76 80 73 88.5 69.5Z'],
  ['Traps', 'M61.5 31C64 31 66 32 66.5 33.5C70.5 38.5 75.5 41 80.5 42C74 47.5 67.5 57 61.5 72Z'],
  ['Rear Delts', DELT_INNER],
  ['Side Delts', DELT_OUTER],
  ['Triceps', UPPER_ARM],
  ['Forearms', FOREARM],
  ['Lower Back', 'M61.5 101.5C67 104.5 72.5 105.8 77.5 106C77.5 109 79 112 81 114.5C81 117 81.5 119 82 121C75 122.3 68 122.6 61.5 122Z'],
  ['Glutes', 'M61.5 124.5C68 125 76 124.5 82.5 123C86.5 130 88 140 85.5 149C79 154.5 68.5 155 61.5 151Z'],
  ['Hamstrings', 'M64 155.5C71 158.5 79 158 85.5 153C86 162 84.5 171 80.5 177.5C76.5 176.5 71.5 176.5 67.5 177.5C65.5 170 64.5 163 64 155.5Z'],
  ['Adductors', 'M61.5 153.5C63.5 154.5 65 155.5 66 157C66.5 163 67 169 67.5 174C64.5 168 62.5 161 61.5 153.5Z'],
  ['Calves', CALF],
];

/** Every muscle has at least one region on one of the two figures. */
export const MAPPED = new Set<Muscle>([...FRONT, ...BACK].flatMap(([m]) => (m ? [m] : [])));

function Figure({ regions, bands, selected, onPick, label }: {
  regions: Region[];
  bands: Record<Muscle, Band>;
  selected?: Muscle | null;
  onPick?: (m: Muscle) => void;
  label: string;
}) {
  const half = (
    <>
      {regions.map(([m, d], i) =>
        m ? (
          <path key={i} d={d} className={`r band-${bands[m]}`} onClick={onPick ? () => onPick(m) : undefined} />
        ) : (
          <path key={i} d={d} className="base" />
        ),
      )}
    </>
  );
  const sel = selected ? regions.filter(([m]) => m === selected).map(([, d], i) => <path key={i} d={d} className="sel" />) : null;
  return (
    <figure>
      <svg viewBox="0 0 120 252" className={`bm${onPick ? ' pickable' : ''}`} aria-hidden="true">
        <path d={HEAD} className="base" />
        <path d={NECK} className="base" />
        <g>{half}{sel}</g>
        <g transform="translate(120 0) scale(-1 1)">{half}{sel}</g>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** Front and back views shaded by band. Colour is never the only signal: callers list the numbers too. */
export function BodyMap({ bands, selected, onPick, label, width = 150, style }: {
  bands: Record<Muscle, Band>;
  selected?: Muscle | null;
  onPick?: (m: Muscle) => void;
  label: string; // what the figures show, for screen readers
  width?: number; // max width of each figure, px
  style?: CSSProperties;
}) {
  return (
    <div className="bodymap" role="img" aria-label={label} style={{ '--bm-w': `${width}px`, ...style } as CSSProperties}>
      <Figure regions={FRONT} bands={bands} selected={selected} onPick={onPick} label="Front" />
      <Figure regions={BACK} bands={bands} selected={selected} onPick={onPick} label="Back" />
    </div>
  );
}
