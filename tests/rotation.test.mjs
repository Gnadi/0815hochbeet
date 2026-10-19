import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getRotationAnalysis, nextYearAdvice } from '../src/utils/rotationAdvice.js';
import { ageAdvice, bedAge, feederMismatches } from '../src/utils/bedAge.js';
import { plantById } from '../src/data/plants.js';

const p = (id, plantId, start, end, x = 40, y = 40) => [id, { id, plantId, x, y, count: 1, start, end }];

test('cabbage two years after cabbage breaks the 4-year pause', () => {
  const plantings = Object.fromEntries([
    p('a', 'cabbage', '2024-05-01', '2024-09-30'),
    p('b', 'broccoli', '2026-05-01', '2026-08-31'),
  ]);
  const { warnings, score } = getRotationAnalysis(plantings, 2026);
  const w = warnings.find(x => x.kind === 'rotation' && x.family === 'Brassicaceae');
  assert.ok(w);
  assert.deepEqual(w.years, [2024]);
  assert.ok(score < 100);
});

test('the same family in one year on different spots is no rotation problem', () => {
  const plantings = Object.fromEntries([
    p('a', 'cabbage', '2026-05-01', '2026-09-30', 20, 20),
    p('b', 'kohlrabi', '2026-05-01', '2026-07-31', 90, 60),
  ]);
  assert.equal(getRotationAnalysis(plantings, 2026).warnings.length, 0);
});

test('Paradeiser after Paradeiser is fine, Kartoffel after Paradeiser is not', () => {
  const tomatoes = Object.fromEntries([
    p('a', 'tomato', '2025-05-15', '2025-10-01'),
    p('b', 'tomato', '2026-05-15', '2026-10-01'),
  ]);
  assert.equal(getRotationAnalysis(tomatoes, 2026).warnings.length, 0);
  const potato = Object.fromEntries([
    p('a', 'tomato', '2025-05-15', '2025-10-01'),
    p('b', 'potato', '2026-04-01', '2026-08-01'),
  ]);
  assert.equal(getRotationAnalysis(potato, 2026).warnings.length, 1);
});

test('Spinat followed by Mangold on the same spot is flagged as succession', () => {
  const plantings = Object.fromEntries([
    p('a', 'spinach', '2026-03-01', '2026-05-15'),
    p('b', 'chard', '2026-05-16', '2026-10-15'),
  ]);
  const w = getRotationAnalysis(plantings, 2026).warnings;
  assert.ok(w.some(x => x.kind === 'succession' && x.family === 'Chenopodiaceae'));
});

test('next year advice names the families that must still wait', () => {
  const plantings = Object.fromEntries([p('a', 'cabbage', '2026-05-01', '2026-09-30')]);
  const { blocked } = nextYearAdvice(plantings, 2026);
  assert.deepEqual(blocked.map(b => [b.family, b.freeFrom]), [['Brassicaceae', 2030]]);
});

test('Befüllungsjahr: Starkzehrer in year 1–2, Schwachzehrer from 3, refill after', () => {
  const bed = { filledYear: 2024 };
  assert.equal(bedAge(bed, 2024), 1);
  assert.equal(ageAdvice(bedAge(bed, 2025)).phase, 'rich');
  assert.equal(ageAdvice(bedAge(bed, 2026)).phase, 'lean');
  assert.ok(ageAdvice(bedAge(bed, 2027)).refill);
  assert.deepEqual(feederMismatches([plantById('lettuce'), plantById('tomato')], 1).map(m => m.plant.id), ['lettuce']);
  assert.deepEqual(feederMismatches([plantById('lettuce'), plantById('tomato')], 3).map(m => m.plant.id), ['tomato']);
});

test('a bed has no age before the year it was filled', () => {
  assert.equal(bedAge({ filledYear: 2026 }, 2024), null);
});
