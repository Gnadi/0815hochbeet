import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalizeOpenMeteo } from '../src/lib/weather.js';
import { getWeatherAdvice } from '../src/utils/weatherAdvice.js';
import { remoteWins } from '../src/lib/syncRules.js';

test('Open-Meteo data is normalised and old days are kept until they expire', () => {
  const now = new Date(2026, 6, 10).getTime();
  const prev = { daily: { '2026-07-01': { rain: 4 }, '2026-05-01': { rain: 9 } } };
  const out = normalizeOpenMeteo({
    daily: { time: ['2026-07-09', '2026-07-10'], precipitation_sum: [6.2, 0], temperature_2m_max: [25, 31], temperature_2m_min: [14, 17], weather_code: [61, 0] },
    hourly: { time: ['2026-07-10T12:00'], temperature_2m: [30], precipitation: [0] },
    current: { temperature_2m: 29.4, weather_code: 0 },
  }, prev, now);
  assert.equal(out.daily['2026-07-09'].rain, 6.2);
  assert.equal(out.daily['2026-07-01'].rain, 4, 'recent history survives a refresh');
  assert.ok(!out.daily['2026-05-01'], 'old history is dropped');
  assert.equal(out.current.temp, 29.4);
});

test('frost advice comes from the plant data, including new plants', () => {
  const now = new Date(2026, 4, 12, 18);
  const hourly = Array.from({ length: 36 }, (_, i) => ({ time: new Date(now.getTime() + i * 3600000).toISOString(), temp: i === 10 ? 1 : 8, rain: 0 }));
  const advice = getWeatherAdvice({ hourly, daily: {} }, ['pumpkin', 'kale'], now);
  const frost = advice.find(a => a.type === 'frost');
  assert.ok(frost && frost.text.includes('Kürbis'));
  assert.ok(!frost.text.includes('Grünkohl'), 'frost-hardy kale needs no protection');
});

test('sync: higher revision wins, legacy merge-written documents never beat a local bed', () => {
  assert.ok(remoteWins({ rev: 5 }, { rev: 4 }));
  assert.ok(!remoteWins({ rev: 3 }, { rev: 4 }));
  assert.ok(remoteWins({ rev: 4, updatedAt: '2026-05-02' }, { rev: 4, updatedAt: '2026-05-01' }));
  assert.ok(!remoteWins({ updatedAt: '2099-01-01' }, { rev: 0 }), 'legacy doc with ghost plants must lose');
  assert.ok(remoteWins({ rev: 1 }, null));
});
