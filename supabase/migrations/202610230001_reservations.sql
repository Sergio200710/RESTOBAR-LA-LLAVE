begin;
create extension if not exists btree_gist;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.restaurant_settings (
  id integer primary key default 1 check (id = 1),
  reservations_enabled boolean not null default false,
  horizon_days integer not null default 60 check (horizon_days between 1 and 365),
  retention_days integer not null default 90 check (retention_days between 1 and 730),
  privacy_controller text not null default '' check (length(privacy_controller) <= 300),
  privacy_contact text not null default '' check (length(privacy_contact) <= 300),
  privacy_notice text not null default '' check (length(privacy_notice) <= 10000),
  privacy_version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (not reservations_enabled or (length(trim(privacy_controller)) > 0 and length(trim(privacy_contact)) > 0 and length(trim(privacy_notice)) > 0))
);
insert into public.restaurant_settings(id) values (1);
create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 60),
  capacity integer not null check (capacity between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  step_minutes integer not null check (step_minutes between 5 and 240),
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens < closes),
  unique (weekday, opens),
  exclude using gist (weekday with =, (tsrange(date '2000-01-01' + opens, date '2000-01-01' + closes, '[)')) with &&) where (active)
);
create table public.exceptional_closures (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  reason text not null default '' check (length(reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on)
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  fingerprint text not null,
  customer_name text not null check (length(trim(customer_name)) between 2 and 100),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  notes text not null default '' check (length(notes) <= 1000),
  guests integer not null check (guests between 1 and 100),
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE','CONFIRMADA','RECHAZADA','CANCELADA')),
  privacy_accepted_at timestamptz not null default now(),
  privacy_version integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  exclude using gist (table_id with =, (tstzrange(starts_at, ends_at, '[)')) with &&) where (status in ('PENDIENTE','CONFIRMADA'))
);
create unique index reservation_phone_slot on public.reservations(phone, starts_at) where (status in ('PENDIENTE','CONFIRMADA'));
create index reservations_date_status on public.reservations(starts_at, status);
create index reservations_name on public.reservations(lower(customer_name));
create index reservations_table on public.reservations(table_id);
create index closures_dates on public.exceptional_closures(starts_on, ends_on);
create table private.rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
create table public.reservation_events (
  id bigint generated always as identity primary key,
  reservation_id uuid references public.reservations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event text not null,
  created_at timestamptz not null default now()
);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid() and active);
$$;
create function private.require_admin() returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'E_FORBIDDEN'; end if;
end; $$;
create function private.touch_updated() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end; $$;
create trigger reservations_updated before update on public.reservations for each row execute function private.touch_updated();
create trigger settings_updated before update on public.restaurant_settings for each row execute function private.touch_updated();
create trigger tables_updated before update on public.restaurant_tables for each row execute function private.touch_updated();
create trigger hours_updated before update on public.opening_hours for each row execute function private.touch_updated();
create trigger closures_updated before update on public.exceptional_closures for each row execute function private.touch_updated();

alter table public.admin_users enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.opening_hours enable row level security;
alter table public.exceptional_closures enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_events enable row level security;
create policy admin_self_read on public.admin_users for select to authenticated using (user_id = auth.uid());
create policy settings_admin_read on public.restaurant_settings for select to authenticated using (public.is_admin());
create policy tables_admin_read on public.restaurant_tables for select to authenticated using (public.is_admin());
create policy hours_admin_read on public.opening_hours for select to authenticated using (public.is_admin());
create policy closures_admin_read on public.exceptional_closures for select to authenticated using (public.is_admin());
create policy reservations_admin_read on public.reservations for select to authenticated using (public.is_admin());
create policy events_admin_read on public.reservation_events for select to authenticated using (public.is_admin());
revoke all on public.admin_users, public.restaurant_settings, public.restaurant_tables, public.opening_hours, public.exceptional_closures, public.reservations, public.reservation_events from anon, authenticated;
grant select on public.admin_users, public.restaurant_settings, public.restaurant_tables, public.opening_hours, public.exceptional_closures, public.reservations, public.reservation_events to authenticated;

