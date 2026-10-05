'use client';
import { useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  ShoppingBagOpen,
  WhatsappLogo,
} from '@phosphor-icons/react';
import type { Product, ProductVariant } from '@/lib/types';
import { money, WHATSAPP_NUMBER } from '@/lib/format';
import Dialog from './dialog';

export default function ProductDetail({
  product,
  onClose,
  onAdd,
  favorite,
  onFavorite,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (variant: ProductVariant) => void;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const [image, setImage] = useState(0);
  const colors = [...new Map(product.variants.map((v) => [v.color, v])).values()];
  const [color, setColor] = useState(colors[0]?.color || '');
  const [size, setSize] = useState('');
  const [error, setError] = useState('');
  const [video, setVideo] = useState<number | null>(null);
  const gallery = [
    ...new Set([...product.images, ...product.variants.flatMap((v) => (v.image ? [v.image] : []))]),
  ];
  const variants = product.variants.filter((v) => v.color === color);
  const variant = variants.find((v) => v.size === size);
  const selectedPrice = variant ? variant.priceCop : product.priceCop;
  const selectColor = (next: string) => {
    setColor(next);
    setSize('');
    setError('');
    setVideo(null);
    const photo = product.variants.find((v) => v.color === next)?.image;
    const i = gallery.indexOf(photo || '');
    if (i >= 0) setImage(i);
  };
  return (
    <Dialog title="La prenda, en detalle" kind="modal" className="product-dialog" onClose={onClose}>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            {video !== null && product.videos[video] ? (
              <video
                key={product.videos[video]}
                src={product.videos[video]}
                controls
                playsInline
                preload="metadata"
              />
            ) : gallery[image] ? (
              <Image
                src={gallery[image]}
                alt={`${product.name}, vista ${image + 1}`}
                fill
                sizes="(max-width: 680px) 90vw, 45vw"
                priority
              />
            ) : (
              <span>Imagen no disponible</span>
            )}
            {video === null && gallery.length > 1 && (
              <div className="gallery-navigation">
                <button
                  aria-label="Foto anterior"
                  onClick={() => setImage((i) => (i - 1 + gallery.length) % gallery.length)}
                >
                  <ArrowLeft size={20} />
                </button>
                <span>
                  {image + 1} / {gallery.length}
                </span>
                <button
                  aria-label="Foto siguiente"
                  onClick={() => setImage((i) => (i + 1) % gallery.length)}
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
          <div className="thumbnails">
            {gallery.map((src, i) => (
              <button
                key={src}
                className={i === image && video === null ? 'selected' : ''}
                aria-label={`Ver foto ${i + 1}`}
                onClick={() => {
                  setImage(i);
                  setVideo(null);
                }}
              >
                <Image src={src} alt="" fill sizes="64px" />
              </button>
            ))}
            {product.videos.map((src, i) => (
              <button
                key={src}
                className={`video-thumbnail ${video === i ? 'selected' : ''}`}
                onClick={() => setVideo(i)}
              >
                Video {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="detail-content">
          <span className="eyebrow">GLAMOUR BOUTIQUE CALI</span>
          <h2>{product.name}</h2>
          <p className="detail-price">
            {selectedPrice === null ? 'Precio por confirmar' : `${money(selectedPrice)} COP`}
          </p>
          {product.preview && (
            <p className="inline-notice">
              Prenda de referencia. Confirmaremos el precio, las tallas y la disponibilidad antes de
              tu compra.
            </p>
          )}
          <p className="description">{product.description}</p>
          {colors.length > 0 && (
            <fieldset>
              <legend>
                Color <span>— {color}</span>
              </legend>
              <div className="detail-colors">
                {colors.map((v) => (
                  <button
                    key={v.color}
                    className={`swatch ${v.color === color ? 'selected' : ''}`}
                    style={{ '--swatch': v.colorHex } as React.CSSProperties}
                    aria-label={`Elegir color ${v.color}`}
                    aria-pressed={v.color === color}
                    onClick={() => selectColor(v.color)}
                  />
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend>
              Talla <span>— {size || 'Selecciona tu talla'}</span>
            </legend>
            <div className="size-buttons">
              {variants.map((v) => (
                <button
                  key={v.id}
                  className={size === v.size ? 'selected' : ''}
                  disabled={!product.preview && v.stock < 1}
                  onClick={() => {
                    setSize(v.size);
                    setError('');
                  }}
                  aria-pressed={size === v.size}
                >
                  {v.size}
                </button>
              ))}
            </div>
            {variants.length === 0 && (
              <p className="muted">Consulta las opciones disponibles con una asesora.</p>
            )}
          </fieldset>
          <a
            className="size-help"
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola, necesito ayuda con la talla de ${product.name}. ${product.sourceUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            ¿Dudas con tu talla? Te asesoramos
          </a>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="detail-actions">
            <button
              className="button dark"
              disabled={
                variants.length === 0 || (!product.preview && !!variant && variant.stock < 1)
              }
              onClick={() => {
                if (!variant) {
                  setError('Selecciona una talla para agregar esta prenda.');
                  return;
                }
                onAdd(variant);
              }}
            >
              <ShoppingBagOpen size={20} />
              Agregar a mi bolsa
            </button>
            <button
              className="favorite-outline"
              aria-label="Guardar prenda en favoritos"
              aria-pressed={favorite}
              onClick={onFavorite}
            >
              <Heart size={23} weight={favorite ? 'fill' : 'light'} />
            </button>
          </div>
          <div className="detail-assurances">
            <span>
              <Check size={16} />
              Atención personalizada
            </span>
            <span>
              <WhatsappLogo size={16} />
              Finaliza tu pedido por WhatsApp
            </span>
          </div>
          <details>
            <summary>Sobre esta prenda</summary>
            <p>
              {product.material ? `Material indicado: ${product.material}. ` : ''}Revisa las
              fotografías y confirma las medidas de la talla con nuestra asesora.
            </p>
          </details>
          <details>
            <summary>Entrega y disponibilidad</summary>
            <p>
              Consulta los tiempos de entrega y el costo de envío para tu ciudad antes de realizar
              la transferencia.
            </p>
          </details>
        </div>
      </div>
    </Dialog>
  );
}
