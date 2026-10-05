'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Heart, ArrowUpRight, ImageSquare } from '@phosphor-icons/react';
import type { Product } from '@/lib/types';
import { money } from '@/lib/format';

export default function ProductCard({
  product,
  favorite,
  onFavorite,
  onOpen,
  index,
}: {
  product: Product;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  index: number;
}) {
  const colors = [...new Map(product.variants.map((v) => [v.color, v])).values()];
  const [color, setColor] = useState(colors[0]?.color);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const colorImage = colors.find((v) => v.color === color)?.image;
  const mainImage = colorImage
    ? failedImages.includes(colorImage)
      ? undefined
      : colorImage
    : product.images.find((src) => !failedImages.includes(src));
  // A variant photo does not imply that the rest of the gallery shows that color.
  const alternateImage =
    !colorImage || colors.length === 1
      ? product.images.find((src) => src !== mainImage && !failedImages.includes(src))
      : undefined;
  const selectedPrices = product.variants
    .filter((v) => v.color === color && v.priceCop !== null)
    .map((v) => v.priceCop as number);
  const selectedPrice = selectedPrices.length
    ? Math.min(...selectedPrices)
    : colors.length
      ? null
      : product.priceCop;
  const referenceColor =
    product.preview && colors.length === 1 && colors[0].color === 'Según fotografía';
  const markImageFailed = (src: string) => {
    setFailedImages((previous) => (previous.includes(src) ? previous : [...previous, src]));
  };
  return (
    <article
      className="product-card"
      style={{ '--index': Math.min(index, 7) } as React.CSSProperties}
    >
      <div className="product-visual">
        <button className="product-open" onClick={onOpen} aria-label={`Ver ${product.name}`}>
          {mainImage ? (
            <>
              <Image
                key={mainImage}
                src={mainImage}
                alt={product.name}
                fill
                sizes="(max-width: 680px) 50vw, (max-width: 1000px) 33vw, 25vw"
                className="product-photo primary-photo"
                loading={index < 4 ? 'eager' : 'lazy'}
                onError={() => markImageFailed(mainImage)}
              />
              {alternateImage && (
                <Image
                  key={alternateImage}
                  src={alternateImage}
                  alt={`${product.name}, otra vista`}
                  fill
                  sizes="(max-width: 680px) 50vw, 25vw"
                  className="product-photo secondary-photo"
                  onError={() => markImageFailed(alternateImage)}
                />
              )}
            </>
          ) : (
            <span className="photo-unavailable">
              <ImageSquare size={36} weight="thin" />
              <span>Imagen no disponible</span>
            </span>
          )}
          <span className="quick-view">
            Descubrir prenda <ArrowUpRight size={16} />
          </span>
        </button>
        {product.isNew && !product.preview && <span className="product-badge">NUEVO</span>}
        <button
          className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
          aria-label={`${favorite ? 'Quitar de' : 'Guardar en'} favoritos: ${product.name}`}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Heart size={20} weight={favorite ? 'fill' : 'light'} />
        </button>
      </div>
      <div className="product-info">
        <span className="product-category">{product.material || product.category}</span>
        <button className="product-name" onClick={onOpen}>
          {product.name}
        </button>
        <div className="price-row">
          <span className={selectedPrice === null ? 'price pending-price' : 'price'}>
            {selectedPrice === null ? 'Precio por confirmar' : money(selectedPrice)}
            {selectedPrice !== null && <small> COP</small>}
          </span>
        </div>
        {referenceColor ? (
          <p className="reference-options">Tallas y colores por confirmar</p>
        ) : (
          colors.length > 0 && (
            <div className="swatches">
              {colors.map((v) => (
                <button
                  key={v.color}
                  className={`swatch ${v.color === color ? 'selected' : ''}`}
                  style={{ '--swatch': v.colorHex } as React.CSSProperties}
                  aria-label={`${product.name}: ${v.color}`}
                  aria-pressed={v.color === color}
                  title={v.color}
                  onClick={() => setColor(v.color)}
                />
              ))}
              <span className="swatch-label">{color}</span>
            </div>
          )
        )}
      </div>
    </article>
  );
}
