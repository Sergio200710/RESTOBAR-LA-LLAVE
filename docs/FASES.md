# Registro de fases

## Demo funcional aislada para el propietario — 26/10/2026

Se revisaron y reutilizaron la landing, fotografías, formulario, validación de
datos, tipos de reservas, dashboard, filtros, calendario y cambios de estado.
Se añadió un adaptador local en src/demo, sin reconstruir esas pantallas ni
modificar estilos o fotografías. El build normal conserva Auth y Supabase;
solo el modo de compilación demo habilita el panel ficticio sin cuenta.

Configuración ficticia solicitada: 4 mesas de 2, 4 de 4 y 2 de 6 personas;
martes a domingo, 13:00–16:00 y 20:00–23:30, duración 90 min, intervalos 30 min.
localStorage exclusivo del origen demo, persistencia al recargar, cambios entre
pestañas y reset limitado a datos demo. Banner y mensajes identifican las
reservas como ficticias. Sin Auth, Turnstile ni solicitudes a Supabase en demo.
La demo no permite acceder a reservas reales ni comparte datos entre dispositivos.

Comprobaciones ejecutadas y superadas:

- TypeScript y builds normal y demo; Vite mantiene el aviso de bundle >500 kB.
- 50 pruebas Playwright: las 41 anteriores, 8 de demo y una de protección del
  acceso normal frente a URL/almacenamiento demo. Recorrido completo a
  320/390/768/1440 px, persistencia, confirmación, cancelación, rechazo, filtros,
  calendario, disponibilidad, duplicados, reset y actualización entre pestañas.
- 24 casos SQL locales (26 resultados contando contenedores), sin tocar remoto.
- Paquete estático dist-demo probado con Chromium: acceso directo a /admin,
  solicitud y confirmación ficticias, cero solicitudes al backend.
- Build demo sin URL ni claves reales; producción sin almacén demo. SPA y
  noindex solo en dist-demo. Capturas revisadas y git diff --check correcto.

Los primeros intentos de pruebas se corrigieron: el detector de aislamiento
confundía el módulo local supabase.ts con una llamada externa y un selector de
filtro era demasiado estricto. La comprobación adicional por PowerShell usó
selectores estructurales para evitar problemas de codificación de acentos.
Los resultados anteriores corresponden a las ejecuciones finales correctas.

No se han hecho operaciones remotas, despliegues, git push ni activación de
reservas reales durante este trabajo. Para probar: npm.cmd run dev:demo,
http://127.0.0.1:5174 y /admin. Para compartir, falta autorizar un sitio Netlify
separado, publicar dist-demo y comprobar su URL. Guía: docs/DEMO.md.

Este apartado prevalece como estado de la demostración; no declara terminada
la prueba de reservas reales de los apartados siguientes.

## Preparación del frontend real — 26/10/2026

Claves públicas presentes y con formato válido. Se corrigió la URL pública
local al proyecto `bdgtlonduwffyxvkcadi`, conservando las claves sin mostrarlas.
RPC pública real 200; `reserve` con clave publicable y JSON vacío 400 con CORS
correcto. Chromium sin interceptar Supabase: RPC 200, formulario bloqueado,
/admin accesible y móvil de 390 px sin desbordamiento. No se ha enviado reserva.
Auth tiene correo activo pero registro público aún habilitado. Cero admins,
mesas y franjas activas, privacidad pendiente y reservas desactivadas.
No se modificó la configuración remota, no se crearon usuarios, no hubo git push
ni Netlify. Datos necesarios y plan en docs/PRUEBA-RESERVAS-REALES.md.
Este estado sustituye la mención anterior a claves públicas pendientes.

## Lanzamiento — Edge Function desplegada el 26/10/2026

Con autorización expresa se configuraron exclusivamente TURNSTILE_SECRET_KEY,
ALLOWED_ORIGINS y RATE_LIMIT_SALT y se desplegó únicamente `reserve` en
`bdgtlonduwffyxvkcadi`. Valores secretos no mostrados. Estado remoto ACTIVE,
versión 1. Pruebas HTTP del endpoint: CORS local 204, JSON vacío 400, origen
ajeno 403. Reservas siguen desactivadas; sin Netlify ni git push.
No se ha probado aún la creación de una reserva real ni Turnstile con token real.
Pendientes: clave publicable y Site key del frontend, cuenta administrativa, mesas/horarios,
privacidad y autorización para habilitar pruebas. Ver docs/TURNSTILE-RESERVE.md.

## Correcciones de seguridad — verificación local del 26/10/2026

