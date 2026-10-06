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
5. En Vercel, conectar Blob privado y comprobar el cron diario. En un servidor propio, programar el comando y compartir su volumen con la aplicación.

La importación conserva el último catálogo válido si falla la nueva descarga. Las cotizaciones revisan variantes, existencias, margen y antigüedad del catálogo y del cambio en el servidor. Los precios que envía el navegador no se usan para calcular el total.

La colección selecciona como máximo **200 productos de cada proveedor**, mantiene sus referencias entre actualizaciones y completa vacantes desde la fuente verificada. Informa el recuento real de cada tienda: no fabrica artículos para alcanzar 400. El orden inicial es el de la fuente, no una clasificación garantizada de más vendidos.

Cada sincronización compara los SKU con la versión anterior. Registra cambios de precio de hasta **$5.000 COP** como menores y superiores como significativos, tanto al subir como al bajar; todos los precios nuevos se actualizan. El informe detallado queda en el almacenamiento privado y el comando de sincronización devuelve solo recuentos. Sin margen compara costos del proveedor convertidos a COP; esos costos no se muestran a las clientas. No se envían notificaciones externas automáticamente.

## Pago y WhatsApp

La llave es `3128851441`; WhatsApp abre `+57 3128851441` con el resumen de prendas, variantes y cantidades. Con datos reales válidos, el servidor genera una cotización de duración limitada y su total en COP. En vista previa se solicita una cotización a Glamour.

La clienta realiza la transferencia y adjunta el comprobante en WhatsApp. Abrir WhatsApp no envía el mensaje automáticamente. La aplicación no verifica transferencias, no reserva inventario y no crea una orden pagada. La cotización tampoco ejecuta una compra en AliExpress.

## Despliegue y mantenimiento

La aplicación soporta Vercel con una instantánea en **Blob privado**. Conectar el almacén al proyecto para obtener `BLOB_READ_WRITE_TOKEN`, o usar `BLOB_STORE_ID` con la identidad OIDC del runtime. En Vercel nunca se usa disco efímero como persistencia. Desarrollo, revisión y producción tienen rutas de catálogo separadas; solo `VERCEL_ENV=production` selecciona producción y solo `VERCEL_ENV=preview` selecciona revisión. Un entorno local, ausente o distinto usa desarrollo. Las credenciales quedan solo en el servidor y los costos USD nunca salen por la API pública.

`vercel.json` declara `GET /api/cron/sync-catalog` diariamente a las 07:15 UTC (02:15 en Colombia). Configurar un `CRON_SECRET` aleatorio; la ruta exige `Authorization: Bearer …`. El horario debe ajustarse al momento real de actualización del feed y de la tasa para mantener su vigencia de 26 horas. Vercel ejecuta cron únicamente en despliegues **de producción**; una revisión preview no activa tareas periódicas. Una llamada autorizada responde `503 not_configured` si falta fuente o almacenamiento, `502 failed` si falla la importación y `200 updated` solo después de guardar una instantánea válida.

Sin feed o margen, el despliegue puede revisarse con las referencias archivadas y consultar la selección por WhatsApp; no habilita cobros ni presenta esos datos como inventario vigente. Promover a producción no resuelve automáticamente la autorización del catálogo ni el margen pendiente.

En desarrollo sin Blob o en un servidor propio, la aplicación mantiene la escritura atómica en `GLAMOUR_DATA_DIR` (por defecto `./data`); se requiere un volumen persistente y una sola instancia escritora. `npm start` escucha en `127.0.0.1`, por lo que un alojamiento propio necesita proxy inverso o ajustar la escucha.

Para contribuir, usar una rama `codex/`, mantener los secretos fuera de Git y ejecutar las comprobaciones anteriores. Las reglas comerciales se prueban en servidor; los cambios de catálogo, selección, carrito o pago también deben revisarse en móvil y escritorio.

Ver [requisitos y criterios de aceptación](docs/requisitos.md) para el alcance solicitado y las decisiones pendientes de catálogo, margen y entrega.
