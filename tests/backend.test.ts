import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { POST } from '../src/app/api/checkout/route';
import { catalogFromCache, readCatalogCache } from '../src/lib/server/catalog';
import { CheckoutError, createQuote } from '../src/lib/server/checkout';
import { MAX_AGE_MS, QUOTE_LIFETIME_MS, readConfig } from '../src/lib/server/config';
import {
  cacheSchema,
  feedSchema,
  type CatalogCache,
  type SupplierFeed,
} from '../src/lib/server/feed';
import { priceInCop } from '../src/lib/server/pricing';
import { FX_URL, syncCatalog } from '../src/lib/server/sync';

// Deliberately synthetic test fixtures. Never imported by the application or sync job.
const now = Date.parse('2026-10-05T12:00:00.000Z');
const timestamp = new Date(now).toISOString();
const config = readConfig({
  ALIEXPRESS_CATALOG_FEED_URL: 'https://catalog.example.com/authorized-feed',
  ALIEXPRESS_CATALOG_FEED_TOKEN: 'test-token',
  GLAMOUR_FX_PROVIDER: 'exchange-rate-api',
  GLAMOUR_MARKUP_PERCENT: '25',
  GLAMOUR_FIXED_COST_COP_PER_ITEM: '1000',
  GLAMOUR_PRICE_ROUNDING_COP: '100',
});

function feed(): SupplierFeed {
  return {
    schemaVersion: 1,
    generatedAt: timestamp,
    language: 'es',
    destination: 'CO',
    currency: 'USD',
    suppliers: ['821117', '1101290000'],
    products: [
      {
        id: '1005000000001',
        supplierId: '821117',
        sourceUrl: 'https://www.aliexpress.com/item/1005000000001.html',
        name: 'Prenda de prueba',
        description: 'Solo una fixture de prueba.',
        category: 'vestidos',
        material: 'Bandage',
        images: [
          'https://ae01.alicdn.com/kf/test-front.jpg',
          'https://ae01.alicdn.com/kf/test-back.jpg',
        ],
        videos: [],
        updatedAt: timestamp,
        variants: [
          {
            id: 'sku-black-s',
            color: 'Negro',
            colorHex: '#111111',
            size: 'S',
            stock: 3,
            priceUsd: 20,
          },
          {
            id: 'sku-red-m',
            color: 'Rojo',
            colorHex: '#bb0000',
            size: 'M',
            stock: 0,
            priceUsd: 10,
          },
        ],
      },
    ],
  };
}

function cache(): CatalogCache {
  return cacheSchema.parse({
    schemaVersion: 1,
    syncedAt: timestamp,
    feed: feed(),
    exchangeRate: { provider: 'exchange-rate-api', usdCop: 4_000, asOf: timestamp },
  });
}

const cart = (quantity = 1) => ({
  items: [{ productId: '821117:1005000000001', variantId: 'sku-black-s', quantity }],
});

async function temporaryDirectory(t: TestContext): Promise<string> {
  const prefix = path.resolve(os.tmpdir(), 'glamour-catalog-test-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(prefix) && path.dirname(resolved) === path.dirname(prefix));
    await rm(resolved, { recursive: true, force: true });
  });
  return directory;
}

const jsonResponse = (data: unknown) => Response.json(data);
function fxResponse() {
  return {
    result: 'success',
    base_code: 'USD',
    time_last_update_unix: now / 1000,
    rates: { COP: 4000 },
  };
}

test('missing or invalid margin never enables checkout; explicit zero is accepted', () => {
  assert.equal(readConfig({}).pricing, null);
  assert.equal(readConfig({ GLAMOUR_MARKUP_PERCENT: '' }).pricing, null);
  assert.equal(readConfig({ GLAMOUR_MARKUP_PERCENT: '-10' }).pricing, null);
  assert.equal(readConfig({ GLAMOUR_MARKUP_PERCENT: 'abc' }).pricing, null);
  assert.equal(readConfig({ GLAMOUR_MARKUP_PERCENT: '0' }).pricing?.markupPercent, 0);
  const result = catalogFromCache(cache(), { ...config, pricing: null }, now);
  assert.equal(result.checkoutEnabled, false);
  assert.equal(result.status, 'unconfigured');
  assert.equal(result.products[0].priceCop, null);
});

test('COP pricing applies markup, fixed costs and rounding without float boundary errors', () => {
  assert.equal(priceInCop(20, 4000, config.pricing!), 101000);
  assert.equal(
    priceInCop(19.99, 4000, { markupPercent: 0, fixedCostCopPerItem: 0, roundingCop: 1 }),
    79960,
  );
  assert.equal(
    priceInCop(19.99, 4000, { markupPercent: 0, fixedCostCopPerItem: 0, roundingCop: 100 }),
    80000,
  );
  assert.equal(
    priceInCop(0.1, 1000, { markupPercent: 0, fixedCostCopPerItem: 0, roundingCop: 100 }),
    100,
  );
  assert.equal(
    priceInCop(1, 1000, { markupPercent: 12.34, fixedCostCopPerItem: 15, roundingCop: 1 }),
    1139,
  );
});

