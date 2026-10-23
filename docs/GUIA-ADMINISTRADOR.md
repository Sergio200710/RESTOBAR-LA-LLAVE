# Guía del administrador — Restobar La Llave

Esta guía es para el propietario y el equipo autorizado. No necesitas editar
código para gestionar las reservas, mesas, horarios o cierres.

**Antes del estreno:** el responsable técnico debe completar la conexión y las
pruebas de entrega. Si aparece «Panel pendiente de conexión segura», el servicio
todavía no está preparado para trabajar con reservas reales.

## Entrar y salir

1. Abre la web del restaurante y pulsa **Administración** al final, o añade
   `/admin` a su dirección. Puedes guardar esa dirección en tu móvil.
2. Introduce tu propio correo y contraseña y pulsa **Entrar**.
3. Si aparece que no tienes autorización, pide al responsable de la entrega
   que revise el permiso de tu cuenta. Crear una cuenta no concede ese permiso.
4. Al terminar, pulsa **Cerrar sesión**, especialmente en un dispositivo compartido.

No compartas tu contraseña. Si otra persona necesita entrar, debe tener su propia
cuenta autorizada. Guarda los datos de recuperación de tu correo de forma segura.

## Si olvidas la contraseña

1. En la pantalla de acceso, abre **He olvidado mi contraseña**.
2. Escribe el correo de tu cuenta y pulsa **Solicitar enlace seguro**.
3. Revisa tu correo y la carpeta de no deseado.
4. Abre el enlace en el mismo navegador donde lo solicitaste.
5. Elige una contraseña nueva de al menos 12 caracteres y repítela.
6. Guarda el cambio e inicia sesión con la contraseña nueva.

Si el enlace ha caducado o cambiaste de navegador, solicita uno nuevo. Si no
llega el correo, contacta con la persona responsable del servicio. Nunca envíes
tu contraseña por mensajes ni facilites claves de Supabase.

## Revisar solicitudes

Al entrar verás tarjetas con pendientes, confirmadas, rechazadas, canceladas y
reservas del día. Pulsa una tarjeta para filtrar el listado.

En **Reservas** puedes buscar por nombre y filtrar por fecha y estado. **Limpiar
filtros** vuelve al listado completo. **Actualizar datos** consulta los cambios
más recientes. Si hay muchas reservas, usa **Anteriores** y **Siguientes**.

Cada ficha muestra cliente, teléfono, fecha, hora, personas, mesa y observaciones.
Pulsa el teléfono si quieres llamar desde tu móvil. La web no envía correos ni
otros avisos de reservas al cliente: la comunicación debe hacerla el restaurante.

## Qué significa cada estado

| Estado | Qué debes saber |
| --- | --- |
| PENDIENTE | Es una solicitud recibida; la mesa todavía no está confirmada al cliente. Bloquea capacidad mientras la revisas. |
| CONFIRMADA | El restaurante ha aceptado la reserva manualmente. |
| RECHAZADA | El restaurante no acepta la solicitud; su mesa queda libre. |
| CANCELADA | Se ha anulado la reserva o solicitud; su mesa queda libre. |

Las pendientes no caducan automáticamente: revísalas con frecuencia.

## Confirmar, rechazar o cancelar

1. Busca la solicitud correcta y comprueba fecha, hora y personas.
2. Pulsa **Confirmar**, **Rechazar** o **Cancelar**, según corresponda.
3. Revisa el aviso y pulsa **Sí, guardar cambio**. **Volver** no cambia nada.
4. Comprueba que aparece el nuevo estado.

El sistema vuelve a comprobar la disponibilidad antes de confirmar. Si indica
que no hay capacidad, no se confirma. Una reserva confirmada puede cancelarse;
las solicitudes rechazadas o canceladas no se reabren. Si el cliente quiere
volver a reservar, debe hacer una nueva solicitud.

## Cambiar fecha, hora o personas

1. Pulsa **Ver detalles / Modificar** en una reserva pendiente o confirmada.
2. Modifica los campos y pulsa **Guardar cambios**.
3. Si hay conflicto con horarios, cierres o mesas, el cambio no se guarda.
4. Si otra persona ya la modificó, pulsa **Actualizar datos** y revisa la ficha.

## Usar el calendario

En **Calendario**, las flechas cambian de mes. Los colores indican los estados
y los números indican cuántas reservas hay. Pulsa un día para ver el listado
de ese día con las horas y detalles. Todas las horas corresponden a Madrid.

## Configurar mesas y horarios

Entra en **Mesas y horarios**. Antes de abrir las reservas online:

1. Añade cada mesa con su nombre, capacidad real y disponibilidad.
2. Añade las franjas de cada día: apertura, cierre, separación entre horarios
   ofrecidos y duración estimada de cada reserva.
3. Añade los días de cierre excepcionales. Los rangos incluyen ambos extremos.
4. Completa responsable, contacto e información de privacidad del restaurante.
5. Activa **Activar solicitudes online** y guarda la configuración.

Para cambiar una mesa o franja existente pulsa **Editar**. Puedes desactivarla
temporalmente. Si hay reservas activas afectadas, el sistema te pedirá revisarlas
primero y conservará la configuración anterior.

Cada grupo se asigna a una sola mesa con capacidad suficiente. El sistema no
junta mesas automáticamente. Una reserva debe caber completa en su franja:
no se permiten reservas que crucen medianoche. Si abres de madrugada, configura
una franja independiente en el día siguiente.

Los cierres bloquean días completos. Para reabrirlos, pulsa **Quitar cierre**
y confirma la acción. No es necesario cambiar todos los horarios habituales.

## Si algo falla

- **No hay horarios disponibles:** revisa mesas activas, capacidades, franjas,
  duración completa del turno, cierres y solicitudes que ya ocupan capacidad.
- **Otra persona ha cambiado la reserva:** actualiza el listado y vuelve a revisar.
- **No se pudo completar la operación:** comprueba tu conexión y actualiza datos
  antes de reintentar. No supongas que un cambio quedó guardado.
- **Reservas online no disponibles:** comprueba el interruptor de activación,
  mesas y horarios. Si sigue igual, debe revisarse la conexión por el soporte técnico.
- **Enlace de recuperación no válido:** pide otro desde el mismo navegador.

La configuración técnica inicial y la gestión de permisos las hace el responsable
del servicio. El propietario debe conservar el control de sus cuentas, proyectos,
dominio y facturación según el documento de entrega.
