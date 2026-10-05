import { get, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ServerConfig } from './config';
import { cacheSchema, type CatalogCache } from './feed';

export const MAX_CACHE_BYTES = 16 * 1_024 * 1_024;
const STORAGE_TIMEOUT_MS = 20_000;

interface BlobRead {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  blob: { etag: string; size: number | null };
}

interface BlobOptions {
  access: 'private';
  token?: string;
  storeId?: string;
  abortSignal: AbortSignal;
}

/** Small injectable boundary; tests never contact cloud storage. */
export interface CatalogBlobClient {
  get(pathname: string, options: BlobOptions & { useCache: false }): Promise<BlobRead | null>;
  put(
    pathname: string,
    body: string,
    options: BlobOptions & {
      contentType: 'application/json';
      addRandomSuffix: false;
      allowOverwrite: boolean;
      cacheControlMaxAge: number;
      ifMatch?: string;
    },
  ): Promise<unknown>;
}

const blobClient: CatalogBlobClient = { get, put };

export class CatalogStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogStorageError';
  }
}

function blobOptions(config: ServerConfig): BlobOptions {
  return {
    access: 'private',
    ...(config.storage?.token ? { token: config.storage.token } : {}),
    ...(config.storage?.storeId ? { storeId: config.storage.storeId } : {}),
    // Let the SDK read and refresh VERCEL_OIDC_TOKEN itself when token is absent.
    abortSignal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
  };
}

async function parseBlob(result: BlobRead): Promise<CatalogCache> {
  if (result.statusCode !== 200 || !result.stream)
    throw new CatalogStorageError('El almacenamiento no devolvió una instantánea completa.');
  if (result.blob.size !== null && result.blob.size > MAX_CACHE_BYTES) {
    await result.stream.cancel();
    throw new CatalogStorageError('El catálogo supera el límite de tamaño.');
  }
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_CACHE_BYTES) {
        await reader.cancel();
        throw new CatalogStorageError('El catálogo supera el límite de tamaño.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return cacheSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}

export async function readStoredCatalog(
  config: ServerConfig,
  client: CatalogBlobClient = blobClient,
): Promise<CatalogCache | null> {
  try {
    if (config.storage?.driver === 'blob') {
      const result = await client.get(config.storage.pathname, {
        ...blobOptions(config),
        useCache: false,
      });
      return result ? await parseBlob(result) : null;
    }
    const location = path.join(config.dataDir, 'catalog.json');
    const metadata = await stat(location);
    if (!metadata.isFile() || metadata.size > MAX_CACHE_BYTES) return null;
    return cacheSchema.parse(JSON.parse(await readFile(location, 'utf8')));
  } catch {
    // Invalid, missing or inaccessible data must not become a purchasable catalog.
    // Cloud failures never fall back to a bundled/local catalog.
    return null;
  }
}

export async function writeStoredCatalog(
  candidate: CatalogCache,
  config: ServerConfig,
  client: CatalogBlobClient = blobClient,
): Promise<void> {
  const cache = cacheSchema.parse(candidate);
  const serialized = JSON.stringify(cache);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CACHE_BYTES)
    throw new CatalogStorageError('El catálogo supera el límite de tamaño.');

  if (config.storage?.driver === 'blob') {
    const previous = await client.get(config.storage.pathname, {
      ...blobOptions(config),
      useCache: false,
    });
    if (previous) {
      const previousCache = await parseBlob(previous);
      if (
        Date.parse(previousCache.syncedAt) > Date.parse(cache.syncedAt) ||
        Date.parse(previousCache.feed.generatedAt) > Date.parse(cache.feed.generatedAt)
      )
        throw new CatalogStorageError('Ya existe una versión más reciente del catálogo.');
    }
    // Conditional overwrite protects against a second job completing after our read.
    // Creation disallows overwrite so simultaneous first syncs cannot race silently.
    await client.put(config.storage.pathname, serialized, {
      ...blobOptions(config),
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: previous !== null,
      ...(previous ? { ifMatch: previous.blob.etag } : {}),
      cacheControlMaxAge: 60,
    });
    return;
  }

  await mkdir(config.dataDir, { recursive: true });
  const location = path.join(config.dataDir, 'catalog.json');
  const temporary = path.join(config.dataDir, `catalog-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    cacheSchema.parse(JSON.parse(await readFile(temporary, 'utf8')));
    await rename(temporary, location);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
