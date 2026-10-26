import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { friendlyError, madridDay, madridTime, rpc, statuses, weekdays, type CalendarCount, type Closure, type OpeningHours, type ReservationRow, type RestaurantSettings, type RestaurantTable } from '../lib/reservations'
import './admin.css'
import { isDemo } from '../demo/mode'
import { DEMO_CHANGED, DEMO_STORAGE, demoConfig, demoTables, demoHours } from '../demo/store'

function MissingConfiguration() {
  return <div className="section admin-page"><p className="eyebrow">ACCESO PRIVADO</p><h1>Administración</h1><div className="notice"><h2>Panel pendiente de conexión segura</h2><p>El servicio todavía no está configurado. No se muestran datos ni se permiten operaciones administrativas.</p></div><p>Cuando se active la conexión segura, podrás:</p><ul><li>Consultar solicitudes pendientes.</li><li>Confirmar, rechazar y cancelar reservas.</li><li>Consultar el calendario.</li><li>Configurar horarios y disponibilidad de mesas.</li></ul><Link className="button" to="/">Volver a la web</Link></div>
}

export default function Admin() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [session,setSession] = useState<Session | null>(null), [ready,setReady] = useState(false), [authorized,setAuthorized] = useState(false), [checking,setChecking] = useState(false)
  const [message,setMessage] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false), [reset,setReset] = useState(false)
  useEffect(() => {
    if (!supabase) return
    let active=true
    supabase.auth.getSession().then(({data,error:sessionError}) => { if(active) { setSession(data.session); setReady(true); if(sessionError) setError('No se pudo recuperar la sesión. Vuelve a iniciar sesión.') } }).catch(()=>{ if(active){setReady(true);setError('No se pudo recuperar la sesión.')} })
    const {data} = supabase.auth.onAuthStateChange((event,value) => { if(active){ setSession(value);setReady(true);if(event==='PASSWORD_RECOVERY') setReset(true) } })
    return () => { active=false;data.subscription.unsubscribe() }
  },[])
  useEffect(() => {
    let active=true; setAuthorized(false)
    if(!session || !supabase) return
    setChecking(true)
    const client=supabase
    ;(async()=>{
      try {
        const {error:userError} = await client.auth.getUser()
        if(userError) throw userError
        const allowed=await rpc<boolean>('is_admin')
        if(active){setAuthorized(allowed); if(!allowed)setError('Esta cuenta no está autorizada para administrar el restaurante.')}
      } catch { if(active) setError('No se pudo verificar tu acceso. Vuelve a iniciar sesión.') }
      finally{if(active)setChecking(false)}
    })()
    return()=>{active=false}
  },[session?.user.id,session?.access_token])

  if(!supabase) return <MissingConfiguration />
  const client=supabase
  const signOut = async () => {
    setBusy(true);setError('')
    const {error:signOutError} = await client.auth.signOut({scope:'local'})
    if(signOutError) setError('No se pudo cerrar la sesión. Inténtalo de nuevo.')
    else {setSession(null);setAuthorized(false);setMessage('Sesión cerrada.');setReset(false)}
    setBusy(false)
  }
  if(!ready || checking) return <div className="section admin-page" role="status">Comprobando acceso seguro…</div>
  if(session && authorized && !(reset || pathname==='/admin/recuperar')) return <Dashboard email={session.user.email ?? ''} authError={error} onSignOut={signOut} onRevoked={()=>{setAuthorized(false);setError('Tu cuenta ya no tiene acceso administrativo.')}} />
  return <div className="section admin-page"><div className="auth-panel"><p className="eyebrow">ACCESO PRIVADO</p><h1>Administración</h1>{error && <p className="feedback error" role="alert">{error}</p>}{message && <p className="feedback" role="status">{message}</p>}
    {session && !authorized ? <button className="button" disabled={busy} onClick={signOut}>Cerrar sesión</button> : session && authorized ? <form onSubmit={async event=>{
      event.preventDefault();setBusy(true);setError('');const values=new FormData(event.currentTarget)
      if(values.get('password')!==values.get('repeat')){setError('Las contraseñas no coinciden.');setBusy(false);return}
      const {error:updateError}=await client.auth.updateUser({password:String(values.get('password'))})
      if(updateError)setError('No se pudo cambiar la contraseña. Usa un enlace de recuperación reciente y una contraseña de al menos 12 caracteres.')
      else {await client.auth.signOut({scope:'local'});setSession(null);setReset(false);setMessage('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');navigate('/admin',{replace:true})}
      setBusy(false)
    }}><h2>Cambiar contraseña</h2><label>Nueva contraseña<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><label>Repite la nueva contraseña<input name="repeat" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><button className="button" disabled={busy}>Guardar contraseña</button></form> : <>
      <p>Entra con tu cuenta autorizada del restaurante.</p><form onSubmit={async event=>{
        event.preventDefault();setBusy(true);setError('');setMessage('');const values=new FormData(event.currentTarget)
        try {
          const {error:loginError}=await client.auth.signInWithPassword({email:String(values.get('email')).trim(),password:String(values.get('password'))})
          if(loginError)setError('No se pudo iniciar sesión. Revisa el correo y la contraseña o utiliza la recuperación.')
        } catch {setError('No se pudo contactar con el servicio. Inténtalo más tarde.')} finally{setBusy(false)}
      }}><label>Correo electrónico<input name="email" type="email" autoComplete="username" required maxLength={254} /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label><button className="button" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></form>
      <details className="reset-password"><summary>He olvidado mi contraseña</summary><form onSubmit={async event=>{
        event.preventDefault();setBusy(true);setError('');setMessage('');const values=new FormData(event.currentTarget)
        try {
          const {error:recoveryError}=await client.auth.resetPasswordForEmail(String(values.get('recovery-email')).trim(),{redirectTo:`${window.location.origin}/admin/recuperar`})
          if(recoveryError){setError('No se pudo tramitar la recuperación. Inténtalo más tarde.');return}
          setMessage('Si el correo corresponde a una cuenta válida, recibirás un enlace para cambiar tu contraseña. Revisa también el correo no deseado.')
        }catch{setError('No se pudo tramitar la recuperación. Inténtalo más tarde.')}finally{setBusy(false)}
      }}><label>Correo de recuperación<input name="recovery-email" type="email" autoComplete="email" maxLength={254} required /></label><button className="button secondary" disabled={busy}>Solicitar enlace seguro</button></form></details>
    </>}
    <Link className="text-link" to="/">Volver a la web</Link></div></div>
}

