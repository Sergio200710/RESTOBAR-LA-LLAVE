export interface ReservationInput {
  request_id: string; date: string; time: string; guests: number; name: string; phone: string; notes: string;
  privacy_accepted: boolean; privacy_version: number; token: string; website?: string;
}
export function validateReservation(value: unknown): value is ReservationInput {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.request_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.request_id)
    && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)
    && typeof v.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)
    && Number.isInteger(v.guests) && Number(v.guests) >= 1 && Number(v.guests) <= 100
    && typeof v.name === 'string' && v.name.trim().length >= 2 && v.name.trim().length <= 100
    && typeof v.phone === 'string' && /^\+?[0-9]{7,15}$/.test(v.phone.replace(/[\s().-]/g, ''))
    && typeof v.notes === 'string' && v.notes.length <= 1000 && v.privacy_accepted === true
    && Number.isInteger(v.privacy_version) && Number(v.privacy_version) > 0
    && typeof v.token === 'string' && v.token.length > 0 && v.token.length <= 2048
    && (v.website === undefined || v.website === '')
}

export interface HandlerDependencies {
  origins: string[]
  secret: string
  salt: string
  verify: (token: string) => Promise<{ success: boolean; hostname?: string; action?: string }>
  registerAttempt: (data: Omit<ReservationInput, 'token' | 'website'>, networkHash: string, contactHash: string) => Promise<{ allowed: boolean; retry_after: number }>
  save: (data: Omit<ReservationInput, 'token' | 'website'>, networkHash: string, contactHash: string) => Promise<{ error: { message: string } | null }>
}

export function createReservationHandler(deps: HandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') ?? ''
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      ...(deps.origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) }
    const reply = (status: number, message: string, extraHeaders: Record<string,string> = {}) => Response.json({ message }, { status, headers: { ...headers, ...extraHeaders } })
    if (!deps.origins.includes(origin)) return reply(403, 'No se permite esta solicitud.')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, apikey', 'Access-Control-Max-Age': '600' } })
    if (request.method !== 'POST') return reply(405, 'Utiliza el formulario de reservas.')
    if (!deps.secret || deps.salt.length < 32 || !deps.origins.length) return reply(503, 'Las reservas todavía no están disponibles.')
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, 'Formato de solicitud incorrecto.')
    try {
      // Read incrementally: Content-Length may be missing or forged.
      const reader = request.body?.getReader()
      if (!reader) return reply(400, 'Revisa los datos de la solicitud.')
      let size = 0; const chunks: Uint8Array[] = []
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 10000) { await reader.cancel(); return reply(413, 'La solicitud es demasiado larga.') }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return reply(400, 'Revisa los datos de la solicitud.') }
      if (!validateReservation(input)) return reply(400, 'Revisa los datos de la solicitud.')
      const verification = await deps.verify(input.token)
      if (!verification.success || verification.action !== 'reserve' || verification.hostname !== new URL(origin).hostname) return reply(400, 'Completa de nuevo la comprobación de seguridad.')
      const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(deps.salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('')
      // IP quota is an extra layer; Turnstile and the contact quota remain mandatory.
      // Deploy only behind Supabase's managed proxy; never trust client IP headers for authorization.
      const network = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
      const { token: _token, website: _website, ...data } = input
      data.phone = data.phone.replace(/[\s().-]/g, '')
      const networkHash = await hash(`ip:${network}`), contactHash = await hash(`phone:${data.phone}`)
      // Await an independent, committed RPC. Do NOT wrap registration + booking
      // in one SQL function/transaction: the booking may intentionally roll back.
      const attempt = await deps.registerAttempt(data, networkHash, contactHash)
      if (!attempt.allowed) return reply(429, 'Has enviado varias solicitudes. Espera un momento antes de intentarlo de nuevo.', { 'Retry-After': String(attempt.retry_after) })
      const result = await deps.save(data, networkHash, contactHash)
      if (result.error) {
        const message = result.error.message
        if (message.includes('E_RATE')) return reply(429, 'Has enviado varias solicitudes. Espera un momento antes de intentarlo de nuevo.')
        if (/E_(FULL|HOUR|CLOSED|DATE)/.test(message)) return reply(409, 'Ese horario ya no está disponible. Elige otra fecha u hora.')
        if (message.includes('E_DISABLED')) return reply(503, 'Las reservas no están disponibles en este momento.')
        if (message.includes('E_PRIVACY')) return reply(409, 'La información de privacidad ha cambiado. Recarga la página antes de continuar.')
        return reply(400, 'No se pudo registrar la solicitud. Revisa los datos o inténtalo más tarde.')
      }
      return reply(200, 'Tu solicitud se ha recibido y está pendiente de confirmación por el restaurante. Tu mesa todavía no está confirmada.')
    } catch { return reply(503, 'No podemos procesar la solicitud en este momento. Inténtalo más tarde.') }
  }
}
