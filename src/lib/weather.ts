// Weather lookup via Open-Meteo (free, no API key). Only called when you tap a
// "fetch weather" button; sends a location rounded to ~10 km and the dates.
import type { Profile } from './types';

export interface Weather {
  tempC: number;
  rain: boolean;
}

const API = 'https://api.open-meteo.com/v1/forecast';
// WMO codes for drizzle, rain, freezing rain, showers, thunderstorms
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function savedLocation(p: Profile): { lat: number; lon: number } | null {
  return p.weatherLat != null && p.weatherLon != null ? { lat: p.weatherLat, lon: p.weatherLon } : null;
}

/** Ask the browser for the location, rounded to 0.1° (~10 km) for privacy. */
export function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location not available on this device'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: round1(p.coords.latitude), lon: round1(p.coords.longitude) }),
      () => reject(new Error('Location permission denied. Type the temperature instead.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 6 * 3600_000 },
    );
  });
}

/** Weather at a given hour for each requested date (one request for the whole range). */
export async function fetchWeather(lat: number, lon: number, items: { date: string; hour: number }[]): Promise<Map<string, Weather>> {
  const out = new Map<string, Weather>();
  if (!items.length) return out;
  const dates = items.map((i) => i.date).sort();
  const url = `${API}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,weather_code&timezone=auto&start_date=${dates[0]}&end_date=${dates[dates.length - 1]}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error('Could not reach the weather service (offline?)');
  }
  if (!res.ok) throw new Error(`Weather service error ${res.status}`);
  const j = await res.json();
  const times: string[] = j.hourly?.time ?? [];
  for (const it of items) {
    const key = `${it.date}T${String(Math.min(23, Math.max(0, it.hour))).padStart(2, '0')}:00`;
    const k = times.indexOf(key);
    if (k < 0) continue;
    const t = j.hourly.temperature_2m[k];
    const p = j.hourly.precipitation[k] ?? 0;
    const code = j.hourly.weather_code[k];
    if (typeof t !== 'number') continue;
    out.set(it.date, { tempC: Math.round(t), rain: RAIN_CODES.has(code) || p >= 0.2 });
  }
  return out;
}

export const hourOf = (startTime?: string) => (startTime ? Number(startTime.slice(0, 2)) : 19);
