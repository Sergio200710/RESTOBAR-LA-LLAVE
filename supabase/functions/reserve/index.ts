import { createClient } from '@supabase/supabase-js'
import { createReservationHandler } from '../_shared/reserve-handler.ts'

const secret = Deno.env.get('TURNSTILE_SECRET_KEY') ?? ''
const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
Deno.serve(createReservationHandler({
  origins: (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean),
  secret,
  salt: Deno.env.get('RATE_LIMIT_SALT') ?? '',
  verify: async token => {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token }), signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error('Security verification unavailable')
    return response.json()
  },
  registerAttempt: async (data, networkHash, contactHash) => {
    const { data: result, error } = await client.rpc('register_reservation_attempt', { p_data: data, p_network_hash: networkHash, p_contact_hash: contactHash })
    // Fail closed if migration 003 is missing or the decision is malformed.
    if (error || typeof result?.allowed !== 'boolean' || !Number.isInteger(result?.retry_after) || result.retry_after < 0 || result.retry_after > 900 || (!result.allowed && result.retry_after < 1)) throw new Error('Attempt registration unavailable')
    return { allowed: result.allowed, retry_after: result.retry_after }
  },
  save: async (data, networkHash, contactHash) => {
    const { data: result, error } = await client.rpc('create_reservation_request', { p_data: data, p_network_hash: networkHash, p_contact_hash: contactHash })
    return { error: error ?? (result?.received === true ? null : { message: 'Unexpected database response' }) }
  },
}))