Se conserva el commit local `cac8182` de Claude Code. Al retomar el trabajo no
había cambios sin guardar. Están completas y son coherentes la recuperación de
`Admin.tsx`, la llamada previa de `reserve-handler.ts`, su implementación en
`reserve/index.ts` y la migración aditiva `202610230003_persistent_attempt_limits.sql`.
No se han reescrito esas correcciones ni las migraciones anteriores.

La recuperación comprueba el error devuelto por Supabase, limpia éxitos previos
y muestra errores genéricos sin revelar si existe la cuenta. Los intentos se
contabilizan en una transacción RPC independiente de la reserva; rechazar esta
última no revierte la cuota. El bloqueo transaccional serializa la comprobación
y el incremento. Solo `service_role` puede registrar intentos. Los reintentos
de solicitudes ya guardadas con contenido idéntico no duplican ni consumen cuota.

Añadido `tests/db/attempt-limits.test.mjs`, integrado en `test:db`, y regresiones
en `tests/e2e/admin-contract.spec.ts` y `tests/e2e/service-handler.spec.ts`.
Actualizados README y este registro. Sin cambios de landing, imágenes o estilos.

Pruebas ejecutadas y superadas:

- `npm.cmd run typecheck` y `npm.cmd run build`.
- `npm.cmd run test:db`: 24 casos SQL; 26 resultados contando dos contenedores.
  Incluye migración sobre datos existentes, rollback por falta de disponibilidad,
  fechas/horas inválidas, cuotas por red/contacto, expiración, permisos, retención
  y ocho reintentos idempotentes sin duplicados incluso con cuota agotada.
- `npm.cmd run test:e2e`: 41 pruebas, incluidas recuperación con error devuelto
  y fallo de red, inicio de sesión posterior, registro previo de cuota, fallo
  cerrado del registro, imágenes originales y responsive a 320/390/768/1440 px.

Límites: PGlite serializa las llamadas en una única conexión; las llamadas
solapadas locales no acreditan concurrencia entre sesiones independientes.
Auth/Turnstile del navegador están interceptados. No se ha ejecutado GoTrue
real, envío de correos ni comprobación Deno en esta revisión.

Pendiente, siempre con autorización: consultar en solo lectura el historial
remoto; después planificar la aplicación de 003 y el despliegue compatible de
`reserve`, y validar concurrencia, RLS vía REST y recuperación reales en un
proyecto de pruebas. Verificar también configuración real de Supabase,
Turnstile, orígenes, redirección Auth, administrador y mesas/horarios antes de
activar reservas. No se han consultado secretos, aplicado migraciones remotas,
desplegado funciones, publicado en Netlify ni realizado `git push`.

Este apartado prevalece sobre los recuentos históricos siguientes.

## Fase 3 — Reservas y administración segura

Estado: implementación local terminada; activación en Supabase y aceptación del
propietario pendientes. Este apartado prevalece sobre los estados históricos.
No se ha publicado ni aplicado ninguna migración remota.

La landing conserva las cuatro secciones, navegación y diseño negro/dorado.
Se usan las nuevas logo.jpg, PlatoLaLlave.jpg y PlatoLaLlave2.jpg, copiadas sin
alteración a public/images. El usuario ha indicado que no se inventen nombres:
ambos nombres son null y no se muestran títulos de plato hasta recibir los
oficiales. Se renderizarán en HTML cuando se proporcionen. Los PNG antiguos se
conservan como históricos pero no se cargan.

Implementación:
- Dos migraciones SQL: tablas de reservas, mesas, horarios, cierres, ajustes,
  administradores y eventos; claves foráneas, índices, restricciones y RLS.
- Lectura pública limitada a configuración sin datos personales y horarios
  disponibles. No se concede acceso anónimo a reservas ni escritura directa.
- Creación únicamente desde Edge Function privilegiada, después de validar
  datos, origen, token Turnstile, hostname y acción, tamaño y campo trampa.
- Idempotencia mediante UUID y detección de duplicados. Cuotas por red y contacto
  con HMAC; sin datos personales en logs ni identificadores en respuestas públicas.
- Solicitudes siempre PENDIENTE. Pendientes y confirmadas ocupan una mesa física;
  rechazo/cancelación liberan capacidad. No hay combinación de mesas automática.
- Disponibilidad transaccional en creación/confirmación/edición, bloqueo común,
  restricción de exclusión GiST y protección contra ediciones obsoletas.
- Configuración que invalidaría reservas activas se rechaza y revierte.
- Formulario conectado por variables y activación explícita; sin configuración
  permanece como vista previa sin solicitudes ficticias.
