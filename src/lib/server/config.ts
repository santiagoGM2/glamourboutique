import path from 'node:path';

export const SUPPLIER_IDS = ['821117', '1101290000'] as const;
export const MAX_AGE_MS = 26 * 60 * 60 * 1_000;
export const CLOCK_SKEW_MS = 5 * 60 * 1_000;
export const QUOTE_LIFETIME_MS = 15 * 60 * 1_000;
export const WHATSAPP_NUMBER = '573128851441';

export interface PricingConfig {
  markupPercent: number;
  fixedCostCopPerItem: number;
  roundingCop: number;
}

export interface ServerConfig {
  feedUrl: string;
  feedToken: string;
  fxProvider: string;
  dataDir: string;
  pricing: PricingConfig | null;
}

function decimalSetting(value: string | undefined, maximum: number): number | null {
  if (value === undefined || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed <= maximum ? parsed : null;
}

/** An absent margin deliberately has no sale-price default. Explicit 0 is valid. */
export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const markupPercent = decimalSetting(env.GLAMOUR_MARKUP_PERCENT, 1_000);
  const fixedCostCopPerItem = decimalSetting(
    env.GLAMOUR_FIXED_COST_COP_PER_ITEM ?? '0',
    10_000_000,
  );
  const roundingCop = decimalSetting(env.GLAMOUR_PRICE_ROUNDING_COP ?? '100', 100_000);
  const pricing =
    markupPercent !== null &&
    fixedCostCopPerItem !== null &&
    roundingCop !== null &&
    Number.isInteger(fixedCostCopPerItem) &&
    Number.isInteger(roundingCop) &&
    roundingCop >= 1
      ? { markupPercent, fixedCostCopPerItem, roundingCop }
      : null;
  return {
    feedUrl: env.ALIEXPRESS_CATALOG_FEED_URL?.trim() ?? '',
    feedToken: env.ALIEXPRESS_CATALOG_FEED_TOKEN?.trim() ?? '',
    fxProvider: env.GLAMOUR_FX_PROVIDER?.trim() ?? '',
    // This cache belongs to a persistent runtime volume, never the bundled source tree.
    dataDir: path.resolve(
      /* turbopackIgnore: true */ env.GLAMOUR_DATA_DIR?.trim() || path.join(process.cwd(), 'data'),
    ),
    pricing,
  };
}

export function hasIntegrationConfig(config: ServerConfig): boolean {
  return Boolean(config.feedUrl && config.feedToken && config.fxProvider === 'exchange-rate-api');
}

export function isFresh(timestamp: string, now: number): boolean {
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -CLOCK_SKEW_MS && age <= MAX_AGE_MS;
}
