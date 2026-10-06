import { z } from 'zod';
import {
  hasIntegrationConfig,
  hasStorageConfig,
  isFresh,
  readConfig,
  type ServerConfig,
} from './config';
import { cacheSchema, feedSchema, type ExchangeRate } from './feed';
import { MAX_CACHE_BYTES, readStoredCatalog, writeStoredCatalog } from './storage';
import { selectCollection } from './selection';
import { compareCatalogs, type ChangesReport } from './changes';

export const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const REQUEST_TIMEOUT_MS = 20_000;

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

function validatedFeedUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.localhost') ||
      url.hostname.includes(':') ||
      /^\d+(?:\.\d+){3}$/.test(url.hostname)
    )
      throw new Error();
    return url.href;
  } catch {
    throw new SyncError(
      'ALIEXPRESS_CATALOG_FEED_URL debe ser una URL HTTPS pública sin credenciales.',
    );
  }
}

async function fetchJson(url: string, fetcher: typeof fetch, token?: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new SyncError(`El proveedor respondió HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^application\/(?:[a-z0-9.+-]*\+)?json(?:;|$)/i.test(contentType)) {
      throw new SyncError(
        'El proveedor no devolvió JSON. No se interpretarán páginas HTML o desafíos de acceso.',
      );
    }
    if (Number(response.headers.get('content-length') ?? 0) > MAX_CACHE_BYTES) {
      throw new SyncError('El catálogo supera el límite de tamaño.');
    }
    if (!response.body) throw new SyncError('El proveedor devolvió una respuesta vacía.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_CACHE_BYTES) {
          await reader.cancel();
          throw new SyncError('El catálogo supera el límite de tamaño.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

const fxResponseSchema = z.object({
  result: z.literal('success'),
  base_code: z.literal('USD'),
  time_last_update_unix: z.number().int().positive(),
  rates: z.object({ COP: z.number().min(100).max(100_000) }),
});

export interface SyncOptions {
  config?: ServerConfig;
  now?: number;
  fetcher?: typeof fetch;
}

/** All network/validation work completes before the single atomic cache replacement. */
export async function syncCatalog(options: SyncOptions = {}): Promise<{
  productCount: number;
  syncedAt: string;
  selection?: ReturnType<typeof selectCollection>['selection'];
  changeSummary?: ChangesReport['counts'];
}> {
  const config = options.config ?? readConfig();
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? fetch;
  if (!hasIntegrationConfig(config)) {
    throw new SyncError(
      'Configura el feed autorizado, su token y GLAMOUR_FX_PROVIDER antes de sincronizar.',
    );
  }
  if (!hasStorageConfig(config))
    throw new SyncError('Conecta un almacén privado Vercel Blob antes de sincronizar.');
  const feedUrl = validatedFeedUrl(config.feedUrl);
  try {
    const feed = feedSchema.parse(await fetchJson(feedUrl, fetcher, config.feedToken));
    if (
      ![feed.generatedAt, ...feed.products.map((product) => product.updatedAt)].every((date) =>
        isFresh(date, now),
      )
    ) {
      throw new SyncError(
        'El feed contiene fechas antiguas o futuras. Se conserva el catálogo anterior.',
      );
    }
    const fx = fxResponseSchema.parse(await fetchJson(FX_URL, fetcher));
    const exchangeRate: ExchangeRate = {
      provider: 'exchange-rate-api',
      usdCop: fx.rates.COP,
      asOf: new Date(fx.time_last_update_unix * 1_000).toISOString(),
    };
    if (!isFresh(exchangeRate.asOf, now))
      throw new SyncError('La tasa de cambio no está vigente. Se conserva el catálogo anterior.');
    const previous = await readStoredCatalog(config);
    const selected = selectCollection(feed, previous?.feed);
    const candidate = cacheSchema.parse({
      schemaVersion: 1,
      syncedAt: new Date(now).toISOString(),
      feed: selected.feed,
      exchangeRate,
      selection: selected.selection,
    });
    const cache = cacheSchema.parse({
      ...candidate,
      changes: compareCatalogs(previous, candidate, config.pricing),
    });
    await writeStoredCatalog(cache, config);
    return {
      productCount: cache.feed.products.length,
      syncedAt: cache.syncedAt,
      selection: selected.selection,
      changeSummary: cache.changes?.counts,
    };
  } catch (error) {
    if (error instanceof SyncError) throw error;
    if (error instanceof z.ZodError) {
      // Never include feed values, remote HTML, authentication details or URLs in logs.
      const fields = error.issues
        .slice(0, 4)
        .map((issue) => issue.path.join('.') || 'documento')
        .join(', ');
      throw new SyncError(
        `El catálogo o la tasa no cumple el contrato (${fields}). Se conserva la última versión válida.`,
      );
    }
    throw new SyncError(
      'No fue posible sincronizar el catálogo. Se conserva la última versión válida.',
    );
  }
}
