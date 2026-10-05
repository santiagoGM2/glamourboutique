# Glamour Boutique Cali

Tienda en español construida con Next.js, React y TypeScript. Incluye catálogo adaptable, fotografías alternativas, filtros, selección de variantes, carrito y cierre por WhatsApp con los métodos de pago entregados por Glamour.

**Estado:** los enlaces de AliExpress no proporcionan por sí solos una conexión al catálogo. El proyecto prepara la importación desde un feed de un integrador autorizado, pero requiere esa fuente y el margen comercial para ofrecer precios reales. La vista previa visual no acredita stock ni precios vigentes y no habilita el pago de productos de demostración. No se usan fotografías de Mew Mews.

## Inicio local

Requiere Node.js compatible con Next.js 16 (20.9 o superior) y npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abrir http://127.0.0.1:3000. Sin credenciales, se puede revisar la experiencia visual y el carrito de vista previa. Los secretos de `.env.local` no se publican en Git.

```powershell
npm run typecheck
npm test
npm run build
npm start
```

## Activar datos reales

El contrato del feed y las variables completas están en [la guía de integración](docs/catalog-integration.md). El importador admite exclusivamente las tiendas `821117` y `1101290000`; conserva los identificadores, variantes y medios de los proveedores.

1. Configurar `ALIEXPRESS_CATALOG_FEED_URL` con el endpoint HTTPS del integrador y `ALIEXPRESS_CATALOG_FEED_TOKEN` con su token de acceso. La implementación actual requiere ambos. Los enlaces públicos de las tiendas no sirven como endpoint de feed.
2. Definir `GLAMOUR_MARKUP_PERCENT`. Dejarlo vacío mantiene la venta deshabilitada; no se presume un margen de cero.
3. Configurar los costos por artículo y el redondeo según el acuerdo comercial. Habilitar la fuente de cambio con `GLAMOUR_FX_PROVIDER=exchange-rate-api`.
4. Ejecutar `npm run sync:catalog`, revisar el resultado y comprobar `/api/catalog` antes de abrir la venta.
5. Programar el comando diariamente en el alojamiento elegido y verificar que el estado sigue vigente.

La importación conserva el último catálogo válido si falla la nueva descarga. Las cotizaciones revisan variantes, existencias, margen y antigüedad del catálogo y del cambio en el servidor. Los precios que envía el navegador no se usan para calcular el total.

## Pago y WhatsApp

La llave es `3128851441`; WhatsApp abre `+57 3128851441` con el resumen de prendas, variantes y cantidades. Con datos reales válidos, el servidor genera una cotización de duración limitada y su total en COP. En vista previa se solicita una cotización a Glamour.

La clienta realiza la transferencia y adjunta el comprobante en WhatsApp. Abrir WhatsApp no envía el mensaje automáticamente. La aplicación no verifica transferencias, no reserva inventario y no crea una orden pagada. La cotización tampoco ejecuta una compra en AliExpress.

## Despliegue y mantenimiento

La versión actual guarda el catálogo como JSON mediante escritura atómica en `GLAMOUR_DATA_DIR` (por defecto `./data`). Se necesita un servidor con un volumen persistente, una sola instancia escritora y un programador diario. El disco efímero de funciones serverless no conserva este catálogo de forma fiable; para ese alojamiento se debe adaptar la persistencia a una base de datos o almacenamiento de objetos antes de habilitar ventas.

`npm start` escucha en `127.0.0.1`; un despliegue propio necesita un proxy inverso o ajustar la escucha a la configuración del alojamiento. El programador y la publicación no quedan activados por descargar este repositorio.

Para contribuir, usar una rama `codex/`, mantener los secretos fuera de Git y ejecutar las comprobaciones anteriores. Las reglas comerciales se prueban en servidor; los cambios de catálogo, selección, carrito o pago también deben revisarse en móvil y escritorio.

Ver [requisitos y criterios de aceptación](docs/requisitos.md) para el alcance solicitado y las decisiones pendientes de catálogo, margen y entrega.
