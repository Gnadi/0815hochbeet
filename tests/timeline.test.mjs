import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  activeAt, clampPlantings, defaultRange, fitInTime, mergePlantings, migrateSeasonCells, toDateStr,
} from '../src/lib/timeline.js';
import { plantById } from '../src/data/plants.js';

let n = 0;
const gen = () => `p${++n}`;
const at = (plantId, x, y, start, end, id = gen()) => ({ id, plantId, x, y, count: 1, start, end });
const byId = (...list) => Object.fromEntries(list.map(p => [p.id, p]));

test('toDateStr uses the local calendar day', () => {
  // 23:30 local on 1 March must stay 1 March even where UTC is already the 2nd.
  assert.equal(toDateStr(new Date(2026, 2, 1, 23, 30)), '2026-03-01');
});

test('Spinat bis Mai, dann Paradeiser, dann Vogerlsalat — on the same spot', () => {
  const spinach = at('spinach', 40, 40, '2026-03-01', '2026-05-20');
  const tomato = at('tomato', 40, 40, '2026-05-21', '2026-09-30');
  const lamb = at('lambslettuce', 40, 40, '2026-10-01', '2027-02-28');
  const bed = byId(spinach, tomato, lamb);
  assert.deepEqual(Object.keys(activeAt(bed, '2026-04-15')), [spinach.id]);
  assert.deepEqual(Object.keys(activeAt(bed, '2026-07-15')), [tomato.id]);
  assert.deepEqual(Object.keys(activeAt(bed, '2026-12-15')), [lamb.id]);
});

test('a new planting starts after a Vorkultur that already ended on the spot', () => {
  const spinach = at('spinach', 40, 40, '2026-03-01', '2026-06-10');
  const tomatoRange = defaultRange(plantById('tomato'), 2026, 5);   // from 1 June
  const res = fitInTime(byId(spinach), at('tomato', 40, 40, tomatoRange.start, tomatoRange.end), '2026-06-15');
  assert.ok(!res.blocked);
  assert.equal(res.planting.start, '2026-06-11');
  assert.ok(res.adjusted);
});

test('a new planting ends before a planned Nachkultur on the spot', () => {
  const lamb = at('lambslettuce', 40, 40, '2026-08-20', '2027-01-31');
  const res = fitInTime(byId(lamb), at('lettuce', 40, 40, '2026-06-01', '2026-08-31'), '2026-06-15');
  assert.equal(res.planting.end, '2026-08-19');
});

test('something standing on the spot that day blocks the planting', () => {
  const tomato = at('tomato', 40, 40, '2026-05-01', '2026-09-30');
  const res = fitInTime(byId(tomato), at('lettuce', 45, 40, '2026-06-01', '2026-07-31'), '2026-06-15');
  assert.ok(res.blocked);
});

test('migrating the old season layouts keeps every plant and chains spots in time', () => {
  const legacy = {
    spring: { a: { plantId: 'spinach', x: 40, y: 40, count: 3 } },
    summer: { b: { plantId: 'tomato', x: 40, y: 40, count: 1 } },
    autumn: {}, winter: {},
  };
  const out = Object.values(migrateSeasonCells(legacy, 2026, gen));
  assert.equal(out.length, 2);
  const spinach = out.find(p => p.plantId === 'spinach');
  const tomato = out.find(p => p.plantId === 'tomato');
  assert.equal(spinach.count, 3);
  assert.equal(tomato.start, '2026-05-01', 'Paradeiser go in in their planting month, May');
  assert.ok(spinach.end < tomato.start, 'the spring crop makes room for the summer crop');
});

test('shrinking the bed pulls plants inside without losing any', () => {
  const a = at('lettuce', 110, 30, '2026-05-01', '2026-06-30');
  const b = at('lettuce', 115, 30, '2026-05-01', '2026-06-30');
  const out = clampPlantings(byId(a, b), 80, 80);
  assert.equal(Object.keys(out).length, 2);
  for (const p of Object.values(out)) assert.ok(p.x <= 80 - 12.5, `x=${p.x} is outside`);
  const [pa, pb] = Object.values(out);
  assert.ok(pa.x !== pb.x || pa.y !== pb.y, 'the two plants ended up on the same point');
});

test('applying a plan replaces the month and trims the neighbours in time', () => {
  const before = at('spinach', 40, 40, '2026-03-01', '2026-06-10');   // harvested before mid-June
  const visible = at('lettuce', 80, 40, '2026-06-01', '2026-07-31');
  const added = [at('tomato', 40, 40, '2026-06-01', '2026-09-30')];
  const out = mergePlantings(byId(before, visible), added, '2026-06-15');
  assert.ok(!(visible.id in out), 'what stood there in June is replaced');
  assert.equal(out[before.id].end, '2026-05-31');
  assert.ok(added[0].id in out);
});
