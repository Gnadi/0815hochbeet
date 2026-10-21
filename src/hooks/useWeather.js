import { useEffect, useSyncExternalStore } from 'react';
import { describeCode, getWeatherSnapshot, refreshWeather, subscribeWeather } from '../lib/weather';

/**
 * Current weather plus the cached history. `fetch: true` refreshes it when the
 * cache is older than an hour — screens that only read it (the task list)
 * leave that to the dashboard.
 */
export function useWeather({ fetch = false } = {}) {
  const snap = useSyncExternalStore(subscribeWeather, getWeatherSnapshot, getWeatherSnapshot);
  useEffect(() => { if (fetch) refreshWeather(); }, [fetch]);
  const data = snap.data;
  return {
    data,
    loading: snap.loading && !data,
    error: snap.error,
    temp: data?.current?.temp != null ? Math.round(data.current.temp) : null,
    description: describeCode(data?.current?.code),
  };
}
