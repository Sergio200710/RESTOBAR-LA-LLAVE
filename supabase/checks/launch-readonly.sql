-- Inventario previo al lanzamiento. Ejecutar solo en el proyecto identificado.
-- No consulta reservas, teléfonos, correos ni secretos. No modifica datos.
begin transaction read only;
set local statement_timeout = '15s';

select current_database() as database_name,
  to_regclass('supabase_migrations.schema_migrations') is not null as has_migration_history;

do $$
declare migration_version text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'Historial ausente: no implica que el esquema esté vacío.';
  else
    for migration_version in execute
      'select version::text from supabase_migrations.schema_migrations order by version'
    loop
      raise notice 'Migración registrada: %', migration_version;
    end loop;
  end if;
end $$;

select expected.object_name, c.oid is not null as present,
  c.relrowsecurity as rls_enabled
from (values
  ('public.admin_users'), ('public.restaurant_settings'),
  ('public.restaurant_tables'), ('public.opening_hours'),
  ('public.exceptional_closures'), ('public.reservations'),
  ('public.reservation_events'), ('private.rate_limits')
) as expected(object_name)
left join pg_class c on c.oid = to_regclass(expected.object_name)
order by expected.object_name;

select n.nspname as schema_name, p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer, p.proconfig as function_settings,
  p.proacl as execution_grants
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in (
  'is_admin','public_booking_config','booking_slots',
  'create_reservation_request','register_reservation_attempt',
  'admin_reservations','admin_dashboard','admin_calendar',
  'admin_update_reservation','admin_save_configuration','maintenance_cleanup'
)
order by n.nspname,p.proname;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename in (
  'admin_users','restaurant_settings','restaurant_tables','opening_hours',
  'exceptional_closures','reservations','reservation_events'
)) or (schemaname='private' and tablename='rate_limits')
order by schemaname,tablename,policyname;

rollback;
