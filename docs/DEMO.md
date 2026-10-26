# Demo funcional para el propietario

Esta demostración utiliza datos ficticios. No guarda reservas en Supabase,
no utiliza Auth ni Turnstile y no altera las reservas reales desactivadas.
No necesita la cuenta del propietario ni una contraseña de demostración.

## Abrir localmente

```powershell
npm.cmd run dev:demo
```

Web: http://127.0.0.1:5174 · Panel: http://127.0.0.1:5174/admin
Mantener la terminal abierta; Ctrl+C detiene la demo. El puerto es independiente
del frontend real 5173. No usar `npm run dev` para presentar esta demostración.

1. Abrir «Reservar mesa». Elegir un martes a domingo futuro dentro de 60 días,
   la hora y el número de personas (hasta seis).
2. Utilizar los datos ficticios precargados o escribir otros ficticios.
   Marcar la lectura del aviso y enviar. La solicitud se muestra como ficticia,
   pendiente, sin mesa real confirmada.
3. Abrir «Ver panel demo» o /admin en el mismo navegador y origen. La solicitud
   aparece PENDIENTE. Confirmarla, rechazarla o cancelarla con el diálogo existente.
4. Probar filtros, calendario y «Mesas y horarios». La configuración ficticia es
   de consulta; todavía no se decide ni escribe la configuración del restaurante.
5. «Restablecer demo» pide confirmación y elimina solo las reservas ficticias.

## Datos provisionales

| Mesas | Capacidad por mesa |
| --- | --- |
| 4 | 2 personas |
| 4 | 4 personas |
| 2 | 6 personas |

Martes a domingo. Comidas 13:00–16:00; cenas 20:00–23:30.
Duración 90 minutos, comienzos cada 30 minutos. Últimos comienzos 14:30 y 22:00,
para que los 90 minutos terminen antes del cierre. Lunes cerrado. Sin combinar
mesas. Las solicitudes pendientes y confirmadas bloquean capacidad; rechazo y
cancelación la liberan. Se rechazan fechas pasadas, grupos mayores de seis,
solapamientos y duplicados por contacto/turno. Los reintentos con mismo UUID y
contenido no crean otra solicitud.

## Aislamiento y límites

- Activación exclusiva mediante `vite --mode demo` o `build:demo`. Una URL como
  `?demo=1` o modificar localStorage no permite saltar el acceso real de /admin.
- En modo demo las variables de Supabase/Turnstile se fuerzan a vacío antes de
  crear el cliente. No se llama a APIs remotas, Auth ni a la función real.
- Almacén exclusivo `la-llave:demo:reservations:v1` en localStorage. Reutiliza las
  interfaces de reservas y las pantallas existentes, con adaptador local.
- Los datos persisten al recargar, pero son exclusivos de ese navegador y origen.
  Otra pestaña del mismo origen se actualiza; otro dispositivo o navegador no
  verá sus solicitudes. No introducir datos personales ni información real.
- No es una prueba de Supabase, de seguridad del backend ni del captcha real.
  No se han modificado tablas, funciones, secretos ni configuración remotos.

## Paquete para compartir posteriormente

```powershell
npm.cmd run build:demo
npm.cmd run preview:demo
```

Salida separada **dist-demo/**. `dist/` sigue reservado al build normal.
El paquete demo incluye redirección SPA `_redirects` para /admin y una etiqueta
robots noindex/nofollow. No necesita variables de entorno en el alojamiento.

Para compartir en Netlify falta autorización expresa y elegir un sitio **separado
de producción**, controlado por el restaurante. Configurar build
`npm run build:demo` y publicación `dist-demo`, sin copiar claves, sin desplegar
funciones y sin conexión de despliegue automático mediante git push. También
puede subirse manualmente solo esa carpeta. No subir el repositorio ni archivos
.env. Después comprobar /admin directo y el recorrido ficticio en la URL real.
No se ha creado ni publicado un sitio en esta entrega.

En la URL compartida cada visitante conservará su propia demo. El propietario
puede recorrer web y panel desde su móvil sin cuenta; las solicitudes de su móvil
no aparecerán en el ordenador del desarrollador. No hay una base demo compartida.

## Verificaciones

Se ejecutan las regresiones existentes y casos específicos en
`tests/e2e/demo.spec.ts`: recorrido y persistencia a 320/390/768/1440 px,
confirmación/rechazo/cancelación, filtros, calendario, capacidad, lunes cerrado,
últimos turnos, duplicados, limpieza aislada y actualización entre pestañas.
Comprueban que no existen solicitudes de red a Supabase, Turnstile o Auth.
Recuento y resultados finales en FASES.md.
