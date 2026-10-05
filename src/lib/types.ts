export type Category = 'vestidos' | 'faldas' | 'calzado' | 'conjuntos' | 'tops';
export interface ProductVariant {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
  priceCop: number | null;
  image?: string;
}
export interface Product {
  id: string;
  supplierId: '821117' | '1101290000';
  sourceUrl: string;
  name: string;
  description: string;
  category: Category;
  material: string;
  images: string[];
  videos: string[];
  variants: ProductVariant[];
  priceCop: number | null;
  updatedAt: string | null;
  isNew?: boolean;
  preview?: boolean;
}
export interface Catalog {
  products: Product[];
  updatedAt: string | null;
  status: 'live' | 'stale' | 'unconfigured' | 'preview';
  checkoutEnabled: boolean;
  message: string;
}
export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
}
export interface QuoteLine {
  productId: string;
  variantId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCop: number;
  lineTotalCop: number;
  sourceUrl: string;
}
export interface Quote {
  reference: string;
  lines: QuoteLine[];
  totalCop: number;
  expiresAt: string;
  whatsappUrl: string;
  message: string;
}
