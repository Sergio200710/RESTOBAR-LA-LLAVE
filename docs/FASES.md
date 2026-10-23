# Registro de fases

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