test('catalog exposes only normalized sale data and selects the in-stock minimum', () => {
  const result = catalogFromCache(cache(), config, now);
  assert.equal(result.status, 'live');
  assert.equal(result.checkoutEnabled, true);
  assert.equal(result.products[0].id, '821117:1005000000001');
  assert.equal(result.products[0].priceCop, 101000);
  assert.equal('priceUsd' in result.products[0].variants[0], false);
  assert.equal(JSON.stringify(result).includes('test-token'), false);
  assert.equal(catalogFromCache(null, config, now).checkoutEnabled, false);
});

test('stale or future feed, SKU and exchange dates block checkout independently', () => {
  const oldDate = new Date(now - MAX_AGE_MS - 1).toISOString();
  const futureDate = new Date(now + 6 * 60 * 1000).toISOString();
  const mutations = [
    (value: CatalogCache) => {
      value.syncedAt = oldDate;
    },
    (value: CatalogCache) => {
      value.feed.generatedAt = oldDate;
    },
    (value: CatalogCache) => {
      value.feed.products[0].updatedAt = oldDate;
    },
    (value: CatalogCache) => {
      value.exchangeRate.asOf = oldDate;
    },
    (value: CatalogCache) => {
      value.feed.generatedAt = futureDate;
    },
  ];
  for (const mutate of mutations) {
    const input = cache();
    mutate(input);
    const result = catalogFromCache(input, config, now);
    assert.equal(result.status, 'stale');
    assert.equal(result.checkoutEnabled, false);
    assert.throws(
      () => createQuote(cart(), result, now),
      (error) => error instanceof CheckoutError && error.code === 'CHECKOUT_UNAVAILABLE',
    );
  }
});

test('feed rejects wrong stores, partial enumeration, duplicate SKUs and unsafe media/source URLs', () => {
  const mutations: Array<(value: SupplierFeed) => unknown> = [
    (value) => {
      (value.products[0] as { supplierId: string }).supplierId = '999999';
    },
    (value) => {
      value.suppliers = ['821117', '821117'];
    },
    (value) => {
      value.products[0].variants.push(value.products[0].variants[0]);
    },
    (value) => {
      value.products.push(value.products[0]);
    },
    (value) => {
      value.products[0].images[0] = 'javascript:alert(1)';
    },
    (value) => {
      value.products[0].images[0] = 'https://alicdn.com.evil.example/image.jpg';
    },
    (value) => {
      value.products[0].sourceUrl = 'https://www.aliexpress.com/item/1005000000002.html';
    },
    (value) => {
      value.products[0].sourceUrl = 'not a URL';
    },
    (value) => {
      value.products[0].variants[0].priceUsd = -1;
    },
  ];
  for (const mutate of mutations) {
    const input = feed();
    mutate(input);
    assert.equal(feedSchema.safeParse(input).success, false);
  }
});

test('checkout ignores client prices and produces a verifiable, expiring purchase request', () => {
  const input = { ...cart(2), totalCop: 1 };
  Object.assign(input.items[0], { priceCop: 1, unitPriceCop: 1, name: 'Malicious name' });
  const quote = createQuote(input, catalogFromCache(cache(), config, now), now);
  assert.equal(quote.totalCop, 202000);
  assert.equal(quote.lines[0].unitPriceCop, 101000);
  assert.equal(quote.lines[0].name, 'Prenda de prueba');
  assert.equal(Date.parse(quote.expiresAt), now + QUOTE_LIFETIME_MS);
  assert.equal(new URL(quote.whatsappUrl).pathname, '/573128851441');
  assert.equal(new URL(quote.whatsappUrl).searchParams.get('text'), quote.message);
  assert.match(quote.message, /821117:1005000000001/);
  assert.match(quote.message, /sku-black-s/);
  assert.match(quote.message, /no confirma un pago ni reserva inventario/);
});

test('duplicate cart entries are merged before checking the total stock', () => {
  const current = catalogFromCache(cache(), config, now);
  const item = cart(2).items[0];
  assert.throws(
    () => createQuote({ items: [item, item] }, current, now),
    (error) => error instanceof CheckoutError && error.code === 'INSUFFICIENT_STOCK',
  );
  const quote = createQuote({ items: [cart().items[0], cart(2).items[0]] }, current, now);
  assert.equal(quote.lines.length, 1);
  assert.equal(quote.lines[0].quantity, 3);
  assert.equal(quote.totalCop, 303000);
});

test('checkout rejects invalid quantities, nonexistent products/SKUs, previews and missing prices', () => {
  const current = catalogFromCache(cache(), config, now);
  for (const quantity of [-1, 0, 0.5, 100, NaN, Infinity]) {
    assert.throws(() => createQuote(cart(quantity), current, now), CheckoutError);
  }
  assert.throws(() => createQuote({ items: [] }, current, now), CheckoutError);
  assert.throws(
    () =>
      createQuote({ items: [{ ...cart().items[0], variantId: 'does-not-exist' }] }, current, now),
    CheckoutError,
  );
  assert.throws(
    () =>
      createQuote(
        { items: [{ ...cart().items[0], productId: '821117:1005000000099' }] },
        current,
        now,
      ),
    CheckoutError,
  );
  const preview = structuredClone(current);
  preview.products[0].preview = true;
  assert.throws(() => createQuote(cart(), preview, now), CheckoutError);
  const noPrice = structuredClone(current);
  noPrice.products[0].variants[0].priceCop = null;
  assert.throws(() => createQuote(cart(), noPrice, now), CheckoutError);
});

