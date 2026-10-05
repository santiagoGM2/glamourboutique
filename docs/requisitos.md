# Glamour Boutique Cali: requisitos del proyecto

Este documento conserva el alcance solicitado y distingue el resultado esperado de las dependencias que todavía faltan para vender con datos reales. Una vista previa del catálogo no acredita una integración activa con AliExpress.

## Negocio y decisiones confirmadas

Glamour Boutique Cali vende vestidos, faldas, calzado y otras prendas, con especialidad en tela bandage. La web será una tienda en español, con precios expresados en pesos colombianos (COP), compartible por enlace con las clientas.

| Decisión                      | Valor confirmado                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| Marca                         | Glamour Boutique Cali                                                                        |
| Referencia visual             | Colección de Mew Mews facilitada por el usuario                                              |
| Identidad                     | Logo original proporcionado por el usuario                                                   |
| Proveedor 1                   | https://www.aliexpress.com/store/821117                                                      |
| Proveedor 2                   | https://verosinly.es.aliexpress.com/store/1101290000                                         |
| Disponibilidad de integración | El usuario solo dispone de los enlaces; no tiene API ni archivo de catálogo                  |
| Precio de venta               | Precio en COP más un margen todavía por definir                                              |
| Llave de transferencia        | `3128851441`                                                                                 |
| WhatsApp de pedidos           | `+57 3128851441`; enlace de destino `https://wa.me/573128851441`                             |
| Cobro                         | Transferencia u otro método de la imagen entregada; revisión humana del soporte por WhatsApp |
| Repositorio indicado          | https://github.com/santiagoGM2/glamourboutique                                               |

## Requisitos funcionales y aceptación

### RF-01. Identidad y diseño del catálogo

Usar el logo de Glamour y una presentación de moda cuidada, inspirada en la composición, jerarquía, distribución y comportamiento de la referencia. No reutilizar imágenes, videos, productos ni textos de Mew Mews.

**Aceptación:** el catálogo muestra identidad Glamour, fotografías amplias, nombres, precios y variantes; cambia a una segunda fotografía al pasar el cursor si el producto tiene más de una. En pantallas táctiles, todas las fotos deben ser accesibles sin depender del cursor. Una sola fotografía no debe producir una imagen vacía.

### RF-02. Catálogo de los dos proveedores

Incorporar los productos disponibles de las tiendas `821117` y `1101290000`, con sus identificadores originales, nombre, imágenes, videos cuando existan, categorías, precio y variantes disponibles. Mantener la relación de cada artículo y variante con su proveedor. No inventar stock, tallas, descuentos, videos ni precios.

**Aceptación:** cada artículo importado se puede rastrear a una tienda permitida y a su identificador original. Las imágenes y los videos proceden del catálogo de esos proveedores. Las variantes seleccionables corresponden a datos importados. Un catálogo de demostración se identifica visiblemente como tal y sus datos no se presentan como disponibilidad verificada.

**Dependencia:** las URL públicas no son credenciales de integración. Para cumplir la alimentación completa y automática se requiere una fuente accesible y autorizada que entregue estos datos, por ejemplo un conector de AliExpress o un feed normalizado. El adaptador, la documentación o la programación de una sincronización por sí solos no significan que esta dependencia esté resuelta.

### RF-03. Búsqueda, categorías y filtros

Permitir explorar vestidos, faldas, calzado y demás categorías disponibles, filtrar por precio y ordenar el catálogo. La búsqueda por nombre complementa esta navegación. Los filtros deben combinarse y poder restablecerse.

**Aceptación:** al aplicar una categoría y un límite de precio solo quedan los productos coincidentes; ordenar por precio respeta los valores numéricos en COP. El recuento se actualiza y una búsqueda sin resultados ofrece una salida clara.

### RF-04. Información y selección de producto

Mostrar fotografías alternativas, nombre, precio, descripción y opciones del producto. Permitir elegir las variantes reales, como talla y color, antes de incorporarlo al carrito; mostrar video cuando el proveedor lo incluya.

**Aceptación:** el carrito conserva el artículo, variante y cantidad elegidos. Una combinación no disponible no se puede comprar. El video es opcional y su ausencia no rompe la ficha.

### RF-05. Carrito

Permitir agregar varios productos, cambiar cantidades, eliminar líneas y consultar subtotales y total. Mantener las selecciones al recargar el navegador.

**Aceptación:** un mismo producto con variantes distintas genera líneas distinguibles; las cantidades y totales se recalculan correctamente; un carrito vacío no permite iniciar un pago. Restaurar un carrito no convierte un precio antiguo en una cotización vigente.

