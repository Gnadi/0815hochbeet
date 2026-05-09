import { plantById } from '../data/plants';

const FROST_SENSITIVE = new Set(['tomato', 'basil', 'cucumber', 'bean', 'zucchini', 'pepper']);
const HEAT_SENSITIVE  = new Set(['lettuce', 'spinach', 'rucola', 'radish']);
const WATER_HUNGRY    = new Set(['tomato', 'cucumber', 'zucchini']);

export function getWeatherAdvice(forecast, plantedIds = []) {
  if (!forecast?.list?.length) return [];
  const planted = new Set(plantedIds);
  const advice = [];
  const next36h = forecast.list.slice(0, 12);
  const next24h = forecast.list.slice(0, 8);

  // Frost warning
  const minTemp = Math.min(...next36h.map(p => p.main.temp_min ?? p.main.temp));
  if (minTemp < 3) {
    const affected = [...planted].filter(id => FROST_SENSITIVE.has(id)).map(id => plantById(id)?.de || id);
    if (affected.length > 0) {
      advice.push({
        type: 'frost',
        color: '#3B82F6',
        bg: 'rgba(59,130,246,0.08)',
        border: 'rgba(59,130,246,0.25)',
        icon: '❄',
        title: 'Frostgefahr',
        text: `Min. ${Math.round(minTemp)}°C erwartet. Schütze: ${affected.join(', ')}.`,
      });
    }
  }

  // Rain — skip watering
  const totalRain = next24h.reduce((s, p) => s + (p.rain?.['3h'] || 0), 0);
  if (totalRain > 5) {
    advice.push({
      type: 'rain',
      color: '#0EA5E9',
      bg: 'rgba(14,165,233,0.08)',
      border: 'rgba(14,165,233,0.25)',
      icon: '🌧',
      title: 'Regen kommt',
      text: `~${Math.round(totalRain)} mm in 24 h. Wässern heute auslassen.`,
    });
  }

  // Heat stress for shade plants
  const maxTemp = Math.max(...next24h.map(p => p.main.temp_max ?? p.main.temp));
  if (maxTemp > 28) {
    const affected = [...planted].filter(id => HEAT_SENSITIVE.has(id)).map(id => plantById(id)?.de || id);
    if (affected.length > 0) {
      advice.push({
        type: 'heat',
        color: '#F59E0B',
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.25)',
        icon: '☀',
        title: 'Hitzestress',
        text: `Bis ${Math.round(maxTemp)}°C erwartet. ${affected.join(', ')} beschatten oder extra gießen.`,
      });
    }
  }

  // Dry spell — water reminder for thirsty plants
  if (totalRain < 1) {
    const thirsty = [...planted].filter(id => WATER_HUNGRY.has(id)).map(id => plantById(id)?.de || id);
    if (thirsty.length > 0 && maxTemp > 20) {
      advice.push({
        type: 'water',
        color: '#3E5C30',
        bg: 'rgba(62,92,48,0.08)',
        border: 'rgba(62,92,48,0.25)',
        icon: '💧',
        title: 'Gießen empfohlen',
        text: `Kein Regen in Sicht. ${thirsty.join(', ')} brauchen heute Wasser.`,
      });
    }
  }

  // Good conditions for sowing / transplanting
  const avgTemp = next24h.reduce((s, p) => s + p.main.temp, 0) / next24h.length;
  if (avgTemp >= 14 && avgTemp <= 24 && totalRain < 3 && minTemp > 5) {
    advice.push({
      type: 'sow',
      color: '#3E5C30',
      bg: 'rgba(62,92,48,0.08)',
      border: 'rgba(62,92,48,0.25)',
      icon: '✦',
      title: 'Gutes Pflanztag-Wetter',
      text: 'Mild und trocken — ideale Bedingungen zum Aussäen und Umpflanzen.',
    });
  }

  return advice.slice(0, 3);
}
