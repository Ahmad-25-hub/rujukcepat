-- RujukCepat: schema awal (T03).
-- Dapat dijalankan pada Supabase (auth.uid() bawaan) maupun PGlite lokal
-- (memakai shim supabase/local/auth-shim.sql yang dijalankan lebih dulu).
-- Seluruh status kapabilitas/kapasitas adalah SIMULASI demo.

-- ---------------------------------------------------------------- enum
do $$ begin
  create type capability_code as enum (
    'IGD_DASAR','CATH_LAB','CT_SCAN','ICU_VENTILATOR',
    'PONEK_NICU','TRAUMA_BEDAH','HEMODIALISA','ANTI_BISA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type capability_status as enum ('READY','PENUH','MAINTENANCE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgency_level as enum ('MERAH','KUNING','HIJAU');
exception when duplicate_object then null; end $$;

do $$ begin
  create type referral_status as enum ('PENDING','ACCEPTED','REJECTED','CANCELLED','EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum ('HELD','RELEASED','CONSUMED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- tabel
create table if not exists hospitals (
  id uuid primary key,
  name text not null,
  short_name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  osm_id text unique,
  location_source text not null default 'OSM',
  location_fetched_at timestamptz,
  -- false: lokasi dari peta publik tidak menyiratkan kemitraan.
  is_demo_partner boolean not null default false
);

create table if not exists hospital_capabilities (
  hospital_id uuid not null references hospitals(id) on delete cascade,
  code capability_code not null,
  status capability_status not null,
  is_simulated boolean not null default true,
  source text not null default 'SEED_SIMULASI',
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (hospital_id, code)
);

create table if not exists hospital_capacity (
  hospital_id uuid primary key references hospitals(id) on delete cascade,
  total_slots int not null check (total_slots >= 0),
  available_slots int not null check (available_slots >= 0),
  is_simulated boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint capacity_not_over_total check (available_slots <= total_slots)
);

create table if not exists staff_members (
  user_id uuid primary key,
  hospital_id uuid not null references hospitals(id) on delete cascade,
  display_name text not null,
  is_demo_admin boolean not null default false
);

create table if not exists referral_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  hospital_id uuid not null references hospitals(id),
  status referral_status not null default 'PENDING',
  ai_result jsonb not null,
  urgency urgency_level,
  needs capability_code[] not null,
  required_needs capability_code[] not null,
  eta_seconds int,
  eta_source text check (eta_source in ('OSRM','MOCK')),
  origin_lat numeric(8,3) not null,
  origin_lng numeric(8,3) not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_at timestamptz,
  decided_by uuid,
  decision_note text,
  arrived_at timestamptz,
  unique (requester_id, idempotency_key)
);
create index if not exists referral_requests_hospital_idx on referral_requests (hospital_id, status);

create table if not exists quota_reservations (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references referral_requests(id) on delete cascade,
  hospital_id uuid not null references hospitals(id),
  status reservation_status not null default 'HELD',
  held_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text
);

create table if not exists referral_events (
  id bigint generated always as identity primary key,
  referral_id uuid references referral_requests(id) on delete cascade,
  hospital_id uuid references hospitals(id) on delete cascade,
  type text not null,
  actor uuid,
  at timestamptz not null default now(),
  -- tanpa data kesehatan; hanya status/angka teknis
  payload jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------- view publik
-- Hanya data fasilitas yang boleh publik; tanpa data pasien.
create or replace view facility_public_status as
select
  h.id, h.name, h.short_name, h.lat, h.lng, h.address, h.osm_id,
  h.location_source, h.location_fetched_at,
  c.total_slots, c.available_slots, c.updated_at as capacity_updated_at, c.is_simulated,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
        'code', hc.code, 'status', hc.status, 'updated_at', hc.updated_at,
        'is_simulated', hc.is_simulated, 'source', hc.source) order by hc.code)
     from hospital_capabilities hc where hc.hospital_id = h.id),
    '[]'::jsonb) as capabilities
