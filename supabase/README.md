# Backend de reservas

Migraciones en orden:
1. `202610230001_reservations.sql`: reservas, mesas, franjas, cierres, configuración,
   administradores autorizados, eventos, RLS, idempotencia, cuotas y funciones
   transaccionales de disponibilidad y edición.
2. `202610230002_admin_queries.sql`: listado paginado, dashboard y calendario
   autorizados exclusivamente para administradores.

No se han aplicado a un proyecto remoto. `npm.cmd run test:db` las aplica y prueba
en PostgreSQL embebido con un sustituto local mínimo del esquema Auth.

La función pública `reserve` verifica Turnstile y llama a la RPC de creación
con credenciales de servidor. No hay lectura anónima de datos personales,
confirmación automática ni gestión de carta/precios. Las funciones administrativas
verifican `admin_users`, no metadatos del usuario ni su mero inicio de sesión.

Todos los cambios de capacidad, reservas y horarios comparten un bloqueo
transaccional; una restricción de exclusión protege además la asignación física.
Las pendientes consumen mesa. No se combinan mesas ni se crean turnos de ejemplo.
Las franjas no admiten reservas que crucen medianoche.

Ver el README principal para variables, despliegue, primer administrador y
programación de mantenimiento. No guardar secretos en archivos versionados.
