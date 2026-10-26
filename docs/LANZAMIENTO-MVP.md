# Lanzamiento MVP — fase 1

Actualización del 26/10/2026: tres secretos configurados y `reserve` desplegada
con autorización. Estado ACTIVE y comprobaciones HTTP 204/400/403 correctas.
Reservas siguen desactivadas. Resultado y prueba controlada pendiente en
[TURNSTILE-RESERVE.md](TURNSTILE-RESERVE.md); prevalece sobre los estados previos.

Estado: migraciones 001, 002 y 003 aplicadas con autorización expresa del
propietario a `bdgtlonduwffyxvkcadi`. Reservas públicas todavía desactivadas.
Los cambios locales anteriores se conservan.

Configuración local posterior de Edge/Turnstile preparada, sin despliegue ni
activación. Acciones manuales mínimas y comandos exactos: [TURNSTILE-RESERVE.md](TURNSTILE-RESERVE.md).

## Aplicación autorizada y comprobación posterior

Antes de aplicar se confirmó el ref enlazado y la CLI 2.122.0. El dry-run
enumeró exclusivamente las tres migraciones, sin seeds ni roles adicionales.
Se ejecutó `db push --linked --project-ref bdgtlonduwffyxvkcadi --skip-vault
--yes` con la CLI instalada; las tres se aplicaron en orden, con salida 0.

Verificación remota posterior en transacción READ ONLY y `migration list`:

- Historial remoto y local coinciden: 202610230001, 202610230002, 202610230003.
- Existen las ocho tablas y las dieciséis funciones de aplicación (cinco
  privadas y once públicas); todas las tablas tienen RLS habilitada.
- Existen las siete políticas de lectura: autorización administrativa, salvo
  lectura de la propia asignación en `admin_users`.
- Anónimos sin lectura ni escritura directa en tablas; autenticados sin
  escritura directa, con lectura sujeta a RLS. Ambos sin acceso a `private`.
- Creación de solicitudes, registro de intentos y mantenimiento ejecutables
  por `service_role`, no por anónimos ni autenticados. Consultas públicas de
  configuración/disponibilidad accesibles; RPC administrativas no anónimas.
- `btree_gist` instalada y restricción de exclusión de reservas presente.
- `restaurant_settings.reservations_enabled` sigue siendo `false`.

Sin errores en la aplicación ni en estas consultas. No se desplegaron Edge
Functions, no se publicó, no se hizo git push ni se activaron reservas.
Estos controles de catálogo no sustituyen las pruebas futuras por API y de
concurrencia real.

Siguiente paso sujeto a autorización: configurar secretos de `reserve` y
desplegar esa función. Después completar claves públicas locales, Turnstile,
Auth/propietario y mesas/horarios reales antes de probar reservas. La activación
pública continúa requiriendo autorización independiente.

Los apartados siguientes documentan estados y planes previos; prevalece este
resultado de aplicación y verificación.

## Inventario remoto comprobado

Destino comprobado: `supabase/.temp/project-ref` contiene `bdgtlonduwffyxvkcadi`.
CLI encontrada en la caché local: versión 2.122.0. Se ejecutaron `migration list
--linked`, `db query` con `checks/launch-readonly.sql` y una consulta adicional
de catálogos en una transacción READ ONLY terminada con ROLLBACK.

- Las tres migraciones 001/002/003 están únicamente en local.
- No hay relaciones, funciones ni políticas en `public` o `private`.
- Existe `public`; todavía no existe el esquema `private`.
- Existe `auth.users` y los roles `anon`, `authenticated` y `service_role`.
- `btree_gist` está disponible pero no instalada; la crea la migración 001.

No se detectan conflictos de nombres para las tres migraciones. No se han
consultado datos de clientes ni secretos. No se han desplegado funciones.

Comando propuesto para autorización, todavía NO ejecutado:

