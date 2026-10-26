import { useEffect, useRef, useState } from 'react'
import { publishableKey, supabase, supabaseUrl, turnstileSiteKey } from '../lib/supabase'
import { friendlyError, madridDay, rpc, type BookingConfig } from '../lib/reservations'
import { isDemo } from '../demo/mode'
import { demoSubmit } from '../demo/store'
import { Turnstile } from './Turnstile'

export function ReservationForm() {
  const [config,setConfig] = useState<BookingConfig | null>(null)
  const [date,setDate] = useState(''), [guests,setGuests] = useState(''), [time,setTime] = useState('')
  const [slots,setSlots] = useState<string[]>([]), [slotLoading,setSlotLoading] = useState(false)
  const [token,setToken] = useState(''), [captchaReset,setCaptchaReset] = useState(0)
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [success,setSuccess] = useState('')
  const inFlight = useRef(false), idempotency = useRef({ fingerprint:'', id:'' })
  const ready = Boolean(config?.enabled && (isDemo || (supabase && turnstileSiteKey)))
  const verified = isDemo || Boolean(token)
  const minDate = madridDay()
  useEffect(() => {
    if (!supabase && !isDemo) return
    let active = true
    rpc<BookingConfig>('public_booking_config').then(value => { if (active) setConfig(value) }).catch(() => { if (active) setError('No se pudo consultar el servicio de reservas. Recarga la página para volver a intentarlo.') })
    return () => { active=false }
  }, [])
  useEffect(() => {
    setTime(''); setSlots([])
    if (!ready || !date || !Number.isInteger(Number(guests)) || Number(guests)<1 || Number(guests)>(config?.max_guests ?? 0)) { setSlotLoading(false); return }
    let active = true; setSlotLoading(true)
    const timer = setTimeout(() => rpc<string[]>('booking_slots',{p_date:date,p_guests:Number(guests)}).then(value => { if (active) setSlots(value) }).catch(() => { if (active) setError('No se pudieron consultar los horarios. Prueba con otra fecha o recarga la página.') }).finally(() => { if (active) setSlotLoading(false) }), 250)
    return () => { active=false; clearTimeout(timer) }
  }, [ready,date,guests,config?.max_guests])

  if (success) return <div className="form-panel" role="status"><h3>Solicitud recibida</h3><p>{success}</p><p>La reserva requiere confirmación manual del restaurante.</p><button className="button" type="button" onClick={() => { setSuccess(''); setDate(''); setTime(''); setGuests(''); idempotency.current={fingerprint:'',id:''} }}>Nueva solicitud</button></div>
  return <div className="form-panel"><div id="reservation-notice" className="notice"><strong>{ready ? 'Tu solicitud quedará pendiente de confirmación' : 'Reservas online todavía no disponibles'}</strong><p>{ready ? 'El restaurante revisará tu solicitud. Enviarla no significa que la mesa esté confirmada.' : 'Este formulario es una vista previa. No envía ni guarda datos y no comprueba disponibilidad.'}</p></div>
    {error && <p className="feedback error" role="alert">{error}</p>}
    <form aria-label={ready ? 'Solicitud de reserva' : 'Vista previa del formulario de reservas'} aria-describedby="reservation-notice" onSubmit={async event => {
      event.preventDefault()
      if (!ready || !config || !verified || inFlight.current) return
      const form = event.currentTarget, values = new FormData(form)
      const data = {date,time,guests:Number(guests),name:String(values.get('name') ?? '').trim(),phone:String(values.get('phone') ?? '').trim(),notes:String(values.get('notes') ?? ''),privacy_accepted:values.get('privacy')==='on',privacy_version:config.privacy_version}
      const fingerprint = JSON.stringify(data)
      if (fingerprint!==idempotency.current.fingerprint) idempotency.current={fingerprint,id:crypto.randomUUID()}
      inFlight.current=true; setBusy(true); setError('')
      try {
        if (isDemo) {
          const result=await demoSubmit({...data,request_id:idempotency.current.id,website:values.get('website') ?? ''})
          setSuccess(result.message);form.reset();return
        }
        const response = await fetch(`${supabaseUrl}/functions/v1/reserve`,{method:'POST',headers:{'Content-Type':'application/json',apikey:publishableKey},body:JSON.stringify({...data,request_id:idempotency.current.id,token,website:values.get('website') ?? ''}),signal:AbortSignal.timeout(20000)})
        const result = await response.json() as {message?: string}
        if (!response.ok) { setError(result.message || 'No se pudo enviar la solicitud. Inténtalo más tarde.'); return }
        setSuccess(result.message || 'Tu solicitud se ha recibido y está pendiente de confirmación por el restaurante.'); form.reset()
      } catch (error) { setError(isDemo ? friendlyError(error) : 'No se pudo comprobar si la solicitud llegó. Puedes reintentarlo: no se duplicará si llegó correctamente.') }
      finally { inFlight.current=false; setBusy(false); setToken(''); setCaptchaReset(value=>value+1) }
    }}>
      <fieldset disabled={busy}><legend className="visually-hidden">Datos de la solicitud</legend><div className="form-grid">
        <label>Fecha<input type="date" name="date" min={minDate} max={config ? new Date(Date.parse(`${minDate}T12:00:00Z`)+config.horizon_days*86400000).toISOString().slice(0,10) : undefined} value={date} onChange={event=>setDate(event.target.value)} required /></label>
        <label>Hora{ready ? <select name="time" value={time} onChange={event=>setTime(event.target.value)} required disabled={slotLoading || !slots.length}><option value="">{slotLoading ? 'Buscando horarios…' : !date || !guests ? 'Elige fecha y comensales' : slots.length ? 'Selecciona una hora' : 'Sin horarios disponibles'}</option>{slots.map(slot=><option key={slot}>{slot}</option>)}</select> : <input type="time" name="time" value={time} onChange={event=>setTime(event.target.value)} required aria-describedby="time-help" />}</label>
        <p className="field-help full-width" id="time-help">{ready ? 'Solo se muestran turnos con disponibilidad. Se volverá a comprobar al enviar.' : 'Horarios y disponibilidad pendientes de configurar.'}</p>
        <label>Número de comensales<input type="number" name="guests" min="1" max={ready ? config?.max_guests : undefined} step="1" value={guests} onChange={event=>setGuests(event.target.value)} placeholder="¿Cuántos venís?" required /></label>
        <label>Nombre<input type="text" name="name" autoComplete="off" minLength={2} maxLength={100} placeholder={isDemo ? 'Nombre ficticio' : 'Tu nombre'} defaultValue={isDemo ? 'Cliente de prueba' : undefined} required /></label>
        <label className="full-width">Teléfono<input type="tel" name="phone" autoComplete="off" minLength={7} maxLength={30} placeholder={isDemo ? 'Teléfono ficticio' : 'Tu teléfono de contacto'} defaultValue={isDemo ? '000000000' : undefined} required /></label>
        <label className="full-width">Observaciones <span className="optional">(opcional)</span><textarea name="notes" rows={3} maxLength={1000} placeholder="¿Algo que debamos tener en cuenta?" /></label>
      </div><div className="honeypot" aria-hidden="true"><label>Deja este campo vacío<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {ready ? <><details className="privacy-details"><summary>Información sobre el tratamiento de tus datos</summary><p>Responsable: {config?.privacy_controller}</p><p>Contacto: {config?.privacy_contact}</p><p className="preserve-lines">{config?.privacy_notice}</p>{!isDemo&&<p>Comprobación de seguridad mediante Cloudflare Turnstile.</p>}</details><label className="checkbox-label"><input type="checkbox" name="privacy" required /> He leído la información de privacidad.</label>{isDemo ? <p className="notice">DEMO · Solo datos ficticios. Sin captcha ni envíos reales. Las solicitudes se guardan únicamente en este navegador.</p> : <Turnstile siteKey={turnstileSiteKey} onToken={setToken} reset={captchaReset} />}</> : <p className="form-privacy">Vista previa sin envío. Evita introducir datos personales reales.</p>}
      <button className="button submit-button" type="submit" disabled={!ready || !verified || busy || !time || slotLoading}>{busy ? 'Enviando solicitud…' : ready ? 'Solicitar reserva' : 'Solicitar reserva · Próximamente'}</button></fieldset>
    </form>
  </div>
}
