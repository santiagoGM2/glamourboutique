import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Catalog, Product } from '../types';
import { hasIntegrationConfig, isFresh, readConfig, type ServerConfig } from './config';
import { cacheSchema, productKey, type CatalogCache } from './feed';
import { priceInCop } from './pricing';

export const MAX_CACHE_BYTES = 16 * 1_024 * 1_024;

export async function readCatalogCache(config: ServerConfig): Promise<CatalogCache | null> {
  try {
    const location = path.join(config.dataDir, 'catalog.json');
    const metadata = await stat(location);
    if (metadata.size > MAX_CACHE_BYTES || !metadata.isFile()) return null;
    return cacheSchema.parse(JSON.parse(await readFile(location, 'utf8')));
  } catch {
    // Missing, invalid or unreadable cache must never create a purchasable catalog.
    return null;
  }
}

export function isCacheFresh(cache: CatalogCache, now: number): boolean {
  return [
    cache.syncedAt,
    cache.feed.generatedAt,
    cache.exchangeRate.asOf,
    ...cache.feed.products.map((product) => product.updatedAt),
  ].every((date) => isFresh(date, now));
}

export function catalogFromCache(
  cache: CatalogCache | null,
  config: ServerConfig,
  now = Date.now(),
): Catalog {
  if (!hasIntegrationConfig(config) || !cache) {
    return {
      products: [],
      updatedAt: null,
      status: 'unconfigured',
      checkoutEnabled: false,
      message: 'Estamos preparando el catálogo. Escríbenos para consultar disponibilidad.',
    };
  }

  const fresh = isCacheFresh(cache, now);
  const pricing = config.pricing;
  const products: Product[] = cache.feed.products.map((source) => {
    const variants = source.variants.map(({ priceUsd, ...variant }) => ({
      ...variant,
      priceCop: pricing ? priceInCop(priceUsd, cache.exchangeRate.usdCop, pricing) : null,
    }));
    const inStock = variants.filter((variant) => variant.stock > 0);
    const applicable = inStock.length ? inStock : variants;
    const prices = applicable.flatMap((variant) =>
      variant.priceCop === null ? [] : [variant.priceCop],
    );
    return {
      id: productKey(source),
      supplierId: source.supplierId,
      sourceUrl: source.sourceUrl,
      name: source.name,
      description: source.description,
      category: source.category,
      material: source.material,
      images: source.images,
      videos: source.videos,
      variants,
      priceCop: prices.length ? Math.min(...prices) : null,
      updatedAt: source.updatedAt,
      isNew: source.isNew,
    };
  });

  return {
    products,
    updatedAt: cache.syncedAt,
    status: fresh ? (pricing ? 'live' : 'unconfigured') : 'stale',
    checkoutEnabled:
      fresh &&
      pricing !== null &&
      products.some((product) => product.variants.some((variant) => variant.stock > 0)),
    message: !fresh
      ? 'Estamos actualizando precios y disponibilidad. Consulta tu selección por WhatsApp antes de pagar.'
      : !pricing
        ? 'Los precios de esta colección están por confirmar. Consulta tu selección por WhatsApp.'
        : 'Precios en pesos colombianos. Disponibilidad verificada en la última actualización del catálogo.',
  };
}

export async function getCatalog(): Promise<Catalog> {
  const config = readConfig();
  return catalogFromCache(await readCatalogCache(config), config);
}
