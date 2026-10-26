# Preparación de la primera reserva real

Proyecto: `bdgtlonduwffyxvkcadi`. Pruebas acordadas en
`http://127.0.0.1:5173`. Reservas desactivadas; no se autoriza su activación
por el mero hecho de completar esta preparación.

## Configuración comprobada

- Claves públicas presentes y con formato correcto, sin mostrar valores.
- Se corrigió únicamente la URL en `.env.local` al proyecto autorizado,
  conservando las claves. Los archivos privados siguen ignorados por Git.
- Con la clave publicable real, `public_booking_config` responde 200 y devuelve
  solicitudes desactivadas. `reserve` responde 400 a JSON vacío con CORS local
  correcto, sin crear reservas ni consumir cuota. No se ha enviado un token real.
- Navegador Chromium con el frontend real y Supabase sin interceptar: RPC 200,
  formulario bloqueado, ruta /admin con acceso visible y móvil de 390 px sin
  desbordamiento. Dos intentos iniciales con un selector por texto agotaron su
  espera; la comprobación posterior con selectores estructurales pasó.
  No se ha verificado todavía la Site key con un token real: únicamente formato.
- Auth responde 200 y tiene correo habilitado, pero el registro público sigue
  habilitado. Debe desactivarse durante la configuración del acceso privado,
  mediante una operación autorizada; no se ha modificado automáticamente.
- Sigue habiendo cero administradores, mesas y franjas activas; privacidad
  incompleta y `reservations_enabled=false`.

## Datos mínimos que debe facilitar el propietario

| Dato | Información necesaria |
| --- | --- |
| Cuenta | Correo propio al que tendrá acceso el propietario; nunca contraseña |
| Mesas | Identificador/nombre de cada mesa y capacidad, o cantidad por capacidad |
| Días de apertura | Días de la semana y cada franja de apertura/cierre |
| Duración | Minutos que ocupa una reserva |
| Separación de turnos | Cada cuántos minutos puede comenzar una reserva |
| Cierres | Días de cierre excepcional, si los hay |
| Privacidad | Responsable, contacto y texto de información al cliente |

No se han inventado ni guardado mesas, horarios ni capacidades. Las solicitudes
pendientes ocupan mesa. No se combinan mesas automáticamente. La duración completa
debe caber en la franja; una franja que cruza medianoche se divide en dos días.
El panel actual permite introducir estos datos sin modificar código.

## Preparación del acceso del propietario

Cuando se conozca su correo y se autoricen esas operaciones:

1. Desactivar el registro público en Auth. Conservar correo/contraseña; no crear
   cuentas públicas ni contraseñas predeterminadas.
2. Comprobar en Auth la Site URL `http://127.0.0.1:5173` y permitir exactamente
   `http://127.0.0.1:5173/admin/recuperar`. La configuración local de CLI no
   demuestra que esos valores estén aplicados en remoto.
3. Comprobar que Auth puede entregar el correo al propietario, configurar el
   proveedor necesario e invitar su cuenta con enlace seguro. Esto no añade
   notificaciones de reservas por correo.
4. Verificar la cuenta exacta y asignar su UUID a `public.admin_users` desde
   una operación privilegiada autorizada. Nunca usar los metadatos de usuario
   como permiso de administrador.
5. El propietario establece su contraseña e inicia sesión personalmente en
   /admin. Verificar recuperación y cierre de sesión sin compartir contraseñas.

El alta/invitación y la asignación administrativa son escrituras remotas
pendientes de autorización, no acciones realizadas en esta preparación.

## Prueba pendiente de autorización

Tras configurar el acceso, mesas/horarios y privacidad, mantener el checkbox
de activación desmarcado hasta recibir autorización explícita para las pruebas.
La habilitación es global en el backend; CORS local no equivale a acceso privado.
Después se probará una solicitud con datos de prueba acordados, captcha real,
estado PENDIENTE y gestión manual del propietario. No publicar en Netlify ni
dejar solicitudes activadas como efecto de esta preparación.

Referencias:
- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/guides/auth/redirect-urls
- `GUIA-ADMINISTRADOR.md` y `TURNSTILE-RESERVE.md`.
