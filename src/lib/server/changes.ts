import { z } from 'zod';
import { SUPPLIER_IDS, type PricingConfig } from './config';
import type { CatalogCache, SupplierProduct } from './feed';
import { priceInCop } from './pricing';

export const SIGNIFICANT_PRICE_CHANGE_COP = 5_000;

const nonnegativeInteger = z.number().int().min(0);
const identity = {
  supplierId: z.enum(SUPPLIER_IDS),
  productId: z.string().regex(/^\d{5,25}$/),
  variantId: z.string().regex(/^[A-Za-z0-9._:;-]{1,128}$/),
};

const priceChangeSchema = z
  .object({
    ...identity,
    oldPriceCop: z.number().int().positive(),
    newPriceCop: z.number().int().positive(),
    deltaCop: z.number().int(),
    absoluteDeltaCop: z.number().int().positive(),
    severity: z.enum(['minor', 'significant']),
  })
  .strict();

const stockChangeSchema = z
  .object({
    ...identity,
    oldStock: nonnegativeInteger,
    newStock: nonnegativeInteger,
    deltaStock: z.number().int(),
  })
  .strict();

export const changesReportSchema = z
  .object({
    thresholdCop: z.literal(SIGNIFICANT_PRICE_CHANGE_COP),
    basis: z.enum(['supplier_cost_cop', 'sale_price_cop']),
    comparedAt: z.iso.datetime({ offset: true }),
    previousSyncedAt: z.iso.datetime({ offset: true }).nullable(),
    counts: z
      .object({
        addedProducts: nonnegativeInteger,
        removedProducts: nonnegativeInteger,
        priceChanges: nonnegativeInteger,
        significantPriceChanges: nonnegativeInteger,
        minorPriceChanges: nonnegativeInteger,
        stockChanges: nonnegativeInteger,
      })
      .strict(),
    priceChanges: z.array(priceChangeSchema),
    stockChanges: z.array(stockChangeSchema),
  })
  .strict()
  .superRefine((report, context) => {
    const significantCount = report.priceChanges.filter(
      (change) => change.severity === 'significant',
    ).length;
    if (
      report.counts.priceChanges !== report.priceChanges.length ||
      report.counts.significantPriceChanges !== significantCount ||
      report.counts.minorPriceChanges !== report.priceChanges.length - significantCount ||
      report.counts.stockChanges !== report.stockChanges.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['counts'],
        message: 'Change counts must match entries',
      });
    }
    for (const [index, change] of report.priceChanges.entries()) {
      const delta = change.newPriceCop - change.oldPriceCop;
      const absoluteDelta = Math.abs(delta);
      if (
        delta === 0 ||
        change.deltaCop !== delta ||
        change.absoluteDeltaCop !== absoluteDelta ||
        change.severity !== (absoluteDelta > report.thresholdCop ? 'significant' : 'minor')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['priceChanges', index],
          message: 'Invalid price difference or severity',
        });
      }
    }
    for (const [index, change] of report.stockChanges.entries()) {
      if (change.deltaStock === 0 || change.deltaStock !== change.newStock - change.oldStock) {
        context.addIssue({
          code: 'custom',
          path: ['stockChanges', index],
          message: 'Invalid stock difference',
        });
      }
    }
  });

export type ChangesReport = z.infer<typeof changesReportSchema>;

const supplierCostPricing: PricingConfig = {
  markupPercent: 0,
  fixedCostCopPerItem: 0,
  roundingCop: 1,
};

function key(product: Pick<SupplierProduct, 'supplierId' | 'id'>): string {
  return `${product.supplierId}:${product.id}`;
}

/**
 * Compares matching SKUs using each snapshot's USD/COP exchange rate. Without a
 * configured margin, the basis is supplier cost, rounded up to a whole COP by the
 * shared pricing helper. With pricing, both snapshots use the CURRENT configured
 * margin, fixed cost and rounding; this report cannot reconstruct prior margins.
 *
 * The COP 5,000 threshold classifies changes only. This pure function neither
 * suppresses a price update nor blocks or modifies either catalog. Every change
 * is retained. New/removed products count separately from comparable SKU changes;
 * newly added/removed SKUs have no previous/next price or stock to compare.
 */
export function compareCatalogs(
  previous: CatalogCache | null,
  next: CatalogCache,
  pricing: PricingConfig | null,
): ChangesReport {
  const previousProducts = new Map(
    previous?.feed.products.map((product) => [key(product), product]),
  );
  const nextProducts = new Map(next.feed.products.map((product) => [key(product), product]));
  const priceChanges: ChangesReport['priceChanges'] = [];
  const stockChanges: ChangesReport['stockChanges'] = [];
  const appliedPricing = pricing ?? supplierCostPricing;
  let addedProducts = 0;
  let significantPriceChanges = 0;

  for (const [productKey, product] of nextProducts) {
    const oldProduct = previousProducts.get(productKey);
    if (!oldProduct || !previous) {
      addedProducts += 1;
      continue;
    }
    const previousVariants = new Map(oldProduct.variants.map((variant) => [variant.id, variant]));
    for (const variant of product.variants) {
      const oldVariant = previousVariants.get(variant.id);
      if (!oldVariant) continue;
      const variantIdentity = {
        supplierId: product.supplierId,
        productId: product.id,
        variantId: variant.id,
      };
      const oldPriceCop = priceInCop(
        oldVariant.priceUsd,
        previous.exchangeRate.usdCop,
        appliedPricing,
      );
      const newPriceCop = priceInCop(variant.priceUsd, next.exchangeRate.usdCop, appliedPricing);
      const deltaCop = newPriceCop - oldPriceCop;
      if (deltaCop !== 0) {
        const absoluteDeltaCop = Math.abs(deltaCop);
        const significant = absoluteDeltaCop > SIGNIFICANT_PRICE_CHANGE_COP;
        if (significant) significantPriceChanges += 1;
        priceChanges.push({
          ...variantIdentity,
          oldPriceCop,
          newPriceCop,
          deltaCop,
          absoluteDeltaCop,
          severity: significant ? 'significant' : 'minor',
        });
      }
      if (variant.stock !== oldVariant.stock) {
        stockChanges.push({
          ...variantIdentity,
          oldStock: oldVariant.stock,
          newStock: variant.stock,
          deltaStock: variant.stock - oldVariant.stock,
        });
      }
    }
  }

  return {
    thresholdCop: SIGNIFICANT_PRICE_CHANGE_COP,
    basis: pricing ? 'sale_price_cop' : 'supplier_cost_cop',
    comparedAt: next.syncedAt,
    previousSyncedAt: previous?.syncedAt ?? null,
    counts: {
      addedProducts,
      removedProducts: [...previousProducts.keys()].filter(
        (productKey) => !nextProducts.has(productKey),
      ).length,
      priceChanges: priceChanges.length,
      significantPriceChanges,
      minorPriceChanges: priceChanges.length - significantPriceChanges,
      stockChanges: stockChanges.length,
    },
    priceChanges,
    stockChanges,
  };
}