from hospitals h
join hospital_capacity c on c.hospital_id = h.id;

-- ---------------------------------------------------------------- lifecycle
-- PENDING --terima--> ACCEPTED --pasien tiba--> (reservasi CONSUMED)
--         --tolak---> REJECTED   (reservasi RELEASED)
--         --batal---> CANCELLED  (reservasi RELEASED)
--         --expiry--> EXPIRED    (reservasi RELEASED)
-- ACCEPTED --REVOKE (petugas, beralasan)--> CANCELLED (reservasi RELEASED)

-- Melepas reservasi tepat satu kali; slot dikembalikan hanya jika baris HELD ter-update.
create or replace function release_reservation(p_referral uuid, p_reason text)
returns boolean language plpgsql as $$
declare v_hospital uuid;
begin
  update quota_reservations
     set status = 'RELEASED', released_at = now(), release_reason = p_reason
   where referral_id = p_referral and status = 'HELD'
  returning hospital_id into v_hospital;
  if v_hospital is null then
    return false;
  end if;
  update hospital_capacity
     set available_slots = least(total_slots, available_slots + 1), updated_at = now()
   where hospital_id = v_hospital;
  insert into referral_events (referral_id, hospital_id, type, payload)
  values (p_referral, v_hospital, 'QUOTA_RELEASED', jsonb_build_object('reason', p_reason));
  return true;
end $$;

-- Expiry malas (lazy): dipanggil di awal transaksi & pembacaan, tanpa cron.
create or replace function expire_stale_referrals(p_hospital uuid default null)
returns int language plpgsql as $$
declare r record; n int := 0;
begin
  for r in
    select id from referral_requests
     where status = 'PENDING' and expires_at <= now()
       and (p_hospital is null or hospital_id = p_hospital)
     for update skip locked
  loop
    update referral_requests set status = 'EXPIRED', updated_at = now() where id = r.id;
    perform release_reservation(r.id, 'EXPIRED');
    insert into referral_events (referral_id, type) values (r.id, 'EXPIRED');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Transaksi atomik pembuatan rujukan + reservasi kuota (SPEC §8.2).
-- Mengembalikan jsonb { referral_id, created(bool) } atau RAISE
-- 'NO_CAPACITY' / 'CAPABILITY_CHANGED' / 'HOSPITAL_NOT_FOUND'.
create or replace function create_referral(
  p_requester uuid,
  p_idempotency_key text,
  p_hospital uuid,
  p_ai_result jsonb,
  p_urgency urgency_level,
  p_needs capability_code[],
  p_required capability_code[],
  p_eta_seconds int,
  p_eta_source text,
  p_lat double precision,
  p_lng double precision,
  p_ttl_seconds int,
  p_stale_minutes int
) returns jsonb language plpgsql security definer as $$
declare
  v_existing uuid;
  v_slots int;
  v_missing int;
  v_id uuid;
