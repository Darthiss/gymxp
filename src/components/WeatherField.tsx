import { useState } from 'react';
import { getStore, useData } from '../lib/store';
import { fetchWeather, hourOf, locate, savedLocation, type Weather } from '../lib/weather';
import { RULES } from '../lib/xp';
import { toast } from './ui';

/** Get (and remember, rounded to ~10 km) the location used for weather lookups. */
export async function weatherLocation(): Promise<{ lat: number; lon: number }> {
  const saved = savedLocation(getStore().getState().data.profile);
  if (saved) return saved;
  const loc = await locate();
  getStore().update((d) => {
    d.profile = { ...d.profile, weatherLat: loc.lat, weatherLon: loc.lon, updatedAt: Date.now() };
  }, 'Set weather location');
  return loc;
}

export async function lookupWeather(items: { date: string; startTime?: string }[]): Promise<Map<string, Weather>> {
  const { lat, lon } = await weatherLocation();
  return fetchWeather(lat, lon, items.map((i) => ({ date: i.date, hour: hourOf(i.startTime) })));
}

/** Temperature + rain toggle with an "auto" button, for the workout screen. */
export function WeatherField({ date, startTime, tempC, rain, onChange }: {
  date: string;
  startTime?: string;
  tempC: string;
  rain: boolean;
  onChange: (w: { tempC: string; rain: boolean }) => void;
}) {
  const data = useData();
  const [busy, setBusy] = useState(false);
  const hasLoc = !!savedLocation(data.profile);

  const auto = async () => {
    setBusy(true);
    try {
      const w = (await lookupWeather([{ date, startTime }])).get(date);
      if (!w) throw new Error('No weather data for that date');
      onChange({ tempC: String(w.tempC), rain: w.rain });
      toast(`${w.rain ? '🌧️ Raining' : '⛅ No rain'} · ${w.tempC} °C`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row between">
        <span className="bold">🌦️ Weather</span>
        <span className="tiny muted">rain +{RULES.rainXp} · ≤5 °C +{RULES.coldXp} · ≥33 °C +{RULES.heatXp}</span>
      </div>
      <div className="row">
        <div className="unit-input" style={{ flex: 1 }}>
          <input className="input" inputMode="decimal" placeholder="temp" value={tempC} aria-label="Temperature in °C"
            onChange={(e) => onChange({ tempC: e.target.value.replace(/[^\d.,-]/g, ''), rain })} />
          <span>°C</span>
        </div>
        <button className={`btn${rain ? ' primary' : ''}`} style={{ flex: 1 }} aria-pressed={rain} onClick={() => onChange({ tempC, rain: !rain })}>
          {rain ? '🌧️ Raining' : '☀️ No rain'}
        </button>
        <button className="icon-btn" onClick={auto} disabled={busy} aria-label="Fetch the weather automatically" title={hasLoc ? 'Fetch weather' : 'Fetch weather (asks for your location once)'}>
          {busy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '📍'}
        </button>
      </div>
    </div>
  );
}
