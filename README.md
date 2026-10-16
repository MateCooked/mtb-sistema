# mtb-sistema

Sistema de pedidos y caja para Rotiseria MTB. Google Sheets es la fuente principal de productos, pedidos y movimientos; el navegador conserva una copia para mostrar la interfaz.

## Publicar el backend de Google Sheets

1. Abri la hoja vinculada a la implementacion actual y entra a **Extensiones > Apps Script**.
2. Reemplaza el contenido de `Code.gs` por el archivo [`Code.gs`](Code.gs) de este repositorio.
3. En **Configuracion del proyecto > Propiedades del script**, agrega `APP_TOKEN` con una clave nueva y privada. No guardes la clave en este repositorio.
4. En **Implementar > Administrar implementaciones**, edita la aplicacion web y crea una version nueva. Conserva **Ejecutar como: Yo** y el acceso que permita a tus dispositivos usar la app.
5. En la pagina, abre **Productos y datos > Google Sheets**, ingresa la URL de la aplicacion web y la misma clave nueva, y toca **Guardar y conectar**.

La primera conexion toma como referencia los datos que ya estan en la hoja y agrega los pedidos o movimientos locales que falten, sin reemplazar los registros existentes. A partir de ahi, cada dispositivo sincroniza contra el Sheet. Los pedidos nuevos reciben su numero desde el backend compartido.
