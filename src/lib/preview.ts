import source from '../../docs/supplier-preview.json';
import type { Catalog, Category, Product } from './types';

// These archived supplier references are explicitly separated from current sellable stock.
// Never use their IDs or images to infer a current price, SKU or inventory level.
export function getPreviewCatalog(): Catalog {
  const products: Product[] = source.products
    .filter((p) => p.category !== 'enterizos')
    .map((p) => ({
      id: p.id,
      supplierId: p.storeId as Product['supplierId'],
      sourceUrl: p.sourceProductUrl,
      name: p.name,
      description:
        'Una referencia de nuestra selección. Escríbenos para confirmar las opciones disponibles de esta prenda.',
      category: p.category as Category,
      material: p.name.toLowerCase().includes('bandage') ? 'Bandage' : '',
      images: p.images,
      videos: [],
      priceCop: null,
      updatedAt: null,
      preview: true,
      variants: [
        {
          id: `${p.id}-consulta`,
          color: 'Según fotografía',
          colorHex: '#b3a89b',
          size: 'Por confirmar',
          stock: 0,
          priceCop: null,
        },
      ],
    }));
  const featuredOrder = ['4000499490406', '1005001640794082', '4000023303457', '4000201236437'];
  products.sort(
    (a, b) =>
      (featuredOrder.indexOf(a.id) < 0 ? 99 : featuredOrder.indexOf(a.id)) -
      (featuredOrder.indexOf(b.id) < 0 ? 99 : featuredOrder.indexOf(b.id)),
  );
  return {
    products,
    updatedAt: null,
    status: 'preview',
    checkoutEnabled: false,
    message: 'Catálogo de muestra · Precio y disponibilidad por confirmar.',
  };
}
