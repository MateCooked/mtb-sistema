# mtb-sistema

Sistema de pedidos y caja para Rotiseria MTB. Google Sheets es la fuente principal de productos, pedidos y movimientos; el navegador conserva una copia para mostrar la interfaz.

## Publicar el backend de Google Sheets

1. Abri la hoja vinculada a la implementacion actual y entra a **Extensiones > Apps Script**.
2. Reemplaza el contenido de `Code.gs` por el archivo [`Code.gs`](Code.gs) de este repositorio.
3. En **Configuracion del proyecto > Propiedades del script**, configura `APP_TOKEN` para atención y `ADMIN_TOKEN` para administración, con valores distintos y privados. No guardes las claves en este repositorio.
4. En **Implementar > Administrar implementaciones**, edita la aplicacion web y crea una version nueva. Conserva **Ejecutar como: Yo** y el acceso que permita a tus dispositivos usar la app.
5. Publica `index.html`, `admin.html`, `styles.css` y `app.js` en GitHub Pages. Atención ingresa con `APP_TOKEN` en la página principal; administración abre `/admin.html` e ingresa con `ADMIN_TOKEN`. La URL de Apps Script ya esta configurada en `app.js`.

Apps Script crea las pestanas `Opciones`, `Promociones` y `Configuracion` al conectar el catalogo nuevo. La carta existente se conserva hasta aplicar la carta base desde Administracion.

## Carta, opciones y promociones

1. Entra a `/admin.html` con `ADMIN_TOKEN`.
2. En **Productos y datos**, pulsa **Aplicar carta base MTB**. Actualiza los productos coincidentes, agrega los que falten y conserva los costos y el estado activo/pausado de las promociones existentes.
3. En **Precio de carne**, ajusta el adicional por medallon extra. Se aplica a hamburguesas dobles y triples; cada pedido conserva el precio usado al cargarlo.
4. En **Promos**, crea combos seleccionando productos y cantidades, define precio y activa o pausa cada promo. Atencion solo recibe las activas.

Las recetas y opciones son por producto. Los ingredientes se pueden quitar; las elecciones requeridas (como acompanamiento) deben seleccionarse antes de agregar; los extras opcionales solo aparecen en los productos donde estan configurados. Cada componente de una promo se personaliza por separado y queda guardado en el pedido.

La primera conexion tambien agrega los pedidos y movimientos locales que falten en la hoja, sin reemplazar registros existentes. Los pedidos nuevos reciben su numero desde el backend compartido.

## Estructura

- `index.html`: estructura principal y referencias a los recursos.
- `admin.html`: acceso separado al dashboard, productos y promociones.
- `styles.css`: estilos de escritorio y adaptaciones para celular.
- `app.js`: interfaz, pedidos, caja y sincronizacion; se carga despues de parsear el HTML.

Caja muestra solo el saldo al cierre y los movimientos. El dashboard calcula ventas brutas menos costo estimado de productos; mientras falten costos en la hoja, usa $ 4.000 por unidad. El neto no descuenta egresos manuales de caja.
