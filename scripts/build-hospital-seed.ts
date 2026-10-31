// Susun supabase/seed-osm.sql dari snapshot OSM (data/osm/hospitals-*.json).
//   npm run build:hospitals
// Aturan (keputusan pengguna 01-11-2026):
//  - Hanya RS sungguhan: nama RS/Rumah Sakit/Hospital; puskesmas, klinik, gigi, apotek, lab dibuang;
//    emergency=no dibuang; RS Mata/Jiwa/Gigi/Ketergantungan Obat/THT/Kusta tidak diambil (tidak relevan untuk IGD).
//  - Urut menurut kelengkapan tag OSM (alamat, telepon, situs, spesialisasi, IGD, operator, jam, kamar).
//  - Target 100 RS per wilayah; 10 RS seed lama dihitung ke kuota Jakarta. Duplikat (nama mirip < 400 m) dibuang.
//  - Kapabilitas hanya dari bukti: tag healthcare:speciality dan jenis RS dari nama. Bila tidak ada keterangan:
//    bawaan IGD_DASAR READY. Kuota bawaan 5/5; bila OSM mencantumkan beds/rooms: ceil(n/25) dibatasi 2..20.
//  - Semua status/kuota berlabel simulasi (is_simulated) karena bukan laporan RS.
import { readFileSync, writeFileSync } from "node:fs";
import { deterministicUuid } from "../src/lib/auth/password";
import { regionOf, type RegionId } from "../src/lib/regions";
import type { CapabilityCode } from "../src/lib/schema/enums";

const TARGET = 100;
type Tags = Record<string, string>;
type El = { osm_id: string; lat: number; lng: number; tags: Tags };
type Snapshot = { area: string; fetched_at: string; osm_base_timestamp: string | null; elements: El[] };
type HospitalType = "UMUM" | "IBU_ANAK" | "JANTUNG" | "ORTOPEDI";

const IS_HOSPITAL = /\b(rs|rsu|rsud|rsup|rsia|rsi|rsab|rsk|rsm|rspal|rst|rsau|rsal|rsad|rsb|rumah\s*sakit|hospital|siloam|mayapada|hermina|mitra keluarga|primaya|omni)\b/i;
const NOT_HOSPITAL = /(puskesmas|puskemas|klinik|clinic|dental|dentist|apotik|apotek|\blab\b|laborator|praktek|praktik|bidan|posyandu|optik|skincare|beauty|spa\b|massage|\bvet|hewan)/i;
const NOT_FOR_IGD = /(\bmata\b|eye|\bjiwa\b|psikiatri|\bgigi\b|ketergantungan|\bkusta\b|\btht\b|kecantikan|estetik)/i;
const TYPE_RULES: [HospitalType, RegExp][] = [
  ["IBU_ANAK", /(\brsia\b|\brsab\b|ibu\s*(dan|&)\s*anak|bersalin|\brsb\b|maternity|mother|\bkia\b)/i],
  ["JANTUNG", /(jantung|heart|cardi)/i],
  ["ORTOPEDI", /(ortho|orthop|ortop|traumatolog)/i],
];
const SPECIALITY_MAP: [RegExp, CapabilityCode][] = [
  [/^(intensive|anaesthetics|anesthesiology)$/, "ICU_VENTILATOR"],
  [/^radiology$/, "CT_SCAN"],
  [/(surgery|orthopaedics|traumatology|trauma)$/, "TRAUMA_BEDAH"],
  [/^(gynaecology|obstetrics|maternity|paediatrics|neonatology|mother_child|mother_and_child_hospital)$/, "PONEK_NICU"],
  [/^(dialysis|dailysis|nephrology)$/, "HEMODIALISA"],
  [/^(cardiology|cardiac_surgery)$/, "CATH_LAB"],
];

const has = (t: Tags, k: string) => !!t[k]?.trim();
const first = (v?: string) => v?.split(";")[0]?.trim() || null;

function score(e: El): number {
  const t = e.tags;
  let s = e.osm_id.startsWith("node/") ? 0 : 1;
  if (has(t, "addr:full") || has(t, "addr:street")) s += 2;
  if (has(t, "addr:city")) s += 1;
  if (has(t, "addr:postcode")) s += 1;
  if (has(t, "phone") || has(t, "contact:phone")) s += 3;
  if (has(t, "website") || has(t, "contact:website")) s += 2;
  if (has(t, "emergency")) s += 2;
  if (has(t, "healthcare:speciality")) s += 3;
  if (has(t, "operator")) s += 1;
  if (has(t, "operator:type")) s += 1;
  if (has(t, "opening_hours")) s += 1;
  if (has(t, "email") || has(t, "contact:email")) s += 1;
  if (has(t, "beds") || has(t, "rooms")) s += 2;
  if (has(t, "healthcare")) s += 1;
  return s;
}

