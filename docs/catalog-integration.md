# Integración del catálogo y cotizaciones

## Estado real de esta entrega

La aplicación contiene el adaptador de importación, el cálculo de precios y la cotización. **No contiene una conexión autorizada y activa a AliExpress**: solo se recibieron los enlaces de las tiendas `821117` y `1101290000`, sin credenciales de API, acceso de dropshipping ni exportación del catálogo. Los enlaces de tienda son páginas web, no fuentes JSON. Tampoco se ha definido el margen comercial.

Por eso la configuración inicial mantiene la venta desactivada. Una colección de vista previa, si la interfaz la muestra, es independiente del catálogo del servidor; nunca se convierte en inventario, precio vigente ni orden pagada.

La [documentación oficial de AliExpress para la consulta de productos](https://developer.alibaba.com/docs/doc.htm?articleId=60452&docType=2&treeId=762) describe credenciales de aplicación, autorización, consultas por producto y datos de SKU, multimedia y tienda. Esa categoría de documentación aparece marcada como obsoleta: hay que confirmar el programa y los permisos que AliExpress conceda a la cuenta que se utilizará. La [documentación de la plataforma](https://developer.alibaba.com/docs/doc.htm?articleId=120689&docType=1&treeId=727) permite revisar el acceso vigente. Esta entrega no elude CAPTCHA ni presenta extracción de páginas públicas como una API estable.

## Lo que falta para activar el catálogo

1. Obtener autorización de las tiendas o un integrador con acceso autorizado a sus catálogos, imágenes, vídeos, SKU, precios y existencias. El integrador debe enumerar ambas tiendas completamente, resolver la paginación y entregar los nombres/descripciones en español y disponibilidad para Colombia.
2. Implementar o contratar un endpoint HTTPS que cumpla el contrato de abajo. Guardar su URL y token únicamente en las variables del servidor.
3. Definir margen, gastos incluidos en el precio, política de envío y redondeo con Glamour. No se asigna un margen comercial por suposición.
4. Elegir un servidor con almacenamiento persistente, ejecutar una sincronización real, contrastar referencias y precios con ambas tiendas y programar el trabajo diario en ese servidor.

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

Cada petición remota tiene un límite de 20 segundos; el JSON/caché se limita a 16 MiB. Una sincronización solo reemplaza `catalog.json` cuando el feed completo y la tasa pasan la validación. Se escribe un archivo temporal en el mismo directorio, se valida y se renombra; cualquier error conserva la última versión válida. Los errores no imprimen tokens, URLs con datos sensibles ni respuestas remotas.

La vigencia máxima es de **26 horas**, comprobada en el momento de consultar o cotizar. Afecta a la hora de sincronización, al feed, a cada producto y a la tasa. Fechas con más de cinco minutos hacia el futuro también son inválidas. Una colección vencida puede seguir visible como consulta, pero no permite cotizar ni proceder al pago. La sincronización no rejuvenece los datos viejos porque conserva sus fechas de origen.

## Ejecución diaria y persistencia

Ejecutar desde el directorio del proyecto, con `.env.local` o variables del servidor:

```sh
npm run sync:catalog
```

La salida exitosa contiene únicamente cantidad de productos y fecha; los fallos terminan con código distinto de cero. Alertar al responsable de operación cuando falle. Programar un único proceso diario después de la actualización de la tasa y del catálogo del integrador; la ventana de dos horas entre 24 y 26 horas no reemplaza la monitorización. Un job ejecutado muchas horas después de la actualización diaria de la tasa puede dejar de cumplir la vigencia antes del siguiente ciclo: ajustar el horario o usar un ciclo de verificación más frecuente respetando las cuotas de ambos proveedores.

En Linux se puede ejecutar mediante el programador del servidor; en Windows, con el Programador de tareas. El directorio de trabajo y `GLAMOUR_DATA_DIR` deben coincidir con los de la aplicación. Evitar trabajos simultáneos y mantener el reloj del servidor sincronizado.

**No hay una tarea remota ya programada ni un entorno productivo conectado en esta entrega.** Un job de GitHub Actions aislado no comparte disco con el sitio, por lo que no actualizaría este catálogo. No se guardan catálogos comerciales ni secretos mediante commits automáticos.

Este adaptador local está preparado para un único servidor Node con volumen durable. No funciona como persistencia de producción en archivos efímeros de Vercel, otras funciones serverless o réplicas con discos independientes. Antes de adoptar esos entornos, sustituir la capa de caché por una base de datos o almacenamiento de objetos compartido y conectar el job a la misma fuente; mantener la validación y las comprobaciones de vigencia.

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

`npm test` cubre configuración sin margen, fórmula COP, fechas antiguas/futuras, medios y proveedores inválidos, duplicados, manipulación de precios, falta de stock, vencimiento de cotización, autenticación del feed, reemplazo atómico, conservación de la última versión válida y límites HTTP. Las fixtures son sintéticas, viven solo en pruebas y no constituyen catálogo de venta.

Estas pruebas verifican el software y sus errores esperados. No prueban acceso real a las tiendas: esa verificación solo puede hacerse cuando existan credenciales y un catálogo autorizado.
