import type { PricingConfig } from './config';

/** Integer arithmetic avoids binary-float jumps at a COP rounding boundary. */
export function priceInCop(priceUsd: number, usdCop: number, config: PricingConfig): number {
  const usdUnits = BigInt(Math.round(priceUsd * 10_000));
  const rateUnits = BigInt(Math.round(usdCop * 1_000_000));
  const markupBasisPoints = BigInt(Math.round(config.markupPercent * 100));
  const denominator = 10_000n * 1_000_000n * 10_000n;
  const numerator =
    usdUnits * rateUnits * (10_000n + markupBasisPoints) +
    BigInt(config.fixedCostCopPerItem) * denominator;
  const unit = BigInt(config.roundingCop);
  const divisor = denominator * unit;
  const result = Number(((numerator + divisor - 1n) / divisor) * unit);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('Invalid calculated price');
  return result;
}
