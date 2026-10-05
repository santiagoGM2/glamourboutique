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
  const [failed, setFailed] = useState(false);
  const colorImage = colors.find((v) => v.color === color)?.image;
  const mainImage = colorImage || product.images[0];
  return (
    <article
      className="product-card"
      style={{ '--index': Math.min(index, 7) } as React.CSSProperties}
    >
      <div className="product-visual">
        <button className="product-open" onClick={onOpen} aria-label={`Ver ${product.name}`}>
          {mainImage && !failed ? (
            <>
              <Image
                src={mainImage}
                alt={product.name}
                fill
                sizes="(max-width: 680px) 50vw, (max-width: 1000px) 33vw, 25vw"
                className="product-photo primary-photo"
                priority={index < 4}
                onError={() => setFailed(true)}
              />
              {product.images[1] && (
                <Image
                  src={product.images[1]}
                  alt={`${product.name}, otra vista`}
                  fill
                  sizes="(max-width: 680px) 50vw, 25vw"
                  className="product-photo secondary-photo"
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
          <span className={product.priceCop === null ? 'price pending-price' : 'price'}>
            {product.priceCop === null ? 'Precio por confirmar' : money(product.priceCop)}
            {product.priceCop !== null && <small> COP</small>}
          </span>
        </div>
        {colors.length > 0 && (
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
        )}
      </div>
    </article>
  );
}
