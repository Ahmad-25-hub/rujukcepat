// Memeriksa bahwa rahasia server tidak masuk bundle klien (.next/static).
// Jalankan setelah `npm run build`:  npm run check:secrets
// Nama variabel boleh muncul (mis. di pesan galat UI); yang dilarang adalah NILAI-nya.
// Nilai rahasia dibaca dari environment proses dan .env.local; yang dicari adalah NILAI-nya (tanpa dicetak).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SECRET_NAMES = ["GEMINI_API_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "DEMO_STAFF_PASSWORD", "SESSION_SECRET"];
const PATTERNS: [string, RegExp][] = [
  ["pola secret key Supabase", /sb_secret_[0-9A-Za-z_-]+/],
  ["pola kunci Google API (AIza…)", /AIza[0-9A-Za-z_-]{35}/],
  ["peran service_role", /service_role/],
];

function loadEnvFile(file: string) {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const env = { ...loadEnvFile(path.resolve(".env.local")), ...loadEnvFile(path.resolve(".env.production.local")), ...process.env };
const secrets = SECRET_NAMES.map((n) => [n, env[n]] as const).filter(([, v]) => v && v.length >= 8 && !v.startsWith("<"));

const root = path.resolve(".next", "static");
if (!existsSync(root)) {
  console.error("Folder .next/static tidak ada. Jalankan `npm run build` terlebih dahulu.");
  process.exit(2);
}

let files = 0;
const findings: string[] = [];
for (const file of walk(root)) {
  if (!/\.(js|css|html|json|map|txt)$/.test(file)) continue;
  files++;
  const text = readFileSync(file, "utf8");
  for (const [name, value] of secrets) if (text.includes(value!)) findings.push(`${path.relative(".", file)}: memuat NILAI ${name}`);
  for (const [label, re] of PATTERNS) {
    const m = re.exec(text);
    if (m) findings.push(`${path.relative(".", file)}: ${label}`);
  }
}

console.log(`Dipindai ${files} berkas di .next/static; ${secrets.length} nilai rahasia dicari (${secrets.map(([n]) => n).join(", ") || "tidak ada nilai terisi"}).`);
if (findings.length) {
  console.error("DITEMUKAN:\n" + findings.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log("Lulus: tidak ada rahasia server di bundle klien.");
