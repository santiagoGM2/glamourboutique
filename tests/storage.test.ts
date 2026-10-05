import assert from 'node:assert/strict';
import test from 'node:test';
import { hasStorageConfig, readConfig } from '../src/lib/server/config';
import { cacheSchema, type CatalogCache } from '../src/lib/server/feed';
import {
  MAX_CACHE_BYTES,
  readStoredCatalog,
  writeStoredCatalog,
  type CatalogBlobClient,
} from '../src/lib/server/storage';

function cache(timestamp = '2026-10-05T07:00:00.000Z'): CatalogCache {
  return cacheSchema.parse({
    schemaVersion: 1,
    syncedAt: timestamp,
    feed: {
      schemaVersion: 1,
      generatedAt: timestamp,
      language: 'es',
      destination: 'CO',
      currency: 'USD',
      suppliers: ['821117', '1101290000'],
      products: [],
    },
    exchangeRate: { provider: 'exchange-rate-api', usdCop: 4_000, asOf: timestamp },
  });
}

const config = readConfig({
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  BLOB_READ_WRITE_TOKEN: 'test-token-never-valid-for-cloud',
});

function memoryBlob(initial: CatalogCache | null = null) {
  let value = initial === null ? null : JSON.stringify(initial);
  let etag = 'version-1';
  const puts: Parameters<CatalogBlobClient['put']>[] = [];
  const gets: Parameters<CatalogBlobClient['get']>[] = [];
  const client: CatalogBlobClient = {
    async get(...args) {
      gets.push(args);
      if (value === null) return null;
      return {
        statusCode: 200,
        stream: new Response(value).body!,
        blob: { etag, size: Buffer.byteLength(value) },
      };
    },
    async put(...args) {
      const [, body, options] = args;
      if (
        (value !== null && !options.allowOverwrite) ||
        (options.ifMatch && options.ifMatch !== etag)
      )
        throw new Error('Synthetic precondition failure');
      puts.push(args);
      value = body;
      etag += '-next';
    },
  };
  return {
    client,
    puts,
    gets,
    contents: () => value,
    changeVersion: () => {
      etag += '-external';
    },
  };
}

test('Vercel always chooses shared storage; missing credentials never select local disk', () => {
  const missing = readConfig({ VERCEL: '1' });
  assert.equal(missing.storage?.driver, 'blob');
  assert.equal(hasStorageConfig(missing), false);
  assert.equal(readConfig({}).storage?.driver, 'file');
  assert.equal(readConfig({ BLOB_STORE_ID: 'store_test' }).storage?.driver, 'blob');
  assert.equal(hasStorageConfig(readConfig({ BLOB_STORE_ID: 'store_test' })), true);
  assert.notEqual(config.storage?.pathname, missing.storage?.pathname);
  assert.equal(config.pricing, null);
});

test('local and development credentials cannot target the production catalog implicitly', () => {
  const credentials = { BLOB_READ_WRITE_TOKEN: 'test-local-token' };
  for (const environment of [undefined, 'development', 'custom-environment']) {
    assert.equal(
      readConfig({ ...credentials, VERCEL_ENV: environment }).storage?.pathname,
      'glamour/catalog/development.json',
    );
  }
  assert.equal(
    readConfig({ ...credentials, VERCEL_ENV: 'preview' }).storage?.pathname,
    'glamour/catalog/preview.json',
  );
  assert.equal(
    readConfig({ ...credentials, VERCEL_ENV: 'production' }).storage?.pathname,
    'glamour/catalog/production.json',
  );
});

test('private Blob round-trip uses consistent reads and conditional overwrite', async () => {
  const blob = memoryBlob();
  await writeStoredCatalog(cache(), config, blob.client);
  assert.equal(blob.puts[0][2].access, 'private');
  assert.equal(blob.puts[0][2].allowOverwrite, false);
  assert.equal(blob.puts[0][2].addRandomSuffix, false);
  assert.equal(blob.puts[0][2].ifMatch, undefined);
  assert.deepEqual(await readStoredCatalog(config, blob.client), cache());
  await writeStoredCatalog(cache('2026-10-05T08:00:00.000Z'), config, blob.client);
  assert.equal(blob.puts[1][2].allowOverwrite, true);
  assert.equal(blob.puts[1][2].ifMatch, 'version-1-next');
  assert.ok(blob.gets.every(([, options]) => options.useCache === false));
  assert.ok(blob.gets.every(([, options]) => options.access === 'private'));
});

test('older or invalid snapshots never replace the last valid cloud catalog', async () => {
  const blob = memoryBlob(cache('2026-10-05T09:00:00.000Z'));
  const original = blob.contents();
  await assert.rejects(writeStoredCatalog(cache(), config, blob.client), /más reciente/);
  const invalid = { ...cache(), schemaVersion: 999 } as unknown as CatalogCache;
  await assert.rejects(writeStoredCatalog(invalid, config, blob.client));
  assert.equal(blob.puts.length, 0);
  assert.equal(blob.contents(), original);
});

test('overlapping cloud writes fail rather than overwriting a changed catalog', async () => {
  const blob = memoryBlob(cache());
  const original = blob.contents();
  const client: CatalogBlobClient = {
    get: blob.client.get,
    async put(...args) {
      blob.changeVersion();
      return blob.client.put(...args);
    },
  };
  await assert.rejects(writeStoredCatalog(cache('2026-10-05T08:00:00.000Z'), config, client));
  assert.equal(blob.contents(), original);
});

test('unavailable, corrupt or oversized Blob data never creates a catalog', async () => {
  const unexpectedWrite: CatalogBlobClient['put'] = async () => {
    assert.fail('No write expected');
  };
  const failing: CatalogBlobClient = {
    get: async () => {
      throw new Error('Storage unavailable');
    },
    put: unexpectedWrite,
  };
  assert.equal(await readStoredCatalog(config, failing), null);
  const invalid: CatalogBlobClient = {
    get: async () => ({
      statusCode: 200,
      stream: new Response('{invalid').body!,
      blob: { etag: 'invalid', size: 8 },
    }),
    put: unexpectedWrite,
  };
  assert.equal(await readStoredCatalog(config, invalid), null);
  let cancelled = false;
  const oversized: CatalogBlobClient = {
    get: async () => ({
      statusCode: 200,
      stream: new ReadableStream({
        cancel: () => {
          cancelled = true;
        },
      }),
      blob: { etag: 'large', size: MAX_CACHE_BYTES + 1 },
    }),
    put: unexpectedWrite,
  };
  assert.equal(await readStoredCatalog(config, oversized), null);
  assert.equal(cancelled, true);
});

test('stream size limit also applies when Blob metadata understates content length', async () => {
  let cancelled = false;
  const client: CatalogBlobClient = {
    get: async () => ({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(MAX_CACHE_BYTES + 1));
        },
        cancel() {
          cancelled = true;
        },
      }),
      blob: { etag: 'large', size: 1 },
    }),
    put: async () => {
      assert.fail('No write expected');
    },
  };
  assert.equal(await readStoredCatalog(config, client), null);
  assert.equal(cancelled, true);
});