```powershell
npx.cmd supabase db push --linked --project-ref bdgtlonduwffyxvkcadi --skip-vault
```

`--skip-vault` evita actualizar secretos de Vault como efecto adicional de esta
versión de la CLI. No incluir seed, roles ni reparación de historial. Revisar
que el plan enumere exactamente 202610230001, 202610230002 y 202610230003.
Cada archivo SQL tiene su propia transacción: si falla un archivo posterior,
los anteriores pueden quedar aplicados. En tal caso, consultar de nuevo el
historial y no reiniciar ni borrar la base. Una aplicación correcta crea el
backend con reservas desactivadas; aún faltan función, secretos, Auth del
propietario, mesas/horarios y pruebas reales para activarlas.

Los apartados siguientes conservan la preparación previa; las menciones a
acceso o inventario pendiente quedan sustituidas por este resultado.

## Identificar y comprobar el destino

Destino indicado por el propietario:

- Proyecto y organización: RESTOBAR LA LLAVE.
- Project ref: `bdgtlonduwffyxvkcadi`.
- URL pública: `https://bdgtlonduwffyxvkcadi.supabase.co`.

Estos datos no acreditan todavía acceso ni el estado del esquema remoto.
Falta un acceso autenticado para las consultas autorizadas de solo lectura.
`project_id = "restobar-la-llave"` en `supabase/config.toml`
identifica el entorno local; no acredita la identidad de un proyecto remoto.
No existe `supabase/.temp/project-ref` ni archivos de entorno configurados en
las ubicaciones `.env`, `.env.local` y `supabase/.env`. No se han abierto archivos
de contraseñas. No hay un conector Supabase disponible en esta sesión.

Con el destino confirmado, ejecutar `supabase/checks/launch-readonly.sql` desde
un acceso autorizado al SQL Editor o una conexión PostgreSQL segura. Usa una
transacción de solo lectura y termina con rollback. Devuelve únicamente
inventario, versiones y políticas; no consulta datos personales.
Comprobar además en el panel la función desplegada `reserve`, nombres de los
secretos (sin valores), configuración Auth y propiedad de la organización.

Comparar el historial con:

1. `202610230001_reservations.sql`
2. `202610230002_admin_queries.sql`
3. `202610230003_persistent_attempt_limits.sql`

No se puede determinar aún cuáles faltan. Si hay tablas sin historial, versiones
divergentes u objetos parciales, detener la aplicación y comparar el esquema;
no repetir 001 sobre tablas existentes ni reparar el historial a ciegas.

## Configuración preparada

