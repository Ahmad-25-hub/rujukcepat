-- Seed demo RujukCepat. Idempoten: dapat dijalankan ulang.
-- LOKASI: snapshot OpenStreetMap (data/hospitals.osm.json, diambil 2026-10-31) © OpenStreetMap contributors.
-- KAPABILITAS & KAPASITAS: SIMULASI, bukan data nyata dan bukan bukti kemitraan/kesiapan.
-- Variasi sengaja: delapan kode, PENUH, MAINTENANCE, kapasitas nol, dan status kedaluwarsa.
-- Menjalankan ulang seed MENGEMBALIKAN kapasitas/kapabilitas ke nilai awal.

insert into hospitals (id, name, short_name, lat, lng, address, osm_id, location_source, location_fetched_at, is_demo_partner) values
 ('00000000-0000-4000-8000-000000000001','Rumah Sakit Cipto Mangunkusumo','RSCM',-6.1971484,106.8471306,'DKI Jakarta','way/491244198','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000002','Rumah Sakit Umum Pusat Fatmawati','RSUP Fatmawati',-6.2952467,106.7962661,'Jl. RS. Fatmawati Raya, DKI Jakarta','way/513565284','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000003','RSUD Tarakan','RSUD Tarakan',-6.1716313,106.8103422,'Jl. Kyai Caringin No.7, Jakarta Pusat','way/492535915','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000004','RSUD Pasar Minggu Jakarta','RSUD Pasar Minggu',-6.293984,106.8198692,'Jalan Tahi Bonar Simatupang, Jakarta Selatan','way/917333594','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000005','Rumah Sakit Pusat Otak Nasional Prof. Dr. dr. Mahar Mardjono Jakarta','RS PON',-6.2463095,106.8696599,'Jakarta Timur','way/927020149','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000006','Rumah Sakit Umum Persahabatan','RSUP Persahabatan',-6.2047966,106.8842734,'Jalan Persahabatan Raya, DKI Jakarta','way/153318583','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000007','Rumah Sakit Umum Daerah (RSUD) Koja','RSUD Koja',-6.1089611,106.9000678,'DKI Jakarta','way/517559312','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000008','RSUD Cengkareng','RSUD Cengkareng',-6.1429663,106.7348955,null,'way/783775577','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000009','RSUD Budhi Asih','RSUD Budhi Asih',-6.2560273,106.862978,null,'node/11879123942','OSM','2026-10-31T05:40:47Z',false),
 ('00000000-0000-4000-8000-000000000010','Rumah Sakit Umum Kramat Jati','RSUD Kramat Jati',-6.2868559,106.8623328,'DKI Jakarta','way/489540663','OSM','2026-10-31T05:40:47Z',false)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, lat = excluded.lat, lng = excluded.lng,
  address = excluded.address, osm_id = excluded.osm_id, location_source = excluded.location_source,
  location_fetched_at = excluded.location_fetched_at, is_demo_partner = excluded.is_demo_partner;

-- Kapabilitas yang tidak tercantum = tidak ditawarkan RS tersebut (dalam simulasi).
delete from hospital_capabilities where hospital_id in (select id from hospitals where id::text like '00000000-0000-4000-8000-%');

