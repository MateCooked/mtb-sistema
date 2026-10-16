# mtb-sistema

Sistema de pedidos y caja para Rotiseria MTB. Google Sheets es la fuente principal de productos, pedidos y movimientos; el navegador conserva una copia para mostrar la interfaz.

## Publicar el backend de Google Sheets

1. Abri la hoja vinculada a la implementacion actual y entra a **Extensiones > Apps Script**.
2. Reemplaza el contenido de `Code.gs` por el archivo [`Code.gs`](Code.gs) de este repositorio.
3. En **Configuracion del proyecto > Propiedades del script**, configura `APP_TOKEN` para atención y `ADMIN_TOKEN` para administración, con valores distintos y privados. No guardes las claves en este repositorio.
4. En **Implementar > Administrar implementaciones**, edita la aplicacion web y crea una version nueva. Conserva **Ejecutar como: Yo** y el acceso que permita a tus dispositivos usar la app.
5. Publica `index.html`, `admin.html`, `styles.css` y `app.js` en GitHub Pages. Atención ingresa con `APP_TOKEN` en la página principal; administración abre `/admin.html` e ingresa con `ADMIN_TOKEN`. La URL de Apps Script ya esta configurada en `app.js`.

La primera conexion toma como referencia los datos que ya estan en la hoja y agrega los pedidos o movimientos locales que falten, sin reemplazar los registros existentes. A partir de ahi, cada dispositivo sincroniza contra el Sheet. Los pedidos nuevos reciben su numero desde el backend compartido.

## Estructura

- `index.html`: estructura principal y referencias a los recursos.
- `admin.html`: acceso separado al dashboard administrativo y productos.
- `styles.css`: estilos de escritorio y adaptaciones para celular.
- `app.js`: interfaz, pedidos, caja y sincronizacion; se carga despues de parsear el HTML.

Caja muestra solo el saldo al cierre y los movimientos. El dashboard calcula ventas brutas menos costo estimado de productos; mientras falten costos en la hoja, usa $ 4.000 por unidad. El neto no descuenta egresos manuales de caja.