export function Dashboard({ email,authError,onSignOut,onRevoked }: { email:string;authError:string;onSignOut:()=>Promise<void>;onRevoked:()=>void }) {
  const [tab,setTab]=useState('reservas'),[rows,setRows]=useState<ReservationRow[]>([]),[total,setTotal]=useState(0),[offset,setOffset]=useState(0)
  const [date,setDate]=useState(''),[status,setStatus]=useState(''),[search,setSearch]=useState(''),[query,setQuery]=useState('')
  const [counts,setCounts]=useState<Record<string,number>>({}),[calendar,setCalendar]=useState<CalendarCount[]>([]),[month,setMonth]=useState(madridDay().slice(0,7))
  const [tables,setTables]=useState<RestaurantTable[]>([]),[hours,setHours]=useState<OpeningHours[]>([]),[closures,setClosures]=useState<Closure[]>([]),[settings,setSettings]=useState<RestaurantSettings | null>(null)
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[selected,setSelected]=useState<ReservationRow | null>(null)
  const [confirm,setConfirm]=useState<{row:ReservationRow;status:string}|null>(null)
  const loadVersion=useRef(0)
  const load=useCallback(async()=>{
    if(!supabase&&!isDemo)return
    const version=++loadVersion.current
    setLoading(true);setError('')
    try{
      if(!await rpc<boolean>('is_admin')){setRows([]);onRevoked();return}
      const [list,dashboard,cal,t,h,c,s]=await Promise.all([
        rpc<{items:ReservationRow[];total:number}>('admin_reservations',{p_date:date||null,p_status:status||null,p_search:query,p_offset:offset}),
        rpc<Record<string,number>>('admin_dashboard'),rpc<CalendarCount[]>('admin_calendar',{p_month:`${month}-01`}),
        isDemo ? {data:demoTables,error:null} : supabase!.from('restaurant_tables').select('*').order('name'),isDemo ? {data:demoHours,error:null} : supabase!.from('opening_hours').select('*').order('weekday').order('opens'),
        isDemo ? {data:[] as Closure[],error:null} : supabase!.from('exceptional_closures').select('*').order('starts_on'),isDemo ? {data:{...demoConfig,id:1,reservations_enabled:true,retention_days:90},error:null} : supabase!.from('restaurant_settings').select('*').single(),
      ])
      for(const result of [t,h,c,s])if(result.error)throw result.error
      if(version!==loadVersion.current)return
      setRows(list.items);setTotal(list.total);setCounts(dashboard);setCalendar(cal);setTables(t.data ?? []);setHours(h.data ?? []);setClosures(c.data ?? []);setSettings(s.data)
    }catch(value){if(version===loadVersion.current){setRows([]);setError(friendlyError(value))}}finally{if(version===loadVersion.current)setLoading(false)}
  },[date,status,query,offset,month])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    if(!isDemo)return
    const refresh=()=>{void load()}
    const storage=(event:StorageEvent)=>{if(event.key===DEMO_STORAGE||event.key===null)refresh()}
    window.addEventListener(DEMO_CHANGED,refresh);window.addEventListener('storage',storage)
    return()=>{window.removeEventListener(DEMO_CHANGED,refresh);window.removeEventListener('storage',storage)}
  },[load])
  useEffect(()=>{const timer=setTimeout(()=>{setOffset(0);setQuery(search)},300);return()=>clearTimeout(timer)},[search])
  useEffect(()=>{if(selected||confirm){const element=document.querySelector<HTMLElement>('.action-confirmation, .edit-reservation');element?.scrollIntoView({block:'center'});element?.focus({preventScroll:true})}},[selected,confirm])
  const mutate=async(operation:()=>Promise<unknown>,success:string)=>{
    if(busy)return;setBusy(true);setError('');setMessage('')
    try{await operation();setMessage(success);setSelected(null);setConfirm(null);await load()}catch(value){setError(friendlyError(value))}finally{setBusy(false)}
  }
  const update=(row:ReservationRow,nextStatus:string,nextDate=madridDay(new Date(row.starts_at)),nextTime=madridTime(row.starts_at),guests=row.guests)=>rpc('admin_update_reservation',{p_id:row.id,p_updated_at:row.updated_at,p_status:nextStatus,p_date:nextDate,p_time:nextTime,p_guests:guests})
  const saveConfig=(kind:string,data:Record<string,unknown>)=>mutate(()=>rpc('admin_save_configuration',{p_kind:kind,p_data:data}),'Configuración guardada.')
  return <div className="section admin-dashboard"><div className="admin-heading"><div><p className="eyebrow">RESTOBAR LA LLAVE</p><h1>Administración</h1><small>{email}</small></div><button className="button secondary" onClick={()=>void onSignOut()}>Cerrar sesión</button></div>
    <div className="summary-grid">{[...statuses,'today'].map(key=><button key={key} onClick={()=>{setTab('reservas');setOffset(0);setStatus(key==='today'?'':key);setDate(key==='today'?madridDay():'')}}><span>{key==='today'?'Reservas del día':key.charAt(0)+key.slice(1).toLowerCase()+'s'}</span><strong>{counts[key] ?? '—'}</strong></button>)}</div>
    <nav className="admin-tabs" aria-label="Secciones de administración">{[['reservas','Reservas'],['calendario','Calendario'],['configuracion','Mesas y horarios']].map(([key,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} onClick={()=>{setTab(key);setSelected(null);setConfirm(null)}}>{label}</button>)}</nav>
    <div aria-live="polite">{(error||authError)&&<p className="feedback error" role="alert">{error||authError}</p>}{message&&<p className="feedback" role="status">{message}</p>}</div>
    <div className="admin-refresh"><p>Horas del restaurante: Europe/Madrid.</p><button type="button" className="text-button" disabled={loading||busy} onClick={()=>void load()}>Actualizar datos</button></div>
    {loading&&<p role="status">Cargando datos…</p>}
    {tab==='reservas'&&<><div className="reservation-filters"><label>Buscar cliente<input type="search" value={search} onChange={event=>setSearch(event.target.value)} maxLength={100} placeholder="Nombre del cliente" /></label><label>Fecha<input type="date" value={date} onChange={event=>{setDate(event.target.value);setOffset(0)}} /></label><label>Estado<select value={status} onChange={event=>{setStatus(event.target.value);setOffset(0)}}><option value="">Todos</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></label><button className="button secondary" onClick={()=>{setDate('');setStatus('');setSearch('');setOffset(0)}}>Limpiar filtros</button></div>
      {!loading&&!rows.length&&<p className="empty-state">No hay reservas que coincidan con estos filtros.</p>}
      <div className="reservation-list">{rows.map(row=><article className="reservation-card" key={row.id}><div className="reservation-card-heading"><h2>{row.customer_name}</h2><span className={`badge ${row.status.toLowerCase()}`}>{row.status}</span></div><p><strong>{madridDay(new Date(row.starts_at))} · {madridTime(row.starts_at)}</strong> · {row.guests} comensales</p><p>Mesa: {tables.find(table=>table.id===row.table_id)?.name ?? 'Asignada'}</p>{isDemo ? <span>Tel?fono ficticio: {row.phone}</span> : <a className="text-link" href={`tel:${row.phone}`}>{row.phone}</a>}{row.notes&&<p className="reservation-notes">{row.notes}</p>}<div className="card-actions"><button className="button secondary" onClick={()=>{setSelected(row);setConfirm(null)}}>Ver detalles{['PENDIENTE','CONFIRMADA'].includes(row.status)?' / Modificar':''}</button>{row.status==='PENDIENTE'&&<><button className="button" disabled={busy} onClick={()=>setConfirm({row,status:'CONFIRMADA'})}>Confirmar</button><button className="button danger" disabled={busy} onClick={()=>setConfirm({row,status:'RECHAZADA'})}>Rechazar</button></>}{['PENDIENTE','CONFIRMADA'].includes(row.status)&&<button className="button danger" disabled={busy} onClick={()=>setConfirm({row,status:'CANCELADA'})}>Cancelar</button>}</div></article>)}</div>
      {total>0&&<div className="pagination"><button className="button secondary" disabled={!offset||loading} onClick={()=>setOffset(Math.max(0,offset-50))}>Anteriores</button><span>{offset+1}–{Math.min(offset+50,total)} de {total}</span><button className="button secondary" disabled={offset+50>=total||loading} onClick={()=>setOffset(offset+50)}>Siguientes</button></div>}
    </>}
    {confirm&&<div className="action-confirmation" tabIndex={-1} role="region" aria-label="Confirmar cambio de estado"><h2>{confirm.status==='CONFIRMADA'?'Confirmar reserva':confirm.status==='RECHAZADA'?'Rechazar solicitud':'Cancelar reserva'}</h2><p>{confirm.row.customer_name} · {madridDay(new Date(confirm.row.starts_at))} · {madridTime(confirm.row.starts_at)} · {confirm.row.guests} comensales</p><p>{confirm.status==='CONFIRMADA'?'Se comprobará otra vez la disponibilidad antes de confirmar.':'La mesa quedará disponible para otras solicitudes.'}</p><button className="button" disabled={busy} onClick={()=>void mutate(()=>update(confirm.row,confirm.status),'Estado de la reserva actualizado.')}>Sí, guardar cambio</button> <button className="button secondary" disabled={busy} onClick={()=>setConfirm(null)}>Volver</button></div>}
    {selected&&<div className="edit-reservation" tabIndex={-1} key={selected.updated_at}><h2>Detalles de la reserva</h2><p>{selected.customer_name} · {selected.phone}</p><p>{selected.notes||'Sin observaciones.'}</p><p>Estado: {selected.status}</p>{['PENDIENTE','CONFIRMADA'].includes(selected.status)&&<form onSubmit={event=>{event.preventDefault();const values=new FormData(event.currentTarget);void mutate(()=>update(selected,selected.status,String(values.get('date')),String(values.get('time')),Number(values.get('guests'))),'Reserva modificada.')}}><div className="form-grid"><label>Modificar fecha<input name="date" type="date" defaultValue={madridDay(new Date(selected.starts_at))} required /></label><label>Modificar hora<input name="time" type="time" defaultValue={madridTime(selected.starts_at)} required /></label><label>Modificar comensales<input name="guests" type="number" min={1} max={100} step={1} defaultValue={selected.guests} required /></label></div><p>Se comprobarán horarios, capacidad y posibles conflictos al guardar.</p><button className="button" disabled={busy}>Guardar cambios</button></form>}<button className="text-button" onClick={()=>setSelected(null)}>Cerrar detalles</button></div>}
    {tab==='calendario'&&<Calendar month={month} counts={calendar} onMonth={setMonth} onDay={day=>{setDate(day);setStatus('');setOffset(0);setTab('reservas')}} />}
    {tab==='configuracion'&&settings&&(isDemo ? <div className="notice"><h2>Configuración ficticia de demostración</h2><p>Martes a domingo · Comidas 13:00–16:00 · Cenas 20:00–23:30.</p><p>Reservas de 90 minutos · Intervalos de 30 minutos. Sin combinación de mesas. Los turnos deben terminar antes del cierre.</p>{tables.map(table=><p key={table.id}>{table.name} · {table.capacity} personas</p>)}<p>Estos datos son provisionales y no modifican el restaurante real.</p></div> : <Configuration tables={tables} hours={hours} closures={closures} settings={settings} busy={busy} save={saveConfig} />)}
  </div>
}

