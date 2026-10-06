import { z } from 'zod';
import { SUPPLIER_IDS } from './config';
import type { SupplierFeed } from './feed';

const productKey = (product: SupplierFeed['products'][number]) =>
  `${product.supplierId}:${product.id}`;

export const PRODUCTS_PER_SUPPLIER = 200;

export const selectionSchema = z
  .object({
    scope: z.literal('selected'),
    targetPerSupplier: z.literal(200),
    counts: z
      .object({
        '821117': z.number().int().min(0).max(200),
        '1101290000': z.number().int().min(0).max(200),
      })
      .strict(),
    complete: z.boolean(),
  })
  .strict()
  .refine(
    (selection) => selection.complete === SUPPLIER_IDS.every((id) => selection.counts[id] === 200),
    'Collection coverage must agree with the supplier counts',
  );

/** Select only from a validated complete feed; never infer missing products or rankings. */
export function selectCollection(feed: SupplierFeed, previous?: SupplierFeed) {
  const available = new Map(feed.products.map((product) => [productKey(product), product]));
  const chosen: SupplierFeed['products'] = [];
  const counts = { '821117': 0, '1101290000': 0 };
  const selectedKeys = new Set<string>();
  const choose = (key: string) => {
    const product = available.get(key);
    if (!product || selectedKeys.has(key) || counts[product.supplierId] >= PRODUCTS_PER_SUPPLIER)
      return;
    selectedKeys.add(key);
    chosen.push(product);
    counts[product.supplierId] += 1;
  };
  // Stable references survive upstream reordering, with their NEW prices and stock.
  for (const product of previous?.products ?? []) choose(productKey(product));
  // Fill vacancies in source order; a feed's order is not a verified sales ranking.
  for (const product of feed.products) choose(productKey(product));
  const selection = selectionSchema.parse({
    scope: 'selected',
    targetPerSupplier: PRODUCTS_PER_SUPPLIER,
    counts,
    complete: SUPPLIER_IDS.every((id) => counts[id] === PRODUCTS_PER_SUPPLIER),
  });
  return { feed: { ...feed, products: chosen }, selection };
}
