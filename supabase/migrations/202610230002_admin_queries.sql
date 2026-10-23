begin;
create function public.admin_reservations(p_date date default null, p_status text default null, p_search text default '', p_offset integer default 0) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_total bigint; v_items jsonb;
begin
  perform private.require_admin();
  if p_offset<0 or p_offset>100000 or length(p_search)>100 then raise exception 'E_INVALID'; end if;
  select count(*) into v_total from public.reservations where
    (p_date is null or (starts_at at time zone 'Europe/Madrid')::date=p_date)
    and (p_status is null or status=p_status) and strpos(lower(customer_name),lower(p_search))>0;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_items from (
    select id,customer_name,phone,notes,guests,table_id,starts_at,ends_at,status,updated_at from public.reservations where
      (p_date is null or (starts_at at time zone 'Europe/Madrid')::date=p_date)
      and (p_status is null or status=p_status) and strpos(lower(customer_name),lower(p_search))>0
      order by starts_at desc,id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('items',v_items,'total',v_total);
end; $$;
create function public.admin_dashboard() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select jsonb_build_object('PENDIENTE',count(*) filter(where status='PENDIENTE'),'CONFIRMADA',count(*) filter(where status='CONFIRMADA'),
    'RECHAZADA',count(*) filter(where status='RECHAZADA'),'CANCELADA',count(*) filter(where status='CANCELADA'),
    'today',count(*) filter(where (starts_at at time zone 'Europe/Madrid')::date=(now() at time zone 'Europe/Madrid')::date)) from public.reservations);
end; $$;
create function public.admin_calendar(p_month date) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform private.require_admin();
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_result from (
    select (starts_at at time zone 'Europe/Madrid')::date as day,status,count(*) as count from public.reservations
      where (starts_at at time zone 'Europe/Madrid')::date >= date_trunc('month',p_month)::date
      and (starts_at at time zone 'Europe/Madrid')::date < (date_trunc('month',p_month) + interval '1 month')::date
    group by 1,status order by 1
  ) q;
  return v_result;
end; $$;
revoke all on function public.admin_reservations(date,text,text,integer), public.admin_dashboard(), public.admin_calendar(date) from public, anon, authenticated;
grant execute on function public.admin_reservations(date,text,text,integer), public.admin_dashboard(), public.admin_calendar(date) to authenticated;
commit;