-- All mutations take the same transaction lock, including configuration changes.
-- The exclusion constraint is an additional invariant against overlapping assignments.
create function private.slot_range(p_date date, p_time time, p_guests integer, p_check_future boolean default true) returns tstzrange language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz; v_end timestamptz; v_duration integer; v_close time;
begin
  if p_date is null or p_time is null or p_guests is null or p_guests not between 1 and 100 then raise exception 'E_INVALID'; end if;
  v_start := (p_date + p_time) at time zone 'Europe/Madrid';
  if p_check_future and (v_start <= now() or p_date > (now() at time zone 'Europe/Madrid')::date + (select horizon_days from public.restaurant_settings where id=1)) then raise exception 'E_DATE'; end if;
  -- Reject nonexistent and ambiguous daylight-saving clock times.
  if v_start at time zone 'Europe/Madrid' <> p_date + p_time or
    (v_start + interval '1 hour') at time zone 'Europe/Madrid' = p_date + p_time or
    (v_start - interval '1 hour') at time zone 'Europe/Madrid' = p_date + p_time then raise exception 'E_HOUR'; end if;
  if exists(select 1 from public.exceptional_closures where p_date between starts_on and ends_on) then raise exception 'E_CLOSED'; end if;
  select duration_minutes, closes into v_duration, v_close from public.opening_hours where active and weekday=extract(dow from p_date)::integer
    and p_time >= opens and p_time < closes
    and mod(extract(epoch from (p_time-opens))::numeric, step_minutes * 60)=0
    and p_date + p_time + make_interval(mins => duration_minutes) <= p_date + closes;
  if v_duration is null then raise exception 'E_HOUR'; end if;
  v_end := v_start + make_interval(mins => v_duration);
  if v_end at time zone 'Europe/Madrid' > p_date + v_close or (v_end at time zone 'Europe/Madrid')::date <> p_date then raise exception 'E_HOUR'; end if;
  return tstzrange(v_start, v_end, '[)');
end; $$;
create function private.choose_table(p_range tstzrange, p_guests integer, p_ignore uuid default null) returns uuid language sql security definer set search_path = '' as $$
  select t.id from public.restaurant_tables t where t.active and t.capacity >= p_guests
    and not exists(select 1 from public.reservations r where r.table_id=t.id and r.status in ('PENDIENTE','CONFIRMADA')
      and (p_ignore is null or r.id <> p_ignore) and tstzrange(r.starts_at,r.ends_at,'[)') && p_range)
    order by t.capacity, t.name limit 1;
$$;
create function public.public_booking_config() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('enabled', reservations_enabled and exists(select 1 from public.restaurant_tables where active) and exists(select 1 from public.opening_hours where active),
    'horizon_days', horizon_days, 'max_guests', coalesce((select max(capacity) from public.restaurant_tables where active),0),
    'privacy_controller',privacy_controller,'privacy_contact',privacy_contact,'privacy_notice',privacy_notice,'privacy_version',privacy_version)
  from public.restaurant_settings where id=1;
