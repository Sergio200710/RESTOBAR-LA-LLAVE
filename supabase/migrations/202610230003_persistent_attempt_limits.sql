begin;

-- Additive migration: 001/002 may already be deployed and must remain unchanged.
-- Called ONLY by the Edge Function, as a separate RPC which must commit BEFORE
-- create_reservation_request. A subsequent booking rollback cannot undo it.
-- Existing successful-booking quotas in 001 remain in force, independently.
create function public.register_reservation_attempt(p_data jsonb, p_network_hash text, p_contact_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_network private.rate_limits;
  v_contact private.rate_limits;
  v_network_count integer;
  v_contact_count integer;
  v_now timestamptz;
  v_retry_after integer := 0;
  v_fingerprint text;
  v_request_id uuid;
begin
  if p_network_hash is null or p_contact_hash is null
    or p_network_hash !~ '^[a-f0-9]{64}$' or p_contact_hash !~ '^[a-f0-9]{64}$'
    or p_data is null or p_data->>'request_id' is null then raise exception 'E_INVALID'; end if;
  v_request_id := (p_data->>'request_id')::uuid;
  -- Same canonical fingerprint as 001. An already committed, identical request
  -- may be acknowledged after a lost response without charging the customer twice.
  -- Failed or modified requests do NOT get this exemption, even with the same UUID.
  v_fingerprint := md5(jsonb_build_object('name',trim(p_data->>'name'),
    'phone',regexp_replace(p_data->>'phone','[\s().-]','','g'),
    'date',p_data->>'date','time',p_data->>'time','guests',(p_data->>'guests')::integer,
    'notes',coalesce(p_data->>'notes',''),'privacy_version',p_data->>'privacy_version')::text);
  if exists(select 1 from public.reservations where request_id=v_request_id and fingerprint=v_fingerprint) then
    return jsonb_build_object('allowed',true,'retry_after',0);
  end if;

  -- A short, independent transaction lock serializes check + charge across
  -- sessions, including first use of an absent bucket. No booking lock is held.
  perform pg_advisory_xact_lock(7442104);
  v_now := clock_timestamp();
  select * into v_network from private.rate_limits where bucket='attempt-ip:'||p_network_hash;
  select * into v_contact from private.rate_limits where bucket='attempt-contact:'||p_contact_hash;
  v_network_count := case when v_network.window_start > v_now-interval '15 minutes' then v_network.attempts else 0 end;
  v_contact_count := case when v_contact.window_start > v_now-interval '15 minutes' then v_contact.attempts else 0 end;

  -- Failed availability attempts need a little more room than successful bookings:
  -- 15 verified attempts / network and 6 / contact in a fixed 15-minute window.
  -- A denied request never extends a window or drains the other customer's quota.
  if v_network_count >= 15 then
    v_retry_after := greatest(1,ceil(extract(epoch from v_network.window_start+interval '15 minutes'-v_now))::integer);
  end if;
  if v_contact_count >= 6 then
    v_retry_after := greatest(v_retry_after,1,ceil(extract(epoch from v_contact.window_start+interval '15 minutes'-v_now))::integer);
  end if;
  if v_retry_after > 0 then
    -- Return a decision, not an exception. The RPC completes normally.
    return jsonb_build_object('allowed',false,'retry_after',v_retry_after);
  end if;

  insert into private.rate_limits(bucket,window_start,attempts) values
    ('attempt-ip:'||p_network_hash,case when v_network_count=0 then v_now else v_network.window_start end,v_network_count+1),
    ('attempt-contact:'||p_contact_hash,case when v_contact_count=0 then v_now else v_contact.window_start end,v_contact_count+1)
    on conflict(bucket) do update set window_start=excluded.window_start,attempts=excluded.attempts;
  return jsonb_build_object('allowed',true,'retry_after',0);
end; $$;

revoke all on function public.register_reservation_attempt(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.register_reservation_attempt(jsonb,text,text) to service_role;
-- private.rate_limits stays under its existing restrictive RLS and schema grants.
-- maintenance_cleanup already removes all expired buckets, including these prefixes.
commit;
