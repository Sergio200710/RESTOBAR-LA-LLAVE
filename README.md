# RESTOBAR LA LLAVE

Landing React + Vite + TypeScript con cuatro secciones: portada, platos, reservas
y redes sociales. Fase 3 incorpora integración Supabase, SQL transaccional, función
de reservas y panel administrativo en español. No hay carta, pagos, pedidos,
notificaciones de reservas por correo ni confirmación automática.

**Estado real:** código implementado y probado localmente. No hay credenciales
configuradas, migraciones aplicadas a Supabase ni servicios desplegados. Sin
configuración, la web muestra la vista previa y no envía reservas. Los resultados
locales no acreditan el recorrido completo contra Supabase real. No se ha publicado.

## Inicio local

Requiere Node.js >=22.12 y npm. En PowerShell restringido, usar `npm.cmd` y
`npx.cmd` sin cambiar la política de ejecución.

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir http://127.0.0.1:5173 y `/admin`. Sin configuración no hay acceso a un panel
ficticio ni datos de ejemplo. El formulario permanece sin envío. El panel conectado
solo se muestra tras verificar la sesión con Auth y la autorización en la base
de datos. Mantener la terminal abierta; Ctrl+C detiene el servidor.

## Estructura

```text
src/App.tsx                         Landing y rutas existentes
src/components/ReservationForm.tsx  Solicitud, disponibilidad e idempotencia
src/components/Turnstile.tsx        Comprobación antiautomatismos
src/admin/Admin.tsx                 Acceso, reservas, calendario y configuración
src/admin/admin.css                Diseño del panel, especialmente para móvil
src/lib/                           Cliente Supabase, tipos y mensajes seguros
src/data/site.ts                   Fotografías y enlaces sociales
supabase/migrations/               Esquema, restricciones, RLS y funciones SQL
supabase/functions/reserve/        Entrada Edge Function, ejecutada con Deno
supabase/functions/_shared/        Lógica HTTP de reservas comprobable en local
tests/db/                          PostgreSQL embebido, sin credenciales
tests/e2e/                         Regresiones y contratos de navegador/servidor
docs/GUIA-ADMINISTRADOR.md          Uso sencillo para el propietario
docs/ENTREGA.md                    Activación, validación y transferencia
docs/FASES.md                      Resultados y límites de cada entrega
```

## Configuración pública y privada

Crear `.env` a partir de `.env.example` y completar **solo**:

| Variable pública | Valor que debes obtener |
| --- | --- |
| `VITE_SUPABASE_URL` | URL real del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable `sb_publishable_...` |
| `VITE_TURNSTILE_SITE_KEY` | Site key pública del widget Turnstile |

No se admiten claves secretas en estas variables. Vite publica cualquier
variable `VITE_*`. La URL local de Supabase puede ser HTTP en localhost/127.0.0.1;
para servicios remotos se exige HTTPS. Reiniciar Vite al cambiar `.env`.

En el entorno de **Supabase Edge Functions**, configurar estos secretos usando
el panel o un archivo `.env` local ignorado basado en `supabase/.env.example`:

| Variable de servidor | Uso |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | Verificación del token en Cloudflare, nunca en navegador |
| `ALLOWED_ORIGINS` | Orígenes exactos separados por comas, con protocolo y puerto |
| `RATE_LIMIT_SALT` | Valor aleatorio privado de al menos 32 caracteres para HMAC |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son proporcionados por el entorno
Supabase. Esta última solo se lee en la función de servidor. No copiarla a Vite,
al repositorio ni al chat. Generar el salt con un gestor seguro y conservarlo
como secreto del proyecto. `.env.example` no contiene claves reales.

## Proyecto Supabase y migraciones

Trabajar primero en un proyecto de pruebas controlado por el restaurante.
Las siguientes órdenes son instrucciones pendientes, no acciones ejecutadas:

```powershell
npx.cmd supabase login
npx.cmd supabase link
npx.cmd supabase db push
npx.cmd supabase secrets set --env-file supabase/.env
npx.cmd supabase functions deploy reserve
```

