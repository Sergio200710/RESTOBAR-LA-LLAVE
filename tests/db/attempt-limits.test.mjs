import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { createReservationHandler } from '../../supabase/functions/_shared/reserve-handler.ts'

test('Cuotas persistentes: actualización no destructiva, rollbacks y permisos', async t => {
  const db = new PGlite({ extensions: { btree_gist } })
  const admin = randomUUID(), ip = 'a'.repeat(64), contact = 'b'.repeat(64)
  const hash = value => createHash('sha256').update(value).digest('hex')
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;`)
    for (const file of ['202610230001_reservations.sql','202610230002_admin_queries.sql']) {
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
    }
    await db.query('insert into auth.users(id) values($1)', [admin])
    await db.query('insert into public.admin_users(user_id) values($1)', [admin])
    const { day, dow } = (await db.query("select ((now() at time zone 'Europe/Madrid')::date+7)::text as day,extract(dow from (now() at time zone 'Europe/Madrid')::date+7)::integer as dow")).rows[0]
    const asRole = async (role, callback) => {
      await db.exec(`begin; set local role ${role};`)
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[role==='authenticated'?admin:''])
        const result=await callback()
        await db.exec('commit')
        return result
      } catch (error) { await db.exec('rollback'); throw error }
    }
    const seed = async () => {
      await db.exec(`delete from public.reservations; delete from private.rate_limits;
        delete from public.exceptional_closures; delete from public.opening_hours; delete from public.restaurant_tables;
        update public.restaurant_settings set reservations_enabled=true,privacy_controller='Pruebas locales',
          privacy_contact='Contacto de pruebas',privacy_notice='Solo información sintética para pruebas';
        insert into public.restaurant_tables(name,capacity) values('Mesa de pruebas',4);`)
      await db.query("insert into public.opening_hours(weekday,opens,closes,step_minutes,duration_minutes) values($1,'12:00','18:00',30,90)",[dow])
    }
    const payload = (patch={}) => ({request_id:randomUUID(),date:day,time:'13:00',guests:2,name:'Cliente de pruebas',phone:'600000001',notes:'',privacy_accepted:true,privacy_version:1,...patch})
    const register = (data, network=ip, person=contact) => asRole('service_role', async () =>
      (await db.query('select public.register_reservation_attempt($1,$2,$3) as decision',[data,network,person])).rows[0].decision)
    const create = (data, network=ip, person=contact) => asRole('service_role', async () =>
      (await db.query('select public.create_reservation_request($1,$2,$3) as result',[data,network,person])).rows[0].result)
    const counter = async bucket => (await db.query('select attempts,window_start from private.rate_limits where bucket=$1',[bucket])).rows[0]
    const countReservations = async () => (await db.query('select count(*)::integer as n from public.reservations')).rows[0].n
    const migration=readFileSync('supabase/migrations/202610230003_persistent_attempt_limits.sql','utf8')

    await t.test('003 se aplica sobre 001/002 con datos existentes sin alterarlos', async () => {
      await seed(); await create(payload())
      const before=(await db.query('select id,status,updated_at from public.reservations')).rows
      const quotaBefore=(await db.query('select * from private.rate_limits order by bucket')).rows
      await db.exec(migration)
      assert.deepEqual((await db.query('select id,status,updated_at from public.reservations')).rows,before)
      assert.deepEqual((await db.query('select * from private.rate_limits order by bucket')).rows,quotaBefore)
    })

    await t.test('seis rechazos E_FULL consumen cuota; el séptimo queda limitado', async () => {
      await seed(); await create(payload(),hash('ocupada-ip'),hash('ocupada-contacto'))
      // UUID idéntico: un intento fallido nunca obtiene la exención de un reintento recibido.
      const rejected=payload({phone:'600000002'})
      for(let index=1;index<=6;index++) {
        assert.equal((await register(rejected)).allowed,true)
        await assert.rejects(create(rejected),/E_FULL/)
        assert.equal((await counter(`attempt-contact:${contact}`)).attempts,index)
        assert.equal((await counter(`attempt-ip:${ip}`)).attempts,index)
      }
      const blocked=await register(rejected)
      assert.equal(blocked.allowed,false)
      assert.ok(blocked.retry_after>=1&&blocked.retry_after<=900)
      assert.equal((await counter(`attempt-contact:${contact}`)).attempts,6)
      assert.equal(await counter(`contact:${contact}`),undefined) // la cuota antigua sí se revirtió
      assert.equal(await countReservations(),1) // solo existe la mesa ocupada por la prueba
    })

    await t.test('fechas y horarios rechazados también conservan su cuota tras rollback', async () => {
      await seed()
      for(const [patch,error] of [[{date:'2000-01-01'},/E_DATE/],[{time:'11:00'},/E_HOUR/],[{guests:5},/E_FULL/]]) {
        const data=payload(patch)
        assert.equal((await register(data)).allowed,true)
        await assert.rejects(create(data),error)
      }
      assert.equal((await counter(`attempt-contact:${contact}`)).attempts,3)
      assert.equal(await countReservations(),0)
    })

    await t.test('reintento recibido conserva UUID y contenido, no consume cuota ni duplica', async () => {
      await seed()
      const data=payload({name:' Cliente de pruebas ',phone:'600 000 001'})
      assert.equal((await register(data)).allowed,true)
      assert.deepEqual(await create(data),{received:true})
      // Agotar la cuota con otro contenido del mismo UUID no otorga una exención.
      const modified={...data,guests:3}
      for(let index=0;index<5;index++) {
        assert.equal((await register(modified)).allowed,true)
        await assert.rejects(create(modified),/E_INVALID/)
      }
      assert.equal((await register(modified)).allowed,false)
      for(let index=0;index<8;index++) {
        assert.deepEqual(await register(data),{allowed:true,retry_after:0})
        assert.deepEqual(await create(data),{received:true})
      }
      assert.equal((await counter(`attempt-contact:${contact}`)).attempts,6)
      assert.equal((await counter(`contact:${contact}`)).attempts,1)
      assert.equal(await countReservations(),1)
    })

    await t.test('el límite de contacto no prolonga la ventana ni carga otras redes', async () => {
      await seed(); const data=payload()
      for(let index=0;index<6;index++)await register(data)
      const before=await counter(`attempt-contact:${contact}`)
      for(let index=0;index<4;index++)assert.equal((await register(data,hash(`otra-red-${index}`))).allowed,false)
      assert.deepEqual(await counter(`attempt-contact:${contact}`),before)
      assert.equal(await counter(`attempt-ip:${hash('otra-red-0')}`),undefined)
      // Otro cliente de la misma red mantiene su propia cuota.
      assert.equal((await register(data,ip,hash('otro-contacto'))).allowed,true)
    })

    await t.test('quince intentos de una red limitan contactos distintos sin cargar al siguiente', async () => {
      await seed()
      for(let index=0;index<15;index++)assert.equal((await register(payload(),ip,hash(`contacto-${index}`))).allowed,true)
      assert.equal((await register(payload(),ip,hash('contacto-16'))).allowed,false)
      assert.equal((await counter(`attempt-ip:${ip}`)).attempts,15)
      assert.equal(await counter(`attempt-contact:${hash('contacto-16')}`),undefined)
    })

    await t.test('ventana vencida permite reintentar sin un bloqueo permanente', async () => {
      await seed(); const data=payload()
      for(let index=0;index<6;index++)await register(data)
      assert.equal((await register(data)).allowed,false)
      await db.exec("update private.rate_limits set window_start=clock_timestamp()-interval '16 minutes' where bucket like 'attempt-%'")
      assert.deepEqual(await register(data),{allowed:true,retry_after:0})
      assert.equal((await counter(`attempt-contact:${contact}`)).attempts,1)
      assert.equal((await counter(`attempt-ip:${ip}`)).attempts,1)
    })

    await t.test('llamadas concurrentes locales no conceden más de seis permisos por contacto', async () => {
      await seed()
      // PGlite serializa estas transacciones en una conexión. Comprueba el cupo
      // bajo llamadas solapadas, pero NO simula sesiones PostgreSQL independientes.
      const decisions=await Promise.all(Array.from({length:30},async()=>
        (await db.query('select public.register_reservation_attempt($1,$2,$3) as decision',[payload(),ip,contact])).rows[0].decision))
      assert.equal(decisions.filter(value=>value.allowed).length,6)
      assert.equal((await counter(`attempt-contact:${contact}`)).attempts,6)
    })

    await t.test('RPC exclusiva del servidor, sin acceso a contadores para clientes', async () => {
      await seed()
      for(const role of ['anon','authenticated']) {
        await assert.rejects(asRole(role,()=>db.query('select public.register_reservation_attempt($1,$2,$3)',[payload(),ip,contact])),/permission denied/)
        await assert.rejects(asRole(role,()=>db.query('select * from private.rate_limits')),/permission denied/)
      }
      assert.equal((await register(payload())).allowed,true)
      assert.equal((await db.query("select relrowsecurity from pg_class where oid='private.rate_limits'::regclass")).rows[0].relrowsecurity,true)
    })

    await t.test('HTTP real del manejador + SQL local: 409 seis veces, luego 429', async () => {
      await seed(); await create(payload(),hash('ocupada-ip'),hash('ocupada-contacto'))
      let saveCalls=0
      const handler=createReservationHandler({
        origins:['https://restaurant.example.invalid'],secret:'SOLO_PRUEBAS',salt:'salt-sintetico-solo-para-pruebas-locales-123456',
        verify:async()=>({success:true,hostname:'restaurant.example.invalid',action:'reserve'}),
        registerAttempt:register,
        save:async(data,network,person)=>{saveCalls++;try {await create(data,network,person);return {error:null}} catch(error){return {error:{message:error.message}}}},
      })
      const data=payload({phone:'600000002'})
      const send=()=>handler(new Request('https://edge.example.invalid/reserve',{method:'POST',headers:{origin:'https://restaurant.example.invalid','content-type':'application/json'},body:JSON.stringify({...data,token:'TOKEN_SINTETICO'})}))
      for(let index=0;index<6;index++)assert.equal((await send()).status,409)
      const limited=await send()
      assert.equal(limited.status,429)
      assert.ok(Number(limited.headers.get('Retry-After'))>0)
      assert.equal(saveCalls,6)
      assert.equal(await countReservations(),1)
    })

    await t.test('mantenimiento existente elimina también las cuotas caducadas nuevas', async () => {
      await seed(); await register(payload())
      await db.exec("update private.rate_limits set window_start=now()-interval '2 days' where bucket like 'attempt-%'")
      await asRole('service_role',()=>db.query('select public.maintenance_cleanup()'))
      assert.equal((await db.query('select count(*)::integer as n from private.rate_limits')).rows[0].n,0)
    })
  } finally {await db.close()}
})
