import { supabase } from './supabase'

export const statuses = ['PENDIENTE','CONFIRMADA','RECHAZADA','CANCELADA'] as const
export type ReservationStatus = typeof statuses[number]
export interface ReservationRow {
  id: string; customer_name: string; phone: string; notes: string; guests: number; table_id: string;
  starts_at: string; ends_at: string; status: ReservationStatus; updated_at: string;
}
export interface RestaurantSettings {
  id: number; reservations_enabled: boolean; horizon_days: number; retention_days: number;
  privacy_controller: string; privacy_contact: string; privacy_notice: string; privacy_version: number;
}
export interface BookingConfig extends Omit<RestaurantSettings,'id'|'reservations_enabled'|'retention_days'> { enabled: boolean; max_guests: number }
export interface RestaurantTable { id: string; name: string; capacity: number; active: boolean }
export interface OpeningHours { id: string; weekday: number; opens: string; closes: string; step_minutes: number; duration_minutes: number; active: boolean }
export interface Closure { id: string; starts_on: string; ends_on: string; reason: string }
export interface CalendarCount { day: string; status: ReservationStatus; count: number }

export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : ''
  if (message.includes('E_FORBIDDEN')) return 'No tienes autorización para realizar esta operación.'
  if (message.includes('E_STALE')) return 'Otra persona ha cambiado esta reserva. Actualiza el listado antes de continuar.'
  if (message.includes('E_BOOKED_CONFIG')) return 'Este cambio afecta a reservas pendientes o confirmadas. Revísalas antes de cambiar la configuración.'
  if (/E_(FULL|HOUR|DATE|CLOSED)/.test(message)) return 'No hay disponibilidad para esa fecha, hora y número de comensales.'
  if (message.includes('E_STATE')) return 'No se puede realizar ese cambio de estado.'
  if (message.includes('E_PRIVACY')) return 'La información de privacidad ha cambiado. Recarga la página.'
  if (/constraint|invalid input|E_INVALID/.test(message)) return 'Revisa los campos. Puede haber datos incompletos o franjas que se solapan.'
  return 'No se pudo completar la operación. Comprueba tu conexión y vuelve a intentarlo.'
}
export async function rpc<T>(name: string, parameters?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Servicio no configurado')
  const { data, error } = await supabase.rpc(name, parameters).abortSignal(AbortSignal.timeout(15000))
  if (error) throw error
  return data as T
}
export function madridDay(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit' }).format(value)
}
export function madridTime(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hour12:false }).format(new Date(value))
}
export const weekdays = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
