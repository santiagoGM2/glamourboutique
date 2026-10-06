import assert from 'node:assert/strict';
import test from 'node:test';
import { changesReportSchema, compareCatalogs } from '../src/lib/server/changes';
import type { PricingConfig } from '../src/lib/server/config';
import type { CatalogCache, SupplierProduct } from '../src/lib/server/feed';

// Synthetic references and prices, used only for tests and never for the store.
const before = '2026-10-04T12:00:00.000Z';
const after = '2026-10-05T12:00:00.000Z';

function product(index = 0, supplierId: SupplierProduct['supplierId'] = '821117'): SupplierProduct {
  const id = String(1005000000000 + index);
  return {
    id,
    supplierId,
    sourceUrl: `https://www.aliexpress.com/item/${id}.html`,
    name: `Prenda sintética ${index}`,
    description: 'Fixture de prueba.',
    category: 'vestidos',
    material: 'Bandage',
    images: ['https://ae01.alicdn.com/kf/test.jpg'],
    videos: [],
    variants: [
      { id: 'sku-s', color: 'Negro', colorHex: '#000000', size: 'S', priceUsd: 10, stock: 7 },
    ],
    updatedAt: before,
  };
}

function cache(products = [product()], usdCop = 4000, syncedAt = before): CatalogCache {
  return {
    schemaVersion: 1,
    syncedAt,
    feed: {
      schemaVersion: 1,
      generatedAt: syncedAt,
      language: 'es',
      destination: 'CO',
      currency: 'USD',
      suppliers: ['821117', '1101290000'],
      products,
    },
    exchangeRate: { provider: 'exchange-rate-api', usdCop, asOf: syncedAt },
  };
}

test('initial synchronization counts products without inventing changes from zero', () => {
  const next = cache([product(), product(1, '1101290000')], 4000, after);
  const report = compareCatalogs(null, next, null);
  assert.deepEqual(report.counts, {
    addedProducts: 2,
    removedProducts: 0,
    priceChanges: 0,
    significantPriceChanges: 0,
    minorPriceChanges: 0,
    stockChanges: 0,
  });
  assert.equal(report.basis, 'supplier_cost_cop');
  assert.equal(report.thresholdCop, 5000);
  assert.equal(report.comparedAt, after);
  assert.equal(report.previousSyncedAt, null);
  assert.equal(changesReportSchema.safeParse(report).success, true);
});

test('unchanged snapshots report no differences', () => {
  const previous = cache();
  const next = { ...structuredClone(previous), syncedAt: after };
  const report = compareCatalogs(previous, next, null);
  assert.ok(Object.values(report.counts).every((count) => count === 0));
  assert.deepEqual(report.priceChanges, []);
  assert.deepEqual(report.stockChanges, []);
  assert.equal(report.previousSyncedAt, before);
});

test('COP 5000 inclusive is minor; larger increases and decreases are significant', () => {
  const previous = cache(Array.from({ length: 6 }, (_, i) => product(i)));
  const next = structuredClone(previous);
  next.syncedAt = after;
  // 1000, 3000, 5000, 5001, -5000, -5001 COP changes at a synthetic rate of 4000.
  const prices = [10.25, 10.75, 11.25, 11.2501, 8.75, 8.7497];
  next.feed.products.forEach((item, index) => {
    item.variants[0].priceUsd = prices[index];
  });
  const originalPrevious = structuredClone(previous);
  const originalNext = structuredClone(next);
  const report = compareCatalogs(previous, next, null);
  assert.deepEqual(
    report.priceChanges.map((change) => change.deltaCop),
    [1000, 3000, 5000, 5001, -5000, -5001],
  );
  assert.deepEqual(
    report.priceChanges.map((change) => change.severity),
    ['minor', 'minor', 'minor', 'significant', 'minor', 'significant'],
  );
  assert.equal(report.counts.priceChanges, 6);
  assert.equal(report.counts.minorPriceChanges, 4);
  assert.equal(report.counts.significantPriceChanges, 2);
  assert.deepEqual(previous, originalPrevious);
  assert.deepEqual(next, originalNext);
  assert.equal(changesReportSchema.safeParse(report).success, true);
});

