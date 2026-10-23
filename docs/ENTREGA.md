# Entrega al restaurante y activación

Esta lista aún no está completada. No se ha creado la cuenta real del propietario,
conectado Supabase, publicado en Netlify ni transferido ningún dominio.

## Control de los servicios

Crear desde el principio las cuentas y organizaciones bajo control del restaurante.
El propietario utiliza su correo, recuperación y autenticación de dos factores.
El desarrollador recibe una invitación con los permisos necesarios durante el
trabajo; no se intercambian contraseñas, códigos de recuperación ni claves secretas.

- **Supabase:** invitar al propietario a la organización con rol Owner y verificar
  aceptación y acceso. Si el proyecto nació en una organización personal, transferirlo
  a la del restaurante usando las opciones oficiales y revisar los requisitos
  vigentes de transferencia. Revisar plan, facturación y miembros antes de retirar
  al desarrollador. El rol Owner de la plataforma no sustituye el permiso en
  `public.admin_users` para entrar en la aplicación.
- **Netlify:** el sitio y facturación deben pertenecer al equipo del restaurante.
  Una vez autorizada la publicación, invitar al propietario y, si procede,
  transferir el proyecto al equipo de destino. El repositorio y su conexión de
  despliegue también deben quedar bajo control del restaurante.
- **Dominio:** el registrante, correo de renovación, acceso al registrador y pagos
  deben ser del restaurante. Usar el procedimiento de transferencia del proveedor
  y sus autorizaciones oficiales. Un cambio de DNS no transfiere la titularidad.
  Conservar DNS y correo existentes durante el cambio y verificar la web antes
  de retirar accesos anteriores.
- **Cloudflare Turnstile y correo de acceso:** usar cuentas/proveedor del restaurante
  o transferir control mediante sus mecanismos oficiales. Las claves secretas se
  guardan en el gestor de secretos del proyecto, sin pasarlas por chat o repositorio.

Documentación de referencia:
[roles Supabase](https://supabase.com/docs/guides/platform/access-control),
[transferir proyectos Supabase](https://supabase.com/docs/guides/platform/project-transfer),
[transferir proyectos Netlify](https://docs.netlify.com/manage/projects/transfer-project/)
y [transferir dominios en Netlify](https://docs.netlify.com/manage/domains/manage-domains/transfer-a-domain/).
Consultar el flujo de transferencia vigente de Netlify y del registrador elegido
cuando existan esos recursos; todavía no se ha elegido ni conectado un dominio.

## Preparación técnica previa

- Aplicar ambas migraciones a un proyecto de pruebas y revisar RLS y privilegios.
- Configurar las tres variables públicas del frontend y los secretos de Edge
  Functions indicados en README, sin mezclar claves públicas y privadas.
- Configurar Turnstile para los hostnames permitidos y comprobar su validación
  real en servidor, expiración y reutilización de tokens.
- Desplegar la función `reserve` en Supabase cuando se autorice la activación.
- Desactivar el registro público de Auth y permitir las URL de recuperación exactas.
- Configurar proveedor de correo de Auth, probar entrega y recuperación PKCE
  en el mismo navegador; no hay notificaciones de reservas por correo.
- Invitar al propietario a Auth, verificar su identidad y asignar su UUID a
  `admin_users` mediante SQL privilegiado. Nada de contraseñas predeterminadas.
- Configurar mesas, horarios, cierres y duración reales con el propietario.
- Revisar información de privacidad, proveedores, conservación y copias de seguridad.
- Programar `public.maintenance_cleanup()` diariamente en Supabase Cron y comprobar
  que elimina los datos de prueba caducados. Revisar también retención de backups.
- Mantener solicitudes públicas desactivadas hasta completar las pruebas reales.

## Prueba de aceptación con el propietario

El propietario debe realizar personalmente estos pasos desde su móvil y con su
propia cuenta. Registrar fecha, responsable, resultado e incidencias, sin anotar
contraseñas ni datos personales innecesarios en este documento.

1. Iniciar sesión sin usar la sesión ni la cuenta del desarrollador.
2. Recuperar su contraseña y acceder de nuevo con la elegida por él.
3. Crear o editar una mesa, una franja y un cierre con los datos acordados.
4. Solicitar una reserva de prueba desde otro navegador sin sesión.
5. Comprobar que aparece como PENDIENTE y que el cliente no recibe confirmación definitiva.
6. Confirmarla manualmente y verificar el estado en la aplicación y Supabase.
7. Probar rechazo y cancelación con nuevas solicitudes.
8. Cambiar fecha, hora y personas; comprobar la protección frente a conflicto.
9. Solicitar la misma plaza desde dos navegadores simultáneamente; comprobar que
   solo persiste una asignación compatible. Repetir con dos administradores y edición obsoleta.
10. Verificar por REST que anónimos y usuarios sin rol no pueden leer reservas,
    modificar estados o concederse permisos. No basta con ocultar botones.
11. Comprobar calendario, búsquedas, filtros y cierre de sesión.
12. Revocar la cuenta temporal de pruebas y confirmar que pierde acceso.
13. Revisar que las tres imágenes son las originales y no hay nombres inventados.

Estos pasos contra los servicios reales siguen pendientes. Las pruebas locales
automatizadas no completan esta aceptación por sí solas.

## Cierre de entrega

- Entregar al restaurante el repositorio, guías y acceso a copias de seguridad.
- Confirmar que puede gestionar reservas, horarios, cierres y mesas sin editar código.
- Verificar propiedad y facturación de Supabase, Netlify, dominio, Turnstile y correo.
- Autorizar por escrito la publicación; configurar HTTPS, redirección SPA y URL
  definitivas en Auth, CORS y Turnstile antes de activar el formulario.
- Retirar accesos personales del desarrollador que ya no sean necesarios. Revocar
  administradores de prueba y rotar secretos que hubieran estado bajo su control,
  coordinando el cambio en los entornos para evitar cortes.
- Conservar un contacto de soporte elegido por el restaurante y un inventario
  de servicios sin contraseñas. La aplicación no depende de una cuenta personal
  del desarrollador para ejecutarse una vez entregada.

Estado actual: **pendiente de conexión y de aceptación del propietario**.
