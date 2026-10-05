# Investigación de proveedores — 5 de octubre de 2026

## Resultado comprobado

Las URL de dos tiendas no bastan para obtener una integración de catálogo completa, estable y autorizada. No se entregaron credenciales de API ni un feed privado. La consulta pública de `https://www.aliexpress.com/store/821117` devolvió un challenge de AliExpress. La tienda `https://verosinly.es.aliexpress.com/store/1101290000` devolvió una vez una página cuyo título fue `Vero Sinly Official Store - Amazing products with exclusive discounts on AliExpress`; una segunda lectura devolvió un challenge. No se intentó resolverlo ni eludirlo.

Se encontraron fotografías archivadas de productos de ambos proveedores. El archivo `supplier-preview.json` registra ID, procedencia y URL original. Estos registros **no acreditan disponibilidad actual, variantes actuales ni precios vigentes** y sirven únicamente para la vista previa del diseño. Los títulos en español son traducciones editoriales breves de los títulos archivados. No se encontraron videos accesibles verificables ni referencias de calzado verificadas para estos proveedores durante esta revisión.

## Integración autorizada

AliExpress Open Platform exige registrar una aplicación y obtener `App Key` y `App Secret`; el secreto debe mantenerse en el servidor. El acceso disponible depende de la categoría de aplicación y los permisos concedidos. Consultar el catálogo completo de una tienda arbitraria no debe darse por garantizado: hay que confirmar una API habilitada para descubrimiento de productos o pedir un feed completo a cada proveedor.

- [Credenciales de aplicación](https://developer.alibaba.com/docs/doc.htm?articleId=120675&docType=1&treeId=727).
- [Registro y revisión de cuenta desarrolladora](https://developer.alibaba.com/docs/doc.htm?articleId=120673&docType=1&treeId=727).
- [Categorías de aplicación](https://developer.alibaba.com/docs/doc.htm?articleId=120674&docType=1&treeId=727).
- [Endpoint de Open Platform](https://developer.alibaba.com/docs/doc.htm?articleId=120689&docType=1&treeId=727): `https://api-sg.aliexpress.com/rest`.

La documentación oficial archivada de [`aliexpress.ds.product.get`](https://developer.alibaba.com/docs/doc.htm?articleId=60452&docType=2&treeId=762) describe información del producto por `product_id`, destino `ship_to_country`, idioma `target_language` y moneda `target_currency`, con autorización del usuario. Incluye:

- `ae_item_base_info_dto`: título, categoría, estado y descripción.
- `ae_item_sku_info_dtos.ae_item_sku_info_d_t_o`: precio y stock por SKU, propiedades de talla/color y fotografías asociadas.
- `ae_multimedia_info_dto.image_urls`: imágenes separadas por punto y coma.
- `ae_multimedia_info_dto.ae_video_dtos`: metadatos de video; la presencia de estos metadatos no garantiza una URL reproducible.
- `ae_store_info.store_id`: permite validar que el producto corresponde a una de las dos tiendas permitidas.

**Limitación documental:** esta sección oficial aparece bajo `Dropshipping (deprecated)` y todavía muestra el endpoint TOP antiguo `https://eco.taobao.com/router/rest`. No debe afirmarse que esa combinación funciona hoy para una aplicación nueva sin contrastarla con el panel y permisos actuales. El endpoint moderno global y el endpoint antiguo no son intercambiables automáticamente. No se realizaron llamadas autenticadas ni se probaron cuotas, compatibilidad COP o cobertura de estos proveedores.

La API oficial documentada [`aliexpress.affiliate.product.query`](https://developer.alibaba.com/docs/api.htm?apiId=45803) devuelve datos de promoción, fotos, precios e identificación de tienda. Sus parámetros documentados de búsqueda no incluyen una garantía de enumeración completa de una tienda; tampoco sustituye el stock por SKU necesario para el carrito.

## Condiciones para activar ventas

1. Proporcionar un feed autorizado de ambos proveedores o credenciales de aplicación aprobada con los permisos adecuados y completar OAuth.
2. Verificar que el feed enumera el catálogo completo, incluyendo productos nuevos, bajas, variantes, existencias, fotos y videos que el proveedor publique.
3. Definir la fórmula comercial: costo del proveedor, cambio USD/COP, margen, redondeo, flete, impuestos y cualquier cargo adicional. No inferir margen ni publicar el costo de AliExpress como precio final de Glamour.
4. Sincronizar en servidor diariamente y registrar última sincronización exitosa. Si falla, conservar la última copia identificada como desactualizada y bloquear pago cuando no pueda asegurarse su vigencia.
5. Volver a validar precio y stock del SKU antes de mostrar las instrucciones para transferir. Una actualización diaria por sí sola no evita cambios durante el día.
6. Guardar una cotización del pedido y su fecha con los SKU elegidos. Incluir esa referencia y el detalle en el mensaje precargado de WhatsApp; la transferencia se confirma manualmente cuando el negocio revise el soporte.

## Procedencia de la vista previa

[`SellerCheck — tienda 821117`](https://sellercheck.ru/s/821117) identifica la tienda como Celebrity Dress y vincula los IDs incluidos a esa tienda. Algunas fichas de Alitools la nombran Celebrity Dress Factory; se cruzó el ID exacto con SellerCheck antes de incluirlas.

Las dos fichas Vero Sinly de la vista previa identifican explícitamente a `Vero Sinly Official Store`, consistente con el título obtenido de la URL suministrada por el usuario. No se afirma que el catálogo archivado siga disponible. Las imágenes no provienen de Mew Mews y no se han generado ni alterado.