insert into hospital_capabilities (hospital_id, code, status, is_simulated, source, updated_at)
select h::uuid, c::capability_code, s::capability_status, true, 'SEED_SIMULASI', now() - (age_min || ' minutes')::interval
from (values
 -- RSCM: tujuh kode READY (tanpa ANTI_BISA, agar kombinasi HEMODIALISA+ANTI_BISA tanpa kandidat)
 ('00000000-0000-4000-8000-000000000001','IGD_DASAR','READY',5),
 ('00000000-0000-4000-8000-000000000001','CATH_LAB','READY',5),
 ('00000000-0000-4000-8000-000000000001','CT_SCAN','READY',5),
 ('00000000-0000-4000-8000-000000000001','ICU_VENTILATOR','READY',5),
 ('00000000-0000-4000-8000-000000000001','PONEK_NICU','READY',5),
 ('00000000-0000-4000-8000-000000000001','TRAUMA_BEDAH','READY',5),
 ('00000000-0000-4000-8000-000000000001','HEMODIALISA','READY',5),
 -- RSUP Fatmawati: ICU PENUH, ANTI_BISA MAINTENANCE
 ('00000000-0000-4000-8000-000000000002','IGD_DASAR','READY',10),
 ('00000000-0000-4000-8000-000000000002','CATH_LAB','READY',10),
 ('00000000-0000-4000-8000-000000000002','CT_SCAN','READY',10),
 ('00000000-0000-4000-8000-000000000002','ICU_VENTILATOR','PENUH',10),
 ('00000000-0000-4000-8000-000000000002','PONEK_NICU','READY',10),
 ('00000000-0000-4000-8000-000000000002','TRAUMA_BEDAH','READY',10),
 ('00000000-0000-4000-8000-000000000002','HEMODIALISA','READY',10),
 ('00000000-0000-4000-8000-000000000002','ANTI_BISA','MAINTENANCE',10),
 -- RSUD Tarakan: HEMODIALISA MAINTENANCE
 ('00000000-0000-4000-8000-000000000003','IGD_DASAR','READY',3),
 ('00000000-0000-4000-8000-000000000003','CT_SCAN','READY',3),
 ('00000000-0000-4000-8000-000000000003','PONEK_NICU','READY',3),
 ('00000000-0000-4000-8000-000000000003','TRAUMA_BEDAH','READY',3),
 ('00000000-0000-4000-8000-000000000003','HEMODIALISA','MAINTENANCE',3),
 -- RSUD Pasar Minggu: kapasitas nol (lihat bawah), CATH_LAB MAINTENANCE
 ('00000000-0000-4000-8000-000000000004','IGD_DASAR','READY',8),
 ('00000000-0000-4000-8000-000000000004','CT_SCAN','READY',8),
 ('00000000-0000-4000-8000-000000000004','PONEK_NICU','READY',8),
 ('00000000-0000-4000-8000-000000000004','HEMODIALISA','READY',8),
 ('00000000-0000-4000-8000-000000000004','CATH_LAB','MAINTENANCE',8),
 -- RS PON
 ('00000000-0000-4000-8000-000000000005','IGD_DASAR','READY',12),
 ('00000000-0000-4000-8000-000000000005','CT_SCAN','READY',12),
 ('00000000-0000-4000-8000-000000000005','ICU_VENTILATOR','READY',12),
 ('00000000-0000-4000-8000-000000000005','CATH_LAB','READY',12),
 -- RSUP Persahabatan: ICU PENUH
 ('00000000-0000-4000-8000-000000000006','IGD_DASAR','READY',6),
 ('00000000-0000-4000-8000-000000000006','CT_SCAN','READY',6),
 ('00000000-0000-4000-8000-000000000006','ICU_VENTILATOR','PENUH',6),
 ('00000000-0000-4000-8000-000000000006','ANTI_BISA','READY',6),
 -- RSUD Koja
 ('00000000-0000-4000-8000-000000000007','IGD_DASAR','READY',15),
 ('00000000-0000-4000-8000-000000000007','TRAUMA_BEDAH','READY',15),
 ('00000000-0000-4000-8000-000000000007','PONEK_NICU','READY',15),
 ('00000000-0000-4000-8000-000000000007','ANTI_BISA','READY',15),
 -- RSUD Cengkareng
 ('00000000-0000-4000-8000-000000000008','IGD_DASAR','READY',4),
 ('00000000-0000-4000-8000-000000000008','CT_SCAN','READY',4),
 ('00000000-0000-4000-8000-000000000008','HEMODIALISA','READY',4),
 ('00000000-0000-4000-8000-000000000008','TRAUMA_BEDAH','READY',4),
 -- RSUD Budhi Asih: CATH_LAB PENUH
 ('00000000-0000-4000-8000-000000000009','IGD_DASAR','READY',7),
 ('00000000-0000-4000-8000-000000000009','CATH_LAB','PENUH',7),
 ('00000000-0000-4000-8000-000000000009','CT_SCAN','READY',7),
 -- RSUD Kramat Jati: status sengaja KEDALUWARSA (45 hari, batas 30 hari) untuk menguji kebaruan
 ('00000000-0000-4000-8000-000000000010','IGD_DASAR','READY',64800),
 ('00000000-0000-4000-8000-000000000010','CT_SCAN','READY',64800)
) as v(h, c, s, age_min);

insert into hospital_capacity (hospital_id, total_slots, available_slots, is_simulated, updated_at) values
 ('00000000-0000-4000-8000-000000000001',6,3,true,now()),
 ('00000000-0000-4000-8000-000000000002',5,2,true,now()),
 ('00000000-0000-4000-8000-000000000003',4,1,true,now()),
 ('00000000-0000-4000-8000-000000000004',4,0,true,now()),
 ('00000000-0000-4000-8000-000000000005',4,2,true,now()),
 ('00000000-0000-4000-8000-000000000006',5,2,true,now()),
 ('00000000-0000-4000-8000-000000000007',5,3,true,now()),
 ('00000000-0000-4000-8000-000000000008',4,2,true,now()),
 ('00000000-0000-4000-8000-000000000009',3,1,true,now()),
 ('00000000-0000-4000-8000-000000000010',3,2,true,now())
on conflict (hospital_id) do update set
  total_slots = excluded.total_slots, available_slots = excluded.available_slots,
  is_simulated = true, updated_at = now();
