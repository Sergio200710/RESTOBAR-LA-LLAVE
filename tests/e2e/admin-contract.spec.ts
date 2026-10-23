import { expect, test, type Page } from '@playwright/test'

test.use({baseURL:'http://127.0.0.1:5180'})
// Browser contract tests: Supabase and Turnstile are intercepted, not real services.
const id='12345678-1234-4234-8234-123456789abc', tableId='22345678-1234-4234-8234-123456789abc'
const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10)
const user={id,email:'owner@example.invalid',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{}}
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString('base64url')}.test-only-signature`
async function backend(page:Page,{allowed=true,loginFailure=false,saveFailure=false}={}){
  let status='PENDIENTE';const calls:{name:string;data:Record<string,unknown>}[]=[]
  const row=()=>({id,customer_name:'Cliente de prueba',phone:'600000000',notes:'Datos sintéticos para pruebas',guests:2,table_id:tableId,starts_at:`${day}T12:00:00Z`,ends_at:`${day}T13:30:00Z`,status,updated_at:'2026-01-01T00:00:00Z'})
  const settings={id:1,reservations_enabled:true,horizon_days:60,retention_days:90,privacy_controller:'Responsable de prueba',privacy_contact:'Contacto de prueba',privacy_notice:'Información de privacidad sintética',privacy_version:1}
  await page.route('https://challenges.cloudflare.com/**',route=>route.fulfill({contentType:'application/javascript',body:`window.turnstile={render:(el,options)=>{el.textContent='Comprobación simulada para pruebas';setTimeout(()=>options.callback('TEST_ONLY_TOKEN'),0);return 'test-widget'},remove:()=>{}};`}))
  await page.route('https://supabase.example.invalid/**',async route=>{
    const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1)??''
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS'}
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers})
    const data=request.postDataJSON()??{};calls.push({name,data})
    let response:unknown=null,code=200
    if(url.pathname.includes('/auth/v1/token')){
      if(loginFailure){code=400;response={error:'invalid_grant',error_description:'Invalid credentials'}}
      else response={access_token:token,refresh_token:'TEST_ONLY_REFRESH',expires_in:3600,token_type:'bearer',user}
    }else if(name==='user')response=user
    else if(name==='logout'||name==='recover')response={}
    else if(name==='is_admin')response=allowed
    else if(name==='public_booking_config')response={...settings,enabled:true,max_guests:4}
    else if(name==='booking_slots')response=['14:00','15:30']
    else if(name==='reserve'){
      code=saveFailure?409:200;response={message:saveFailure?'Ese horario ya no está disponible. Elige otra fecha u hora.':'Tu solicitud se ha recibido y está pendiente de confirmación por el restaurante. Tu mesa todavía no está confirmada.'}
    }else if(name==='admin_reservations')response={items:[row()],total:1}
    else if(name==='admin_dashboard')response={PENDIENTE:status==='PENDIENTE'?1:0,CONFIRMADA:status==='CONFIRMADA'?1:0,RECHAZADA:0,CANCELADA:0,today:0}
    else if(name==='admin_calendar')response=[{day,status,count:1}]
    else if(name==='restaurant_tables')response=[{id:tableId,name:'Mesa de prueba',capacity:4,active:true}]
    else if(name==='opening_hours'||name==='exceptional_closures')response=[]
    else if(name==='restaurant_settings')response=settings
    else if(name==='admin_update_reservation'){status=String(data.p_status);response=null}
    else if(name==='admin_save_configuration')response=null
    else {code=404;response={message:'Recurso no simulado'}}
    await route.fulfill({status:code,headers,contentType:'application/json',body:JSON.stringify(response)})
  })
  return calls
}
async function login(page:Page){
  await page.goto('/admin');await page.getByLabel('Correo electrónico',{exact:true}).fill('owner@example.invalid')
  await page.getByLabel('Contraseña',{exact:true}).fill('TEST_ONLY_PASSWORD_NOT_REAL')
  await page.getByRole('button',{name:'Entrar',exact:true}).click()
}

test('cliente: solicitud pendiente y doble clic sin duplicar envío (servicios simulados)',async({page})=>{
  const calls=await backend(page);await page.goto('/#reservar')
  await expect(page.getByText('Tu solicitud quedará pendiente de confirmación')).toBeVisible()
  await page.getByLabel('Fecha',{exact:true}).fill(day)
  await page.getByLabel('Número de comensales').fill('2')
  await page.getByRole('combobox',{name:'Hora',exact:true}).selectOption('14:00')
  await page.getByLabel('Nombre',{exact:true}).fill('Cliente de prueba')
  await page.getByLabel('Teléfono',{exact:true}).fill('600000000')
  await page.getByLabel('He leído la información de privacidad.').check()
  await page.getByRole('button',{name:'Solicitar reserva',exact:true}).click({clickCount:2})
  await expect(page.getByRole('heading',{name:'Solicitud recibida'})).toBeVisible()
  await expect(page.locator('#reservar')).toContainText('Tu mesa todavía no está confirmada')
  expect(calls.filter(call=>call.name==='reserve')).toHaveLength(1)
  expect(calls.find(call=>call.name==='reserve')?.data).toMatchObject({date:day,guests:2,privacy_accepted:true})
})
test('cliente: conflicto no muestra recepción ni confirmación (servicios simulados)',async({page})=>{
  await backend(page,{saveFailure:true});await page.goto('/#reservar')
  await page.getByLabel('Fecha',{exact:true}).fill(day);await page.getByLabel('Número de comensales').fill('2')
  await page.getByRole('combobox',{name:'Hora',exact:true}).selectOption('14:00');await page.getByLabel('Nombre',{exact:true}).fill('Cliente prueba')
  await page.getByLabel('Teléfono',{exact:true}).fill('600000000');await page.getByLabel('He leído la información de privacidad.').check()
  await page.getByRole('button',{name:'Solicitar reserva',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('ya no está disponible')
  await expect(page.getByRole('heading',{name:'Solicitud recibida'})).toHaveCount(0)
})
test('admin: acceso privado, login, confirmación y cierre (servicios simulados)',async({page})=>{
  const calls=await backend(page);await page.goto('/admin')
  await expect(page.getByText('Cliente de prueba',{exact:true})).toHaveCount(0)
  await login(page);await expect(page.getByRole('heading',{name:'Cliente de prueba'})).toBeVisible()
  await page.getByRole('button',{name:'Confirmar',exact:true}).click()
  await page.getByRole('button',{name:'Sí, guardar cambio'}).click()
  await expect(page.locator('.reservation-card .badge')).toHaveText('CONFIRMADA')
  expect(calls.find(call=>call.name==='admin_update_reservation')?.data.p_status).toBe('CONFIRMADA')
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click()
  await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Cliente de prueba'})).toHaveCount(0)
})
test('admin: usuario autenticado sin rol no accede (servicios simulados)',async({page})=>{
  const calls=await backend(page,{allowed:false});await login(page)
  await expect(page.getByRole('alert')).toContainText('no está autorizada')
  expect(calls.some(call=>call.name==='admin_reservations')).toBe(false)
  await expect(page.getByRole('navigation',{name:'Secciones de administración'})).toHaveCount(0)
})
test('admin: contraseña incorrecta y recuperación sin enumerar cuentas (servicios simulados)',async({page})=>{
  const calls=await backend(page,{loginFailure:true});await login(page)
  await expect(page.getByRole('alert')).toContainText('No se pudo iniciar sesión')
  await page.getByText('He olvidado mi contraseña',{exact:true}).click()
  await page.getByLabel('Correo de recuperación').fill('owner@example.invalid')
  await page.getByRole('button',{name:'Solicitar enlace seguro'}).click()
  await expect(page.locator('.auth-panel [role=status]')).toContainText('Si el correo corresponde')
  expect(calls.some(call=>call.name==='recover')).toBe(true)
})
for(const width of [320,390,768,1440]){
  test(`admin: calendario y configuración a ${width}px (servicios simulados)`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});const calls=await backend(page);await login(page)
    await expect(page.getByRole('heading',{name:'Cliente de prueba'})).toBeVisible()
    await page.getByRole('button',{name:'Calendario',exact:true}).click()
    await expect(page.getByRole('button',{name:'Mes siguiente'})).toBeVisible()
    await page.getByRole('button',{name:'Mes siguiente'}).click()
    await page.getByRole('button',{name:'Mes anterior'}).click()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.getByRole('button',{name:'Mesas y horarios',exact:true}).click()
    await page.getByLabel('Nombre de la mesa').fill('Mesa de pruebas nueva')
    await page.getByLabel('Capacidad',{exact:true}).fill('4')
    await page.getByRole('button',{name:'Guardar mesa',exact:true}).click()
    await expect(page.getByRole('status').filter({hasText:'Configuración guardada'})).toBeVisible()
    await expect(page.getByText('Cargando datos…',{exact:true})).toHaveCount(0)
    expect(calls.find(call=>call.name==='admin_save_configuration')?.data.p_kind).toBe('table')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:testInfo.outputPath(`admin-${width}.png`),fullPage:true})
  })
}

test('admin: rechazo y edición envían la operación correcta (servicios simulados)',async({page})=>{
  const calls=await backend(page);await login(page)
  await page.getByRole('button',{name:'Ver detalles / Modificar'}).click()
  await page.getByLabel('Modificar comensales').fill('3')
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Reserva modificada'})).toBeVisible()
  expect(calls.find(call=>call.name==='admin_update_reservation')?.data.p_guests).toBe(3)
  await page.getByRole('button',{name:'Rechazar',exact:true}).click()
  await page.getByRole('button',{name:'Sí, guardar cambio'}).click()
  await expect(page.locator('.reservation-card .badge')).toHaveText('RECHAZADA')
  expect(calls.filter(call=>call.name==='admin_update_reservation').at(-1)?.data.p_status).toBe('RECHAZADA')
})

test('admin: cancelación de reserva confirmada (servicios simulados)',async({page})=>{
  await backend(page);await login(page)
  await page.getByRole('button',{name:'Confirmar',exact:true}).click()
  await page.getByRole('button',{name:'Sí, guardar cambio'}).click()
  await expect(page.locator('.reservation-card .badge')).toHaveText('CONFIRMADA')
  await page.getByRole('button',{name:'Cancelar',exact:true}).click()
  await page.getByRole('button',{name:'Sí, guardar cambio'}).click()
  await expect(page.locator('.reservation-card .badge')).toHaveText('CANCELADA')
})

test('admin: nueva contraseña y regreso al acceso habitual (servicios simulados)',async({page})=>{
  await backend(page);await login(page)
  await expect(page.getByRole('heading',{name:'Cliente de prueba'})).toBeVisible()
  await page.goto('/admin/recuperar')
  await page.getByLabel('Nueva contraseña',{exact:true}).fill('TEST_ONLY_NEW_PASSWORD_NOT_REAL')
  await page.getByLabel('Repite la nueva contraseña').fill('TEST_ONLY_NEW_PASSWORD_NOT_REAL')
  await page.getByRole('button',{name:'Guardar contraseña',exact:true}).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible()
})
