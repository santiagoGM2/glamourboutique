import { z } from 'zod';
import { SUPPLIER_IDS } from './config';

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Control characters are not allowed');
const timestamp = z.iso.datetime({ offset: true });
const itemId = z.string().regex(/^\d{5,25}$/);
const skuId = z.string().regex(/^[A-Za-z0-9._:;-]{1,128}$/);

function isSupplierMedia(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['alicdn.com', 'aliexpress-media.com'].some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    );
  } catch {
    return false;
  }
}

const mediaUrl = z
  .string()
  .max(2_048)
  .refine(isSupplierMedia, 'Expected an HTTPS supplier media URL');
const sourceUrl = z
  .string()
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.port &&
        (url.hostname === 'aliexpress.com' || url.hostname.endsWith('.aliexpress.com')) &&
        /^\/item\/\d{5,25}\.html$/.test(url.pathname)
      );
    } catch {
      return false;
    }
  }, 'Expected an AliExpress item URL')
  .transform((value) => {
    const url = new URL(value);
    return `https://www.aliexpress.com${url.pathname}`;
  });

const variantSchema = z
  .object({
    id: skuId,
    color: text(80),
    colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    size: text(30),
    stock: z.number().int().min(0).max(1_000_000),
    priceUsd: z
      .number()
      .positive()
      .max(100_000)
      .refine(
        (value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 0.00001,
        'USD prices must have at most four decimals',
      ),
    image: mediaUrl.optional(),
  })
  .strict();

const productSchema = z
  .object({
    id: itemId,
    supplierId: z.enum(SUPPLIER_IDS),
    sourceUrl,
    name: text(180),
    description: z.string().max(8_000),
    category: z.enum(['vestidos', 'faldas', 'calzado', 'conjuntos', 'tops']),
    material: text(160),
    images: z.array(mediaUrl).min(1).max(30),
    videos: z.array(mediaUrl).max(10),
    variants: z.array(variantSchema).min(1).max(300),
    updatedAt: timestamp,
    isNew: z.boolean().optional(),
  })
  .strict()
  .superRefine((product, context) => {
    if (product.sourceUrl !== `https://www.aliexpress.com/item/${product.id}.html`) {
      context.addIssue({
        code: 'custom',
        message: 'Product ID must match sourceUrl',
        path: ['sourceUrl'],
      });
    }
    if (new Set(product.variants.map((variant) => variant.id)).size !== product.variants.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate variant IDs', path: ['variants'] });
    }
    const choices = product.variants.map(
      (variant) => `${variant.color.toLowerCase()}\0${variant.size.toLowerCase()}`,
    );
    if (new Set(choices).size !== choices.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each color and size combination must identify one SKU',
        path: ['variants'],
      });
    }
  });

/** The integrator must enumerate BOTH stores, not merely return a single product endpoint. */
export const feedSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: timestamp,
    language: z.literal('es'),
    destination: z.literal('CO'),
    currency: z.literal('USD'),
    suppliers: z
      .array(z.enum(SUPPLIER_IDS))
      .length(2)
      .refine((ids) => new Set(ids).size === 2, 'Both authorized supplier IDs are required'),
    products: z.array(productSchema).max(5_000),
  })
  .strict()
  .superRefine((feed, context) => {
    const keys = feed.products.map((product) => `${product.supplierId}:${product.id}`);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate products', path: ['products'] });
    }
  });

export const exchangeRateSchema = z
  .object({
    provider: z.literal('exchange-rate-api'),
    usdCop: z.number().min(100).max(100_000),
    asOf: timestamp,
  })
  .strict();

export const cacheSchema = z
  .object({
    schemaVersion: z.literal(1),
    syncedAt: timestamp,
    feed: feedSchema,
    exchangeRate: exchangeRateSchema,
  })
  .strict();

export type SupplierFeed = z.infer<typeof feedSchema>;
export type SupplierProduct = SupplierFeed['products'][number];
export type CatalogCache = z.infer<typeof cacheSchema>;
export type ExchangeRate = z.infer<typeof exchangeRateSchema>;

export function productKey(product: Pick<SupplierProduct, 'supplierId' | 'id'>): string {
  return `${product.supplierId}:${product.id}`;
}