$$;
create function public.booking_slots(p_date date, p_guests integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_time time; v_range tstzrange; v_result jsonb := '[]'; v_min integer; v_hour record;
begin
  if not (public.public_booking_config()->>'enabled')::boolean then return v_result; end if;
  if p_date is null or p_guests is null or p_guests not between 1 and 100 or p_date < (now() at time zone 'Europe/Madrid')::date or p_date > (now() at time zone 'Europe/Madrid')::date + (select horizon_days from public.restaurant_settings where id=1) then return v_result; end if;
  for v_hour in select * from public.opening_hours where active and weekday=extract(dow from p_date)::integer order by opens loop
    v_min := 0;
    while p_date + v_hour.opens + make_interval(mins=>v_min + v_hour.duration_minutes) <= p_date + v_hour.closes loop
      v_time := (p_date + v_hour.opens + make_interval(mins=>v_min))::time;
      begin
        v_range := private.slot_range(p_date,v_time,p_guests);
        if private.choose_table(v_range,p_guests) is not null then v_result := v_result || jsonb_build_array(to_char(v_time,'HH24:MI')); end if;
      exception when raise_exception then null;
      end;
      v_min := v_min + v_hour.step_minutes;
    end loop;
  end loop;
  return v_result;
end; $$;
create function private.consume_rate(p_bucket text, p_window interval, p_max integer) returns void language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into private.rate_limits(bucket,window_start,attempts) values(p_bucket,now(),1)
    on conflict(bucket) do update set
      attempts=case when private.rate_limits.window_start < now()-p_window then 1 else private.rate_limits.attempts+1 end,
      window_start=case when private.rate_limits.window_start < now()-p_window then now() else private.rate_limits.window_start end
    returning attempts into v_count;
  if v_count > p_max then raise exception 'E_RATE'; end if;
end; $$;
create function public.create_reservation_request(p_data jsonb, p_network_hash text, p_contact_hash text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_range tstzrange; v_table uuid; v_fingerprint text; v_existing public.reservations; v_id uuid;
  v_name text := trim(p_data->>'name'); v_phone text := regexp_replace(p_data->>'phone','[\s().-]','','g');
begin
  perform pg_advisory_xact_lock(7442103);
  if p_network_hash is null or p_contact_hash is null or p_network_hash !~ '^[a-f0-9]{64}$' or p_contact_hash !~ '^[a-f0-9]{64}$' then raise exception 'E_INVALID'; end if;
  if p_data is null or v_name is null or length(v_name) not between 2 and 100 or v_phone is null or v_phone !~ '^\+?[0-9]{7,15}$' or coalesce(length(p_data->>'notes'),0)>1000
    or coalesce(p_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_data->>'time','') !~ '^\d{2}:\d{2}$'
    or p_data->>'request_id' is null or p_data->>'guests' is null or coalesce(p_data->>'privacy_accepted','') <> 'true' then raise exception 'E_INVALID'; end if;
  v_fingerprint := md5(jsonb_build_object('name',v_name,'phone',v_phone,'date',p_data->>'date','time',p_data->>'time','guests',(p_data->>'guests')::integer,'notes',coalesce(p_data->>'notes',''),'privacy_version',p_data->>'privacy_version')::text);
  select * into v_existing from public.reservations where request_id=(p_data->>'request_id')::uuid;
  if found then
    if v_existing.fingerprint<>v_fingerprint then raise exception 'E_INVALID'; end if;
    return jsonb_build_object('received',true);
  end if;
  if not (public.public_booking_config()->>'enabled')::boolean then raise exception 'E_DISABLED'; end if;
  if coalesce((p_data->>'privacy_version')::integer,0) <> (select privacy_version from public.restaurant_settings where id=1) then raise exception 'E_PRIVACY'; end if;
  perform private.consume_rate('ip:'||p_network_hash, interval '15 minutes',5);
  perform private.consume_rate('contact:'||p_contact_hash, interval '1 hour',3);
  v_range := private.slot_range((p_data->>'date')::date,(p_data->>'time')::time,(p_data->>'guests')::integer);
  -- Detect retries with a fresh request ID, without exposing any reservation data.
  select * into v_existing from public.reservations where phone=v_phone and starts_at=lower(v_range) and status in ('PENDIENTE','CONFIRMADA');
  if found then
    if v_existing.fingerprint=v_fingerprint then return jsonb_build_object('received',true); end if;
    raise exception 'E_INVALID';
  end if;
  v_table := private.choose_table(v_range,(p_data->>'guests')::integer);
  if v_table is null then raise exception 'E_FULL'; end if;
  insert into public.reservations(request_id,fingerprint,customer_name,phone,notes,guests,table_id,starts_at,ends_at,privacy_version)
    values((p_data->>'request_id')::uuid,v_fingerprint,v_name,v_phone,coalesce(p_data->>'notes',''),(p_data->>'guests')::integer,v_table,lower(v_range),upper(v_range),(p_data->>'privacy_version')::integer)
    returning id into v_id;
  insert into public.reservation_events(reservation_id,event) values(v_id,'SOLICITADA');
  return jsonb_build_object('received',true);
end; $$;

create function public.admin_update_reservation(p_id uuid, p_updated_at timestamptz, p_status text, p_date date, p_time time, p_guests integer) returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.reservations; v_range tstzrange; v_table uuid;
begin
  perform private.require_admin(); perform pg_advisory_xact_lock(7442103);
  select * into v_row from public.reservations where id=p_id for update;
  if not found then raise exception 'E_NOT_FOUND'; end if;
  if p_updated_at is null or v_row.updated_at<>p_updated_at then raise exception 'E_STALE'; end if;
  if p_status is null or not ((v_row.status='PENDIENTE' and p_status in ('PENDIENTE','CONFIRMADA','RECHAZADA','CANCELADA')) or (v_row.status='CONFIRMADA' and p_status in ('CONFIRMADA','CANCELADA'))) then raise exception 'E_STATE'; end if;
  if p_status in ('PENDIENTE','CONFIRMADA') then
    v_range := private.slot_range(p_date,p_time,p_guests);
    v_table := private.choose_table(v_range,p_guests,p_id);
    if v_table is null then raise exception 'E_FULL'; end if;
    update public.reservations set status=p_status,starts_at=lower(v_range),ends_at=upper(v_range),guests=p_guests,table_id=v_table where id=p_id;
  else update public.reservations set status=p_status where id=p_id;
  end if;
  insert into public.reservation_events(reservation_id,actor_id,event) values(p_id,auth.uid(),p_status);
end; $$;

create function public.admin_save_configuration(p_kind text, p_data jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()); v_res public.reservations; v_range tstzrange;
begin
  perform private.require_admin(); perform pg_advisory_xact_lock(7442103);
  if p_kind='settings' then
    update public.restaurant_settings set reservations_enabled=(p_data->>'reservations_enabled')::boolean,horizon_days=(p_data->>'horizon_days')::integer,
      retention_days=(p_data->>'retention_days')::integer,privacy_controller=trim(p_data->>'privacy_controller'),privacy_contact=trim(p_data->>'privacy_contact'),privacy_notice=trim(p_data->>'privacy_notice'),
      privacy_version=privacy_version + case when privacy_notice is distinct from trim(p_data->>'privacy_notice') or privacy_controller is distinct from trim(p_data->>'privacy_controller') or privacy_contact is distinct from trim(p_data->>'privacy_contact') then 1 else 0 end where id=1;
  elsif p_kind='table' then
    insert into public.restaurant_tables(id,name,capacity,active) values(v_id,trim(p_data->>'name'),(p_data->>'capacity')::integer,(p_data->>'active')::boolean)
      on conflict(id) do update set name=excluded.name,capacity=excluded.capacity,active=excluded.active;
  elsif p_kind='hours' then
    insert into public.opening_hours(id,weekday,opens,closes,step_minutes,duration_minutes,active)
      values(v_id,(p_data->>'weekday')::integer,(p_data->>'opens')::time,(p_data->>'closes')::time,(p_data->>'step_minutes')::integer,(p_data->>'duration_minutes')::integer,(p_data->>'active')::boolean)
      on conflict(id) do update set weekday=excluded.weekday,opens=excluded.opens,closes=excluded.closes,step_minutes=excluded.step_minutes,duration_minutes=excluded.duration_minutes,active=excluded.active;
  elsif p_kind='closure' then
    insert into public.exceptional_closures(id,starts_on,ends_on,reason) values(v_id,(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,coalesce(p_data->>'reason',''))
      on conflict(id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,reason=excluded.reason;
  elsif p_kind='delete_closure' then delete from public.exceptional_closures where id=(p_data->>'id')::uuid;
  else raise exception 'E_INVALID'; end if;
  -- Configuration cannot invalidate existing pending or confirmed assignments.
  for v_res in select * from public.reservations where status in ('PENDIENTE','CONFIRMADA') and ends_at>now() loop
    if not exists(select 1 from public.restaurant_tables where id=v_res.table_id and active and capacity>=v_res.guests) then raise exception 'E_BOOKED_CONFIG'; end if;
    begin
      v_range := private.slot_range((v_res.starts_at at time zone 'Europe/Madrid')::date,(v_res.starts_at at time zone 'Europe/Madrid')::time,v_res.guests,false);
      if v_range<>tstzrange(v_res.starts_at,v_res.ends_at,'[)') then raise exception 'E_BOOKED_CONFIG'; end if;
    exception when raise_exception then raise exception 'E_BOOKED_CONFIG'; end;
  end loop;
end; $$;

create function public.maintenance_cleanup() returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(7442103);
  delete from public.reservations where ends_at < now() - make_interval(days=>(select retention_days from public.restaurant_settings where id=1));
  delete from private.rate_limits where window_start < now()-interval '1 day';
end; $$;

-- Functions are executable by PUBLIC by default: explicitly revoke every entry.
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.is_admin(), public.public_booking_config(), public.booking_slots(date,integer), public.create_reservation_request(jsonb,text,text), public.admin_update_reservation(uuid,timestamptz,text,date,time,integer), public.admin_save_configuration(text,jsonb), public.maintenance_cleanup() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.public_booking_config(), public.booking_slots(date,integer) to anon, authenticated;
grant execute on function public.admin_update_reservation(uuid,timestamptz,text,date,time,integer), public.admin_save_configuration(text,jsonb) to authenticated;
grant execute on function public.create_reservation_request(jsonb,text,text), public.maintenance_cleanup() to service_role;
commit;
