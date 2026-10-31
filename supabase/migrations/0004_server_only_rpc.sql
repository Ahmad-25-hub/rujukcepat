-- Sesi aplikasi memakai cookie Next.js, bukan Supabase Auth.
-- Fungsi mutasi hanya boleh dipanggil koneksi SQL server setelah otorisasi route.
-- RLS saja tidak membatasi pemanggilan fungsi SECURITY DEFINER melalui Data API.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_referral', 'transition_referral', 'update_facility',
      'release_reservation', 'expire_stale_referrals')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
    execute format('alter function %s set search_path = public, pg_temp', f.signature);
  end loop;
end $$;
