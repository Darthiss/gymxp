export function uid(): string {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the ISO week containing the date, as YYYY-MM-DD. */
export function weekKey(iso: string): string {
  const d = parseDate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return parseDate(iso).toLocaleDateString('en-GB', opts);
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtKg(kg: number): string {
  if (kg >= 10000) return `${fmtNum(kg / 1000, 1)} t`;
  return `${fmtNum(kg, 1)} kg`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Duration in minutes from "62", "62 min", "1:02:03", "1h 2m" or seconds ("3720"). */
export function parseDuration(s: string): number {
  const t = s.trim().toLowerCase();
  if (!t) return 0;
  const hm = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hm) return hm[3] !== undefined ? +hm[1] * 60 + +hm[2] + +hm[3] / 60 : +hm[1] + +hm[2] / 60; // h:m:s or m:s
  const h = t.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*m(?!s)/);
  if (h || m) return (h ? num(h[1]) * 60 : 0) + (m ? num(m[1]) : 0);
  const n = num(t);
  if (/\bs(ec)?/.test(t) || n > 300) return n / 60; // looks like seconds
  return n;
}

export interface WatchImport { dur?: number; kcal?: number; hr?: number; start?: string }

/** Parse text from the iOS Shortcut ("dur=62 kcal=410 hr=128 start=18:05") or free text ("62 min, 410 kcal, 128 bpm"). */
export function parseWatchText(text: string): WatchImport {
  const out: WatchImport = {};
  const kv = (k: string) => text.match(new RegExp(`${k}\\s*[=:]\\s*([^&;\\n]+?)(?=\\s+\\w+\\s*[=:]|[&;\\n]|$)`, 'i'))?.[1];
  const dur = kv('dur'), kcal = kv('kcal'), hr = kv('hr'), start = kv('start');
  if (dur) out.dur = Math.round(parseDuration(dur));
  if (kcal) out.kcal = Math.round(num(kcal));
  if (hr) out.hr = Math.round(num(hr));
  if (start) {
    const m = start.match(/(\d{1,2}):(\d{2})/);
    if (m) out.start = `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  if (out.dur || out.kcal || out.hr) return out;
  // Free text fallback
  const k = text.match(/(\d+(?:[.,]\d+)?)\s*(?:active\s*)?k?cal/i);
  const b = text.match(/(\d+(?:[.,]\d+)?)\s*bpm/i);
  const d = text.match(/(\d+:\d{2}(?::\d{2})?)/) ?? text.match(/(\d+(?:[.,]\d+)?)\s*min/i);
  if (k) out.kcal = Math.round(num(k[1]));
  if (b) out.hr = Math.round(num(b[1]));
  if (d) out.dur = Math.round(parseDuration(d[1].includes(':') ? d[1] : `${d[1]} min`));
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};
const MONTH_RE = '(jan|ene|feb|mar|apr|abr|may|jun|jul|aug|ago|sep|set|oct|nov|dec|dic)[a-zñ]*\\.?';

/**
 * Find a date in free text: "2026-09-02", "2/9", "02/09/2026" (day first), "Sep 2", "2 sept".
 * Without a year, uses the most recent such date that isn't in the future.
 * Returns the ISO date and the text with the date removed.
 */
export function extractDate(text: string, todayIso = today()): { date: string; rest: string } | null {
  const mk = (y: number | undefined, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const ty = Number(todayIso.slice(0, 4));
    let year = y === undefined ? ty : y < 100 ? 2000 + y : y;
    let iso = `${year}-${pad(m)}-${pad(d)}`;
    if (y === undefined && iso > todayIso) iso = `${--year}-${pad(m)}-${pad(d)}`;
    return iso;
  };
  const tries: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/(\d{4})-(\d{1,2})-(\d{1,2})/, (m) => mk(+m[1], +m[2], +m[3])],
    [/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/, (m) => mk(m[3] ? +m[3] : undefined, +m[2], +m[1])],
    [new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?${MONTH_RE}(?:\\s+(\\d{4}))?`, 'i'), (m) => mk(m[3] ? +m[3] : undefined, MONTHS[m[2].toLowerCase()], +m[1])],
    [new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, 'i'), (m) => mk(m[3] ? +m[3] : undefined, MONTHS[m[1].toLowerCase()], +m[2])],
  ];
  for (const [re, fn] of tries) {
    const m = text.match(re);
    const date = m && fn(m);
    if (m && date) return { date, rest: text.replace(m[0], ' ') };
  }
  return null;
}

/**
 * Parse one pasted workout line: a date plus optional watch stats, either with units
 * ("Sep 2 · 1:02:15 · 410 kcal · 128 bpm") or as bare numbers in the order minutes, kcal, bpm ("2/9 62 410 128").
 */
export function parseWorkoutLine(line: string, todayIso = today()): ({ date: string } & WatchImport) | null {
  const found = extractDate(line, todayIso);
  if (!found) return null;
  if (/kcal|cal\b|bpm|min|=/i.test(found.rest)) return { date: found.date, ...parseWatchText(found.rest) };
  const nums = found.rest.match(/\d+(?::\d{2}){1,2}|\d+(?:[.,]\d+)?/g) ?? [];
  const out: { date: string } & WatchImport = { date: found.date };
  if (nums[0]) out.dur = Math.round(parseDuration(nums[0]));
  if (nums[1]) out.kcal = Math.round(num(nums[1]));
  if (nums[2]) out.hr = Math.round(num(nums[2]));
  return out;
}

/** Parse a number typed by a human: accepts "42,5" as well as "42.5". */
export function num(v: string): number {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
