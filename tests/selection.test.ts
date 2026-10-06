import assert from 'node:assert/strict';
import test from 'node:test';
import { feedSchema, type SupplierFeed, type SupplierProduct } from '../src/lib/server/feed';
import { selectCollection, selectionSchema } from '../src/lib/server/selection';

// Synthetic records are intentionally restricted to tests and never imported by the site.
const timestamp = '2026-10-05T12:00:00.000Z';
function product(supplierId: SupplierProduct['supplierId'], index: number): SupplierProduct {
  const id = String(1005000000000 + index);
  return {
    id,
    supplierId,
    sourceUrl: `https://www.aliexpress.com/item/${id}.html`,
    name: 'Prenda sintética',
    description: 'Solo pruebas',
    category: 'vestidos',
    material: 'Prueba',
    images: ['https://ae01.alicdn.com/kf/test.jpg'],
    videos: [],
    updatedAt: timestamp,
    variants: [
      { id: 'sku-s', color: 'Negro', colorHex: '#000000', size: 'S', stock: 4, priceUsd: 20 },
    ],
  };
}
function feed(first: number, second: number): SupplierFeed {
  return feedSchema.parse({
    schemaVersion: 1,
    generatedAt: timestamp,
    language: 'es',
    destination: 'CO',
    currency: 'USD',
    suppliers: ['821117', '1101290000'],
    products: [
      ...Array.from({ length: first }, (_, i) => product('821117', i)),
      ...Array.from({ length: second }, (_, i) => product('1101290000', 1000 + i)),
    ],
  });
}

test('collection caps each supplier separately at 200 and does not mutate its source', () => {
  const source = feed(250, 220);
  const result = selectCollection(source);
  assert.equal(result.feed.products.length, 400);
  assert.deepEqual(result.selection.counts, { '821117': 200, '1101290000': 200 });
  assert.equal(result.selection.complete, true);
  assert.equal(source.products.length, 470);
});

test('source reordering preserves chosen IDs while refreshing their actual data', () => {
  const original = selectCollection(feed(220, 220));
  const source = feed(220, 220);
  source.products.reverse();
  const refreshed = source.products.find((p) => p.id === original.feed.products[0].id)!;
  refreshed.variants[0].priceUsd = 25;
  refreshed.variants[0].stock = 0;
  const result = selectCollection(source, original.feed);
  assert.deepEqual(
    result.feed.products.map((p) => p.id),
    original.feed.products.map((p) => p.id),
  );
  assert.equal(result.feed.products[0].variants[0].priceUsd, 25);
  assert.equal(result.feed.products[0].variants[0].stock, 0);
});

test('a removed reference is filled only from the same supplier and shortage stays explicit', () => {
  const original = selectCollection(feed(201, 10));
  const source = feed(201, 10);
  const removed = source.products.shift()!;
  const result = selectCollection(source, original.feed);
  assert.equal(
    result.feed.products.some((p) => p.id === removed.id),
    false,
  );
  assert.deepEqual(result.selection.counts, { '821117': 200, '1101290000': 10 });
  assert.equal(result.selection.complete, false);
  const empty = selectCollection(feed(0, 0), original.feed);
  assert.equal(empty.feed.products.length, 0);
  assert.equal(empty.selection.complete, false);
  assert.throws(() => selectionSchema.parse({ ...result.selection, complete: true }));
});