const KEEP_UPPER = /^(RS[A-Z]*|RSUD|RSUP|RSIA|RSU|RSAB|RSPAL|RSAU|RSAL|RSAD|RST|TNI|POLRI|AL|AD|AU|DKT|PKU|PHC|PT|II|III|IV|VI|VII|KM|UPN|ITS|UNAIR|UB|UMM|NU|THT|YPK|MMC|PGI|BUMN)$/;
function tidyCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => {
      const up = w.toUpperCase().replace(/[.,]/g, "");
      if (KEEP_UPPER.test(up)) return w.toUpperCase();
      if (/^dr\.?$/.test(w)) return "dr.";
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function displayName(t: Tags): string {
  return tidyCase((first(t.name) ?? "").replace(/\s+/g, " "));
}

function shortName(t: Tags, name: string): string {
  const derived = name
    .replace(/^Rumah Sakit Umum Daerah\b/i, "RSUD")
    .replace(/^Rumah Sakit Umum Pusat\b/i, "RSUP")
    .replace(/^(RS|Rumah Sakit) Ibu (dan|&) Anak\b/i, "RSIA")
    .replace(/^Rumah Sakit Umum\b/i, "RSU")
    .replace(/^Rumah Sakit\b/i, "RS")
    .replace(/^RS\.\s*/i, "RS ")
    .trim();
  // Tag short_name OSM (mis. "RKZ") hanya dipakai bila nama turunan terlalu panjang; singkatan saja ambigu.
  const s = first(t.short_name);
  return derived.length > 34 && s ? (s.length <= 6 ? s : tidyCase(s)) : derived;
}

function address(t: Tags): string | null {
  if (has(t, "addr:full")) return first(t["addr:full"]);
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" No. ");
  const parts = [street, t["addr:subdistrict"], t["addr:district"], t["addr:city"]].filter((p) => p && p.trim());
  return parts.length ? parts.join(", ") : null;
}

function beds(t: Tags): number | null {
  const n = Number.parseInt(first(t.beds) ?? first(t.rooms) ?? "", 10);
  return Number.isFinite(n) && n > 0 && n < 5000 ? n : null;
}

function hospitalType(name: string): HospitalType {
  return TYPE_RULES.find(([, re]) => re.test(name))?.[0] ?? "UMUM";
}

/** Kapabilitas berdasarkan bukti + sumbernya. Tanpa keterangan -> bawaan IGD_DASAR. */
function capabilities(type: HospitalType, t: Tags): { code: CapabilityCode; source: string }[] {
  const out = new Map<CapabilityCode, string>();
  if (type === "IBU_ANAK") out.set("PONEK_NICU", "JENIS_RS_DARI_NAMA");
  else {
    out.set("IGD_DASAR", t.emergency === "yes" ? "OSM_EMERGENCY" : "BAWAAN_IMPOR");
    if (type === "JANTUNG") out.set("CATH_LAB", "JENIS_RS_DARI_NAMA");
    if (type === "ORTOPEDI") out.set("TRAUMA_BEDAH", "JENIS_RS_DARI_NAMA");
  }
  if (type !== "IBU_ANAK") {
    for (const sp of (t["healthcare:speciality"] ?? "").split(";").map((x) => x.trim().toLowerCase())) {
      const hit = SPECIALITY_MAP.find(([re]) => re.test(sp));
      if (hit && !out.has(hit[1])) out.set(hit[1], "OSM_SPESIALISASI");
    }
  }
  return [...out].map(([code, source]) => ({ code, source }));
}

const norm = (n: string) =>
  n
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(rumah sakit|rs|rsu|rsud|rsup|umum|daerah|pusat|jakarta|surabaya|kota|kabupaten)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  const dl = (b.lat - a.lat) * r;
  const dg = (b.lng - a.lng) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
};
const isDuplicate = (a: { name: string; lat: number; lng: number }, b: { name: string; lat: number; lng: number }) => {
  if (meters(a, b) > 400) return false;
  const x = norm(a.name);
  const y = norm(b.name);
  if (x === y || (!!x && !!y && (x.includes(y) || y.includes(x)))) return true;
  // Kemiripan kata: >= 60% kata nama yang lebih pendek ada di nama lain (mis. "Vincentius A Poli" vs "St. Vincentius A Paulo").
  const tx = new Set(x.split(" ").filter((w) => w.length > 1));
  const ty = new Set(y.split(" ").filter((w) => w.length > 1));
  const [small, big] = tx.size <= ty.size ? [tx, ty] : [ty, tx];
  const shared = [...small].filter((w) => big.has(w)).length;
  return small.size > 0 && shared / small.size >= 0.6;
};

