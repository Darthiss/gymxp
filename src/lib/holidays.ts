// Argentine national holidays (feriados nacionales, Ley 27.399), computed locally.
// Movable ("trasladables") holidays count on BOTH their original date and the Monday they
// move to, so you get the bonus whichever day the government's calendar uses.
// Not included: one-off "días puente" decreed each year.
import { addDays, toISODate } from './util';

function easter(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const FIXED: [string, string][] = [
  ['01-01', 'Año Nuevo'],
  ['03-24', 'Día de la Memoria'],
  ['04-02', 'Día de Malvinas'],
  ['05-01', 'Día del Trabajador'],
  ['05-25', 'Revolución de Mayo'],
  ['06-20', 'Día de la Bandera'],
  ['07-09', 'Día de la Independencia'],
  ['12-08', 'Inmaculada Concepción'],
  ['12-25', 'Navidad'],
];

const MOVABLE: [string, string][] = [
  ['06-17', 'Paso a la Inmortalidad de Güemes'],
  ['08-17', 'Paso a la Inmortalidad de San Martín'],
  ['10-12', 'Día de la Diversidad Cultural'],
  ['11-20', 'Día de la Soberanía Nacional'],
];

const cache = new Map<number, Map<string, string>>();

export function holidaysOf(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const m = new Map<string, string>();
  for (const [md, name] of FIXED) m.set(`${year}-${md}`, name);
  const e = toISODate(easter(year));
  m.set(addDays(e, -48), 'Carnaval');
  m.set(addDays(e, -47), 'Carnaval');
  m.set(addDays(e, -2), 'Viernes Santo');
  for (const [md, name] of MOVABLE) {
    const iso = `${year}-${md}`;
    m.set(iso, name);
    const dow = new Date(year, Number(md.slice(0, 2)) - 1, Number(md.slice(3))).getDay(); // 0 = Sunday
    // Tue/Wed → previous Monday; Thu/Fri → next Monday
    const shift = dow === 2 ? -1 : dow === 3 ? -2 : dow === 4 ? 4 : dow === 5 ? 3 : 0;
    if (shift && !m.has(addDays(iso, shift))) m.set(addDays(iso, shift), `${name} (trasladado)`);
  }
  cache.set(year, m);
  return m;
}

/** Name of the Argentine national holiday on that date, if any. */
export function holidayOn(iso: string): string | undefined {
  return holidaysOf(Number(iso.slice(0, 4))).get(iso);
}
