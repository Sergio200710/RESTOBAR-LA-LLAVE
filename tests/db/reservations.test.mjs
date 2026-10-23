import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

test('PostgreSQL local: migraciones, disponibilidad, transacciones y RLS', async t => {
  const db = new PGlite({ extensions: { btree_gist } })
  const admin = randomUUID(), ordinary = randomUUID()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;`)
  try {
    for (const name of readdirSync('supabase/migrations').sort()) {
      try { await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8')) }
      catch (error) { throw new Error(`Migración ${name}: ${error.message}`) }
    }
    await db.query('insert into auth.users(id) values($1),($2)', [admin, ordinary])
    await db.query('insert into public.admin_users(user_id) values($1)', [admin])
    const [{ day, dow }] = (await db.query("select ((now() at time zone 'Europe/Madrid')::date+7)::text as day,extract(dow from (now() at time zone 'Europe/Madrid')::date+7)::integer as dow")).rows
    const runAs = async (role, user, fn) => {
      await db.exec(`begin; set local role ${role};`)
      try { await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? '']); const result = await fn(); await db.exec('commit'); return result }
      catch (error) { await db.exec('rollback'); throw error }
    }
    const config = (kind, data) => runAs('authenticated', admin, () => db.query('select public.admin_save_configuration($1,$2)', [kind, data]))
    const seed = async () => {
      await db.exec('delete from public.reservations; delete from private.rate_limits; delete from public.exceptional_closures; delete from public.opening_hours; delete from public.restaurant_tables;')
      await config('settings', { reservations_enabled: true, horizon_days: 60, retention_days: 90, privacy_controller: 'Responsable de prueba', privacy_contact: 'Contacto de prueba', privacy_notice: 'Información de privacidad exclusivamente de pruebas' })
      await config('table', { name: 'Mesa de pruebas', capacity: 4, active: true })
      await config('hours', { weekday: dow, opens: '12:00', closes: '18:00', step_minutes: 30, duration_minutes: 90, active: true })
    }
    const payload = async (patch = {}) => ({ request_id: randomUUID(), date: day, time: '13:00', guests: 2, name: 'Cliente de prueba', phone: '600000001', notes: '', privacy_accepted: true, privacy_version: (await db.query('select privacy_version from public.restaurant_settings')).rows[0].privacy_version, ...patch })
    const create = async data => runAs('service_role', null, () => db.query('select public.create_reservation_request($1,$2,$3)', [data, 'a'.repeat(64), 'b'.repeat(64)]))
    const row = async () => (await db.query('select * from public.reservations limit 1')).rows[0]
    const change = (r, status, date = day, time = '13:00', guests = 2) => runAs('authenticated', admin, () => db.query('select public.admin_update_reservation($1,$2,$3,$4,$5,$6)', [r.id, r.updated_at, status, date, time, guests]))

    await t.test('estado inicial cerrado sin mesas ni horarios inventados', async () => {
      const result = await runAs('anon', null, () => db.query('select public.public_booking_config() as config'))
      assert.equal(result.rows[0].config.enabled, false)
      assert.equal((await db.query('select count(*)::integer as n from public.restaurant_tables')).rows[0].n, 0)
    })
    await t.test('creación PENDIENTE, reintento idempotente y duplicado con UUID nuevo', async () => {
      await seed(); const p = await payload(); await create(p); await create(p); await create({ ...p, request_id: randomUUID() })
      assert.equal((await row()).status, 'PENDIENTE')
      assert.equal((await db.query('select count(*)::integer as n from public.reservations')).rows[0].n, 1)
      await assert.rejects(create({ ...p, guests: 3 }), /E_INVALID/)
    })
    await t.test('validaciones de fecha, hora, tamaño, privacidad y cierres', async () => {
      await seed()
      for (const [patch, error] of [[{ date: '2000-01-01' }, /E_DATE/], [{ time: '11:00' }, /E_HOUR/], [{ time: '13:10' }, /E_HOUR/], [{ guests: 5 }, /E_FULL/], [{ phone: 'x' }, /E_INVALID/], [{ privacy_accepted: false }, /E_INVALID/], [{ privacy_version: 0 }, /E_PRIVACY/]]) {
        await assert.rejects(create(await payload(patch)), error)
      }
      await config('closure', { starts_on: day, ends_on: day, reason: 'Cierre de prueba' })
      await assert.rejects(create(await payload()), /E_CLOSED/)
    })
    await t.test('confirmación manual, edición, conflicto y actualización obsoleta', async () => {
      await seed(); await create(await payload()); const pending = await row()
      await change(pending, 'CONFIRMADA'); assert.equal((await row()).status, 'CONFIRMADA')
      await assert.rejects(change(pending, 'CANCELADA'), /E_STALE/)
      await change(await row(), 'CONFIRMADA', day, '15:00', 3); assert.equal((await row()).guests, 3)
      await assert.rejects(create(await payload({ phone: '600000002', time: '15:30' })), /E_FULL/)
      await change(await row(), 'CANCELADA'); assert.equal((await row()).status, 'CANCELADA')
      await create(await payload({ phone: '600000002', time: '15:00' }))
    })
    await t.test('rechazo libera capacidad y no permite reabrir solicitudes terminadas', async () => {
      await seed(); await create(await payload()); await change(await row(), 'RECHAZADA')
      await assert.rejects(change(await row(), 'CONFIRMADA'), /E_STATE/)
      await create(await payload({ phone: '600000002' }))
    })
    await t.test('exclusión impide solapamientos incluso si se intenta saltar la RPC', async () => {
      await seed(); await create(await payload()); const r = await row()
      await assert.rejects(db.query(`insert into public.reservations(request_id,fingerprint,customer_name,phone,guests,table_id,starts_at,ends_at,privacy_version)
        values($1,'test','Otro cliente','600000003',2,$2,$3,$4,1)`, [randomUUID(),r.table_id,r.starts_at,r.ends_at]), /exclusion constraint/)
    })
    await t.test('configuración no invalida mesas, horarios o cierres con reservas activas', async () => {
      await seed(); await create(await payload()); const r = await row()
      await assert.rejects(config('table', { id: r.table_id, name: 'Mesa de pruebas', capacity: 1, active: true }), /E_BOOKED_CONFIG/)
      await assert.rejects(config('closure', { starts_on: day, ends_on: day }), /E_BOOKED_CONFIG/)
      assert.equal((await db.query('select count(*)::integer as n from public.exceptional_closures')).rows[0].n, 0)
    })
    await t.test('RLS: anónimo sin datos ni RPC de escritura; usuario normal sin privilegios', async () => {
      await seed(); await create(await payload())
      await assert.rejects(runAs('anon',null,() => db.query('select * from public.reservations')), /permission denied/)
      await assert.rejects(runAs('anon',null,() => db.query('select public.create_reservation_request($1,$2,$3)', [{},'a'.repeat(64),'b'.repeat(64)])), /permission denied/)
      const result = await runAs('authenticated',ordinary,() => db.query('select * from public.reservations'))
      assert.equal(result.rows.length, 0)
      await assert.rejects(runAs('authenticated',ordinary,() => db.query('select public.admin_dashboard()')), /E_FORBIDDEN/)
      await assert.rejects(runAs('authenticated',ordinary,() => db.query('insert into public.admin_users(user_id) values($1)', [ordinary])), /permission denied/)
      await assert.rejects(runAs('authenticated',admin,() => db.query("update public.reservations set status='CONFIRMADA'")), /permission denied/)
      assert.equal((await runAs('authenticated',admin,() => db.query('select * from public.reservations'))).rows.length,1)
    })
    await t.test('consulta, búsqueda, dashboard y calendario solo administrativos', async () => {
      const list = await runAs('authenticated',admin,() => db.query('select public.admin_reservations($1,$2,$3,$4) as data', [day,'PENDIENTE','cliente',0]))
      assert.equal(list.rows[0].data.total,1)
      assert.equal(list.rows[0].data.items[0].phone,'600000001')
      assert.equal('fingerprint' in list.rows[0].data.items[0],false)
      const dashboard = await runAs('authenticated',admin,() => db.query('select public.admin_dashboard() as data'))
      assert.equal(dashboard.rows[0].data.PENDIENTE,1)
      const calendar = await runAs('authenticated',admin,() => db.query('select public.admin_calendar($1) as data',[day]))
      assert.equal(calendar.rows[0].data[0].day,day)
    })
    await t.test('un usuario normal no puede mutar; revocar un administrador corta el acceso', async () => {
      const r=await row()
      await assert.rejects(runAs('authenticated',ordinary,()=>db.query('select public.admin_update_reservation($1,$2,$3,$4,$5,$6)',[r.id,r.updated_at,'CONFIRMADA',day,'13:00',2])),/E_FORBIDDEN/)
      await assert.rejects(runAs('authenticated',ordinary,()=>db.query('select public.admin_save_configuration($1,$2)',['table',{name:'Intrusión',capacity:4,active:true}])),/E_FORBIDDEN/)
      await db.query('update public.admin_users set active=false where user_id=$1',[admin])
      assert.equal((await runAs('authenticated',admin,()=>db.query('select public.is_admin() as allowed'))).rows[0].allowed,false)
      assert.equal((await runAs('authenticated',admin,()=>db.query('select * from public.reservations'))).rows.length,0)
      await db.query('update public.admin_users set active=true where user_id=$1',[admin])
    })
    await t.test('intervalos contiguos permitidos; confirmaciones incompatibles no pueden persistir', async () => {
      await seed();await create(await payload())
      await create(await payload({phone:'600000002',time:'14:30'}))
      const values=(await db.query('select * from public.reservations order by starts_at')).rows
      await assert.rejects(change(values[1],'CONFIRMADA',day,'13:30',2),/E_FULL/)
      assert.equal((await db.query('select status from public.reservations where id=$1',[values[1].id])).rows[0].status,'PENDIENTE')
    })
    await t.test('disponibilidad pública no expone información personal; cuota persistente', async () => {
      await seed(); const available = await runAs('anon',null,() => db.query('select public.booking_slots($1,$2) as slots',[day,2]))
      assert.ok(available.rows[0].slots.includes('13:00'))
      await create(await payload()); const busy = await runAs('anon',null,() => db.query('select public.booking_slots($1,$2) as slots',[day,2]))
      assert.ok(!busy.rows[0].slots.includes('13:00'))
      await create(await payload({ time:'14:30',phone:'600000002' })); await create(await payload({ time:'16:00',phone:'600000003' }))
      await assert.rejects(create(await payload({ phone:'600000004',time:'12:00' })), /E_RATE/)
    })
    await t.test('retención elimina datos y eventos antiguos sin acceso público al mantenimiento', async () => {
      await seed(); await create(await payload()); const r = await row()
      await db.query("update public.reservations set status='CANCELADA',starts_at=now()-interval '100 days',ends_at=now()-interval '99 days' where id=$1",[r.id])
      await assert.rejects(runAs('authenticated',admin,() => db.query('select public.maintenance_cleanup()')), /permission denied/)
      await runAs('service_role',null,() => db.query('select public.maintenance_cleanup()'))
      assert.equal((await db.query('select count(*)::integer as n from public.reservations')).rows[0].n,0)
    })
  } finally { await db.close() }
})
