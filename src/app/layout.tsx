import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' });
const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-serif',
});
export const metadata: Metadata = {
  title: 'Glamour Boutique Cali | Vestidos, bandage y mucho más',
  description:
    'Descubre la colección de Glamour Boutique Cali. Vestidos bandage, faldas, conjuntos y calzado. Arma tu selección y recibe atención por WhatsApp.',
  robots: { index: false, follow: false },
  applicationName: 'Glamour Boutique Cali',
  icons: {
    icon: { url: '/brand/logo-glamour.png', type: 'image/png' },
    apple: { url: '/brand/logo-glamour.png', type: 'image/png' },
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
