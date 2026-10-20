import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateTasks, RAIN_SKIP_MM } from '../src/utils/taskEngine.js';

const bed = (plantings, extra = {}) => ({
  id: 'b1', name: 'Beet', filledYear: 2026,
  plantings: Object.fromEntries(plantings.map(p => [p.id, p])),
  ...extra,
});
const tomato = { id: 't1', plantId: 'tomato', x: 30, y: 30, count: 1, start: '2026-05-16', end: '2026-10-15' };
const range = (a, b) => [new Date(`${a}T00:00:00`), new Date(`${b}T23:59:59`)];

test('a summer crop gets its Vorziehen reminder in late winter', () => {
  const tasks = generateTasks([bed([tomato])], ...range('2026-03-01', '2026-04-30'));
  const pre = tasks.find(t => t.kind === 'preculture' && t.plantId === 'tomato');
  assert.ok(pre, 'no preculture task — the season-based engine never produced one');
  assert.equal(new Date(`${pre.date}T00:00:00`).getDay(), 6, 'on a Saturday');
});

test('planting-out is due on the planting start date', () => {
  const tasks = generateTasks([bed([tomato])], ...range('2026-05-01', '2026-05-31'));
  assert.ok(tasks.some(t => t.kind === 'sow' && t.date === '2026-05-16'));
});

test('Eisheilige warn about tender plants already in the bed', () => {
  const early = { ...tomato, id: 't2', start: '2026-05-01' };
  const tasks = generateTasks([bed([early])], ...range('2026-05-10', '2026-05-12'));
  const warn = tasks.find(t => t.kind === 'protect');
  assert.ok(warn && warn.detail.includes('Tomate'));
});

test('no watering task when it rained enough', () => {
  const day = '2026-07-06';   // Monday — a watering day for thirsty summer beds
  const dry = generateTasks([bed([tomato])], ...range(day, day));
  assert.ok(dry.some(t => t.kind === 'water'), 'expected a watering task on a dry Monday');

  const weather = { daily: { '2026-07-05': { rain: 2 }, [day]: { rain: RAIN_SKIP_MM } } };
  const wet = generateTasks([bed([tomato])], ...range(day, day), { weather });
  assert.ok(!wet.some(t => t.kind === 'water'), 'watering task despite rain');
});

test('a hot day adds watering outside the schedule', () => {
  const day = '2026-07-07';   // Tuesday — not a scheduled day
  const plain = generateTasks([bed([tomato])], ...range(day, day));
  assert.ok(!plain.some(t => t.kind === 'water'));
  const weather = { daily: { [day]: { rain: 0, tMax: 33 } } };
  const hot = generateTasks([bed([tomato])], ...range(day, day), { weather });
  assert.ok(hot.some(t => t.kind === 'water' && t.detail.includes('Hitzetag')));
});

test('an empty bed needs no watering', () => {
  const tasks = generateTasks([bed([tomato])], ...range('2026-12-01', '2026-12-31'));
  assert.ok(!tasks.some(t => t.kind === 'water'));
});

test('a spent bed gets an Auffüllen task in March', () => {
  const tasks = generateTasks([bed([], { filledYear: 2022 })], ...range('2026-03-01', '2026-03-31'));
  assert.ok(tasks.some(t => t.id === 'auto:b1:refill:2026'));
  const fresh = generateTasks([bed([], { filledYear: 2025 })], ...range('2026-03-01', '2026-03-31'));
  assert.ok(!fresh.some(t => t.id.includes('refill')));
});
