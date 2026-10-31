-- RujukCepat: detail RS dari OpenStreetMap (01-11-2026). Hanya menambah kolom; tidak menghapus data.
-- Dapat dijalankan ulang.

alter table hospitals add column if not exists phone text;
alter table hospitals add column if not exists website text;
-- Jumlah tempat tidur/kamar bila tercantum di OSM (beds/rooms); null = tidak diketahui.
alter table hospitals add column if not exists beds int;
-- UMUM | IBU_ANAK | JANTUNG | ORTOPEDI (dari nama RS); menentukan kapabilitas bawaan impor.
alter table hospitals add column if not exists hospital_type text;

-- Kolom baru ditambahkan di akhir agar CREATE OR REPLACE VIEW tetap sah.
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
    '[]'::jsonb) as capabilities,
  h.phone, h.website
from hospitals h
join hospital_capacity c on c.hospital_id = h.id;
