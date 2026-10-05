import type { CartItem, Product } from './types';
import { WHATSAPP_NUMBER } from './format';

export const MAX_CART_LINES = 50;
const MAX_ITEM_QUANTITY = 20;

function validItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const validId = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9._:;-]{1,160}$/.test(id);
  return (
    validId(item.productId) &&
    validId(item.variantId) &&
    typeof item.quantity === 'number' &&
    Number.isSafeInteger(item.quantity) &&
    item.quantity > 0
  );
}

function normalizeItems(values: unknown[]): CartItem[] {
  const items = new Map<string, CartItem>();
  for (const item of values) {
    if (!validItem(item)) continue;
    const key = `${item.productId}\0${item.variantId}`;
    const previous = items.get(key);
    if (!previous && items.size >= MAX_CART_LINES) continue;
    items.set(key, {
      productId: item.productId,
      variantId: item.variantId,
      quantity: Math.min(MAX_ITEM_QUANTITY, item.quantity + (previous?.quantity ?? 0)),
    });
  }
  return [...items.values()];
}

export function readCart(value: string | null): CartItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return normalizeItems(parsed);
  } catch {
    return [];
  }
}
export function addCartItem(cart: CartItem[], next: CartItem, limit = 20): CartItem[] {
  if (!validItem(next) || !Number.isFinite(limit) || limit < 1) return cart;
  const maximum = Math.min(MAX_ITEM_QUANTITY, Math.floor(limit));
  const normalized = normalizeItems(cart);
  const found = normalized.find(
    (i) => i.productId === next.productId && i.variantId === next.variantId,
  );
  if (found)
    return normalized.map((i) =>
      i === found ? { ...i, quantity: Math.min(maximum, i.quantity + next.quantity) } : i,
    );
  if (normalized.length >= MAX_CART_LINES) return normalized;
  return [
    ...normalized,
    {
      productId: next.productId,
      variantId: next.variantId,
      quantity: Math.min(maximum, next.quantity),
    },
  ];
}
export function inquiryMessage(cart: CartItem[], products: Product[]): string {
  const lines = cart.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    return product && variant
      ? `${item.quantity} × ${product.name}\nColor: ${variant.color} · Talla: ${variant.size}\nRef.: ${product.id} · Opción: ${variant.id}\n${product.sourceUrl}`
      : `${item.quantity} × Referencia ${item.productId} (opción ${item.variantId}, por confirmar)`;
  });
  return `Hola, Glamour Boutique Cali. Me gustaría consultar esta selección:\n\n${lines.join('\n\n')}\n\nPor favor, confírmenme disponibilidad, tallas, precio final en COP y costo de envío antes de realizar el pago. Aún no he realizado una transferencia.`;
}
export function inquiryUrl(cart: CartItem[], products: Product[]): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(inquiryMessage(cart, products))}`;
}
