import type { BookingConfig, ReservationRow, ReservationStatus, RestaurantTable, OpeningHours } from '../lib/reservations'
import { validateReservation } from '../../supabase/functions/_shared/reserve-handler'

export const DEMO_STORAGE = 'la-llave:demo:reservations:v1'
export const DEMO_CHANGED = 'la-llave-demo-changed'
type DemoRow = ReservationRow & { request_id: string; fingerprint: string }
const active = (row: ReservationRow) => ['PENDIENTE','CONFIRMADA'].includes(row.status)
const dayOf = (value: string | Date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
export const demoTables: RestaurantTable[] = [2,2,2,2,4,4,4,4,6,6].map((capacity,index)=>({id:`demo-table-${index+1}`,name:`DEMO · Mesa ${index+1}`,capacity,active:true}))
export const demoHours: OpeningHours[] = [0,2,3,4,5,6].flatMap(weekday=>[
  {id:`demo-lunch-${weekday}`,weekday,opens:'13:00',closes:'16:00',step_minutes:30,duration_minutes:90,active:true},
  {id:`demo-dinner-${weekday}`,weekday,opens:'20:00',closes:'23:30',step_minutes:30,duration_minutes:90,active:true},
])
export const demoConfig: BookingConfig = {enabled:true,max_guests:6,horizon_days:60,privacy_controller:'DEMOSTRACIÓN · Datos ficticios',privacy_contact:'Sin contacto real',privacy_notice:'Demo local: utiliza solo nombres y teléfonos ficticios. No se envía información a Supabase ni se reserva una mesa real.',privacy_version:1}

function read(): DemoRow[] {
  const raw=localStorage.getItem(DEMO_STORAGE)
  if(!raw)return []
  const rows: unknown=JSON.parse(raw)
  if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.id!=='string'||typeof row.starts_at!=='string'||typeof row.updated_at!=='string'))throw new Error('E_DEMO_STORAGE')
  return rows as DemoRow[]
}
function write(rows: DemoRow[]) {
  localStorage.setItem(DEMO_STORAGE,JSON.stringify(rows))
  window.dispatchEvent(new Event(DEMO_CHANGED))
}
export function resetDemo() { localStorage.removeItem(DEMO_STORAGE);window.dispatchEvent(new Event(DEMO_CHANGED)) }

