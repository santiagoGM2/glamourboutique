import test from 'node:test';
import assert from 'node:assert/strict';
import { addCartItem, inquiryMessage, inquiryUrl, MAX_CART_LINES, readCart } from '../src/lib/cart';
import { getPreviewCatalog } from '../src/lib/preview';

test('corrupt storage and malformed lines are safely discarded', () => {
  assert.deepEqual(readCart('{'), []);
  assert.deepEqual(readCart('{"items":[]}'), []);
  assert.deepEqual(
    readCart(
      JSON.stringify([
        { productId: 'a', variantId: 'x', quantity: -1 },
        { productId: 'a', variantId: 'x', quantity: 1.5 },
        { productId: 'a', variantId: 'x', quantity: '2' },
        { productId: 'a', variantId: 'x', quantity: Number.MAX_SAFE_INTEGER + 1 },
        { productId: '', variantId: 'x', quantity: 1 },
        { productId: 'a\nInjected message', variantId: 'x', quantity: 1 },
        { productId: 'a', variantId: null, quantity: 1 },
        {},
        [],
        null,
      ]),
    ),
    [],
  );
});
test('stored duplicates merge by SKU, quantities clamp to 20 and unknown fields are removed', () => {
  assert.deepEqual(
    readCart(
      JSON.stringify([
        { productId: 'a', variantId: 's', quantity: 3, priceCop: 1 },
        { productId: 'a', variantId: 's', quantity: 4 },
        { productId: 'a', variantId: 'm', quantity: 999 },
        { productId: 'b', variantId: 's', quantity: 2 },
      ]),
    ),
    [
      { productId: 'a', variantId: 's', quantity: 7 },
      { productId: 'a', variantId: 'm', quantity: 20 },
      { productId: 'b', variantId: 's', quantity: 2 },
    ],
  );
  assert.equal(
    readCart(
      JSON.stringify([
        { productId: 'a', variantId: 's', quantity: 18 },
        { productId: 'a', variantId: 's', quantity: 18 },
      ]),
    )[0].quantity,
    20,
  );
});
test('50 distinct lines remain purchasable while duplicate rows still merge at the cap', () => {
  const items = Array.from({ length: MAX_CART_LINES + 3 }, (_, i) => ({
    productId: `p${i}`,
    variantId: 's',
    quantity: 1,
  }));
  const restored = readCart(JSON.stringify([...items, { ...items[0], quantity: 2 }]));
  assert.equal(restored.length, MAX_CART_LINES);
  assert.equal(restored[0].quantity, 3);
  assert.equal(restored.at(-1)?.productId, `p${MAX_CART_LINES - 1}`);
  assert.deepEqual(
    addCartItem(restored, { productId: 'another', variantId: 's', quantity: 1 }),
    restored,
  );
  const updated = addCartItem(restored, { ...items[0], quantity: 2 });
  assert.equal(updated.length, MAX_CART_LINES);
  assert.equal(updated[0].quantity, 5);
  assert.equal(restored[0].quantity, 3);
});
test('same SKU merges, distinct options remain separate, stock limit is respected', () => {
  const first = { productId: 'a', variantId: 'black-s', quantity: 1 };
  const merged = addCartItem([first], { ...first, quantity: 8 }, 3);
  assert.equal(merged[0].quantity, 3);
  const separate = addCartItem(merged, { ...first, variantId: 'black-m' }, 5);
  assert.equal(separate.length, 2);
  assert.equal(first.quantity, 1);
});
test('adding cannot create zero-stock or invalid lines or exceed the per-line cap', () => {
  const item = { productId: 'a', variantId: 's', quantity: 1 };
  for (const limit of [0, -1, NaN, Infinity]) {
    assert.deepEqual(addCartItem([], item, limit), []);
    assert.deepEqual(addCartItem([item], item, limit), [item]);
  }
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) {
    assert.deepEqual(addCartItem([], { ...item, quantity }), []);
  }
  assert.equal(addCartItem([], { ...item, quantity: 99 }, 500)[0].quantity, 20);
});
test('WhatsApp inquiry retains references, quantities, options and no-payment language', () => {
  const products = getPreviewCatalog().products;
  const item = { productId: products[0].id, variantId: products[0].variants[0].id, quantity: 2 };
  const text = inquiryMessage([item], products);
  assert.ok(text.includes(`2 × ${products[0].name}`));
  assert.ok(text.includes(products[0].sourceUrl));
  assert.ok(text.includes(item.variantId));
  assert.ok(text.includes('Aún no he realizado una transferencia'));
  const url = new URL(inquiryUrl([item], products));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/573128851441');
  assert.equal(url.searchParams.get('text'), text);
});
test('preview cannot imply current prices or sellable stock', () => {
  const catalog = getPreviewCatalog();
  assert.equal(catalog.checkoutEnabled, false);
  assert.equal(catalog.status, 'preview');
  assert.ok(
    catalog.products.every(
      (p) =>
        p.preview &&
        p.priceCop === null &&
        p.updatedAt === null &&
        p.variants.every((v) => v.stock === 0 && v.priceCop === null),
    ),
  );
});
