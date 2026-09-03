import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generatePlan, SKIP_REASONS } from '../src/utils/planGenerator.js';
import { pairScore, plantById } from '../src/data/plants.js';

const BED = { widthCm: 120, depthCm: 80, heightCm: 80, season: 'autumn', goal: 'family' };
const plan = (picks, over = {}) => generatePlan({ picks, ...BED, ...over });
const kindsOf = p => p.kinds;
const skipReason = (p, id) => p.skipped.find(s => s.plant.id === id)?.reason;

test('keeps every choice that fits', () => {
  const picks = ['lettuce', 'radish', 'pea', 'kohlrabi'];
  const result = plan(picks);
  for (const id of picks) assert.ok(kindsOf(result).includes(id), `${id} missing`);
  assert.equal(result.skipped.length, 0);
});

test('adding a plant never pushes an already-fitting one out for nothing', () => {
  // The greedy version dropped Kohlrabi as soon as Rucola was added, even
  // though a different combination fitted both.
  const before = plan(['lettuce', 'radish', 'pea', 'kohlrabi']);
  const after = plan(['lettuce', 'radish', 'pea', 'kohlrabi', 'spinach']);
  assert.ok(after.kinds.length >= before.kinds.length,
    `variety shrank from ${before.kinds.length} to ${after.kinds.length}`);
  for (const id of before.kinds) {
    assert.ok(after.kinds.includes(id) || skipReason(after, id),
      `${id} vanished without a reason`);
  }
});

test('packs the most of the selection the depth allows', () => {
  const picks = ['lettuce', 'radish', 'pea', 'kohlrabi', 'spinach', 'rucola', 'carrot'];
  const result = plan(picks);
  const depth = picks
    .filter(id => result.kinds.includes(id))
    .reduce((s, id) => s + plantById(id).spacing_cm, 0);
  assert.ok(depth <= BED.depthCm, `rows total ${depth} cm in an ${BED.depthCm} cm bed`);
  // radish 8 + pea 10 + spinach 10 + carrot 5 + rucola 15 + lettuce 25 = 73
  assert.ok(result.kinds.length >= 6, `only fitted ${result.kinds.length} kinds`);
});

test('every dropped choice is reported with a reason', () => {
  const picks = ['lettuce', 'radish', 'pea', 'kohlrabi', 'tomato', 'zucchini'];
  const result = plan(picks, { season: 'summer' });
  for (const id of picks) {
    assert.ok(result.kinds.includes(id) || skipReason(result, id),
      `${id} was dropped silently`);
  }
});

test('names the reason a plant was dropped', () => {
  const result = plan(['lettuce', 'tomato', 'zucchini'], { season: 'summer', depthCm: 80 });
  assert.equal(skipReason(result, 'zucchini'), SKIP_REASONS.depth,   // needs 90 cm
    'zucchini should be reported as too deep for the bed');
  // Basil is a summer-only crop, so in autumn it is out of season rather than
  // merely out of room. (Tomato would not do here — it runs into autumn.)
  const autumn = plan(['lettuce', 'basil'], { season: 'autumn' });
  assert.equal(skipReason(autumn, 'basil'), SKIP_REASONS.season);
  // Tomato does grow in autumn; in an 80 cm bed next to lettuce it simply
  // runs out of space, and must say so rather than claiming a season clash.
  const crowded = plan(['lettuce', 'tomato'], { season: 'autumn' });
  assert.equal(skipReason(crowded, 'tomato'), SKIP_REASONS.space);
});

test('rows never exceed the bed depth', () => {
  for (const depthCm of [40, 60, 80, 120, 200]) {
    const result = plan(['lettuce', 'radish', 'pea', 'kohlrabi', 'spinach', 'rucola', 'carrot'], { depthCm });
    assert.ok(result.usedDepth <= depthCm, `${result.usedDepth} cm used in a ${depthCm} cm bed`);
  }
});

test('plants sit inside the bed outline', () => {
  const result = plan(['lettuce', 'radish', 'pea', 'kohlrabi'], { widthCm: 137, depthCm: 83 });
  for (const cell of Object.values(result.cells)) {
    const r = plantById(cell.plantId).spacing_cm / 2;
    assert.ok(cell.x - r >= -0.5 && cell.x + r <= 137.5, `x ${cell.x} outside 137 cm`);
    assert.ok(cell.y - r >= -0.5 && cell.y + r <= 83.5, `y ${cell.y} outside 83 cm`);
  }
});

test('never puts known bad neighbours in adjacent rows', () => {
  // Carrot hates dill and parsley; lettuce hates parsley. A deep bed forces
  // all of them in, so the separation pass has to do real work.
  const result = plan(['carrot', 'dill', 'lettuce', 'parsley', 'radish', 'spinach'], { depthCm: 200 });
  assert.ok(result.rows.length > 3);
  for (let i = 1; i < result.rows.length; i++) {
    const a = result.rows[i - 1].plant.id;
    const b = result.rows[i].plant.id;
    assert.ok(pairScore(a, b) >= 0, `${a} must not sit next to ${b}`);
  }
});

test('a selection with nothing plantable still explains itself', () => {
  const result = plan(['tomato', 'basil'], { season: 'winter' });
  assert.equal(result.rows.length, 0);
  assert.equal(result.skipped.length, 2);
  assert.ok(result.skipped.every(s => s.reason === SKIP_REASONS.season));
});

test('no picks at all yields no plan', () => {
  assert.equal(plan([]), null);
});