### RF-06. Actualización de precios y disponibilidad

Actualizar los datos de proveedor y el cambio USD/COP diariamente. La fórmula será precio del proveedor convertido a COP más el margen de Glamour; el porcentaje o importe del margen sigue pendiente. Cualquier costo adicional debe definirse antes de incluirse en el total.

**Aceptación:** la sincronización registra fecha, fuente de cambio y estado; solo publica una actualización válida y completa. Una consulta fallida conserva el último catálogo válido e informa su antigüedad. Antes de mostrar un total pagable, el servidor revisa precios, disponibilidad, moneda, margen configurado y vigencia del catálogo. Si un importe cambió, la clienta recibe el total actualizado antes de transferir. No se acepta un total enviado libremente por el navegador.

**Límite actual:** sin una fuente real conectada y un margen confirmado no se puede anunciar que los precios están actualizados ni presentar la vista previa como un pedido listo para pago.

### RF-07. Métodos de pago y transferencia

Al continuar desde el carrito, mostrar la imagen original de métodos de pago entregada por el usuario y ofrecer la llave `3128851441` con un control para copiarla. Indicar que el soporte se envía por WhatsApp.

**Aceptación:** la imagen es legible y puede ampliarse si hace falta; la llave tiene exactamente diez dígitos y el botón copia `3128851441`, sin espacios. Los métodos de la imagen son información para un pago manual; escoger uno o abrir WhatsApp no marca el pedido como pagado.

### RF-08. Resumen de pedido por WhatsApp

Abrir WhatsApp en `573128851441` con un mensaje precargado que incluya los productos seleccionados, variantes, cantidades, precios y total cuando exista una cotización válida. Incorporar identificadores o enlaces que permitan a Glamour localizar las prendas. Pedir a la clienta adjuntar su soporte de transferencia en WhatsApp.

**Aceptación:** el mensaje corresponde al carrito actual y conserva acentos y saltos de línea mediante codificación de URL. Abrir el enlace no envía automáticamente el mensaje ni adjunta automáticamente un comprobante. Si solo existe una vista previa, el mensaje solicita una cotización e identifica esa condición, sin afirmar que ya se pagó o que el stock está confirmado.

## Requisitos no funcionales

| ID     | Requisito                   | Criterio verificable                                                                                                                   |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | Español y moneda local      | Interfaz y mensajes de compra en español; formato `es-CO`, moneda COP e importes consistentes.                                         |
| RNF-02 | Adaptación a dispositivos   | Catálogo, filtros, carrito y pago utilizables en móvil y escritorio, sin desplazamiento horizontal involuntario.                       |
| RNF-03 | Accesibilidad               | Controles con nombres accesibles, navegación por teclado, foco visible, cierre de diálogos y respeto a movimiento reducido.            |
| RNF-04 | Rendimiento                 | Imágenes dimensionadas y carga diferida cuando corresponda; no descargar videos hasta que sean necesarios.                             |
| RNF-05 | Seguridad de la integración | Credenciales y fórmula comercial en servidor; validación de datos importados y de solicitudes de cotización; sincronización protegida. |
| RNF-06 | Resiliencia                 | Fallos externos no destruyen la última importación válida; se diferencia catálogo vigente, obsoleto y vista previa.                    |
| RNF-07 | Exactitud                   | No anunciar conexión, stock, precio final, descuento o pago confirmado sin datos que lo respalden.                                     |
| RNF-08 | Mantenimiento               | Configuración documentada, secretos fuera del repositorio y pruebas de las reglas de precio, carrito, variantes y WhatsApp.            |
| RNF-09 | Operación diaria            | Una ejecución programada debe refrescar el catálogo y dejar estado verificable; el entorno debe conservar los datos entre ejecuciones. |

## Datos pendientes para habilitar ventas reales

1. Elegir y habilitar una fuente de datos para ambas tiendas, con credenciales si el proveedor las exige, y comprobar que incluye catálogo completo, variantes, stock, fotos y videos.
2. Definir el margen, la regla de redondeo y si el precio incluye envío del proveedor, envío a la clienta u otros cargos.
3. Confirmar cobertura, costos y tiempos de entrega, y la forma de comunicar cambios y devoluciones.
4. Elegir el alojamiento con persistencia y el programador diario; configurar secretos e inspeccionar una sincronización real de ambas tiendas.
5. Validar con Glamour un pedido de extremo a extremo y los datos de los métodos de pago antes de compartir el enlace para cobrar.

No se solicita una pasarela de tarjeta, compra automática al proveedor ni validación bancaria automática. La confirmación del pago y la gestión del pedido se realizan con Glamour a través de WhatsApp.
