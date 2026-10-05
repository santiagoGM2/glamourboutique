export const money = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
export const categories = [
  { id: 'all', name: 'Ver todo' },
  { id: 'vestidos', name: 'Vestidos' },
  { id: 'faldas', name: 'Faldas' },
  { id: 'calzado', name: 'Calzado' },
  { id: 'conjuntos', name: 'Conjuntos' },
  { id: 'tops', name: 'Tops' },
] as const;
export const WHATSAPP_NUMBER = '573128851441';
export const PAYMENT_KEY = '3128851441';
