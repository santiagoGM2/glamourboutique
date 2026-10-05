import assert from 'node:assert/strict';
import test from 'node:test';
import { runCatalogCron } from '../src/lib/server/cron';
import { readConfig } from '../src/lib/server/config';

const secret = 'synthetic-test-secret-not-a-real-credential';
const config = readConfig({
  ALIEXPRESS_CATALOG_FEED_URL: 'https://catalog.example.com/feed',
  ALIEXPRESS_CATALOG_FEED_TOKEN: 'test-feed-token',
  GLAMOUR_FX_PROVIDER: 'exchange-rate-api',
  VERCEL: '1',
  BLOB_READ_WRITE_TOKEN: 'test-blob-token',
});
const request = (authorization?: string) =>
  new Request('https://glamour.example/api/cron/sync-catalog', {
    headers: authorization ? { authorization } : {},
  });

test('cron rejects missing, wrong and unconfigured secrets before synchronization', async () => {
  let calls = 0;
  const sync = async () => {
    calls += 1;
    return { productCount: 0, syncedAt: 'unused' };
  };
  for (const authorization of [undefined, 'Bearer wrong', `Bearer ${secret.slice(1)}x`]) {
    const result = await runCatalogCron(request(authorization), { secret, config, sync });
    assert.equal(result.status, 401);
    assert.equal(result.headers.get('Cache-Control'), 'no-store, max-age=0');
  }
  assert.equal(
    (await runCatalogCron(request('Bearer '), { secret: '', config, sync })).status,
    401,
  );
  assert.equal(calls, 0);
});

test('cron reports missing feed or durable storage as unconfigured, never successful sync', async () => {
  const sync = async () => {
    assert.fail('A missing source must not run sync');
  };
  const missingSource = await runCatalogCron(request(`Bearer ${secret}`), {
    secret,
    config: readConfig({}),
    sync,
  });
  assert.equal(missingSource.status, 503);
  assert.equal((await missingSource.json()).status, 'not_configured');
  const missingStorage = await runCatalogCron(request(`Bearer ${secret}`), {
    secret,
    config: { ...config, storage: { driver: 'blob', pathname: 'catalog.json' } },
    sync,
  });
  assert.equal(missingStorage.status, 503);
});

test('cron can update catalog while margin remains unset and never reveals provider errors', async () => {
  assert.equal(config.pricing, null);
  const result = { productCount: 12, syncedAt: '2026-10-05T07:15:00.000Z' };
  const success = await runCatalogCron(request(`Bearer ${secret}`), {
    secret,
    config,
    sync: async ({ config: received } = {}) => {
      assert.equal(received, config);
      return result;
    },
  });
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { status: 'updated', ...result });
  const failure = await runCatalogCron(request(`Bearer ${secret}`), {
    secret,
    config,
    sync: async () => {
      throw new Error('secret-from-provider');
    },
  });
  assert.equal(failure.status, 502);
  assert.equal((await failure.text()).includes('secret-from-provider'), false);
});
