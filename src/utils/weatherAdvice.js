// Weather hints for what is actually planted. Which plants are affected comes
// from the plant data (frostHardy, water, boltsInHeat) — the old hand-kept id
// lists went stale with every plant added to the library.

import { plantById } from '../data/plants.js';
import { toDateStr } from '../lib/timeline.js';

const CARD = {
  frost: { color:'#3B82F6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.25)', icon:'❄', title:'Frostgefahr' },
  rain:  { color:'#0EA5E9', bg:'rgba(14,165,233,0.08)', border:'rgba(14,165,233,0.25)', icon:'🌧', title:'Regen kommt' },
  heat:  { color:'#F59E0B', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.25)', icon:'☀', title:'Hitzestress' },
  water: { color:'#3E5C30', bg:'rgba(62,92,48,0.08)', border:'rgba(62,92,48,0.25)', icon:'💧', title:'Gießen empfohlen' },
  sow:   { color:'#3E5C30', bg:'rgba(62,92,48,0.08)', border:'rgba(62,92,48,0.25)', icon:'✦', title:'Gutes Pflanzwetter' },
};

/** `weather` is the normalised store data (see lib/weather.js). */
export function getWeatherAdvice(weather, plantedIds = [], now = new Date()) {
  const hours = (weather?.hourly || []).filter(h => new Date(h.time) >= new Date(now.getTime() - 3600000));
  if (!hours.length) return [];
  const plants = plantedIds.map(plantById).filter(Boolean);
  const names = list => list.map(p => p.de).join(', ');
  const next36 = hours.slice(0, 36);
  const next24 = hours.slice(0, 24);
  const advice = [];

  const minTemp = Math.min(...next36.map(h => h.temp ?? 99));
  const tender = plants.filter(p => !p.frostHardy);
  if (minTemp < 3 && tender.length) {
    advice.push({ type:'frost', ...CARD.frost, text:`Min. ${Math.round(minTemp)} °C erwartet. Schütze: ${names(tender)}.` });
  }

  const rain24 = next24.reduce((s, h) => s + (h.rain || 0), 0);
  if (rain24 > 5) {
    advice.push({ type:'rain', ...CARD.rain, text:`~${Math.round(rain24)} mm in 24 h. Gießen heute auslassen.` });
  }

  const maxTemp = Math.max(...next24.map(h => h.temp ?? -99));
  const bolting = plants.filter(p => p.boltsInHeat);
  if (maxTemp > 28 && bolting.length) {
    advice.push({ type:'heat', ...CARD.heat, text:`Bis ${Math.round(maxTemp)} °C erwartet. ${names(bolting)} beschatten oder extra gießen.` });
  }

  const today = toDateStr(now);
  const yesterday = toDateStr(new Date(now.getTime() - 86400000));
  const pastRain = (weather.daily?.[today]?.rain || 0) + (weather.daily?.[yesterday]?.rain || 0);
  const thirsty = plants.filter(p => p.water === 'high');
  if (rain24 < 1 && pastRain < 1 && maxTemp > 20 && thirsty.length) {
    advice.push({ type:'water', ...CARD.water, text:`Kein Regen in Sicht. ${names(thirsty)} brauchen heute Wasser.` });
  }

  const avg = next24.reduce((s, h) => s + (h.temp ?? 0), 0) / next24.length;
  if (avg >= 14 && avg <= 24 && rain24 < 3 && minTemp > 5) {
    advice.push({ type:'sow', ...CARD.sow, text:'Mild und trocken — ideale Bedingungen zum Aussäen und Umpflanzen.' });
  }

  return advice.slice(0, 3);
}