- /admin con correo/contraseña, verificación getUser + rol SQL, recuperación PKCE,
  nueva contraseña y cierre de sesión. No hay registro público en la aplicación.
- Dashboard, búsqueda/filtros, listado paginado, detalles, cambio de fecha/hora/
  comensales y acciones manuales con confirmación visual.
- Calendario mensual y acceso por día a horas y detalles.
- Mesas, capacidades, horarios, duración de turnos, cierres, privacidad y activación
  configurables desde el panel. Sin capacidades ni horarios de ejemplo.
- Retención configurable y función de limpieza privilegiada; la programación diaria
  en Supabase Cron queda pendiente antes de activar producción.
- Guía sencilla del propietario y procedimiento de transferencia de cuentas,
  proyectos, dominio y control independiente, sin compartir contraseñas.

Archivos principales creados: supabase/migrations/202610230001_reservations.sql y
202610230002_admin_queries.sql; supabase/functions/reserve/{index.ts,deno.json,
deno.lock}; supabase/functions/_shared/reserve-handler.ts; supabase/config.toml;
supabase/.env.example; src/admin/{Admin.tsx,admin.css}; src/components/
{ReservationForm.tsx,Turnstile.tsx}; src/lib/reservations.ts; tests/db/
reservations.test.mjs; tests/e2e/{admin-contract.spec.ts,service-handler.spec.ts};
tests/run-browser-tests.mjs; tests/fixtures/configured-server.mjs;
docs/GUIA-ADMINISTRADOR.md y docs/ENTREGA.md.

Modificados: src/App.tsx, src/data/site.ts, src/lib/supabase.ts, src/styles.css,
.env.example, .gitignore, package.json/package-lock.json, playwright.config.ts,
README.md, supabase/README.md, public/images/README.md y el test existente
landing.spec.ts (solo nueva procedencia de imágenes y ausencia de nombres inventados).
Se conserva la cobertura de regresión anterior.

Verificaciones:
- `npm.cmd run typecheck` y `npm.cmd run build`: correctos en la comprobación final.
- SQL: 13 casos superados en PostgreSQL embebido (14 resultados contando el test
  contenedor). Ambas migraciones aplicadas realmente en el motor local; pruebas
  de estado inicial, creación, duplicados, fechas/horarios/cierres, confirmación,
  edición, rechazo, cancelación, exclusión de conflictos, configuración protegida,
  RLS, permisos, revocación, consultas administrativas, cuota y retención.
- Playwright: 36 casos superados con cierre normal: 13 regresiones de landing,
  11 del manejador HTTP con dependencias controladas y 12 contratos de interfaz
  de reservas/Auth/panel con servicios interceptados. No son credenciales reales.
- Navegación y panel a 320, 390, 768 y 1440 px; imágenes JPEG verificadas por
  SHA-256 y decodificación. Capturas completas en test-results.
- Deno check superado con módulos oficiales reales, sin desplegar la función.
- Se ajustaron selectores de prueba para el selector de horas y los mensajes de
  carga/guardado. Un wrapper que controla Vite en el mismo proceso evita el bloqueo
  de cierre de servidores observado en Windows; la suite ya termina normalmente.

Límites: no hay credenciales reales ni Docker activo. PGlite prueba PostgreSQL y
RLS usando un sustituto local mínimo del esquema Auth, no el servicio GoTrue.
La prueba de navegador intercepta Supabase y Turnstile; no certifica conexión real,
envío de recuperación ni captcha real. PGlite usa una conexión: falta probar dos
sesiones concurrentes contra Supabase, aunque la exclusión sí se ha ejecutado.
Las franjas y reservas están limitadas al mismo día; no se admite una reserva
que cruce medianoche. No se combinan mesas ni caducan pendientes automáticamente.

Para activar faltan: proyecto Supabase controlado por el restaurante, variables
públicas, secretos Edge/Turnstile, migraciones y función desplegadas, registro
público de Auth desactivado, correo/URL de recuperación, cuenta propia del
propietario autorizada, mesas/horarios/cierres reales, privacidad revisada y
limpieza programada. La prueba completa cliente → PENDIENTE → administrador →
confirmación/rechazo → estado real debe ejecutarse antes de la entrega, con
participación independiente del propietario. Instrucciones exactas en README,
docs/GUIA-ADMINISTRADOR.md y docs/ENTREGA.md.

## Alcance vigente — Simplificación definitiva

Este apartado sustituye los objetivos de carta digital, precios, páginas de
contacto y gestión de platos de las fases históricas que siguen más abajo.

