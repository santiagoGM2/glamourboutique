'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CaretDown,
  ChatCircle,
  Diamond,
  FadersHorizontal,
  GridFour,
  Heart,
  List,
  Minus,
  Plus,
  Rows,
  MagnifyingGlass,
  ShoppingBagOpen,
  Trash,
  Truck,
  WhatsappLogo,
  X,
} from '@phosphor-icons/react';
import type { CartItem, Catalog, Product, ProductVariant, Quote } from '@/lib/types';
import { categories, money, WHATSAPP_NUMBER } from '@/lib/format';
import { addCartItem, inquiryUrl, MAX_CART_LINES, readCart } from '@/lib/cart';
import Dialog from './dialog';
import ProductCard from './product-card';
import ProductDetail from './product-detail';
import Payment from './payment';

type Panel = 'cart' | 'favorites' | 'filters' | 'menu' | 'payment' | 'checkout' | null;
const CART_KEY = 'glamour-bag-v1';
const FAVORITES_KEY = 'glamour-favorites-v1';
const contactUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola, Glamour Boutique Cali. Quisiera recibir asesoría sobre su colección.')}`;

export default function Storefront({ initialCatalog }: { initialCatalog: Catalog }) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState('featured');
  const [maxPrice, setMaxPrice] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [grid, setGrid] = useState(4);
  const [visibleCount, setVisibleCount] = useState(24);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [expired, setExpired] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const checkoutRequest = useRef(0);

  useEffect(() => {
    try {
      setCart(readCart(localStorage.getItem(CART_KEY)));
      const parsed: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      if (Array.isArray(parsed))
        setFavorites(parsed.filter((id): id is string => typeof id === 'string').slice(0, 200));
    } catch {
      /* Shopping remains usable when browser storage is unavailable. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
      } catch {
        /* Private browser mode. */
      }
    }
  }, [cart, ready]);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      } catch {
        /* Private browser mode. */
      }
    }
  }, [favorites, ready]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (!quote) return;
    const update = () => setExpired(Date.now() >= new Date(quote.expiresAt).getTime());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [quote]);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/catalog', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('catalog');
        const latest: Catalog = await response.json();
        setCatalog((current) =>
          current.status === 'preview' &&
          latest.status === 'unconfigured' &&
          latest.updatedAt === null
            ? current
            : latest,
        );
        setRefreshError(false);
      } catch {
        if (!controller.signal.aborted) setRefreshError(true);
      }
    }
    void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const toggleFavorite = useCallback(
    (id: string) =>
      setFavorites((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id])),
    [],
  );
  const products = catalog.products;
  const sizes = [...new Set(products.flatMap((p) => p.variants.map((v) => v.size)))].filter(
    (v) => v !== 'Por confirmar',
  );
  const colors = [...new Set(products.flatMap((p) => p.variants.map((v) => v.color)))].filter(
    (v) => v !== 'Según fotografía',
  );
  const filtered = useMemo(
    () =>
      products
        .filter((p) => {
          const text = `${p.name} ${p.description} ${p.category}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
          const query = search
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
          const matchingOption =
            (!maxPrice && !sizeFilter && !colorFilter) ||
            p.variants.some(
              (v) =>
                (!maxPrice || (v.priceCop !== null && v.priceCop <= Number(maxPrice))) &&
                (!sizeFilter || v.size === sizeFilter) &&
                (!colorFilter || v.color === colorFilter),
            );
          return (
            (category === 'all' || p.category === category) &&
            text.includes(query) &&
            matchingOption
          );
        })
        .sort((a, b) =>
          sort === 'price-asc'
            ? (a.priceCop ?? Infinity) - (b.priceCop ?? Infinity)
            : sort === 'price-desc'
              ? (b.priceCop ?? -Infinity) - (a.priceCop ?? -Infinity)
              : sort === 'name'
                ? a.name.localeCompare(b.name, 'es')
                : sort === 'newest'
                  ? (b.updatedAt || '').localeCompare(a.updatedAt || '')
                  : 0,
        ),
    [products, category, search, maxPrice, sizeFilter, colorFilter, sort],
  );
  const activeFilters = Number(!!maxPrice) + Number(!!sizeFilter) + Number(!!colorFilter);
  const bagCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartLines = cart.map((item) => ({
    item,
    product: products.find((p) => p.id === item.productId),
    variant: products
      .find((p) => p.id === item.productId)
      ?.variants.find((v) => v.id === item.variantId),
  }));
  const allPriced = cart.length > 0 && cartLines.every((l) => l.variant?.priceCop != null);
  const cartTotal = cartLines.reduce(
    (sum, l) => sum + (l.variant?.priceCop || 0) * l.item.quantity,
    0,
  );
  function chooseCategory(id: string) {
    setCategory(id);
    setVisibleCount(24);
    setPanel(null);
  }
  function closePanel() {
    checkoutRequest.current++;
    setBusy(false);
    setPanel(null);
  }
  function addProduct(product: Product, variant: ProductVariant) {
    if (
      cart.length >= MAX_CART_LINES &&
      !cart.some((i) => i.productId === product.id && i.variantId === variant.id)
    ) {
      setToast(`Puedes agregar hasta ${MAX_CART_LINES} opciones por pedido.`);
      return;
    }
    checkoutRequest.current++;
    setBusy(false);
    setCart((items) =>
      addCartItem(
        items,
        { productId: product.id, variantId: variant.id, quantity: 1 },
        product.preview ? 20 : Math.min(20, variant.stock),
      ),
    );
    setQuote(null);
    setSelected(null);
    setPanel('cart');
    setToast('Prenda agregada a tu bolsa');
  }
  function changeQuantity(index: number, quantity: number) {
    const line = cartLines[index];
    const limit = line.product?.preview ? 20 : Math.min(20, line.variant?.stock || 0);
    if (quantity > line.item.quantity && quantity > limit) return;
    checkoutRequest.current++;
    setBusy(false);
    setCart((items) =>
      items.flatMap((item, i) =>
        i !== index ? [item] : quantity < 1 ? [] : [{ ...item, quantity }],
      ),
    );
    setQuote(null);
    setCheckoutError('');
  }
  async function startCheckout() {
    const requestId = ++checkoutRequest.current;
    setCheckoutError('');
    setQuote(null);
    setExpired(false);
    if (!catalog.checkoutEnabled) {
      setPanel('checkout');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });
      const result = await response.json();
      if (requestId !== checkoutRequest.current) return;
      if (!response.ok)
        throw new Error(result.error || 'No pudimos verificar tu pedido. Intenta de nuevo.');
      setQuote(result);
      setPanel('checkout');
    } catch (error) {
      if (requestId === checkoutRequest.current)
        setCheckoutError(
          error instanceof Error ? error.message : 'No pudimos verificar el pedido.',
        );
    } finally {
      if (requestId === checkoutRequest.current) setBusy(false);
    }
  }
  const clearFilters = () => {
    setCategory('all');
    setSearch('');
    setMaxPrice('');
    setSizeFilter('');
    setColorFilter('');
    setVisibleCount(24);
  };
  const filterContents = (
    <div className="filters-content">
      <fieldset>
        <legend>Categoría</legend>
        {categories.map((c) => (
          <label className="filter-radio" key={c.id}>
            <input
              type="radio"
              name="category"
              checked={category === c.id}
              onChange={() => {
                setCategory(c.id);
                setVisibleCount(24);
              }}
            />
            <span>{c.name}</span>
            <small>
              {c.id === 'all'
                ? products.length
                : products.filter((p) => p.category === c.id).length}
            </small>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Precio máximo</legend>
        <label className="price-input">
          <span>COP $</span>
          <input
            type="number"
            min="0"
            step="10000"
            value={maxPrice}
            placeholder="Sin límite"
            aria-label="Precio máximo en pesos colombianos"
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setVisibleCount(24);
            }}
          />
        </label>
        {catalog.status === 'preview' && (
          <p className="filter-note">Los precios de las prendas de muestra están por confirmar.</p>
        )}
      </fieldset>
      <fieldset>
        <legend>Talla</legend>
        {sizes.length ? (
          <div className="size-buttons">
            {sizes.map((s) => (
              <button
                key={s}
                className={sizeFilter === s ? 'selected' : ''}
                aria-pressed={sizeFilter === s}
                onClick={() => setSizeFilter(sizeFilter === s ? '' : s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="filter-note">Las tallas se confirmarán al actualizar la colección.</p>
        )}
      </fieldset>
      {!!colors.length && (
        <fieldset>
          <legend>Color</legend>
          <select
            aria-label="Filtrar por color"
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
          >
            <option value="">Todos los colores</option>
            {colors.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </fieldset>
      )}
      <button className="text-button" onClick={clearFilters}>
        Limpiar filtros
      </button>
      <button className="button dark" onClick={() => setPanel(null)}>
        Ver {filtered.length} prendas
      </button>
    </div>
  );

  return (
    <>
      <a className="skip-link" href="#coleccion">
        Ir a la colección
      </a>
      <div className="announcement">
        <span>EL GLAMOUR ES TUYO. NOSOTRAS TE ACOMPAÑAMOS.</span>
        <a href={contactUrl} target="_blank" rel="noopener noreferrer">
          Atención personalizada <ArrowUpRight size={12} />
        </a>
      </div>
      <header className="site-header">
        <div className="masthead">
          <div className="header-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setPanel('menu')}
            >
              <List size={24} />
            </button>
            <span className="location-label">
              CALI, COLOMBIA <span>Especialistas en bandage</span>
            </span>
          </div>
          <button
            className="brand"
            aria-label="Glamour Boutique Cali, ver toda la colección"
            onClick={clearFilters}
          >
            <Image
              src="/brand/logo-glamour.png"
              alt="Glamour Boutique Cali"
              width={180}
              height={120}
              priority
            />
          </button>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Buscar prendas"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <MagnifyingGlass size={23} weight="light" />
            </button>
            <button
              className="icon-button favorites-nav"
              aria-label={`Mis favoritos, ${favorites.length} prendas`}
              onClick={() => setPanel('favorites')}
            >
              <Heart size={23} weight="light" />
              {favorites.length > 0 && <span className="counter">{favorites.length}</span>}
            </button>
            <button
              className="icon-button"
              aria-label={`Abrir bolsa, ${bagCount} prendas`}
              onClick={() => setPanel('cart')}
            >
              <ShoppingBagOpen size={24} weight="light" />
              <span className="counter">{bagCount}</span>
            </button>
          </div>
        </div>
        <nav className="main-nav" aria-label="Categorías de la colección">
          {categories.map((c) => (
            <button
              key={c.id}
              className={category === c.id ? 'active' : ''}
              onClick={() => chooseCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
          <button className="nav-payment" onClick={() => setPanel('payment')}>
            Cómo comprar <ArrowUpRight size={13} />
          </button>
        </nav>
        {searchOpen && (
          <div className="search-bar">
            <MagnifyingGlass size={21} />
            <input
              type="search"
              autoFocus
              placeholder="Encuentra tu próximo favorito…"
              aria-label="Buscar en la colección"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(24);
              }}
            />
            <button
              className="icon-button"
              aria-label="Cerrar búsqueda"
              onClick={() => {
                setSearchOpen(false);
                setSearch('');
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}
      </header>
      <main id="coleccion">
        <div className="collection-intro">
          <div className="breadcrumb">
            <button onClick={clearFilters}>Inicio</button>
            <span>/</span>
            <span>Colección</span>
          </div>
          <span className="eyebrow">EL ARTE DE SENTIRTE TÚ</span>
          <h1>
            {category === 'all'
              ? 'La colección Glamour'
              : categories.find((c) => c.id === category)?.name}
          </h1>
          <p>Siluetas que enamoran. Prendas que hablan de ti.</p>
          <div className="collection-tabs">
            {categories.slice(0, 5).map((c) => (
              <button
                key={c.id}
                className={category === c.id ? 'active' : ''}
                onClick={() => chooseCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {catalog.status === 'preview' || catalog.status === 'unconfigured' ? (
          <div className="catalog-notice">
            <span className="notice-mark">i</span>
            <p>
              <strong>Colección de referencia.</strong> Confirma precio y disponibilidad por
              WhatsApp.
            </p>
            <a href={contactUrl} target="_blank" rel="noopener noreferrer">
              Consultar <ArrowUpRight size={14} />
            </a>
          </div>
        ) : !catalog.checkoutEnabled ? (
          <div className="catalog-notice">
            <p>
              Estamos confirmando precios y disponibilidad. Puedes preparar tu selección y
              consultarla por WhatsApp.
            </p>
          </div>
        ) : null}
        {refreshError && (
          <p className="connection-notice" role="status">
            No pudimos actualizar la colección. Comprobaremos los precios antes de continuar al
            pago.
          </p>
        )}
        <div className="catalog-toolbar">
          <button
            className={`filter-trigger ${activeFilters ? 'has-filters' : ''}`}
            onClick={() => setPanel('filters')}
          >
            <FadersHorizontal size={19} weight="light" />
            Filtrar{activeFilters > 0 && <span>{activeFilters}</span>}
          </button>
          <span className="result-count">
            {filtered.length} {filtered.length === 1 ? 'prenda' : 'prendas'}
          </span>
          <div className="grid-switch" aria-label="Vista del catálogo">
            <button
              aria-label="Ver en dos columnas"
              aria-pressed={grid === 2}
              className={grid === 2 ? 'active' : ''}
              onClick={() => setGrid(2)}
            >
              <Rows size={20} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button
              aria-label="Ver en cuatro columnas"
              aria-pressed={grid === 4}
              className={grid === 4 ? 'active' : ''}
              onClick={() => setGrid(4)}
            >
              <GridFour size={20} />
            </button>
          </div>
          <label className="sort-control">
            <span>Ordenar por:</span>
            <select
              aria-label="Ordenar prendas"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="featured">Selección Glamour</option>
              <option value="newest">Más recientes</option>
              <option value="price-asc">Menor precio</option>
              <option value="price-desc">Mayor precio</option>
              <option value="name">Nombre: A–Z</option>
            </select>
            <CaretDown size={13} />
          </label>
        </div>
        {(search || activeFilters > 0) && (
          <div className="active-filters">
            {search && (
              <button onClick={() => setSearch('')}>
                “{search}” <X size={13} />
              </button>
            )}
            {maxPrice && (
              <button onClick={() => setMaxPrice('')}>
                Hasta {money(Number(maxPrice))} <X size={13} />
              </button>
            )}
            {sizeFilter && (
              <button onClick={() => setSizeFilter('')}>
                Talla {sizeFilter} <X size={13} />
              </button>
            )}
            {colorFilter && (
              <button onClick={() => setColorFilter('')}>
                {colorFilter} <X size={13} />
              </button>
            )}
          </div>
        )}
        <div className={`product-grid columns-${grid}`}>
          {filtered.slice(0, visibleCount).map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              favorite={favorites.includes(product.id)}
              onFavorite={() => toggleFavorite(product.id)}
              onOpen={() => setSelected(product)}
            />
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <MagnifyingGlass size={35} weight="thin" />
            <h2>
              {category === 'calzado' && !search
                ? 'Los próximos pasos, muy pronto.'
                : 'Aún no hay prendas en esta selección.'}
            </h2>
            <p>
              {category === 'calzado'
                ? 'Estamos preparando la selección de calzado. Puedes consultar las opciones por WhatsApp.'
                : 'Prueba otra categoría o ajusta los filtros para seguir descubriendo.'}
            </p>
            <button className="button outlined" onClick={clearFilters}>
              Ver toda la colección
            </button>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="catalog-end">
            <span>
              Has visto {Math.min(visibleCount, filtered.length)} de {filtered.length} prendas
            </span>
            <div className="collection-progress">
              <i style={{ width: `${Math.min(visibleCount / filtered.length, 1) * 100}%` }} />
            </div>
            {visibleCount < filtered.length && (
              <button className="button outlined" onClick={() => setVisibleCount((n) => n + 24)}>
                Descubrir más prendas
              </button>
            )}
            <p>
              ¿Buscas algo especial?{' '}
              <a href={contactUrl} target="_blank" rel="noopener noreferrer">
                Hablemos por WhatsApp <ArrowUpRight size={13} />
              </a>
            </p>
          </div>
        )}
      </main>
      <section className="brand-note">
        <Diamond size={31} weight="thin" />
        <span className="eyebrow">BANDAGE. ACTITUD. GLAMOUR.</span>
        <h2>Tu esencia, tu mejor look.</h2>
        <p>
          Amamos las siluetas que te hacen sentir bien.
          <br />
          Encuentra la tuya con la asesoría de Glamour Boutique Cali.
        </p>
        <a href={contactUrl} target="_blank" rel="noopener noreferrer">
          Encuentra tu prenda ideal <ArrowUpRight size={16} />
        </a>
      </section>
      <div className="service-strip">
        <span>
          <Diamond size={24} weight="thin" />
          <span>
            <strong>Especialistas en bandage</strong>Prendas para tus mejores momentos
          </span>
        </span>
        <span>
          <ChatCircle size={24} weight="thin" />
          <span>
            <strong>Estamos para asesorarte</strong>Elige tu talla con nuestra ayuda
          </span>
        </span>
        <span>
          <ShoppingBagOpen size={24} weight="thin" />
          <span>
            <strong>Una compra acompañada</strong>Finaliza tu pedido por WhatsApp
          </span>
        </span>
      </div>
      <footer>
        <div className="footer-main">
          <div className="footer-brand">
            <Image
              src="/brand/logo-glamour.png"
              alt="Glamour Boutique Cali"
              width={160}
              height={107}
            />
            <p>
              Viste como te sientes.
              <br />
              Siéntete como quieres.
            </p>
          </div>
          <div>
            <h3>EXPLORA</h3>
            {categories.slice(1, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  chooseCategory(c.id);
                  document.getElementById('coleccion')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div>
            <h3>TE ACOMPAÑAMOS</h3>
            <button onClick={() => setPanel('payment')}>Métodos de pago</button>
            <a href={contactUrl} target="_blank" rel="noopener noreferrer">
              Asesoría de tallas
            </a>
            <a href={contactUrl} target="_blank" rel="noopener noreferrer">
              Envíos y disponibilidad
            </a>
          </div>
          <div className="footer-contact">
            <h3>HABLEMOS</h3>
            <a href={contactUrl} target="_blank" rel="noopener noreferrer">
              <WhatsappLogo size={20} />
              312 885 1441
            </a>
            <p>
              Cali, Colombia
              <br />
              Atención personalizada por WhatsApp
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Glamour Boutique Cali</span>
          <span>Colombia · Español · COP $</span>
          {catalog.status === 'live' && (
            <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
              Tasas de cambio: ExchangeRate-API
            </a>
          )}
        </div>
      </footer>
      <a
        className="floating-whatsapp"
        aria-label="Hablar con Glamour por WhatsApp"
        href={contactUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <WhatsappLogo size={27} weight="light" />
      </a>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {selected && (
        <ProductDetail
          key={selected.id}
          product={selected}
          favorite={favorites.includes(selected.id)}
          onFavorite={() => toggleFavorite(selected.id)}
          onClose={() => setSelected(null)}
          onAdd={(variant) => addProduct(selected, variant)}
        />
      )}
      {panel === 'menu' && (
        <Dialog title="Glamour Boutique Cali" onClose={closePanel}>
          <nav className="mobile-nav">
            {categories.map((c) => (
              <button key={c.id} onClick={() => chooseCategory(c.id)}>
                {c.name}
                <ArrowUpRight size={19} />
              </button>
            ))}
            <button onClick={() => setPanel('favorites')}>
              Mis favoritos
              <Heart size={19} />
            </button>
            <button onClick={() => setPanel('payment')}>
              Cómo comprar
              <ShoppingBagOpen size={19} />
            </button>
          </nav>
        </Dialog>
      )}
      {panel === 'filters' && (
        <Dialog title="Encuentra tu prenda" onClose={closePanel}>
          {filterContents}
        </Dialog>
      )}
      {panel === 'favorites' && (
        <Dialog title={`Tus favoritos (${favorites.length})`} onClose={closePanel}>
          {products.filter((p) => favorites.includes(p.id)).length ? (
            <div className="favorites-grid">
              {products
                .filter((p) => favorites.includes(p.id))
                .map((p, i) => (
                  <ProductCard
                    key={p.id}
                    index={i}
                    product={p}
                    favorite
                    onFavorite={() => toggleFavorite(p.id)}
                    onOpen={() => {
                      setPanel(null);
                      setSelected(p);
                    }}
                  />
                ))}
            </div>
          ) : (
            <div className="empty-state">
              <Heart size={40} weight="thin" />
              <h2>Guarda lo que te enamora.</h2>
              <p>Toca el corazón de una prenda para encontrarla aquí.</p>
              <button className="button dark" onClick={() => setPanel(null)}>
                Explorar la colección
              </button>
            </div>
          )}
        </Dialog>
      )}
      {panel === 'cart' && (
        <Dialog title={`Tu bolsa (${bagCount})`} onClose={closePanel}>
          {cart.length ? (
            <>
              <div className="bag-lines">
                {cartLines.map(({ item, product, variant }, index) => (
                  <div className="bag-line" key={`${item.productId}-${item.variantId}`}>
                    <div className="bag-photo">
                      {product?.images[0] && (
                        <Image
                          src={variant?.image || product.images[0]}
                          alt={product.name}
                          fill
                          sizes="100px"
                        />
                      )}
                    </div>
                    <div className="bag-line-info">
                      <strong>{product?.name || 'Prenda no disponible'}</strong>
                      <span>
                        {variant?.color || 'Opción no disponible'} ·{' '}
                        {variant?.size || 'Por confirmar'}
                      </span>
                      <b>
                        {variant?.priceCop != null
                          ? money(variant.priceCop)
                          : 'Precio por confirmar'}
                      </b>
                      <div className="bag-quantity">
                        <button
                          aria-label={`Quitar una unidad de ${product?.name || item.productId}`}
                          onClick={() => changeQuantity(index, item.quantity - 1)}
                        >
                          <Minus size={13} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label={`Agregar una unidad de ${product?.name || item.productId}`}
                          disabled={
                            item.quantity >=
                            (product?.preview ? 20 : Math.min(variant?.stock || 0, 20))
                          }
                          onClick={() => changeQuantity(index, item.quantity + 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                    <button
                      className="remove-item icon-button"
                      aria-label={`Eliminar ${product?.name || item.productId}`}
                      onClick={() => changeQuantity(index, 0)}
                    >
                      <Trash size={17} weight="light" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="bag-summary">
                <div className="total-row">
                  <span>Subtotal</span>
                  <strong>{allPriced ? `${money(cartTotal)} COP` : 'Por confirmar'}</strong>
                </div>
                <p>
                  {catalog.checkoutEnabled
                    ? 'Verificaremos los precios y la disponibilidad al continuar. El envío se confirma por WhatsApp.'
                    : 'Confirmaremos disponibilidad, precio final y envío por WhatsApp antes del pago.'}
                </p>
                {checkoutError && (
                  <p className="form-error" role="alert">
                    {checkoutError}
                  </p>
                )}
                <button className="button dark" disabled={busy} onClick={startCheckout}>
                  {busy
                    ? 'Verificando tu selección…'
                    : catalog.checkoutEnabled
                      ? 'Ir a pagar'
                      : 'Consultar mi selección'}
                  {!busy && <ArrowRight size={18} />}
                </button>
                <button className="text-button continue-shopping" onClick={closePanel}>
                  Seguir descubriendo
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <ShoppingBagOpen size={43} weight="thin" />
              <h2>Hay lugar para tus favoritos.</h2>
              <p>Descubre la colección y agrega las prendas que te encantan.</p>
              <button className="button dark" onClick={() => setPanel(null)}>
                Ver la colección
              </button>
            </div>
          )}
        </Dialog>
      )}
      {panel === 'payment' && (
        <Dialog title="Una compra, paso a paso" onClose={closePanel}>
          <ol className="purchase-steps">
            <li>
              <span>01</span>Elige tus prendas y agrégalas a la bolsa.
            </li>
            <li>
              <span>02</span>Confirma disponibilidad, total y envío.
            </li>
            <li>
              <span>03</span>Realiza el pago y comparte el soporte en WhatsApp.
            </li>
          </ol>
          <Payment canPay={false} />
        </Dialog>
      )}
      {panel === 'checkout' && (
        <Dialog
          title={quote ? 'Finaliza tu pedido' : 'Tu selección, lista para consultar'}
          onClose={closePanel}
        >
          <div className="checkout-content">
            <button
              className="text-button back-to-bag"
              onClick={() => {
                setPanel('cart');
                setQuote(null);
              }}
            >
              <ArrowLeft size={15} />
              Volver a la bolsa
            </button>
            {quote ? (
              <>
                <span className="eyebrow">PEDIDO {quote.reference}</span>
                <div className="quote-lines">
                  {quote.lines.map((line) => (
                    <div key={`${line.productId}-${line.variantId}`}>
                      <span>
                        {line.quantity} × {line.name}
                        <small>
                          {line.color} · {line.size}
                        </small>
                      </span>
                      <strong>{money(line.lineTotalCop)}</strong>
                    </div>
                  ))}
                </div>
                <div className="total-row">
                  <span>Total de prendas</span>
                  <strong>{money(quote.totalCop)} COP</strong>
                </div>
                <p className="quote-notice">
                  Precios verificados para esta selección. Revisa el total actualizado antes de
                  transferir. Confirma el costo de envío con nuestra asesora.
                </p>
                {expired ? (
                  <div className="inline-notice">
                    <p>
                      La verificación de precios venció. Vuelve a revisar tu bolsa antes de realizar
                      el pago.
                    </p>
                    <button
                      className="button dark"
                      onClick={() => {
                        setPanel('cart');
                        setQuote(null);
                      }}
                    >
                      Volver a verificar
                    </button>
                  </div>
                ) : (
                  <Payment canPay whatsappUrl={quote.whatsappUrl} />
                )}
              </>
            ) : (
              <>
                <div className="checkout-symbol">
                  <WhatsappLogo size={38} weight="thin" />
                </div>
                <h3>
                  Un paso más cerca
                  <br />
                  de tu próximo favorito.
                </h3>
                <p className="checkout-description">
                  Enviaremos tu selección con las referencias, cantidades y opciones elegidas. Una
                  asesora confirmará el precio final, la disponibilidad y el envío.
                </p>
                <div className="inquiry-summary">
                  {cartLines.map(({ item, product, variant }) => (
                    <div key={`${item.productId}-${item.variantId}`}>
                      <strong>
                        {item.quantity} × {product?.name || item.productId}
                      </strong>
                      <span>
                        {variant?.color} · {variant?.size}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="inline-notice">
                  No realices una transferencia hasta recibir la confirmación del total.
                </p>
                <a
                  className="button dark"
                  href={inquiryUrl(cart, products)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsappLogo size={20} />
                  Continuar a WhatsApp
                </a>
                <p className="payment-note">
                  El mensaje estará preparado. Solo tendrás que enviarlo.
                </p>
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