test('exchange-rate changes are compared even when USD prices are identical', () => {
  const previous = cache();
  const next = cache([product()], 4600, after);
  const report = compareCatalogs(previous, next, null);
  assert.equal(report.priceChanges[0].oldPriceCop, 40000);
  assert.equal(report.priceChanges[0].newPriceCop, 46000);
  assert.equal(report.priceChanges[0].severity, 'significant');
});

test('configured margin switches to sale prices using shared rounding and fixed costs', () => {
  const previous = cache();
  const next = cache();
  next.feed.products[0].variants[0].priceUsd = 11;
  const pricing: PricingConfig = { markupPercent: 50, fixedCostCopPerItem: 1100, roundingCop: 100 };
  const report = compareCatalogs(previous, next, pricing);
  assert.equal(report.basis, 'sale_price_cop');
  assert.equal(report.priceChanges[0].oldPriceCop, 61100);
  assert.equal(report.priceChanges[0].newPriceCop, 67100);
  assert.equal(report.priceChanges[0].severity, 'significant');
  assert.equal(compareCatalogs(previous, next, null).priceChanges[0].severity, 'minor');
});

test('comparison isolates suppliers and SKUs and counts product removals and stock changes', () => {
  const previous = cache([product(0), product(0, '1101290000'), product(1)]);
  previous.feed.products[0].variants.push({
    id: 'sku-m',
    color: 'Negro',
    colorHex: '#000000',
    size: 'M',
    priceUsd: 20,
    stock: 3,
  });
  const next = structuredClone(previous);
  next.feed.products = next.feed.products.slice(0, 2).reverse();
  next.feed.products.push(product(2));
  // Same product ID and variant ID in different stores must remain independent.
  next.feed.products[0].variants[0].priceUsd = 12;
  next.feed.products[0].variants[0].stock = 0;
  next.feed.products[1].variants.reverse();
  next.feed.products[1].variants[0].priceUsd = 19;
  next.feed.products[1].variants[0].stock = 5;
  next.feed.products[1].variants[1].id = 'new-sku';
  next.feed.products[1].variants[1].priceUsd = 100;
  const report = compareCatalogs(previous, next, null);
  assert.equal(report.counts.addedProducts, 1);
  assert.equal(report.counts.removedProducts, 1);
  assert.equal(report.counts.priceChanges, 2);
  assert.deepEqual(
    report.priceChanges.map(({ supplierId, variantId, deltaCop }) => ({
      supplierId,
      variantId,
      deltaCop,
    })),
    [
      { supplierId: '1101290000', variantId: 'sku-s', deltaCop: 8000 },
      { supplierId: '821117', variantId: 'sku-m', deltaCop: -4000 },
    ],
  );
  assert.deepEqual(
    report.stockChanges.map((change) => change.deltaStock),
    [-7, 2],
  );
  assert.equal(report.counts.stockChanges, 2);
});

test('all SKU differences across 400 products are retained with matching counts', () => {
  const products = Array.from({ length: 400 }, (_, i) => {
    const item = product(i % 200, i < 200 ? '821117' : '1101290000');
    item.variants.push({ ...item.variants[0], id: 'sku-m', size: 'M' });
    return item;
  });
  const previous = cache(products);
  const next = structuredClone(previous);
  next.feed.products.forEach((item) =>
    item.variants.forEach((variant) => {
      variant.priceUsd = 12;
      variant.stock = 0;
    }),
  );
  const report = compareCatalogs(previous, next, null);
  assert.equal(report.priceChanges.length, 800);
  assert.equal(report.counts.priceChanges, 800);
  assert.equal(report.counts.significantPriceChanges, 800);
  assert.equal(report.stockChanges.length, 800);
  assert.equal(report.counts.stockChanges, 800);
  assert.equal(changesReportSchema.safeParse(report).success, true);
});

test('stored report schema rejects inconsistent counts and misclassified deltas', () => {
  const previous = cache();
  const next = cache();
  next.feed.products[0].variants[0].priceUsd = 12;
  const report = compareCatalogs(previous, next, null);
  const wrongCount = structuredClone(report);
  wrongCount.counts.priceChanges = 0;
  assert.equal(changesReportSchema.safeParse(wrongCount).success, false);
  const wrongSeverity = structuredClone(report);
  wrongSeverity.priceChanges[0].severity = 'minor';
  wrongSeverity.counts.minorPriceChanges = 1;
  wrongSeverity.counts.significantPriceChanges = 0;
  assert.equal(changesReportSchema.safeParse(wrongSeverity).success, false);
});