/** RS seed lama (supabase/seed.sql) agar tidak terduplikasi dan dihitung ke kuota Jakarta. */
function existingSeed() {
  const sql = readFileSync("supabase/seed.sql", "utf8");
  const re = /\('(0{8}-0000-4000-8000-\d{12})','([^']+)','([^']+)',(-?[\d.]+),(-?[\d.]+),(?:'[^']*'|null),'([^']+)'/g;
  return [...sql.matchAll(re)].map((m) => ({ id: m[1], name: m[2], short: m[3], lat: Number(m[4]), lng: Number(m[5]), osm_id: m[6] }));
}

const q = (v: string | number | null) => (v === null ? "null" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);

function main() {
  const existing = existingSeed();
  const picked: {
    region: RegionId;
    id: string;
    osm_id: string;
    name: string;
    short: string;
    lat: number;
    lng: number;
    address: string | null;
    phone: string | null;
    website: string | null;
    beds: number | null;
    type: HospitalType;
    caps: { code: CapabilityCode; source: string }[];
    score: number;
    fetched_at: string;
  }[] = [];
  const enrich: { osm_id: string; phone: string | null; website: string | null; beds: number | null }[] = [];
  const report: string[] = [];

  for (const [file, region] of [
    ["data/osm/hospitals-jakarta.json", "JAKARTA"],
    ["data/osm/hospitals-jatim.json", "JAWA_TIMUR"],
  ] as const) {
    const snap = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
    const fetchedAt = snap.osm_base_timestamp ?? snap.fetched_at;
    const kept: { name: string; lat: number; lng: number }[] = region === "JAKARTA" ? existing.map((e) => ({ name: e.name, lat: e.lat, lng: e.lng })) : [];
    const quota = TARGET - (region === "JAKARTA" ? existing.length : 0);

    // Lengkapi kontak 10 RS seed lama dari elemen OSM yang sama.
    for (const e of existing) {
      const el = snap.elements.find((x) => x.osm_id === e.osm_id);
      if (el) enrich.push({ osm_id: e.osm_id, phone: first(el.tags.phone ?? el.tags["contact:phone"]), website: first(el.tags.website ?? el.tags["contact:website"]), beds: beds(el.tags) });
    }

    const candidates = snap.elements
      .filter((e) => !existing.some((x) => x.osm_id === e.osm_id))
      .map((e) => ({ e, name: displayName(e.tags), score: score(e) }))
      .filter(({ e, name }) => IS_HOSPITAL.test(name) && !NOT_HOSPITAL.test(name) && !NOT_FOR_IGD.test(name) && e.tags.emergency !== "no")
      .filter(({ e }) => regionOf(e) === region)
      .sort((a, b) => b.score - a.score || a.e.osm_id.localeCompare(b.e.osm_id));

    let count = 0;
    let dup = 0;
    for (const { e, name, score: sc } of candidates) {
      if (count >= quota) break;
      if (kept.some((k) => isDuplicate(k, { name, lat: e.lat, lng: e.lng }))) {
        dup++;
        continue;
      }
      kept.push({ name, lat: e.lat, lng: e.lng });
      const type = hospitalType(name);
      const b = beds(e.tags);
      picked.push({
        region,
        id: deterministicUuid(`osm:${e.osm_id}`),
        osm_id: e.osm_id,
        name,
        short: shortName(e.tags, name),
        lat: e.lat,
        lng: e.lng,
        address: address(e.tags),
        phone: first(e.tags.phone ?? e.tags["contact:phone"]),
        website: first(e.tags.website ?? e.tags["contact:website"]),
        beds: b,
        type,
        caps: capabilities(type, e.tags),
        score: sc,
        fetched_at: fetchedAt,
      });
      count++;
    }
    report.push(`${region}: ${candidates.length} kandidat RS, ${dup} duplikat dibuang, ${count} baru dipilih (kuota ${quota})`);
  }

  // Nama singkat kembar (RS berbeda, nama OSM sama): beri keterangan jalan agar bisa dibedakan.
  for (const p of picked) {
    const twins = picked.filter((x) => x.short === p.short);
    if (twins.length < 2) continue;
    twins.forEach((x, i) => {
      const street = x.address?.split(",")[0].replace(/^(jalan|jl\.?)\s*/i, "").trim();
      x.short = `${x.short} (${street || `lokasi ${i + 1}`})`;
    });
  }

  const ids = picked.map((p) => q(p.id)).join(",");
  const lines: string[] = [];
  lines.push(
    "-- Seed RS hasil impor OpenStreetMap (DKI Jakarta + Jawa Timur). DIBUAT OTOMATIS oleh scripts/build-hospital-seed.ts; jangan diedit manual.",
    "-- LOKASI/KONTAK: snapshot OSM data/osm/hospitals-*.json © OpenStreetMap contributors (ODbL).",
    "-- KAPABILITAS & KUOTA: bawaan impor/simulasi (is_simulated=true), bukan laporan RS. Sumber per kapabilitas di kolom source.",
    "-- Idempoten; menjalankan ulang MENGEMBALIKAN kapabilitas/kuota RS impor ke nilai bawaan.",
    "",
    "insert into hospitals (id, name, short_name, lat, lng, address, osm_id, location_source, location_fetched_at, is_demo_partner, phone, website, beds, hospital_type) values",
    picked
      .map((p) => ` (${[q(p.id), q(p.name), q(p.short), p.lat, p.lng, q(p.address), q(p.osm_id), "'OSM'", q(p.fetched_at), "false", q(p.phone), q(p.website), q(p.beds), q(p.type)].join(",")})`)
      .join(",\n"),
    "on conflict (id) do update set",
    "  name = excluded.name, short_name = excluded.short_name, lat = excluded.lat, lng = excluded.lng, address = excluded.address,",
    "  osm_id = excluded.osm_id, location_source = excluded.location_source, location_fetched_at = excluded.location_fetched_at,",
    "  is_demo_partner = excluded.is_demo_partner, phone = excluded.phone, website = excluded.website, beds = excluded.beds,",
    "  hospital_type = excluded.hospital_type;",
    "",
    `delete from hospital_capabilities where hospital_id in (${ids});`,
    "",
    "insert into hospital_capabilities (hospital_id, code, status, is_simulated, source, updated_at) values",
    picked.flatMap((p) => p.caps.map((c) => ` (${q(p.id)},${q(c.code)},'READY',true,${q(c.source)},now())`)).join(",\n") + ";",
    "",
    "insert into hospital_capacity (hospital_id, total_slots, available_slots, is_simulated, updated_at) values",
    picked
      .map((p) => {
        const total = p.beds ? Math.min(20, Math.max(2, Math.ceil(p.beds / 25))) : 5;
        return ` (${q(p.id)},${total},${total},true,now())`;
      })
      .join(",\n"),
    "on conflict (hospital_id) do update set",
    "  total_slots = excluded.total_slots, available_slots = excluded.available_slots, is_simulated = true, updated_at = now();",
    "",
    "-- Kontak publik OSM untuk RS seed lama (supabase/seed.sql).",
    ...enrich.map((e) => `update hospitals set phone = ${q(e.phone)}, website = ${q(e.website)}, beds = ${q(e.beds)} where osm_id = ${q(e.osm_id)};`),
    "",
  );
  writeFileSync("supabase/seed-osm.sql", lines.join("\n"));

  writeFileSync(
    "data/osm/rs-terpilih.json",
    JSON.stringify(
      {
        dibuat: new Date().toISOString(),
        aturan: "Lihat komentar scripts/build-hospital-seed.ts",
        ringkasan: report,
        rumah_sakit: picked.map((p) => ({
          wilayah: p.region,
          osm_id: p.osm_id,
          nama: p.name,
          singkatan: p.short,
          skor_kelengkapan: p.score,
          jenis: p.type,
          telepon: p.phone,
          tempat_tidur_osm: p.beds,
          kapabilitas: p.caps.map((c) => `${c.code} (${c.source})`),
        })),
      },
      null,
      1,
    ) + "\n",
  );

  for (const r of report) console.log(r);
  const types = picked.reduce<Record<string, number>>((a, p) => ((a[p.type] = (a[p.type] ?? 0) + 1), a), {});
  const capCount = picked.flatMap((p) => p.caps).reduce<Record<string, number>>((a, c) => ((a[`${c.code}/${c.source}`] = (a[`${c.code}/${c.source}`] ?? 0) + 1), a), {});
  console.log("Jenis:", JSON.stringify(types));
  console.log("Kapabilitas:", JSON.stringify(capCount));
  console.log(`Telepon: ${picked.filter((p) => p.phone).length}, tempat tidur: ${picked.filter((p) => p.beds).length}, seed lama diperkaya: ${enrich.filter((e) => e.phone || e.website || e.beds).length}`);
  console.log("Ditulis: supabase/seed-osm.sql, data/osm/rs-terpilih.json");
}

main();
