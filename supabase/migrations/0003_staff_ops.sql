-- RujukCepat: akun petugas demo, pembaruan fasilitas atomik, dan perbaikan lifecycle (T10-T12).
-- Dapat dijalankan ulang.

-- ---------------------------------------------------------------- kredensial petugas demo
-- Login petugas ditangani server (cookie bertanda tangan). Tabel ini tidak punya policy RLS
-- sehingga tidak terbaca oleh klien anon/authenticated; hanya server (service role / koneksi langsung).
create table if not exists staff_credentials (
  user_id uuid primary key references staff_members(user_id) on delete cascade,
  email text not null unique,
  password_hash text not null
);
alter table staff_credentials enable row level security;

-- ---------------------------------------------------------------- lifecycle
-- Perbaikan T10: ARRIVED hanya sekali; REVOKE tidak sah setelah pasien tiba
-- (reservasi sudah CONSUMED dan tidak dapat dilepas lagi).
create or replace function transition_referral(
  p_referral uuid, p_action text, p_actor uuid, p_note text
) returns referral_status language plpgsql security definer as $$
declare
  v_status referral_status;
  v_hospital uuid;
  v_arrived timestamptz;
  v_new referral_status;
begin
  perform expire_stale_referrals(null);
  select status, hospital_id, arrived_at into v_status, v_hospital, v_arrived
    from referral_requests where id = p_referral for update;
  if not found then
    raise exception 'REFERRAL_NOT_FOUND';
  end if;

  if p_action = 'ACCEPT' and v_status = 'PENDING' then
    v_new := 'ACCEPTED';
  elsif p_action = 'REJECT' and v_status = 'PENDING' then
    v_new := 'REJECTED';
    perform release_reservation(p_referral, 'REJECTED');
  elsif p_action = 'CANCEL' and v_status = 'PENDING' then
    v_new := 'CANCELLED';
    perform release_reservation(p_referral, 'CANCELLED');
  elsif p_action = 'REVOKE' and v_status = 'ACCEPTED' and v_arrived is null then
    v_new := 'CANCELLED';
    perform release_reservation(p_referral, 'REVOKED');
  elsif p_action = 'ARRIVED' and v_status = 'ACCEPTED' and v_arrived is null then
    update quota_reservations set status = 'CONSUMED'
     where referral_id = p_referral and status = 'HELD';
    update referral_requests set arrived_at = now(), updated_at = now() where id = p_referral;
    insert into referral_events (referral_id, hospital_id, type, actor)
    values (p_referral, v_hospital, 'ARRIVED', p_actor);
    return v_status;
  else
    raise exception 'INVALID_TRANSITION';
  end if;

  update referral_requests
     set status = v_new, updated_at = now(),
         decided_at = case when p_action in ('ACCEPT','REJECT','REVOKE') then now() else decided_at end,
         decided_by = case when p_action in ('ACCEPT','REJECT','REVOKE') then p_actor else decided_by end,
         decision_note = coalesce(p_note, decision_note)
   where id = p_referral;
  insert into referral_events (referral_id, hospital_id, type, actor, payload)
  values (p_referral, v_hospital, p_action, p_actor, jsonb_build_object('to', v_new));
  return v_new;
end $$;

-- ---------------------------------------------------------------- pembaruan fasilitas oleh petugas
-- p_caps: [{ "code": "CATH_LAB", "status": "PENUH" }, ...] - hanya kapabilitas yang sudah dimiliki RS.
-- Memperbarui updated_at walau status sama (petugas mengonfirmasi status masih berlaku).
-- Edit kapasitas manual tidak mengubah reservasi HELD; dicatat di referral_events (tanpa data kesehatan).
create or replace function update_facility(
  p_hospital uuid, p_actor uuid, p_caps jsonb, p_total int, p_available int
) returns void language plpgsql security definer as $$
declare
  c jsonb;
  v_total int;
  v_avail int;
  v_n int;
begin
  select total_slots, available_slots into v_total, v_avail
    from hospital_capacity where hospital_id = p_hospital for update;
  if not found then
    raise exception 'HOSPITAL_NOT_FOUND';
  end if;

  if p_caps is not null then
    for c in select * from jsonb_array_elements(p_caps) loop
      update hospital_capabilities
         set status = (c->>'status')::capability_status,
             updated_at = now(), updated_by = p_actor,
             source = 'DASHBOARD_SIMULASI'
       where hospital_id = p_hospital and code = (c->>'code')::capability_code;
      get diagnostics v_n = row_count;
      if v_n = 0 then
        raise exception 'CAPABILITY_NOT_OFFERED';
      end if;
      insert into referral_events (hospital_id, type, actor, payload)
      values (p_hospital, 'CAPABILITY_UPDATED', p_actor,
              jsonb_build_object('code', c->>'code', 'status', c->>'status'));
    end loop;
  end if;

  if p_total is not null or p_available is not null then
    v_total := coalesce(p_total, v_total);
    v_avail := coalesce(p_available, v_avail);
    if v_total < 0 or v_avail < 0 or v_avail > v_total then
      raise exception 'INVALID_CAPACITY';
    end if;
    update hospital_capacity
       set total_slots = v_total, available_slots = v_avail,
           is_simulated = true, updated_at = now()
     where hospital_id = p_hospital;
    insert into referral_events (hospital_id, type, actor, payload)
    values (p_hospital, 'CAPACITY_UPDATED', p_actor,
            jsonb_build_object('total_slots', v_total, 'available_slots', v_avail));
  end if;
end $$;
