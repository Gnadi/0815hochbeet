// Weather for the garden, from Open-Meteo.
//
// OpenWeather's free tier only forecasts, so the app could warn about frost
// but never knew whether it *had* rained — which is the one thing a watering
// reminder needs. Open-Meteo returns the past days and the forecast in one
// call, needs no API key and allows browser requests.
//
// The result is normalised, cached in localStorage (the bed is often out of
// range) and merged with what was stored before, so a few weeks of observed
// rain survive between visits.

const STORE_KEY = 'hb_weather';
const GEO_KEY = 'hb_geo';
const MAX_AGE_MS = 60 * 60 * 1000;
const KEEP_DAYS = 21;

const listeners = new Set();
let cache;
let inflight = null;
let status = { loading: false, error: null };

const WMO_DE = [
  [[0], 'Klar'], [[1], 'Überwiegend klar'], [[2], 'Teils bewölkt'], [[3], 'Bedeckt'],
  [[45, 48], 'Nebel'], [[51, 53, 55, 56, 57], 'Nieselregen'], [[61, 63, 65, 66, 67], 'Regen'],
  [[71, 73, 75, 77], 'Schnee'], [[80, 81, 82], 'Regenschauer'], [[85, 86], 'Schneeschauer'],
  [[95, 96, 99], 'Gewitter'],
];
export function describeCode(code) {
  return WMO_DE.find(([codes]) => codes.includes(code))?.[1] || '';
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function emit() {
  listeners.forEach(fn => { try { fn(); } catch {} });
}

export function subscribeWeather(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** `{ data, loading, error }` — stable between changes for useSyncExternalStore. */
let snapshot = null;
export function getWeatherSnapshot() {
  if (cache === undefined) cache = read(STORE_KEY);
  if (!snapshot || snapshot.data !== cache || snapshot.loading !== status.loading || snapshot.error !== status.error) {
    snapshot = { data: cache, ...status };
  }
  return snapshot;
}

/** Turns an Open-Meteo response into the app's shape. Exported for tests. */
export function normalizeOpenMeteo(json, previous = null, now = Date.now()) {
  const daily = { ...(previous?.daily || {}) };
  const d = json?.daily;
  if (d?.time) {
    d.time.forEach((date, i) => {
      daily[date] = {
        rain: d.precipitation_sum?.[i] ?? 0,
        tMax: d.temperature_2m_max?.[i] ?? null,
        tMin: d.temperature_2m_min?.[i] ?? null,
        code: d.weather_code?.[i] ?? null,
      };
    });
  }
  // Keep only the recent past and the forecast.
  const cutoff = new Date(now - KEEP_DAYS * 86400000);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  for (const k of Object.keys(daily)) if (k < cutoffStr) delete daily[k];

  const h = json?.hourly;
  const hourly = (h?.time || []).map((time, i) => ({
    time, temp: h.temperature_2m?.[i] ?? null, rain: h.precipitation?.[i] ?? 0,
  }));

  return {
    fetchedAt: now,
    current: { temp: json?.current?.temperature_2m ?? null, code: json?.current?.weather_code ?? null },
    daily,
    hourly,
  };
}

function position() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no-geo')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error('geo-denied')),
      { maximumAge: 6 * 3600 * 1000, timeout: 15000 },
    );
  });
}

/** Fetches fresh data unless the cache is younger than an hour. */
export function refreshWeather({ force = false } = {}) {
  const current = getWeatherSnapshot().data;
  if (!force && current && Date.now() - current.fetchedAt < MAX_AGE_MS) return Promise.resolve(current);
  if (inflight) return inflight;
  status = { loading: true, error: null };
  emit();
  inflight = (async () => {
    try {
      let geo;
      try {
        geo = await position();
        write(GEO_KEY, geo);
      } catch (e) {
        geo = read(GEO_KEY);
        if (!geo) throw e;
      }
      const params = new URLSearchParams({
        latitude: geo.lat.toFixed(3), longitude: geo.lon.toFixed(3),
        current: 'temperature_2m,weather_code',
        hourly: 'temperature_2m,precipitation',
        daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code',
        past_days: '7', forecast_days: '7', timezone: 'auto',
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error('fetch-failed');
      const next = normalizeOpenMeteo(await res.json(), getWeatherSnapshot().data);
      cache = next;
      write(STORE_KEY, next);
      status = { loading: false, error: null };
      return next;
    } catch (e) {
      status = { loading: false, error: e.message === 'geo-denied' || e.message === 'no-geo' ? 'geo-denied' : 'fetch-failed' };
      return getWeatherSnapshot().data;
    } finally {
      inflight = null;
      emit();
    }
  })();
  return inflight;
}