begin
  select id into v_existing from referral_requests
   where requester_id = p_requester and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return jsonb_build_object('referral_id', v_existing, 'created', false);
  end if;

  perform expire_stale_referrals(p_hospital);

  select available_slots into v_slots from hospital_capacity
   where hospital_id = p_hospital for update;
  if not found then
    raise exception 'HOSPITAL_NOT_FOUND';
  end if;

  select count(*) into v_missing
    from unnest(p_required) as req(code)
   where not exists (
     select 1 from hospital_capabilities hc
      where hc.hospital_id = p_hospital and hc.code = req.code
        and hc.status = 'READY'
        and hc.updated_at > now() - make_interval(mins => p_stale_minutes));
  if v_missing > 0 then
    raise exception 'CAPABILITY_CHANGED';
  end if;
  if v_slots <= 0 then
    raise exception 'NO_CAPACITY';
  end if;

  -- Klik ganda serentak: kunci baris kapasitas di atas menyerialkan transaksi,
  -- dan unique (requester_id, idempotency_key) menjadi pengaman terakhir.
  select id into v_existing from referral_requests
   where requester_id = p_requester and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return jsonb_build_object('referral_id', v_existing, 'created', false);
  end if;

  insert into referral_requests (
    requester_id, hospital_id, status, ai_result, urgency, needs, required_needs,
    eta_seconds, eta_source, origin_lat, origin_lng, idempotency_key, expires_at)
  values (
    p_requester, p_hospital, 'PENDING', p_ai_result, p_urgency, p_needs, p_required,
    p_eta_seconds, p_eta_source, round(p_lat::numeric, 3), round(p_lng::numeric, 3),
    p_idempotency_key, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;

  insert into quota_reservations (referral_id, hospital_id, status) values (v_id, p_hospital, 'HELD');
  update hospital_capacity
     set available_slots = available_slots - 1, updated_at = now()
   where hospital_id = p_hospital;
  insert into referral_events (referral_id, hospital_id, type, actor)
  values (v_id, p_hospital, 'CREATED', p_requester);

  return jsonb_build_object('referral_id', v_id, 'created', true);
end $$;

-- Transisi status oleh petugas/pelapor. RAISE 'INVALID_TRANSITION' bila tidak sah.
create or replace function transition_referral(
  p_referral uuid, p_action text, p_actor uuid, p_note text
) returns referral_status language plpgsql security definer as $$
declare
  v_status referral_status;
  v_hospital uuid;
  v_new referral_status;
begin
  perform expire_stale_referrals(null);
  select status, hospital_id into v_status, v_hospital
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
  elsif p_action = 'REVOKE' and v_status = 'ACCEPTED' then
    v_new := 'CANCELLED';
    perform release_reservation(p_referral, 'REVOKED');
  elsif p_action = 'ARRIVED' and v_status = 'ACCEPTED' then
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

-- ---------------------------------------------------------------- RLS
alter table hospitals enable row level security;
alter table hospital_capabilities enable row level security;
alter table hospital_capacity enable row level security;
alter table staff_members enable row level security;
alter table referral_requests enable row level security;
alter table quota_reservations enable row level security;
alter table referral_events enable row level security;

create or replace function staff_hospital_id() returns uuid
language sql stable security definer as $$
  select hospital_id from staff_members where user_id = auth.uid()
$$;

drop policy if exists hospitals_public_read on hospitals;
create policy hospitals_public_read on hospitals for select using (true);

drop policy if exists capabilities_read on hospital_capabilities;
create policy capabilities_read on hospital_capabilities for select using (true);
drop policy if exists capabilities_staff_update on hospital_capabilities;
create policy capabilities_staff_update on hospital_capabilities for update
  using (hospital_id = staff_hospital_id()) with check (hospital_id = staff_hospital_id());

drop policy if exists capacity_read on hospital_capacity;
create policy capacity_read on hospital_capacity for select using (true);
drop policy if exists capacity_staff_update on hospital_capacity;
create policy capacity_staff_update on hospital_capacity for update
  using (hospital_id = staff_hospital_id()) with check (hospital_id = staff_hospital_id());

drop policy if exists staff_self_read on staff_members;
create policy staff_self_read on staff_members for select using (user_id = auth.uid());

drop policy if exists referrals_owner_read on referral_requests;
create policy referrals_owner_read on referral_requests for select
  using (requester_id = auth.uid() or hospital_id = staff_hospital_id());

drop policy if exists reservations_read on quota_reservations;
create policy reservations_read on quota_reservations for select
  using (hospital_id = staff_hospital_id()
         or exists (select 1 from referral_requests r
                     where r.id = referral_id and r.requester_id = auth.uid()));

drop policy if exists events_staff_read on referral_events;
create policy events_staff_read on referral_events for select
  using (hospital_id = staff_hospital_id());
-- INSERT/UPDATE rujukan & reservasi hanya melalui fungsi di atas (dipanggil server).
