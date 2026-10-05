import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Catalog, CartItem, Quote, QuoteLine } from '../types';
import { isFresh, QUOTE_LIFETIME_MS, WHATSAPP_NUMBER } from './config';

export const MAX_CART_LINES = 50;
export const MAX_ITEM_QUANTITY = 99;

export class CheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^(?:821117|1101290000):\d{5,25}$/),
        variantId: z.string().regex(/^[A-Za-z0-9._:;-]{1,128}$/),
        quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
      }),
    )
    .min(1)
    .max(MAX_CART_LINES),
});

function normalizedItems(input: unknown): CartItem[] {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    throw new CheckoutError(
      'INVALID_CART',
      'Revisa los artículos y las cantidades de tu bolsa.',
      400,
    );
  }
  // Client prices, totals, names, supplier links and unknown fields are stripped.
  const groups = new Map<string, CartItem>();
  for (const item of parsed.data.items) {
    const key = `${item.productId}\0${item.variantId}`;
    const existing = groups.get(key);
    const quantity = item.quantity + (existing?.quantity ?? 0);
    if (quantity > MAX_ITEM_QUANTITY) {
      throw new CheckoutError(
        'INVALID_QUANTITY',
        `Puedes solicitar hasta ${MAX_ITEM_QUANTITY} unidades de la misma referencia.`,
        400,
      );
    }
    groups.set(key, { ...item, quantity });
  }
  return [...groups.values()];
}

const money = (value: number) =>
  `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)} COP`;

/** A quote is a purchase request; it does not reserve stock or mark a payment received. */
export function createQuote(input: unknown, catalog: Catalog, now = Date.now()): Quote {
  const items = normalizedItems(input);
  if (
    !catalog.checkoutEnabled ||
    catalog.status !== 'live' ||
    !catalog.updatedAt ||
    !isFresh(catalog.updatedAt, now)
  ) {
    throw new CheckoutError(
      'CHECKOUT_UNAVAILABLE',
      'Necesitamos confirmar precios y disponibilidad antes de recibir tu pago. Escríbenos por WhatsApp.',
    );
  }
  const lines: QuoteLine[] = items.map((item) => {
    const product = catalog.products.find((candidate) => candidate.id === item.productId);
    if (!product || product.preview || !product.updatedAt || !isFresh(product.updatedAt, now)) {
      throw new CheckoutError(
        'PRODUCT_UNAVAILABLE',
        'Una de las prendas necesita confirmación de disponibilidad. Actualiza tu bolsa.',
      );
    }
    const variant = product.variants.find((candidate) => candidate.id === item.variantId);
    if (!variant)
      throw new CheckoutError(
        'VARIANT_UNAVAILABLE',
        `La talla o el color de ${product.name} cambió. Selecciónalo de nuevo.`,
      );
    if (variant.stock < item.quantity) {
      throw new CheckoutError(
        'INSUFFICIENT_STOCK',
        `La cantidad disponible de ${product.name}, ${variant.color}, talla ${variant.size}, ha cambiado. Revisa tu bolsa.`,
      );
    }
    if (
      variant.priceCop === null ||
      !Number.isSafeInteger(variant.priceCop) ||
      variant.priceCop <= 0
    ) {
      throw new CheckoutError(
        'PRICE_UNAVAILABLE',
        'El precio de una de las prendas necesita confirmación.',
      );
    }
    const lineTotalCop = variant.priceCop * item.quantity;
    if (!Number.isSafeInteger(lineTotalCop))
      throw new CheckoutError('INVALID_TOTAL', 'No pudimos calcular el total de tu selección.');
    return {
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      color: variant.color,
      size: variant.size,
      quantity: item.quantity,
      unitPriceCop: variant.priceCop,
      lineTotalCop,
      sourceUrl: product.sourceUrl,
    };
  });
  const totalCop = lines.reduce((total, line) => total + line.lineTotalCop, 0);
  if (!Number.isSafeInteger(totalCop) || totalCop <= 0) {
    throw new CheckoutError('INVALID_TOTAL', 'No pudimos calcular el total de tu selección.');
  }
  const reference = `GL-${new Date(now).toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const expiresAt = new Date(now + QUOTE_LIFETIME_MS).toISOString();
  const expiration = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(expiresAt));
  const message = [
    'Hola, Glamour Boutique Cali. Esta es mi selección:',
    `Solicitud: ${reference}`,
    '',
    ...lines.flatMap((line, index) => [
      `${index + 1}. ${line.name}`,
      `Color: ${line.color} · Talla: ${line.size} · Cantidad: ${line.quantity}`,
      `${money(line.unitPriceCop)} c/u · Subtotal: ${money(line.lineTotalCop)}`,
      `Referencia: ${line.productId} · SKU: ${line.variantId}`,
      line.sourceUrl,
      '',
    ]),
    `Total de artículos: ${money(totalCop)}`,
    `Precios de esta cotización válidos hasta ${expiration} (hora de Colombia).`,
    'Les enviaré el soporte de mi transferencia en este chat. Por favor confirmen el pago y coordinen el envío.',
    'Esta solicitud no confirma un pago ni reserva inventario.',
  ].join('\n');
  return {
    reference,
    lines,
    totalCop,
    expiresAt,
    whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    message,
  };
}