test('synchronization authenticates only the feed, validates FX and atomically replaces the cache', async (t) => {
  const directory = await temporaryDirectory(t);
  const localConfig = { ...config, dataDir: directory };
  await writeFile(path.join(directory, 'catalog.json'), JSON.stringify(cache()), 'utf8');
  const calls: Array<{ url: string; auth: string | null }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = input.toString();
    calls.push({ url, auth: new Headers(init?.headers).get('Authorization') });
    assert.equal(init?.redirect, 'error');
    return jsonResponse(url === FX_URL ? fxResponse() : feed());
  };
  const result = await syncCatalog({ config: localConfig, now, fetcher });
  assert.equal(result.productCount, 1);
  assert.deepEqual(calls, [
    { url: config.feedUrl, auth: 'Bearer test-token' },
    { url: FX_URL, auth: null },
  ]);
  const saved = await readCatalogCache(localConfig);
  assert.equal(saved?.feed.products[0].id, '1005000000001');
  assert.deepEqual(result.selection?.counts, { '821117': 1, '1101290000': 0 });
  assert.equal(result.selection?.complete, false);
  assert.equal(saved?.changes?.counts.priceChanges, 0);
  assert.deepEqual(await readdir(directory), ['catalog.json']);
});

test('sync stores price-change details privately and returns counts without supplier costs', async (t) => {
  const directory = await temporaryDirectory(t);
  const localConfig = { ...config, dataDir: directory };
  await writeFile(path.join(directory, 'catalog.json'), JSON.stringify(cache()), 'utf8');
  const changed = feed();
  changed.products[0].variants[0].priceUsd = 22;
  changed.products[0].variants[0].stock = 2;
  const result = await syncCatalog({
    config: localConfig,
    now,
    fetcher: async (url) => jsonResponse(url.toString() === FX_URL ? fxResponse() : changed),
  });
  assert.equal(result.changeSummary?.significantPriceChanges, 1);
  assert.equal(result.changeSummary?.stockChanges, 1);
  const saved = await readCatalogCache(localConfig);
  assert.equal(saved?.feed.products[0].variants[0].priceUsd, 22);
  assert.equal(saved?.changes?.priceChanges[0].deltaCop, 10_000);
  const publicCatalog = catalogFromCache(saved, localConfig, now);
  assert.equal('changes' in publicCatalog, false);
  assert.equal(JSON.stringify(publicCatalog).includes('priceUsd'), false);
  assert.equal('priceChanges' in result, false);
});

test('failed or stale upstream sync preserves the last good cache byte-for-byte', async (t) => {
  const directory = await temporaryDirectory(t);
  const localConfig = { ...config, dataDir: directory };
  const original = JSON.stringify(cache());
  await writeFile(path.join(directory, 'catalog.json'), original, 'utf8');
  const badFeed = feed();
  badFeed.generatedAt = new Date(now - MAX_AGE_MS - 1).toISOString();
  const badFx = fxResponse();
  badFx.time_last_update_unix -= 27 * 60 * 60;
  const fetchers: Array<typeof fetch> = [
    async () => new Response('Bot challenge', { headers: { 'content-type': 'text/html' } }),
    async () => {
      throw new Error(`Never leak ${config.feedToken}`);
    },
    async () => jsonResponse(badFeed),
    async (url) => jsonResponse(url.toString() === FX_URL ? badFx : feed()),
    async () => jsonResponse({ products: [] }),
  ];
  for (const fetcher of fetchers) {
    await assert.rejects(syncCatalog({ config: localConfig, now, fetcher }), (error: Error) => {
      assert.equal(error.message.includes('test-token'), false);
      return true;
    });
    assert.equal(await readFile(path.join(directory, 'catalog.json'), 'utf8'), original);
  }
});

test('corrupt cache and missing integration fail closed without selling stale/fake products', async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(path.join(directory, 'catalog.json'), '{broken', 'utf8');
  assert.equal(await readCatalogCache({ ...config, dataDir: directory }), null);
  assert.equal(catalogFromCache(cache(), { ...config, feedToken: '' }, now).products.length, 0);
  await assert.rejects(syncCatalog({ config: { ...config, feedToken: '' }, now }));
});

test('HTTP checkout rejects malformed, oversized and cross-site requests before reading catalog', async () => {
  const request = (body: string, extra: Record<string, string> = {}) =>
    new Request('https://glamour.example/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...extra },
      body,
    });
  const malformed = await POST(request('{bad'));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, 'INVALID_JSON');
  assert.equal((await POST(request(' '.repeat(25 * 1024)))).status, 413);
  assert.equal((await POST(request('{}', { origin: 'https://unrelated.example' }))).status, 403);
  assert.equal((await POST(request('{}', { 'content-type': 'text/plain' }))).status, 415);
});
