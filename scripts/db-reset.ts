// Reset database lokal PGlite: MENGHAPUS semua rujukan, reservasi, dan event demo,
// lalu mengembalikan seed kapasitas/kapabilitas simulasi. Hentikan `npm run dev` dulu.
import path from "node:path";
import { openDatabase, resetDemoData } from "../src/lib/data/local-db";

async function main() {
  const dir = path.resolve(process.cwd(), process.env.LOCAL_DB_DIR || ".data/pglite");
  const db = await openDatabase(dir);
  await resetDemoData(db);
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from hospitals");
  console.log(`Reset selesai: ${rows[0].n} RS seed simulasi, data rujukan demo dihapus. (${dir})`);
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