function Calendar({month,counts,onMonth,onDay}:{month:string;counts:CalendarCount[];onMonth:(month:string)=>void;onDay:(day:string)=>void}){
  const [year,number]=month.split('-').map(Number), start=new Date(Date.UTC(year,number-1,1)), days=new Date(Date.UTC(year,number,0)).getUTCDate(), padding=(start.getUTCDay()+6)%7
  const change=(delta:number)=>onMonth(new Date(Date.UTC(year,number-1+delta,1)).toISOString().slice(0,7))
  return <div><div className="calendar-heading"><button className="button secondary" onClick={()=>change(-1)} aria-label="Mes anterior">←</button><h2>{new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}).format(start)}</h2><button className="button secondary" onClick={()=>change(1)} aria-label="Mes siguiente">→</button></div><p>Pulsa un día para ver clientes, horas y detalles. Los colores indican el estado.</p><div className="calendar-grid">{['L','M','X','J','V','S','D'].map((name,index)=><div className="calendar-weekday" key={index}>{name}</div>)}{Array.from({length:padding},(_,index)=><div key={`empty-${index}`} />)}{Array.from({length:days},(_,index)=>{const day=`${month}-${String(index+1).padStart(2,'0')}`,entries=counts.filter(value=>value.day===day);return <button className="calendar-day" type="button" key={day} aria-label={`Ver reservas del ${day}`} onClick={()=>onDay(day)}><strong>{index+1}</strong>{entries.map(value=><span className={`calendar-count ${value.status.toLowerCase()}`} title={`${value.status}: ${value.count}`} key={value.status}><span className="calendar-count-label">{value.status.slice(0,3)} </span>{value.count}</span>)}</button>})}</div><div className="calendar-legend">{statuses.map(status=><span key={status} className={`badge ${status.toLowerCase()}`}>{status}</span>)}</div></div>
}

