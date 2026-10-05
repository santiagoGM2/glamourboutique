# Acceso al catálogo: investigación del 5 de octubre de 2026

## Resultado de esta revisión

No se obtuvo un catálogo nuevo, completo ni actualizado de las tiendas `821117` y `1101290000`. Los ocho productos de vista previa siguen siendo referencias archivadas, no inventario confirmado.

La revisión automática del navegador rechazó el acceso a la tienda `821117` por una política de seguridad del sitio y prohibió conseguir el mismo resultado mediante otras superficies o mecanismos. Se detuvo la extracción de las tiendas. Esto es distinto del challenge de AliExpress documentado en la investigación anterior; no demuestra que una API autorizada esté prohibida o que las tiendas hayan desaparecido.

La búsqueda de complementos disponibles con los términos `AliExpress dropshipping DSers` no devolvió resultados. Tampoco hay herramientas AliExpress o DSers conectadas en esta sesión. El directorio de complementos no es exhaustivo: este resultado no significa que no existan otras integraciones externas.

## Vías de integración comprobadas

### 1. AliExpress Open Platform con autorización

La documentación oficial requiere una cuenta desarrolladora, verificación por correo y revisión del perfil. La aplicación necesita una categoría aprobada y los permisos de API correspondientes. La documentación pública revisada fue actualizada por AliExpress en 2022, por lo que los permisos concretos deben verificarse en el panel actual antes de implementar contra ella. [Registro](https://developer.alibaba.com/docs/doc.htm?articleId=120673&docType=1&treeId=727), [categorías](https://developer.alibaba.com/docs/doc.htm?articleId=120674&docType=1&treeId=727) y [permisos](https://developer.alibaba.com/docs/doc.htm?articleId=120676&docType=1&treeId=727).

Para consultar datos comerciales de una tienda vendedora, la documentación describe OAuth realizado por el vendedor. Una cuenta compradora de Glamour no equivale a autorización de los dos vendedores. La aplicación utiliza su propio App Key y callback; cada vendedor inicia sesión y autoriza, sin compartir su contraseña con Glamour. [Autorización de vendedores](https://developer.alibaba.com/docs/doc.htm?articleId=120687&docType=1&treeId=727).

La categoría pública de las APIs antiguas de dropshipping aparece marcada como obsoleta. `aliexpress.ds.product.get` describe detalles por ID, SKU, imágenes y metadatos de video; eso no demuestra que una aplicación nueva pueda enumerar todas las referencias de estas dos tiendas. No se ha probado una llamada autenticada ni la cobertura completa. [Referencia oficial](https://developer.alibaba.com/docs/doc.htm?articleId=60452&docType=2&treeId=762).

**Paso concreto:** tramitar una aplicación con el propósito real de Glamour y los permisos que AliExpress ofrezca para ese propósito; si se usa la API de vendedores, coordinar la autorización OAuth de ambos proveedores. No registrar Glamour como propietaria de tiendas que no le pertenecen.

### 2. DSers: cuenta y permisos propios

DSers publica un MCP oficial en `https://ai.dsers.com/mcp`, con OAuth 2.1 + PKCE. Describe herramientas de consulta de productos, importación y seguimiento de cambios. Su página exige una cuenta DSers y al menos una tienda Shopify o Wix conectada; los permisos y límites dependen de la cuenta. No es una conexión directa documentada para este proyecto Next.js y no garantiza enumeración completa de proveedores por ID. No se instaló ni se inició una suscripción. [Requisitos oficiales del MCP](https://www.dsers.com/mcp-server).

Para una aplicación propia, DSers documenta otra vía: registrar una cuenta desarrolladora, presentar la solicitud y esperar revisión. La documentación de API y el entorno de pruebas se habilitan tras la aprobación. No promete una aprobación inmediata. [Registro de integraciones propias](https://help.dsers.com/partner-account-registration-for-third-party-app-integrations-2/).

**Paso concreto:** valorar la solicitud de integración propia si DSers confirma que sus permisos permiten exportar el catálogo requerido a Next.js. No introducir Shopify/Wix o una suscripción solamente para aparentar que el catálogo ya está conectado.

### 3. Exportación de los proveedores

Un CSV, XLSX, JSON o feed de cada proveedor permite construir un adaptador con datos verificables, sin depender de las páginas bloqueadas. Un archivo único permite una importación puntual; no actualiza los precios cada día. La actualización diaria necesita una fuente que los proveedores renueven o una API autorizada.

El siguiente texto queda preparado para pedir la información, pero **no se envió a nadie**:

> Hola. Somos Glamour Boutique Cali, Colombia. Queremos integrar sus productos en nuestro catálogo web. ¿Pueden facilitarnos una exportación o feed autorizado de todo su catálogo y permitir el uso de sus fotos y videos? Necesitamos ID de producto, SKU, nombre, descripción, material, precio en USD, tallas, colores, disponibilidad por variante, URLs de imágenes/videos y fecha de actualización. También necesitamos saber cómo recibir diariamente los cambios de precio, existencias, nuevas referencias y bajas para envíos a Colombia. Si ofrecen una API o autorización oficial de AliExpress, indíquennos el procedimiento. Gracias.

## Lo que no sustituye al acceso

Desplegar en Vercel, programar un trabajo diario o añadir un botón de conexión no crea credenciales ni cobertura del catálogo. Un resultado de búsqueda, una ficha archivada o la primera página de una tienda tampoco acreditan catálogo completo, variantes o precio vigente. El margen sigue pendiente por decisión del usuario; no debe suponerse cero ni habilitar un total pagable por esa razón.