function instant(day: string,time: string) {
  // The supplied services are after noon, away from DST's ambiguous hours.
  const utc=Date.parse(`${day}T${time}:00Z`)
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hour12:false}).format(utc))
  const offset=(hour-Number(time.slice(0,2))+24)%24
  return new Date(utc-offset*3600000).toISOString()
}
function range(day: string,time: string,guests: number) {
  const parsed=new Date(`${day}T12:00:00Z`), today=dayOf()
  const last=new Date(`${today}T12:00:00Z`);last.setUTCDate(last.getUTCDate()+60)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day||day<today||day>last.toISOString().slice(0,10))throw new Error('E_DATE')
  if(!Number.isInteger(guests)||guests<1||guests>6)throw new Error('E_FULL')
  const hour=demoHours.find(value=>value.weekday===parsed.getUTCDay()&&time>=value.opens&&time<value.closes)
  if(!hour||!/^\d{2}:\d{2}$/.test(time))throw new Error('E_HOUR')
  const minutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3,5))
  if((minutes(time)-minutes(hour.opens))%30||minutes(time)+90>minutes(hour.closes))throw new Error('E_HOUR')
  const starts_at=instant(day,time),ends_at=new Date(Date.parse(starts_at)+90*60000).toISOString()
  if(Date.parse(starts_at)<=Date.now())throw new Error('E_DATE')
  return {starts_at,ends_at}
}
function choose(rows: DemoRow[],start:string,end:string,guests:number,ignore?:string) {
  return demoTables.find(table=>table.capacity>=guests&&!rows.some(row=>row.id!==ignore&&active(row)&&row.table_id===table.id&&row.starts_at<end&&row.ends_at>start))
}
function slots(day:string,guests:number) {
  const rows=read(), result:string[]=[]
  for(let minute=13*60;minute<=23*60;minute+=30){
    const time=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`
    try {const slot=range(day,time,guests);if(choose(rows,slot.starts_at,slot.ends_at,guests))result.push(time)} catch { /* Closed or unavailable slot. */ }
  }
  return result
}

// Web Locks serializes local check + write across tabs on the same browser origin.
// This is a presentation store, never a substitute for production SQL/RLS.
async function mutation<T>(work:()=>T):Promise<T> {
  if(navigator.locks)return navigator.locks.request(DEMO_STORAGE,work)
  return work()
}
export async function demoSubmit(data:Record<string,unknown>) {
  return mutation(()=>{
    if(!validateReservation({...data,token:'DEMO_LOCAL_ONLY'}))throw new Error('E_INVALID')
    if(data.privacy_version!==demoConfig.privacy_version)throw new Error('E_PRIVACY')
    const rows=read(),phone=String(data.phone).replace(/[\s().-]/g,''),name=String(data.name).trim()
    const fingerprint=JSON.stringify({date:data.date,time:data.time,guests:data.guests,name,phone,notes:data.notes,privacy_version:data.privacy_version})
    const previous=rows.find(row=>row.request_id===data.request_id)
    if(previous){if(previous.fingerprint!==fingerprint)throw new Error('E_INVALID');return {message:'DEMO · Solicitud ficticia recibida. Pendiente de confirmación simulada; no existe ninguna reserva real.'}}
    const slot=range(String(data.date),String(data.time),Number(data.guests))
    if(rows.some(row=>active(row)&&row.phone===phone&&row.starts_at===slot.starts_at))throw new Error('E_FULL')
    const table=choose(rows,slot.starts_at,slot.ends_at,Number(data.guests));if(!table)throw new Error('E_FULL')
    rows.push({id:crypto.randomUUID(),request_id:String(data.request_id),fingerprint,customer_name:`DEMO · ${name}`,phone,notes:String(data.notes),guests:Number(data.guests),table_id:table.id,...slot,status:'PENDIENTE',updated_at:new Date().toISOString()})
    write(rows)
    return {message:'DEMO · Solicitud ficticia recibida. Pendiente de confirmación simulada; no existe ninguna reserva real.'}
  })
}
export async function demoRpc<T>(name:string,p:Record<string,unknown>={}):Promise<T> {
  let result:unknown
  if(name==='public_booking_config')result=demoConfig
  else if(name==='booking_slots')result=slots(String(p.p_date),Number(p.p_guests))
  else if(name==='is_admin')result=true // Demo only; there is no production session.
  else if(name==='admin_update_reservation'){
    await mutation(()=>{
      const rows=read(),row=rows.find(value=>value.id===p.p_id)
      if(!row)throw new Error('E_INVALID')
      if(row.updated_at!==p.p_updated_at)throw new Error('E_STALE')
      const next=String(p.p_status) as ReservationStatus
      if(!active(row)||!['PENDIENTE','CONFIRMADA','RECHAZADA','CANCELADA'].includes(next)||(row.status==='CONFIRMADA'&&['PENDIENTE','RECHAZADA'].includes(next)))throw new Error('E_STATE')
      if(['PENDIENTE','CONFIRMADA'].includes(next)){
        const slot=range(String(p.p_date),String(p.p_time),Number(p.p_guests))
        const table=choose(rows,slot.starts_at,slot.ends_at,Number(p.p_guests),row.id);if(!table)throw new Error('E_FULL')
        Object.assign(row,slot,{table_id:table.id,guests:Number(p.p_guests)})
      }
      row.status=next;row.updated_at=new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString();write(rows)
    })
    result=null
  } else {
    const rows=read()
    if(name==='admin_reservations'){
      const items=rows.filter(row=>(!p.p_date||dayOf(row.starts_at)===p.p_date)&&(!p.p_status||row.status===p.p_status)&&(!p.p_search||row.customer_name.toLocaleLowerCase('es').includes(String(p.p_search).toLocaleLowerCase('es')))).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))
      result={total:items.length,items:items.slice(Number(p.p_offset??0),Number(p.p_offset??0)+50)}
    } else if(name==='admin_dashboard')result={...Object.fromEntries(['PENDIENTE','CONFIRMADA','RECHAZADA','CANCELADA'].map(status=>[status,rows.filter(row=>row.status===status).length])),today:rows.filter(row=>dayOf(row.starts_at)===dayOf()).length}
    else if(name==='admin_calendar'){
      const counts=new Map<string,{day:string;status:ReservationStatus;count:number}>()
      for(const row of rows){const day=dayOf(row.starts_at);if(!day.startsWith(String(p.p_month).slice(0,7)))continue;const key=`${day}:${row.status}`,entry=counts.get(key)??{day,status:row.status,count:0};entry.count++;counts.set(key,entry)}
      result=[...counts.values()]
    } else throw new Error('E_INVALID')
  }
  return result as T
}
