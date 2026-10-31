-- Shim minimum agar migrasi Supabase dapat dijalankan di PGlite lokal.
-- JANGAN dijalankan di Supabase (skema auth sudah disediakan di sana).
create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
