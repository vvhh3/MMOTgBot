import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupInventory } from '../src/features/inventory/lib/groupInventory.ts';

const entry = (id, itemType, values = {}) => ({ id, itemType, quantity: 1, weaponLevel: 1, equiped: false, acquiredAt: 'now', ...values });
const catalog = [{ id: 1, name: 'Оружие', type: 'weapon' }, { id: 2, name: 'Аптечка', type: 'potion' }];

test('duplicate weapons of different levels share one cell without merging their instance IDs', () => {
  const inventory = [entry(10, 1), entry(11, 1, { weaponLevel: 6, equiped: true }), entry(12, 1)];
  const original = structuredClone(inventory);
  const groups = groupInventory(inventory, catalog);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].quantity, 3);
  assert.equal(groups[0].equiped, true);
  assert.equal(groups[0].inventoryEntry.id, 11);
  assert.deepEqual(groups[0].entries.map(e => [e.id, e.weaponLevel]), [[10, 1], [11, 6], [12, 1]]);
  assert.deepEqual(inventory, original);
});

test('counts reflect stack quantities and regroup correctly after one instance is removed', () => {
  const inventory = [entry(10, 1), entry(11, 1), entry(20, 2, { quantity: 8, weaponLevel: null })];
  assert.deepEqual(groupInventory(inventory, catalog).map(g => [g.item.id, g.quantity]), [[1, 2], [2, 8]]);
  const groups = groupInventory(inventory.filter(e => e.id !== 10), catalog);
  assert.equal(groups[0].quantity, 1);
  assert.equal(groups[0].inventoryEntry.id, 11);
  assert.equal(groups[1].quantity, 8);
});

test('catalogue IDs remain separate even when names match; unavailable entries do not create cells', () => {
  const groups = groupInventory([entry(10, 1), entry(11, 3), entry(12, 99), entry(13, 2, { quantity: 0 })],
    [...catalog, { id: 3, name: 'Оружие', type: 'weapon' }]);
  assert.deepEqual(groups.map(g => [g.item.id, g.quantity]), [[1, 1], [3, 1]]);
});
