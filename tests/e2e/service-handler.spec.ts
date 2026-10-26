import { test, expect } from '@playwright/test'
import { createReservationHandler, validateReservation, type HandlerDependencies } from '../../supabase/functions/_shared/reserve-handler'

const valid = {request_id:'12345678-1234-4234-8234-123456789abc',date:'2026-12-01',time:'14:00',guests:2,name:'Cliente de pruebas',phone:'+34 600 000 001',notes:'',privacy_accepted:true,privacy_version:1,token:'token-de-prueba'}
const defaults = ():HandlerDependencies=>({origins:['https://restaurant.example.invalid'],secret:'test-secret',salt:'test-only-salt-with-more-than-32-characters',verify:async()=>({success:true,action:'reserve',hostname:'restaurant.example.invalid'}),registerAttempt:async()=>({allowed:true,retry_after:0}),save:async()=>({error:null})})
const request = (body:unknown=valid,origin='https://restaurant.example.invalid')=>new Request('https://edge.example.invalid/reserve',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)})

test('servidor: formato, comensales, teléfono, aceptación y campo antiautomatismos',()=>{
  expect(validateReservation(valid)).toBe(true)
  for(const patch of [{guests:0},{guests:1.5},{guests:'2'},{time:'25:01'},{phone:'abc'},{name:'x'},{privacy_accepted:false},{website:'spam'},{request_id:'no-uuid'},{token:''}])expect(validateReservation({...valid,...patch})).toBe(false)
})
test('servidor: guarda solo datos normalizados y confirma recepción pendiente',async()=>{
  const deps=defaults();let saved:unknown
  deps.save=async(data,ip,contact)=>{saved=data;expect(ip).toMatch(/^[a-f0-9]{64}$/);expect(contact).toMatch(/^[a-f0-9]{64}$/);return {error:null}}
  const response=await createReservationHandler(deps)(request())
  expect(response.status).toBe(200);expect(await response.text()).toContain('pendiente de confirmación')
  expect(saved).toMatchObject({phone:'+34600000001'});expect(saved).not.toHaveProperty('token')
})
test('servidor: origen, captcha, hostname y action se validan antes de guardar',async()=>{
  const deps=defaults();let writes=0;deps.save=async()=>{writes++;return {error:null}}
  expect((await createReservationHandler(deps)(request(valid,'https://other.example.invalid'))).status).toBe(403)
  for(const verification of [{success:false},{success:true,action:'reserve',hostname:'other.example.invalid'},{success:true,action:'other',hostname:'restaurant.example.invalid'}]){
    deps.verify=async()=>verification
    expect((await createReservationHandler(deps)(request())).status).toBe(400)
  }
  expect(writes).toBe(0)
})
test('servidor: cierra el servicio sin configuración, limita tamaño y oculta errores',async()=>{
  const deps=defaults();deps.salt=''
  expect((await createReservationHandler(deps)(request())).status).toBe(503)
  deps.salt=defaults().salt
  expect((await createReservationHandler(deps)(request({...valid,notes:'x'.repeat(11000)}))).status).toBe(413)
  deps.save=async()=>({error:{message:'database password and private error'}})
  const response=await createReservationHandler(deps)(request());expect(response.status).toBe(400);expect(await response.text()).not.toContain('password')
})
for(const [error,status] of [['E_FULL',409],['E_DATE',409],['E_CLOSED',409],['E_HOUR',409],['E_RATE',429],['E_DISABLED',503],['E_PRIVACY',409]] as const){
  test(`servidor: ${error} devuelve estado seguro ${status}`,async()=>{
    const deps=defaults();deps.save=async()=>({error:{message:error}})
    expect((await createReservationHandler(deps)(request())).status).toBe(status)
  })
}
test('servidor: registerAttempt rechaza cuando allowed:false y no llama a save',async()=>{
  const deps=defaults()
  let saveCalled=false
  deps.registerAttempt=async()=>({allowed:false,retry_after:60})
  deps.save=async()=>{saveCalled=true;return {error:null}}
  const response=await createReservationHandler(deps)(request())
  expect(response.status).toBe(429)
  expect(await response.text()).toContain('Espera un momento')
  expect(response.headers.get('Retry-After')).toBe('60')
  expect(saveCalled).toBe(false)
})

test('servidor: espera el registro de cuota antes de guardar y falla cerrado si no puede registrarlo',async()=>{
  const deps=defaults(),events:string[]=[]
  deps.registerAttempt=async()=>{events.push('registro');await Promise.resolve();events.push('registrado');return {allowed:true,retry_after:0}}
  deps.save=async()=>{events.push('reserva');return {error:null}}
  expect((await createReservationHandler(deps)(request())).status).toBe(200)
  expect(events).toEqual(['registro','registrado','reserva'])
  events.length=0
  deps.registerAttempt=async()=>{throw new Error('private database detail')}
  const response=await createReservationHandler(deps)(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('private database detail')
  expect(events).toEqual([])
})

test('servidor: captcha rechazado no consume cuota de clientes',async()=>{
  const deps=defaults();let attempts=0
  deps.registerAttempt=async()=>{attempts++;return {allowed:true,retry_after:0}}
  deps.verify=async()=>({success:false})
  expect((await createReservationHandler(deps)(request())).status).toBe(400)
  expect(attempts).toBe(0)
})