Seleccionar cuidadosamente el proyecto de destino y revisar las dos migraciones
antes de `db push`. No ejecutar `db reset` contra una base remota ni usar estos
archivos para reemplazar una base con datos existentes. Las migraciones están
versionadas y crean el esquema nuevo, no son scripts para ejecutar repetidamente.
Ver [migraciones oficiales](https://supabase.com/docs/guides/deployment/database-migrations)
y [despliegue de funciones](https://supabase.com/docs/guides/functions/deploy).

Para un stack Supabase completamente local se necesita Docker en ejecución y
Supabase CLI: `npx.cmd supabase start`, `npx.cmd supabase db reset` (solo local)
y `npx.cmd supabase functions serve reserve --env-file supabase/.env`.
Docker no estaba en ejecución durante esta entrega; este stack no se ha probado.

La función `reserve` es pública (`verify_jwt=false`) deliberadamente: los clientes
no tienen cuenta. Exige validación de datos, origen permitido, token Turnstile
válido para el hostname y acción `reserve`, campo trampa vacío y límites en SQL.
Las credenciales publicables nunca se usan como bearer JWT.

## Primer administrador y recuperación

1. En Supabase Auth, desactivar el registro público. Mantener el proveedor de
   correo/contraseña y configurar Site URL y la URL permitida exacta
   `ORIGEN_REAL/admin/recuperar` (y la local si procede).
2. Invitar al correo real del propietario desde Supabase Auth. No crear
   contraseñas predeterminadas ni compartir la cuenta del desarrollador.
3. Una persona con acceso privilegiado a SQL asignará el rol después de verificar
   la identidad. Sustituir el marcador por el correo real de la cuenta invitada:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'CORREO_REAL_DEL_PROPIETARIO'
on conflict (user_id) do update set active = true;
```

Comprobar que se asignó exactamente una cuenta. Ser un usuario registrado,
conocer la ruta o modificar metadatos del usuario **no** concede administración.
No hay API pública para crear administradores.

El propietario elegirá su contraseña mediante un enlace seguro de recuperación
solicitado desde `/admin`, abierto en el mismo navegador (flujo PKCE).
Comprobar la entrega del correo de Auth y configurar su proveedor SMTP antes de
la entrega. Estos mensajes son solo de acceso y recuperación, no notificaciones
de reservas. Para revocar acceso: `admin_users.active=false` desde SQL privilegiado.

## Comportamiento y seguridad de reservas

- Sin mesas/horarios o con solicitudes desactivadas no hay reservas públicas.
- La configuración inicial no inventa capacidad ni apertura. Valores técnicos
  iniciales: horizonte 60 días y conservación 90 días, ambos ajustables por el
  responsable; no constituyen una decisión legal sobre conservación.
- El servidor valida fecha/hora de Europe/Madrid, turno, duración, cierres y
  capacidad. Rechaza horas inexistentes o ambiguas por cambio de hora.
- Cada solicitud ocupa una mesa física suficiente. Las pendientes también
  bloquean capacidad hasta su confirmación, rechazo o cancelación. No hay
  combinación automática de mesas ni caducidad automática de pendientes.
- Las franjas son dentro de un día y no se admiten reservas que crucen medianoche.
  Se pueden configurar franjas separadas en días consecutivos para apertura nocturna.
- La creación usa un UUID idempotente y detecta duplicados por contacto y turno.
  Las confirmaciones y ediciones revalidan disponibilidad dentro de transacción,
  con bloqueo común y restricción GiST que impide solapamientos.
- Ediciones administrativas usan `updated_at` para evitar sobrescribir cambios
  hechos por otra persona. Los cambios de configuración que invalidan reservas
  activas se rechazan y revierten.
- Límites: hasta 5 solicitudes por red en 15 minutos y 3 por contacto en una hora,
  excluidos reintentos con el mismo UUID. La cuota usa HMAC con salt privado; la
  IP es solo una capa adicional, nunca una prueba de identidad.
- Turnstile se valida en servidor para cada intento. La protección de origen/CORS
  no se considera autenticación. No se registran datos personales en logs.
- Las tablas no conceden escritura directa a clientes, ni siquiera administradores.
  Los administradores escriben mediante RPC autorizadas. Anónimos no leen reservas
  ni pueden ejecutar creación directa; solo la función Edge puede crear solicitudes.
- La respuesta pública no contiene identificadores ni datos de otras reservas.

Para activar las solicitudes, entrar en **Mesas y horarios**, configurar mesas,
franjas y cierres reales, completar responsable/contacto/información de privacidad
y activar el interruptor. Además deben estar configurados Turnstile y la función.

## Conservación y mantenimiento

Antes de recoger datos, revisar finalidad, base jurídica, derechos, conservación,
encargados/proveedores y texto de privacidad del restaurante. El formulario
registra la lectura de la versión vigente de esa información; no se atribuye
automáticamente una base jurídica concreta a ese checkbox.

`maintenance_cleanup()` elimina reservas antiguas y sus eventos después del
plazo configurado, y contadores de cuota de más de un día. No es ejecutable por
clientes ni administradores del navegador. **Debe programarse antes de activar
producción**: habilitar Supabase Cron y crear una tarea SQL diaria con:

```sql
select public.maintenance_cleanup();
```

Comprobar ejecuciones y política de copias de seguridad desde la organización
del restaurante. La tarea no está programada en esta entrega, y el borrado de
filas no elimina inmediatamente datos de las copias de seguridad. Ver
[Supabase Cron](https://supabase.com/docs/guides/cron).

## Pruebas y límites de verificación

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:db
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd exec --yes --package=deno -- deno check --config supabase/functions/reserve/deno.json supabase/functions/reserve/index.ts
```

Ejecutar las regresiones sin `.env` real. `test:e2e` administra servidores de
prueba en 5173/5180; puede reutilizar la vista previa local sin credenciales.
No se deben reutilizar servidores conectados a producción. Los valores reservados
de fixtures no son credenciales y todas sus llamadas se interceptan.

- SQL: 13 casos en PostgreSQL embebido real (PGlite); el ejecutor cuenta 14
  resultados incluyendo el contenedor. Ejecuta ambas migraciones, restricciones,
  disponibilidad, duplicados, estados manuales, roles/RLS, revocación y retención.
  El esquema Auth de la prueba es un sustituto local de `auth.uid()` y `auth.users`.
- Playwright: regresiones de la landing conservadas; pruebas HTTP del manejador
  y pantallas con servicios interceptados. Las pruebas de login/recuperación
  comprueban contratos de interfaz, no la entrega real de correos ni GoTrue real.
- Responsive público y panel a 320, 390, 768 y 1440 px; hashes SHA-256 de las
  imágenes nuevas y capturas en `test-results/`.
- Deno comprueba tipos y resolución de los módulos reales de la función Edge.

Resultados finales y recuento del navegador: `docs/FASES.md`. Falta validar en
Supabase real: el recorrido completo, Auth/recuperación real, RLS vía REST,
antibot con tokens reales y dos sesiones concurrentes. PGlite usa una conexión:
las restricciones sí se ejecutan, pero no sustituye esa prueba de concurrencia.

## Fotografías, redes y entrega

Se usan exclusivamente las copias de **logo.jpg**, **PlatoLaLlave.jpg** y
**PlatoLaLlave2.jpg**. Los originales no se han alterado. No contienen nombres
incrustados. Por instrucción del propietario, los platos se muestran **sin
nombres** hasta disponer de los oficiales; `name` es `null`. Cuando se faciliten,
se mostrarán como HTML, nunca retocando la foto. Los anteriores PNG se conservan
como archivos históricos sin usarlos en la landing.

Los enlaces sociales siguen vacíos y configurables en `src/data/site.ts`, sin
inventar cuentas. `/admin` es la ruta privada; las antiguas rutas públicas
redirigen a las anclas de la landing. No se ha desplegado en Netlify. Para su
publicación futura: build `npm run build`, directorio `dist` y regla SPA
`/* /index.html 200`. Requiere autorización expresa.

Uso para el propietario: [Guía del administrador](docs/GUIA-ADMINISTRADOR.md).
Activación y control independiente: [Procedimiento de entrega](docs/ENTREGA.md).
