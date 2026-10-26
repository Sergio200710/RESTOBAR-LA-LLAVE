import { expect, test, type Page } from '@playwright/test'

test.use({baseURL:'http://127.0.0.1:5190'})
const key='la-llave:demo:reservations:v1'
function nextDay(weekday:number) {
  const day=new Date();day.setUTCDate(day.getUTCDate()+7)
  while(day.getUTCDay()!==weekday)day.setUTCDate(day.getUTCDate()+1)
  return day.toISOString().slice(0,10)
}
const tuesday=nextDay(2)
async function requestDemo(page:Page,name='Cliente ficticio',time='13:00',phone='000000000') {
  await page.goto('/#reservar')
  await page.getByLabel('Fecha',{exact:true}).fill(tuesday)
  await page.getByLabel('Número de comensales').fill('2')
  await page.getByRole('combobox',{name:'Hora',exact:true}).selectOption(time)
  await page.getByLabel('Nombre',{exact:true}).fill(name)
  await page.getByLabel('Teléfono',{exact:true}).fill(phone)
  await page.getByLabel('He leído la información de privacidad.').check()
  await page.getByRole('button',{name:'Solicitar reserva',exact:true}).click({clickCount:2})
  await expect(page.getByRole('heading',{name:'Solicitud recibida'})).toBeVisible()
  await expect(page.locator('#reservar')).toContainText('no existe ninguna reserva real')
}

for(const width of [320,390,768,1440]){
  test(`demo ${width}px: solicitud, persistencia, confirmación y cancelación sin Supabase`,async({page},testInfo)=>{
    const forbidden:string[]=[]
    page.on('request',request=>{if(/supabase|must-not-contact|cloudflare/i.test(new URL(request.url()).hostname))forbidden.push('backend externo')})
    await page.setViewportSize({width,height:900})
    await requestDemo(page)
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('la-llave:demo:reservations:v1')??'[]').length)).toBe(1)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:testInfo.outputPath(`demo-form-${width}.png`),fullPage:true})
    await page.goto('/admin');await expect(page.getByRole('heading',{name:'DEMO · Cliente ficticio',exact:true})).toBeVisible()
    await expect(page.locator('.reservation-card .badge')).toHaveText('PENDIENTE')
    await page.getByRole('button',{name:'Confirmar',exact:true}).click()
    await page.getByRole('button',{name:'Sí, guardar cambio'}).click()
    await expect(page.locator('.reservation-card .badge')).toHaveText('CONFIRMADA')
    await page.reload();await expect(page.locator('.reservation-card .badge')).toHaveText('CONFIRMADA')
    await page.getByRole('button',{name:'Cancelar',exact:true}).click()
    await page.getByRole('button',{name:'Sí, guardar cambio'}).click()
    await expect(page.locator('.reservation-card .badge')).toHaveText('CANCELADA')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:testInfo.outputPath(`demo-admin-${width}.png`),fullPage:true})
    expect(forbidden).toEqual([])
  })
}

test('demo: rechazo, calendario, filtros y restauración exclusiva de datos ficticios',async({page})=>{
  await requestDemo(page)
  await page.evaluate(()=>localStorage.setItem('unrelated-data','conservar'))
  await page.goto('/admin')
  await page.getByRole('button',{name:'Rechazar',exact:true}).click();await page.getByRole('button',{name:'Sí, guardar cambio'}).click()
  await expect(page.locator('.reservation-card .badge')).toHaveText('RECHAZADA')
  await page.locator('.reservation-filters select').selectOption('PENDIENTE')
  await expect(page.locator('.reservation-card')).toHaveCount(0)
  await page.getByRole('button',{name:'Limpiar filtros'}).click()
  await expect(page.locator('.reservation-card')).toHaveCount(1)
  await page.getByRole('button',{name:'Calendario',exact:true}).click()
  await expect(page.getByRole('button',{name:'Mes siguiente'})).toBeVisible()
  await page.getByRole('button',{name:'Mesas y horarios',exact:true}).click()
  await expect(page.getByText('Configuración ficticia de demostración')).toBeVisible()
  await expect(page.getByText('DEMO · Mesa 10 · 6 personas',{exact:true})).toBeVisible()
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'Restablecer demo'}).click()
  expect(await page.evaluate(()=>localStorage.getItem('unrelated-data'))).toBe('conservar')
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull()
})

test('demo: lunes cerrado y turnos que respetan los 90 minutos antes del cierre',async({page})=>{
  await page.goto('/#reservar')
  await page.getByLabel('Fecha',{exact:true}).fill(nextDay(1));await page.getByLabel('Número de comensales').fill('2')
  await expect(page.getByRole('combobox',{name:'Hora',exact:true})).toBeDisabled()
  await page.getByLabel('Fecha',{exact:true}).fill(tuesday)
  await expect(page.getByRole('combobox',{name:'Hora',exact:true})).toBeEnabled()
  const options=await page.getByRole('combobox',{name:'Hora',exact:true}).locator('option').allTextContents()
  expect(options.slice(1)).toEqual(['13:00','13:30','14:00','14:30','20:00','20:30','21:00','21:30','22:00'])
})

test('demo: cuota de mesas, rechazo libera capacidad, idempotencia y validación',async({page})=>{
  await page.goto('/')
  const outcome=await page.evaluate(async day=>{
    const path='/src/demo/store.ts',store=await import(path)
    const data=(index:number)=>({request_id:crypto.randomUUID(),date:day,time:'13:00',guests:6,name:'Ficticio',phone:`00000000${index}`,notes:'DEMO',privacy_accepted:true,privacy_version:1})
    const first=data(1),second=data(2)
    await store.demoSubmit(first);await store.demoSubmit(first);await store.demoSubmit(second)
    const error=async(work:()=>Promise<unknown>)=>{try{await work();return 'NO_ERROR'}catch(e){return (e as Error).message}}
    const full=await error(()=>store.demoSubmit(data(3)))
    const duplicate=await error(()=>store.demoSubmit({...first,request_id:crypto.randomUUID()}))
    const invalid=await error(()=>store.demoSubmit({...data(4),date:'2000-01-01'}))
    const rows=JSON.parse(localStorage.getItem('la-llave:demo:reservations:v1')??'[]')
    await store.demoRpc('admin_update_reservation',{p_id:rows[0].id,p_updated_at:rows[0].updated_at,p_status:'RECHAZADA'})
    await store.demoSubmit(data(3))
    return {full,duplicate,invalid,rows:JSON.parse(localStorage.getItem('la-llave:demo:reservations:v1')??'[]').map((r:{status:string})=>r.status),tables:store.demoTables.map((t:{capacity:number})=>t.capacity)}
  },tuesday)
  expect(outcome).toMatchObject({full:'E_FULL',duplicate:'E_FULL',invalid:'E_DATE',rows:['RECHAZADA','PENDIENTE','PENDIENTE'],tables:[2,2,2,2,4,4,4,4,6,6]})
})

test('demo: solicitud en otra pestaña actualiza el panel sin recargar',async({page,context})=>{
  await page.goto('/admin');await expect(page.getByText('No hay reservas que coincidan con estos filtros.')).toBeVisible()
  const customer=await context.newPage();await requestDemo(customer,'Otra pestaña')
  await expect(page.getByRole('heading',{name:'DEMO · Otra pestaña',exact:true})).toBeVisible()
  await customer.close()
})
