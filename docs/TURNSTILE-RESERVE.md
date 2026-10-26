# Preparación de reserve y Turnstile para pruebas locales

Actualización posterior: claves públicas comprobadas, URL local corregida y
conexión real con Supabase/`reserve` verificada sin crear reservas. Preparación
de cuenta y datos reales en [PRUEBA-RESERVAS-REALES.md](PRUEBA-RESERVAS-REALES.md).
Las menciones históricas a claves vacías siguientes quedan sustituidas.

## Despliegue autorizado realizado — 26/10/2026

Se verificó el ref `bdgtlonduwffyxvkcadi`, las tres variables privadas con valores,
el origen exacto acordado y la longitud del salt sin mostrar sus valores.
Se configuraron únicamente esos tres secretos y se desplegó solo `reserve`
con autorización expresa. Ambos comandos finalizaron con código 0.

Comprobaciones posteriores:

- Función `reserve` ACTIVE, versión 1, `verify_jwt=false`.
- OPTIONS desde `http://127.0.0.1:5173`: 204 y CORS correcto.
- POST con JSON vacío: 400 antes de cualquier escritura de reservas o cuotas.
- Origen no permitido: 403.
- Consulta remota de lectura: `reservations_enabled=false`, cero administradores
  activos, cero mesas y franjas activas e información de privacidad incompleta.
- Siguen pendientes `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_TURNSTILE_SITE_KEY`
  en `.env.local`.

No se enviaron reservas reales, no se validó todavía un token Turnstile real,
no se activaron reservas, no se publicó en Netlify y no se hizo git push.

### Prueba de extremo a extremo preparada, todavía no ejecutada

1. Completar la clave publicable y Site key Turnstile en `.env.local` y reiniciar
   Vite en 127.0.0.1:5173. La Site key debe corresponder a la Secret key desplegada.
2. Crear/invitar la cuenta del propietario y autorizar su UUID en `admin_users`,
   con autorización específica para esas escrituras de Auth y base de datos.
   No usar contraseñas predeterminadas ni compartirlas.
3. Introducir desde el panel mesas/capacidades, franjas, duración y datos de
   privacidad reales. Solicitar al propietario únicamente esos datos y su correo.
4. Con autorización explícita aparte, acordar la habilitación temporal de
   solicitudes para probar desde el origen local. El flag es del backend:
   CORS local no equivale a una autenticación privada del formulario.
5. Cliente sin sesión resuelve el widget real y solicita un turno acordado.
   Verificar recepción pendiente y una sola fila PENDIENTE en Supabase.
6. Propietario consulta la misma solicitud en /admin y la confirma/rechaza/cancela
   de forma manual. Verificar los estados guardados y ausencia de duplicados.
7. Completar pruebas de conflicto, privacidad por API y concurrencia antes de
   autorizar publicación. Gestionar el cierre de pruebas y los datos sintéticos
   con autorización, sin borrar datos reales.

Este resultado sustituye los estados «no desplegado» de la preparación siguiente.

Proyecto: `bdgtlonduwffyxvkcadi`. URL de pruebas acordada:
`http://127.0.0.1:5173`. No hay dominio de producción elegido.
No se ha desplegado la función ni configurado secretos remotos en esta preparación.
Las reservas remotas continúan desactivadas.

## Acciones manuales imprescindibles

1. Entrar en Cloudflare con una cuenta controlada por el restaurante, abrir
   **Turnstile → Add widget**, nombre `La Llave — pruebas locales`, modo
   **Managed**, hostname **`127.0.0.1`**, sin protocolo, puerto ni rutas.
   No habilitar pre-clearance. Guardar y conservar las dos claves de ese widget.
2. Abrir `.env.local` en el editor. La URL Supabase ya está preparada. Completar
   `VITE_SUPABASE_PUBLISHABLE_KEY` con la clave publicable `sb_publishable_...`
   de **Supabase → Settings → API Keys**, y `VITE_TURNSTILE_SITE_KEY` con la
   **Site key** del widget anterior.
3. Abrir `supabase/.env` en el editor y completar únicamente
   `TURNSTILE_SECRET_KEY` con la **Secret key del mismo widget**. El origen y
   el salt aleatorio de 32 bytes ya están preparados. No sustituir ni publicar
   el salt y no copiar la clave service_role. Comunicar solo «claves listas».

Ambos archivos están ignorados por Git. No pegar su contenido en el chat, ni
mostrarlos con Get-Content, cat o comandos de diagnóstico. Editarlos localmente.
Reiniciar Vite tras completar `.env.local` y abrir exactamente 127.0.0.1:5173.

Cloudflare permite autorizar explícitamente dominios locales en widgets reales.
Aquí se prueba el captcha real; no se han instalado claves dummy que siempre
aprueban. El servidor comprueba la acción `reserve` y que el hostname de la
validación coincide exactamente con el del origen. Las claves de otro widget
o de producción sin ese hostname no se dan por válidas para estas pruebas.