function Configuration({tables,hours,closures,settings,busy,save}:{tables:RestaurantTable[];hours:OpeningHours[];closures:Closure[];settings:RestaurantSettings;busy:boolean;save:(kind:string,data:Record<string,unknown>)=>Promise<void>}){
  const [table,setTable]=useState<RestaurantTable|null>(null),[hour,setHour]=useState<OpeningHours|null>(null),[deleteClosure,setDeleteClosure]=useState<string|null>(null)
  const submit=(event:FormEvent<HTMLFormElement>,kind:string,convert:(values:FormData)=>Record<string,unknown>)=>{event.preventDefault();void save(kind,convert(new FormData(event.currentTarget)))}
  return <div className="configuration"><div className="notice"><strong>Configura el restaurante antes de activar reservas</strong><p>Añade tus mesas y franjas reales. No hay horarios ni capacidades de ejemplo. Las solicitudes pendientes también ocupan mesa hasta que se confirmen, rechacen o cancelen.</p></div>
    <section className="config-panel"><h2>Mesas</h2>{!tables.length&&<p>No hay mesas configuradas.</p>}<div className="config-list">{tables.map(value=><div key={value.id}><span>{value.name} · {value.capacity} personas · {value.active?'Disponible':'Desactivada'}</span><button className="text-button" onClick={()=>setTable(value)}>Editar mesa</button></div>)}</div><form key={table?.id??'new-table'} onSubmit={event=>submit(event,'table',values=>({id:table?.id,name:String(values.get('name')),capacity:Number(values.get('capacity')),active:values.get('active')==='on'}))}><h3>{table?'Editar mesa':'Añadir mesa'}</h3><div className="form-grid"><label>Nombre de la mesa<input name="name" maxLength={60} defaultValue={table?.name} required /></label><label>Capacidad<input name="capacity" type="number" min={1} max={100} step={1} defaultValue={table?.capacity} required /></label></div><label className="checkbox-label"><input type="checkbox" name="active" defaultChecked={table?.active??true} /> Disponible para reservas</label><button className="button" disabled={busy}>Guardar mesa</button>{table&&<button className="text-button" type="button" onClick={()=>setTable(null)}>Añadir otra mesa</button>}</form></section>
    <section className="config-panel"><h2>Horarios y turnos</h2><p>Introduce franjas dentro del mismo día. Si abres después de medianoche, crea otra franja en el día siguiente. La duración completa de la reserva debe caber en la franja.</p>{!hours.length&&<p>No hay horarios configurados.</p>}<div className="config-list">{hours.map(value=><div key={value.id}><span>{weekdays[value.weekday]} · {value.opens.slice(0,5)}–{value.closes.slice(0,5)} · {value.duration_minutes} min · {value.active?'Activo':'Desactivado'}</span><button className="text-button" onClick={()=>setHour(value)}>Editar horario</button></div>)}</div><form key={hour?.id??'new-hours'} onSubmit={event=>submit(event,'hours',values=>({id:hour?.id,weekday:Number(values.get('weekday')),opens:String(values.get('opens')),closes:String(values.get('closes')),step_minutes:Number(values.get('step_minutes')),duration_minutes:Number(values.get('duration_minutes')),active:values.get('active')==='on'}))}><h3>{hour?'Editar franja':'Añadir franja'}</h3><div className="form-grid"><label>Día de la semana<select name="weekday" defaultValue={hour?.weekday??''} required><option value="" disabled>Elige un día</option>{weekdays.map((day,index)=><option key={day} value={index}>{day}</option>)}</select></label><label>Hora de apertura<input name="opens" type="time" defaultValue={hour?.opens.slice(0,5)} required /></label><label>Hora de cierre<input name="closes" type="time" defaultValue={hour?.closes.slice(0,5)} required /></label><label>Separación entre turnos (minutos)<input name="step_minutes" type="number" min={5} max={240} step={1} defaultValue={hour?.step_minutes} required /></label><label>Duración de la reserva (minutos)<input name="duration_minutes" type="number" min={15} max={480} step={1} defaultValue={hour?.duration_minutes} required /></label></div><label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={hour?.active??true} /> Franja activa</label><button className="button" disabled={busy}>Guardar horario</button>{hour&&<button className="text-button" type="button" onClick={()=>setHour(null)}>Añadir otra franja</button>}</form></section>
    <section className="config-panel"><h2>Cierres excepcionales</h2><p>Los cierres bloquean días completos, incluidos el primero y el último.</p><div className="config-list">{closures.map(value=><div key={value.id}><span>{value.starts_on}–{value.ends_on} · {value.reason||'Cierre'}</span><button className="text-button" onClick={()=>setDeleteClosure(value.id)}>Quitar cierre</button></div>)}</div>{deleteClosure&&<div className="notice"><p>¿Quitar este cierre y volver a permitir reservas según los horarios?</p><button className="button" disabled={busy} onClick={()=>{void save('delete_closure',{id:deleteClosure});setDeleteClosure(null)}}>Sí, quitar cierre</button><button className="text-button" onClick={()=>setDeleteClosure(null)}>Volver</button></div>}<form onSubmit={event=>submit(event,'closure',values=>({starts_on:String(values.get('starts_on')),ends_on:String(values.get('ends_on')),reason:String(values.get('reason'))}))}><div className="form-grid"><label>Primer día de cierre<input name="starts_on" type="date" required /></label><label>Último día de cierre<input name="ends_on" type="date" required /></label><label className="full-width">Motivo (opcional)<input name="reason" maxLength={300} /></label></div><button className="button" disabled={busy}>Añadir cierre</button></form></section>
    <section className="config-panel"><h2>Activación y privacidad</h2><p>Completa la información de privacidad del restaurante antes de activar el formulario público.</p><form key={JSON.stringify(settings)} onSubmit={event=>submit(event,'settings',values=>({reservations_enabled:values.get('reservations_enabled')==='on',horizon_days:Number(values.get('horizon_days')),retention_days:Number(values.get('retention_days')),privacy_controller:String(values.get('privacy_controller')),privacy_contact:String(values.get('privacy_contact')),privacy_notice:String(values.get('privacy_notice'))}))}><div className="form-grid"><label>Antelación máxima (días)<input name="horizon_days" type="number" min={1} max={365} defaultValue={settings.horizon_days} required /></label><label>Conservación de datos (días)<input name="retention_days" type="number" min={1} max={730} defaultValue={settings.retention_days} required /></label><label className="full-width">Responsable de los datos<input name="privacy_controller" maxLength={300} defaultValue={settings.privacy_controller} /></label><label className="full-width">Contacto para privacidad<input name="privacy_contact" maxLength={300} defaultValue={settings.privacy_contact} /></label><label className="full-width">Información de privacidad<textarea name="privacy_notice" maxLength={10000} rows={7} defaultValue={settings.privacy_notice} /></label></div><label className="checkbox-label"><input type="checkbox" name="reservations_enabled" defaultChecked={settings.reservations_enabled} /> Activar solicitudes online</label><p>La activación requiere también mesas, horarios y la comprobación antiautomatismos. La eliminación por conservación debe estar programada en el servidor antes de la entrega.</p><button className="button" disabled={busy}>Guardar configuración</button></form></section>
  </div>
}
