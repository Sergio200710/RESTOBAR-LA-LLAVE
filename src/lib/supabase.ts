import { createClient } from '@supabase/supabase-js'
import { isDemo } from '../demo/mode'

export const supabaseUrl = isDemo ? '' : import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const publishableKey = isDemo ? '' : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
export const turnstileSiteKey = isDemo ? '' : import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? ''
let validUrl = false
try { const parsed = new URL(supabaseUrl); validUrl = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname)) } catch { /* No configuration: local preview. */ }

// Solo claves publicables: ninguna clave privilegiada debe llegar al navegador.
export const supabase = validUrl && publishableKey.startsWith('sb_publishable_')
  ? createClient(supabaseUrl, publishableKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export const backendStatus = supabase
  ? 'Configuración Supabase presente; conexión pendiente de verificar.'
  : 'Demostración local · Sin conexión a Supabase. No se guardan reservas.'
