import Image from 'next/image';
import Link from 'next/link';
import { WHATSAPP_NUMBER } from '@/lib/format';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <Link className="not-found-brand" href="/" aria-label="Ir a Glamour Boutique Cali">
        <Image src="/brand/logo-glamour.png" alt="Glamour Boutique Cali" width={216} height={144} />
      </Link>
      <div className="not-found-content">
        <span className="eyebrow">GLAMOUR BOUTIQUE CALI · 404</span>
        <h1>Volvamos a la colección</h1>
        <p>Esta página no está disponible. Tu próxima prenda puede estar en nuestra colección.</p>
        <Link className="button dark" href="/">
          Explorar la colección
        </Link>
        <a
          className="text-button"
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola, necesito ayuda para encontrar una prenda en Glamour Boutique Cali.')}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Hablar con una asesora
        </a>
      </div>
    </main>
  );
}
