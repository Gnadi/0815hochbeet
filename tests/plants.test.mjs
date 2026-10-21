import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PLANTS, COMPANIONS, searchPlants } from '../src/data/plants.js';

const ids = new Set(PLANTS.map(p => p.id));

test('companion matrix only names plants that exist', () => {
  for (const [a, row] of Object.entries(COMPANIONS)) {
    assert.ok(ids.has(a), `unknown plant ${a}`);
    for (const b of Object.keys(row)) assert.ok(ids.has(b), `${a} names unknown plant ${b}`);
  }
});

test('companion matrix never contradicts itself', () => {
  // pairScore reads whichever direction comes first, so a mismatch would make
  // the answer depend on argument order.
  for (const [a, row] of Object.entries(COMPANIONS)) {
    for (const [b, v] of Object.entries(row)) {
      const back = COMPANIONS[b]?.[a];
      assert.ok(back === undefined || back === v, `${a}/${b} is ${v} one way and ${back} the other`);
    }
  }
});

test('search finds plants by their Austrian name', () => {
  const find = q => searchPlants(PLANTS, q).map(p => p.id);
  assert.ok(find('Paradeiser').includes('tomato'));
  assert.ok(find('Fisolen').includes('bean'));
  assert.ok(find('Blumenkohl').includes('cauliflower'));
  assert.ok(find('Feldsalat').includes('lambslettuce'));
});