| Ubicación | Variables |
| --- | --- |
| Frontend local y futuro Netlify | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`), `VITE_TURNSTILE_SITE_KEY` |
| Secretos de la función | `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_SALT` (aleatorio privado, mínimo 32 caracteres), `ALLOWED_ORIGINS` (orígenes exactos) |
| Entorno administrado por Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, solo servidor |

Las plantillas existentes son `.env.example` y `supabase/.env.example`.
Completar los secretos directamente en el gestor del proveedor o archivo local
ignorado; no enviarlos por chat. No copiar claves privadas a variables `VITE_*`.
`reserve` tiene `verify_jwt=false`: es pública, verifica Turnstile y aplica las
cuotas del servidor antes de crear la solicitud. No necesita cuentas de clientes.

Auth: registro público desactivado, correo/contraseña, URL de recuperación exacta
`ORIGEN/admin/recuperar` y cuenta propia del propietario autorizada en `admin_users`.
Los valores locales de `config.toml` no configuran automáticamente Auth remoto.
No cambiar configuraciones remotas durante este inventario.

## Acceso seguro desde PowerShell

La CLI no está instalada en PATH ni en `node_modules/.bin`; el intento offline
también falló por ausencia del paquete en caché. No se han leído almacenes de
credenciales ni archivos de contraseñas. Las variables de autenticación CLI no
están presentes en este proceso. No se ha podido consultar aún el proyecto remoto.

El propietario puede ejecutar desde su terminal interactivo:

```powershell
Set-Location 'C:\Users\sergi\OneDrive\Documentos\RESTOBAR LA LLAVE'
npx.cmd supabase --version
npx.cmd supabase login
npx.cmd supabase projects list
npx.cmd supabase functions list --project-ref bdgtlonduwffyxvkcadi
```

La primera ejecución puede pedir descargar la CLI. Seguir el inicio de sesión
interactivo en el navegador con la cuenta que tiene acceso a la organización.
Si solicita un token personal, introducirlo únicamente en el prompt local:
nunca como argumento `--token`, en el repositorio o por chat. La CLI utiliza el
almacén nativo de credenciales; si no está disponible puede guardar el token en
texto plano. Si avisa de ese caso, utilizar el SQL Editor autenticado como
alternativa sin compartir ni copiar el token.

Después de iniciar sesión, comunicar solo que está listo, nunca el token. El
listado de proyectos y funciones es lectura; no ejecutar `link`, `db push`,
`migration repair`, `config push` ni despliegues en esta etapa.

Para consultar tablas e historial sin enlazar la CLI, abrir
https://supabase.com/dashboard/project/bdgtlonduwffyxvkcadi/sql/new
y ejecutar exclusivamente el contenido de `supabase/checks/launch-readonly.sql`.
Compartir las tablas de resultados y los avisos de versiones, que no incluyen
reservas ni secretos. El inventario y la CLI son complementarios: listar
proyectos o funciones no comprueba las migraciones ni las tablas.

Referencia: https://supabase.com/docs/reference/cli/supabase-login

## Operaciones propuestas, todavía no autorizadas ni ejecutadas

Después del inventario se presentará la lista exacta de migraciones pendientes
y el proyecto destino para aprobación. La secuencia prevista es:

1. Enlazar localmente el ref confirmado mediante Supabase CLI, con autenticación
   segura; no poner contraseñas en argumentos ni registros.
2. Revisar la lista remota de migraciones y el plan `supabase db push --dry-run`.
   Un dry-run no autoriza el posterior push.
3. **Con autorización de escritura:** aplicar solo las migraciones pendientes
   mediante `supabase db push`, tras comprobar que su plan coincide con lo aprobado.
   Sin `db reset`, borrados ni reescritura de migraciones aplicadas.
4. **Con autorización:** configurar los tres secretos de Edge en el panel y
   desplegar `supabase functions deploy reserve --project-ref REF_CONFIRMADO`.
   La migración 003 debe preceder a la función actualizada; sin su RPC la función
   rechaza envíos de forma segura. No exponer tráfico público durante el cambio.
5. Mantener las reservas públicas desactivadas hasta configurar datos reales y
   completar las pruebas de fases 2/3. Si ya estuvieran activas, acordar el cambio
   antes de modificar su estado. No publicar en Netlify en esta fase.

No ejecutar los marcadores como comandos reales. La CLI no está disponible en
PATH en esta revisión; preparar su instalación local si es la vía elegida.
El SQL Editor permite realizar el inventario sin instalarla.

## Siguiente paso

Validación local de esta preparación: el inventario SQL se ejecutó correctamente
en PGlite sobre una base vacía y sobre las tres migraciones con historial
sintético. `git diff --check` pasó. No se repitieron las suites de aplicación:
en esta fase solo se añadieron SQL de consulta y documentación, sin cambios de
código, diseño o configuración efectiva. Esto no acredita el estado remoto.

Completar el acceso de solo lectura o recibir los resultados del inventario. Después, informar de las
migraciones realmente ausentes y solicitar aprobación de operaciones concretas.
Mesas, horarios y cuenta del propietario se pedirán en fase 2. La guía existente
`GUIA-ADMINISTRADOR.md` y `ENTREGA.md` cubre el uso y transferencia al restaurante.