Implementado: landing pública con exactamente cuatro secciones: Portada,
Algunos de nuestros platos, Reservar mesa y Redes sociales. Cabecera con logotipo
original y acceso destacado a reservas, fotos gastronómicas grandes completas,
negro/dorado/crema, navegación por anclas, menú móvil accesible y transiciones
discretas con respeto al movimiento reducido. Se han retirado la carta, filtros,
categorías, precios, datos de menú y secciones públicas adicionales.

Los dos platos conservan únicamente nombre, imagen y dimensiones. No hay
fotografías de stock ni generadas en public/. Los originales de la raíz se
conservan y sus copias publicadas son idénticas. Sus textos incrustados no se
han modificado. Referencia consultada para jerarquía visual y énfasis en reservas:
https://lafamigliarestaurantes.com/restaurantes/ecija/
No se ha copiado contenido, datos o recursos de ese restaurante.

Formulario de seis campos integrado en la landing. El envío sigue desactivado;
no se simulan solicitudes ni confirmaciones. Se explica que las futuras reservas
requerirán confirmación manual. Horarios y capacidad siguen sin inventarse.

Redes configurables en src/data/site.ts: lista vacía hasta recibir enlaces
oficiales. Botón desactivado mientras no existen enlaces válidos; al configurarlos,
apertura en nueva pestaña con noopener/noreferrer y validación de URL HTTPS.

/admin conservado sin datos ni acciones inseguras. Su estado sigue siendo
informativo: no había autenticación ni backend operativo y no se han simulado.
Quedan pendientes consulta de solicitudes, confirmación/rechazo/cancelación,
calendario y configuración de horarios y mesas con Auth, roles y RLS reales.
La gestión de carta y precios queda fuera del alcance administrativo.

Los antiguos /carta, /reservar y /contacto redirigen a anclas de la única landing.
Se conservan React Router, Vite, TypeScript, dependencias, .env.example y el cliente
opcional de Supabase de fase 1. No se ha publicado ni conectado Supabase.

Archivos: reescritos src/App.tsx, src/styles.css y README.md; creados
src/data/site.ts, src/components/SocialButtons.tsx y tests/e2e/landing.spec.ts;
retirados src/data/menu.ts y las pruebas de recorridos multipágina obsoletos.
Actualizados este registro y supabase/README.md para quitar el menú del backend
previsto. Imágenes y originales sin cambios.

Verificaciones ejecutadas:
- `npm.cmd run build`: correcto, incluye TypeScript.
- `npm.cmd run typecheck`: correcto.
- `npm.cmd run test:e2e`: 13 pruebas superadas en Chromium, cierre normal.
- Cuatro secciones, dos platos y ausencia de carta/precios.
- Recursos HTTP PNG y hashes SHA-256 idénticos a los tres originales, imágenes
  decodificadas y ninguna fuente de imagen ajena a las tres proporcionadas.
- Seis campos operativos visualmente; envío normal, Enter y requestSubmit sin
  solicitudes de escritura, almacenamiento o confirmación; campos vacíos al recargar.
- Ruta /admin y 404, redirecciones antiguas y anclas directas.
- Redes sin destinos inventados y enlace de prueba en nueva pestaña sin opener;
  protocolos inseguros y URL con credenciales descartados.
- Navegación con Enter/Escape y formulario utilizable; sin desbordamiento a
  320, 390, 768 y 1440 px. Capturas completas en test-results.
- Revisión visual de escritorio y móvil: ajustada la ocultación del enlace
  «Saltar al contenido» fuera del foco para evitar que aparezca en capturas
  completas tras desplazar la página. El enlace sigue disponible mediante teclado.

No se verifican reservas reales, Auth, roles o RLS porque no están implementados.
Los resultados y objetivos que aparecen a continuación corresponden a entregas
anteriores y no describen el alcance actual.

## Fase 2 — Web pública e imágenes originales

Estado: implementada, sin iniciar fase 3 ni publicar. Los pendientes de fase 1
que aparecen más abajo son el registro histórico de aquella entrega.

Imágenes localizadas en la raíz e inspeccionadas visualmente: logotipo,
tagliatelle y ensaladilla de pollo al curry. Se conservan los originales y se
publican copias exactas con nombres claros en public/images. Las fotos incluyen
textos y elementos gráficos incrustados; se muestran completos sin alteración.

Implementado:
- Cabecera y pie con logotipo, navegación responsive desplegable, cierre con
  Escape, foco visible, salto al contenido y foco de contenido al cambiar ruta.
- Portada con fotografía gastronómica, eslogan, llamada a reservar, presentación,
  especialidades con ambas fotos, acceso a carta y contacto.
