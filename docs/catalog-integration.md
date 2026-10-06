# Integración del catálogo y cotizaciones

## Estado real de esta entrega

La aplicación contiene el adaptador de importación, el cálculo de precios y la cotización. **No contiene una conexión autorizada y activa a AliExpress**: solo se recibieron los enlaces de las tiendas `821117` y `1101290000`, sin credenciales de API, acceso de dropshipping ni exportación del catálogo. Los enlaces de tienda son páginas web, no fuentes JSON. Tampoco se ha definido el margen comercial.

Por eso la configuración inicial mantiene la venta desactivada. Una colección de vista previa, si la interfaz la muestra, es independiente del catálogo del servidor; nunca se convierte en inventario, precio vigente ni orden pagada.

La [documentación oficial de AliExpress para la consulta de productos](https://developer.alibaba.com/docs/doc.htm?articleId=60452&docType=2&treeId=762) describe credenciales de aplicación, autorización, consultas por producto y datos de SKU, multimedia y tienda. Esa categoría de documentación aparece marcada como obsoleta: hay que confirmar el programa y los permisos que AliExpress conceda a la cuenta que se utilizará. La [documentación de la plataforma](https://developer.alibaba.com/docs/doc.htm?articleId=120689&docType=1&treeId=727) permite revisar el acceso vigente. Esta entrega no elude CAPTCHA ni presenta extracción de páginas públicas como una API estable.

## Lo que falta para activar el catálogo

1. Obtener autorización de las tiendas o un integrador con acceso autorizado a sus catálogos, imágenes, vídeos, SKU, precios y existencias. El integrador debe enumerar ambas tiendas completamente, resolver la paginación y entregar los nombres/descripciones en español y disponibilidad para Colombia.
2. Implementar o contratar un endpoint HTTPS que cumpla el contrato de abajo. Guardar su URL y token únicamente en las variables del servidor.
3. Definir margen, gastos incluidos en el precio, política de envío y redondeo con Glamour. No se asigna un margen comercial por suposición.
4. Conectar un almacén **Blob privado** al proyecto Vercel (o un volumen persistente en alojamiento propio), ejecutar una sincronización real, contrastar referencias y precios con ambas tiendas y comprobar el trabajo diario.

El adaptador no ordena compras en AliExpress ni recibe/valida transferencias. El pago se verifica por el negocio en WhatsApp.

## Variables del servidor

Copiar `.env.example` a `.env.local` y completar únicamente lo que ya esté acordado. La URL y el token del feed son obligatorios. Ninguna credencial debe llevar el prefijo `NEXT_PUBLIC_` ni añadirse a Git.

| Variable                          | Uso                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALIEXPRESS_CATALOG_FEED_URL`     | URL HTTPS pública del JSON de un integrador autorizado. No acepta URLs de tienda, HTTP, credenciales en la URL o direcciones IP literales.                                                  |
| `ALIEXPRESS_CATALOG_FEED_TOKEN`   | Token enviado como `Authorization: Bearer …`, solo a ese endpoint. Redirecciones desactivadas.                                                                                              |
| `GLAMOUR_FX_PROVIDER`             | Valor admitido: `exchange-rate-api`. Vacío mantiene la integración desactivada.                                                                                                             |
| `GLAMOUR_MARKUP_PERCENT`          | Porcentaje de incremento sobre el costo convertido, hasta dos decimales. Vacío o inválido desactiva precios y checkout. `0` explícito es válido. No es un porcentaje de margen sobre venta. |
| `GLAMOUR_FIXED_COST_COP_PER_ITEM` | Costo fijo entero en COP por unidad añadido después del incremento. Predeterminado: `0`. No representa un cálculo automático de envío o impuestos.                                          |
| `GLAMOUR_PRICE_ROUNDING_COP`      | Redondeo hacia arriba a múltiplos de esta cantidad entera. Predeterminado: `100`.                                                                                                           |
| `GLAMOUR_DATA_DIR`                | Directorio persistente compartido por el servidor y el proceso de sincronización. Vacío usa `./data`.                                                                                       |
| `BLOB_READ_WRITE_TOKEN`           | Token del almacén **privado** conectado en Vercel. Se utiliza solo en servidor; activa Blob también al ejecutar la sincronización local.                                                    |
| `BLOB_STORE_ID`                   | Alternativa de identidad: ID del almacén conectado, usado con `VERCEL_OIDC_TOKEN` administrado automáticamente por Vercel. El SDK acepta `store_<id>` o `<id>`.                             |
| `CRON_SECRET`                     | Secreto aleatorio para autenticar `GET /api/cron/sync-catalog`. Nunca incluirlo en URLs ni en el navegador.                                                                                 |

Fórmula por SKU y unidad:

```text
precio COP = redondear hacia arriba a múltiplos de redondeo COP (
  precio USD × tasa USD/COP × (1 + incremento porcentual / 100)
  + costo fijo COP por unidad
)
```

El cálculo usa enteros escalados para evitar que errores de coma flotante añadan un escalón de redondeo. El precio USD admite hasta cuatro decimales; la tasa se calcula con seis. El precio mínimo mostrado usa variantes con existencias cuando las hay. El servidor devuelve precios de venta, sin costos USD ni credenciales.

## Contrato del feed autorizado

La fuente debe responder `application/json` y representar una **instantánea completa**, no una página de resultados ni un cambio incremental. La validación rechaza propiedades desconocidas; el adaptador del integrador debe normalizar primero su respuesta. El esquema ejecutable está en `src/lib/server/feed.ts`.

| Campo raíz      | Contenido                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | Número `1`.                                                                                                                                                       |
| `generatedAt`   | Fecha ISO 8601 con zona horaria del momento real de obtención. No debe renovarse reutilizando información antigua.                                                |
| `language`      | Cadena `es`.                                                                                                                                                      |
| `destination`   | Cadena `CO`.                                                                                                                                                      |
| `currency`      | Cadena `USD`. Los precios normalizados son USD aunque la tienda se visite en español.                                                                             |
| `suppliers`     | Exactamente `['821117', '1101290000']`, sin duplicados; declara que se consultaron ambas tiendas.                                                                 |
| `products`      | De cero a 5.000 productos. Una respuesta completa vacía despublica el inventario anterior y desactiva ventas. Nunca usarla para comunicar un error de extracción. |

Cada producto contiene:

| Campo                             | Contenido                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                              | ID numérico real del artículo AliExpress como cadena, de 5 a 25 dígitos.                                                                                     |
| `supplierId`                      | `821117` o `1101290000`. La pertenencia real a la tienda debe verificarla el integrador.                                                                     |
| `sourceUrl`                       | URL HTTPS AliExpress con ruta `/item/ID.html` que coincida con `id`. Se eliminan parámetros y se normaliza el dominio.                                       |
| `name`, `description`, `material` | Nombre en español, descripción en texto y material comprobado. No inferir que todos los productos son bandage sin datos del proveedor.                       |
| `category`                        | `vestidos`, `faldas`, `calzado`, `conjuntos` o `tops`.                                                                                                       |
| `images`                          | Entre 1 y 30 URLs HTTPS a medios de `alicdn.com` o `aliexpress-media.com` y sus subdominios. Ordenadas para foto principal, reverso/segunda vista y galería. |
| `videos`                          | Lista de cero a diez URLs HTTPS de los mismos dominios. No se inventan vídeos ausentes.                                                                      |
| `updatedAt`                       | Fecha ISO de actualización verificada de este producto, con zona horaria.                                                                                    |
| `isNew`                           | Booleano opcional.                                                                                                                                           |
| `variants`                        | Entre 1 y 300 variantes.                                                                                                                                     |

Cada variante contiene `id` (SKU real, 1–128 caracteres alfanuméricos o `._:;-`), `color`, `colorHex` (`#RRGGBB`), `size`, `stock` (entero entre 0 y 1.000.000), `priceUsd` (número positivo, máximo 100.000, hasta cuatro decimales) e `image` opcional. Debe existir una sola variante por combinación color/talla; para catálogos con otros ejes hay que extender el modelo de forma explícita. Un SKU sin existencias sigue pudiendo mostrarse, pero el servidor no acepta su compra.

El identificador público de cada producto se forma como `supplierId:id`, para evitar colisiones entre tiendas. Se rechazan productos y SKU duplicados, orígenes discordantes, precios inválidos y medios fuera de los dominios permitidos.

## Dólar, vigencia y recuperación

Con `GLAMOUR_FX_PROVIDER=exchange-rate-api` el trabajo consulta `https://open.er-api.com/v6/latest/USD`, valida `base_code=USD`, `result=success`, `rates.COP` y `time_last_update_unix`. Es una tasa comercial de referencia del proveedor, **no una afirmación de TRM oficial colombiana**.

La [documentación de ExchangeRate-API](https://www.exchangerate-api.com/docs/free) permite uso comercial y caché de conversión, indica actualización diaria y exige un enlace de atribución en las páginas que utilizan la tasa. La interfaz debe conservar el enlace a [ExchangeRate-API](https://www.exchangerate-api.com). No se expone ni redistribuye su matriz de tasas.

Cada petición remota tiene un límite de 20 segundos; el JSON/caché se limita a 16 MiB. Una sincronización solo reemplaza la instantánea cuando el feed completo y la tasa pasan la validación. En Blob se usa acceso privado, lectura consistente (`useCache: false`), escritura condicional por ETag y rechazo de una actualización anterior a la guardada. Un trabajo concurrente no puede sobrescribir una versión que cambió después de su lectura. La creación inicial prohíbe sobrescribir. En disco local se escribe un archivo temporal en el mismo directorio, se valida y se renombra. Los errores conservan la última versión válida y no imprimen credenciales ni respuestas remotas.

La vigencia máxima es de **26 horas**, comprobada en el momento de consultar o cotizar. Afecta a la hora de sincronización, al feed, a cada producto y a la tasa. Fechas con más de cinco minutos hacia el futuro también son inválidas. Una colección vencida puede seguir visible como consulta, pero no permite cotizar ni proceder al pago. La sincronización no rejuvenece los datos viejos porque conserva sus fechas de origen.

## Ejecución diaria y persistencia

Ejecutar desde el directorio del proyecto, con `.env.local` o variables del servidor:

```sh
npm run sync:catalog
```

La salida exitosa contiene únicamente cantidad de productos y fecha; los fallos terminan con código distinto de cero. Alertar al responsable de operación cuando falle. Programar un único proceso diario después de la actualización de la tasa y del catálogo del integrador; la ventana de dos horas entre 24 y 26 horas no reemplaza la monitorización. Un job ejecutado muchas horas después de la actualización diaria de la tasa puede dejar de cumplir la vigencia antes del siguiente ciclo: ajustar el horario o usar un ciclo de verificación más frecuente respetando las cuotas de ambos proveedores.

En Vercel, `src/lib/server/storage.ts` usa Blob privado automáticamente cuando `VERCEL=1`. También lo usa al configurar `BLOB_READ_WRITE_TOKEN` o `BLOB_STORE_ID` en desarrollo. Sin credenciales válidas no se recurre al disco temporal. Las instantáneas están aisladas en tres rutas: `glamour/catalog/production.json` únicamente con `VERCEL_ENV=production`, `glamour/catalog/preview.json` únicamente con `VERCEL_ENV=preview`, y `glamour/catalog/development.json` en cualquier otro caso, incluido desarrollo local o variable ausente. Descargar credenciales para desarrollo no selecciona el catálogo productivo. Al sincronizar desde una máquina local contra el almacén de revisión se debe definir `VERCEL_ENV=preview` explícitamente.

`vercel.json` declara una ejecución diaria de `GET /api/cron/sync-catalog` a las **07:15 UTC (02:15 en Colombia)**. El endpoint requiere `Authorization: Bearer <CRON_SECRET>` y dispone de hasta 120 segundos. Falta de configuración devuelve HTTP `503` con `status: not_configured`; error de importación devuelve `502` con `status: failed`; únicamente una escritura verificada devuelve `200` con `status: updated`, cantidad de productos y fecha. El cron puede importar con el margen vacío, pero ese estado mantiene los precios y el pago deshabilitados.

Los [cron de Vercel](https://vercel.com/docs/cron-jobs) solo se ejecutan en producción: **un despliegue preview no activa actualización periódica**. El archivo de configuración no constituye evidencia de conexión a AliExpress ni de una ejecución exitosa. Al activar el feed, ajustar el horario según su actualización real y la tasa de cambio; verificar en los logs la primera ejecución y comprobar que la API mantiene el catálogo vigente. El horario inicial es una configuración de despliegue, no una garantía sobre la hora de publicación de los proveedores.

En Linux o Windows propios se puede ejecutar mediante su programador con el mismo directorio `GLAMOUR_DATA_DIR` que la aplicación; el modo archivo requiere un volumen persistente y una sola instancia escritora. Un job externo con Blob debe apuntar al mismo almacén y entorno, sin guardar catálogos comerciales ni secretos mediante commits automáticos.

## Selección de 200 referencias y cambios de precio

Después de validar la respuesta completa de la fuente, el importador conserva hasta 200 referencias por tienda. Primero mantiene los IDs de la selección anterior que todavía existen en la nueva respuesta, tomando sus datos nuevos, y después llena vacantes en el orden de la fuente. La ausencia en una respuesta completa representa una baja; un error de descarga nunca equivale a una respuesta vacía. Una variante agotada conserva su stock cero y no se convierte en disponible por estar seleccionada.

La instantánea privada añade `selection` con recuentos por tienda, objetivo 200 y `complete` verdadero solo si se alcanzan 200 de cada una. Esto acredita el tamaño de la selección, no la cobertura de todo AliExpress. Si se reciben menos artículos, se guarda el número real y se informa que no está completa.

El campo privado `changes` compara las variantes coincidentes de la selección nueva y anterior, por tienda, producto y SKU. Guarda importe anterior/nuevo, diferencia y existencias. Cambios absolutos de 1 a 5.000 COP son `minor`; más de 5.000 COP son `significant`. No se descartan las actualizaciones pequeñas ni se bloquea automáticamente una grande. La primera importación informa altas, sin inventar precios anteriores; nuevos o eliminados SKU no tienen precio comparable. Se cuenta altas/bajas de producto por separado.

Con margen configurado, ambas versiones se calculan con la fórmula comercial **actual** (`sale_price_cop`); el informe no reconstruye cambios históricos de margen. Sin margen compara costo USD por cambio de cada instantánea, redondeado hacia arriba a un peso (`supplier_cost_cop`). También detecta diferencias debidas al dólar. La comparación es contra la sincronización inmediatamente anterior, no un umbral acumulado de varias semanas.

`sync:catalog` y la respuesta autenticada del cron incluyen cobertura y recuentos de cambios. El detalle y los costos permanecen en el caché privado; `/api/catalog` no los devuelve. El informe describe la última sincronización, no un historial permanente ni un aviso enviado por correo o WhatsApp. Mantener el tamaño total dentro del límite de 16 MiB; si el nuevo documento lo supera, se conserva la instantánea anterior.

Esta lógica solo procesa un feed obtenido legítimamente. No entra a páginas de AliExpress, no crea credenciales, no supera los bloqueos de navegación y no significa que ya haya 400 productos disponibles.

## API pública y flujo de WhatsApp

`GET /api/catalog` devuelve la interfaz `Catalog` de `src/lib/types.ts`. Las respuestas no se cachean en el navegador/CDN. Estados: `unconfigured`, `live` o `stale`; `preview` pertenece a la interfaz de demostración, no al importador. Sin configuración o caché válido devuelve cero productos y `checkoutEnabled: false`.

`POST /api/checkout` acepta exclusivamente una selección útil para el cálculo:

```json
{
  "items": [{ "productId": "821117:1005000000001", "variantId": "sku-black-s", "quantity": 2 }]
}
```

Los identificadores del ejemplo son **sintéticos**; hay que enviar los que devuelva el catálogo real. Se admiten hasta 50 entradas y 99 unidades por SKU; los duplicados se agrupan antes de verificar existencias. Los precios, nombres, enlaces y totales enviados por el cliente se ignoran. La ruta limita el cuerpo a 24 KiB y rechaza orígenes cruzados, JSON incorrecto y tipos de contenido distintos de `application/json`.

El servidor verifica precio, SKU, existencias y vigencia contra el catálogo actual. Una respuesta exitosa devuelve `Quote`: referencia, líneas, total COP, vencimiento a 15 minutos, mensaje y URL hacia `https://wa.me/573128851441`. Cada línea identifica producto, color, talla, cantidad, precio, subtotal, SKU y artículo del proveedor. Los errores tienen forma `{ "error": "mensaje en español", "code": "CODIGO" }`.

La referencia identifica el mensaje de solicitud, **no una orden persistida**. No se guarda la bolsa en el servidor, no se reserva stock, no se garantiza existencias en tiempo real entre sincronizaciones y no se marca un pago como recibido. El vencimiento describe la validez de la cotización; no puede impedir que una persona haga una transferencia externa después de ese momento. El negocio debe confirmar el pago y coordinar la entrega. La llave `3128851441`, la imagen de medios de pago y el número WhatsApp proceden del usuario.

El total calculado es el total de artículos con los costos por unidad configurados; no se inventa un costo de envío final. Antes de habilitar ventas se debe acordar si el envío está incluido o cómo se informa y confirma con cada clienta.

## Verificación automatizada

`npm test` cubre configuración sin margen, fórmula COP, fechas antiguas/futuras, medios y proveedores inválidos, duplicados, manipulación de precios, falta de stock, vencimiento de cotización, autenticación del feed, reemplazo atómico, conservación de la última versión válida y límites HTTP. Prueba además persistencia privada, aislamiento desarrollo/preview/producción, lecturas consistentes, escrituras concurrentes, límite de tamaño por metadatos y por stream, autenticación del cron y sus estados de configuración/error. Las fixtures son sintéticas, viven solo en pruebas y no constituyen catálogo de venta.

Estas pruebas verifican el software y sus errores esperados. No prueban acceso real a las tiendas: esa verificación solo puede hacerse cuando existan credenciales y un catálogo autorizado.