## Variables que utiliza el código actual

| Variable | Dónde | Estado |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend `.env.local` | URL real preparada |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Pendiente de clave publicable, nunca service_role |
| `VITE_TURNSTILE_SITE_KEY` | Frontend | Pendiente de Site key del widget local |
| `TURNSTILE_SECRET_KEY` | Servidor `supabase/.env` → secretos Edge | Pendiente de Secret key del mismo widget |
| `ALLOWED_ORIGINS` | Solo servidor | `http://127.0.0.1:5173`, sin barra final |
| `RATE_LIMIT_SALT` | Solo servidor | Aleatorio generado localmente, 64 caracteres hex; sin mostrar |
| `SUPABASE_URL` | Entorno Edge proporcionado por Supabase | No copiar al archivo de secretos |
| `SUPABASE_SERVICE_ROLE_KEY` | Entorno Edge proporcionado por Supabase | Solo servidor; confirmar disponibilidad al desplegar |

La función actual usa la variable legacy `SUPABASE_SERVICE_ROLE_KEY` ofrecida
por Supabase, no una clave privilegiada del frontend. No desactivar las claves
legacy antes de comprobar el entorno de esta función. No necesita contraseña
PostgreSQL, JWT secret, SMTP ni credenciales Cloudflare API para funcionar.

## Operaciones preparadas, no ejecutadas

Cuando estén las claves y se autorice la configuración remota, subir únicamente
los tres secretos del archivo privado (sin valores como argumentos):

```powershell
npx.cmd supabase secrets set --project-ref bdgtlonduwffyxvkcadi --env-file supabase/.env
```

Despliegue de una sola función, sujeto a autorización explícita independiente:

```powershell
npx.cmd supabase functions deploy reserve --project-ref bdgtlonduwffyxvkcadi --no-verify-jwt --use-api
```

Opciones verificadas con la CLI instalada 2.122.0. `--use-api` evita depender
de Docker. `--no-verify-jwt` coincide con `config.toml`: los clientes no tienen
cuenta y el frontend envía una clave publicable como `apikey`, no como JWT.
La función valida Turnstile, origen, datos y cuotas en servidor; no se omiten
estos controles. No usar --prune ni desplegar todas las funciones.

Endpoint resultante:
`https://bdgtlonduwffyxvkcadi.supabase.co/functions/v1/reserve`.
El formulario ya apunta a este endpoint a partir de la URL del entorno.

Después faltará configurar Auth del propietario, mesas/horarios y privacidad,
y autorizar las pruebas controladas antes de habilitar solicitudes. Activar
`reservations_enabled` es un paso aparte: desplegar no lo activa.

## Paso posterior a Netlify y al dominio definitivo

Cuando exista una URL Netlify real y autorizada, crear un widget **de producción**
Managed permitiendo solo su hostname real (sin `https://`, puerto ni rutas).
Configurar su Site key en Netlify y su Secret key en Supabase; sustituir
`ALLOWED_ORIGINS` por el origen HTTPS exacto autorizado. Retirar el origen local
al terminar las pruebas. No se han inventado nombres de Netlify o dominios.

La función acepta una sola Secret key: no pueden usarse simultáneamente dos
widgets con secretos diferentes contra este mismo backend. Coordinar el cambio
de ambas claves y orígenes al pasar de pruebas a producción, sin nuevas funciones.
Cuando se elija el dominio definitivo, añadirlo al widget de producción y a los
orígenes exactos aprobados; revisar también las URL de recuperación Auth.

## Comprobaciones realizadas

- Deno check con dependencias en caché: correcto para `reserve/index.ts`.
- TypeScript y build correctos. Vite avisa de un bundle mayor de 500 kB;
  no impide compilar y no se ha refactorizado fuera del alcance.
- 14 pruebas del manejador superadas: validación, captcha, origen, errores,
  cuotas, registro antes de reservar y fallo cerrado.
- Consulta remota de solo lectura: migraciones 001/002/003 presentes; ambas RPC
  reciben `(p_data jsonb, p_network_hash text, p_contact_hash text)`, devuelven
  jsonb, ejecutables por service_role pero no anon/authenticated. Coinciden con
  el código. La cuota y la reserva se llaman en RPC separadas y esperadas.
- Fuentes frontend y build sin referencias a variables privadas ni valores
  privados locales; las tres variables VITE son públicas. Los archivos privados
  y la caché de enlace `supabase/.temp/` quedan ignorados por Git.

Pendiente: widget real, claves públicas, subida de secretos, despliegue autorizado
y pruebas con tokens reales. Estas comprobaciones no acreditan una reserva real.

Referencias oficiales:
- https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/
- https://supabase.com/docs/guides/functions/secrets