- Carta visual filtrable, categoría provisional, datos tipados y precios,
  descripciones adicionales y disponibilidad nulos para completar posteriormente.
- Formulario visual con fecha, hora, personas, nombre, teléfono y observaciones;
  etiquetas accesibles, envío desactivado y bloqueo del envío nativo. No conecta
  con API, no almacena datos ni simula recepción o confirmación.
- Estilos negro, dorado y crema, títulos serif, cuerpo sans serif, imágenes
  completas, carga prioritaria en portada y diferida en tarjetas. Fuentes del
  sistema para evitar peticiones externas y permitir uso local sin conexión.

Archivos creados: src/data/menu.ts, tests/e2e/public-site.spec.ts y las tres
copias PNG de public/images. Modificados: src/App.tsx, src/styles.css,
playwright.config.ts, tests/e2e/foundation.spec.ts, public/images/README.md,
README.md y docs/FASES.md. Arquitectura y dependencias conservadas.

Verificaciones ejecutadas:
- `npm.cmd run typecheck`: correcto.
- `npm.cmd run build`: correcto.
- `npm.cmd run test:e2e`: 13 pruebas superadas, cierre normal, Chromium.
- Respuesta HTTP y decodificación de las tres imágenes; hashes SHA-256 idénticos
  a los originales.
- Navegación pública, carta filtrable, menú mediante Enter y Escape, retorno de
  foco, estados informativos y formulario sin peticiones de escritura ni datos
  en localStorage/sessionStorage; campos vacíos al recargar.
- Sin desbordamiento horizontal a 320, 390, 768 y 1440 px. Capturas completas de
  inicio, carta, contacto y reservas en los cuatro anchos en test-results.
- Revisadas visualmente capturas de inicio y formulario de escritorio y
  formulario de 320 px.

En la primera ejecución dos pruebas móviles fallaron porque el selector buscaba
«Menú» después de que el botón pasara a llamarse «Cerrar». Se corrigió el
selector para ambos estados y se repitió la suite completa con resultado correcto.
El servidor de pruebas usa directamente Vite y en esta ejecución reutilizó el
servidor local, evitando el bloqueo de cierre observado en la fase 1.

Funciona realmente: web pública local y compilación estática con sus recursos.
Pendiente de contenido del restaurante: dirección, teléfono, redes sociales,
horarios, precios y disponibilidad. Pendiente para otras fases: Supabase real,
reservas, autenticación, administración, RLS y despliegue. No se han añadido
migraciones ni afirmado conexión a Supabase o Netlify.

## Fase 1 — Estructura y configuración

Inspección: carpeta de trabajo vacía y un único adjunto de texto. No se han
encontrado las tres imágenes originales ni credenciales de servicios.

Implementado: React, Vite, TypeScript estricto, React Router, cliente Supabase
opcional, rutas públicas, ruta administrativa informativa, diseño provisional
responsive y aviso explícito de demostración local. Los dos platos se muestran
sin inventar precios, disponibilidad ni fotografías.

Archivos: package.json y package-lock.json; index.html; tsconfig.json;
vite.config.ts; src/main.tsx, App.tsx, styles.css y lib/supabase.ts;
.env.example, .gitignore, README.md, public/images/README.md,
supabase/README.md, playwright.config.ts y tests/e2e/foundation.spec.ts.

Comprobaciones ejecutadas: instalación npm satisfactoria, auditoría de instalación
sin vulnerabilidades y `npm.cmd run build` correcto (incluye TypeScript).
Pruebas Playwright: 6 superadas en Chromium. Navegación pública, pantallas
informativas de reservas y administración, ruta inexistente y comprobación
de desbordamiento horizontal en cinco rutas a 320, 390, 768 y 1440 px.
Estas comprobaciones no sustituyen una revisión visual ni pruebas de backend.
El ejecutor permaneció activo tras informar los seis casos correctos y se
interrumpió durante el cierre; no se obtuvo un cierre normal de la suite.

Funciona realmente: navegación, rutas directas con Vite, carta provisional,
páginas informativas y compilación estática en dist/.

Pendiente: recibir logotipo y fotografías originales para completar fase 2.
No hay todavía base de datos, reservas, autenticación, gestión administrativa,
políticas RLS, calendario ni publicación. La fase 1 no acredita ninguna de estas
funcionalidades. No se ha verificado conexión a Supabase ni Netlify.

Referencias técnicas consultadas:
- https://vite.dev/guide/
- https://supabase.com/docs/reference/javascript/initializing
- https://supabase.com/docs/guides/getting-started/api-keys
