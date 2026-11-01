import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAiOutput, parseJsonLoose } from "@/lib/ai/normalize";

const FIXTURES = path.join(__dirname, "..", "fixtures", "ai");
const load = (name: string) => JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8"));

describe("validasi keluaran AI", () => {
  it.each(readdirSync(FIXTURES))("fixture %s lolos schema", (f) => {
    const r = normalizeAiOutput(load(f));
    expect(r.ok).toBe(true);
  });

  it("menolak JSON yang field wajibnya hilang", () => {
    const raw = load("lansia-lemas.json");
    delete raw.soap;
    const r = normalizeAiOutput(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(" ")).toContain("soap");
  });

  it("menolak tipe salah dan kategori urgensi di luar enum", () => {
    const raw = load("lansia-lemas.json");
    raw.urgency.level = "UNGU";
    expect(normalizeAiOutput(raw).ok).toBe(false);
  });

  it("parseJsonLoose melempar untuk JSON rusak dan menerima blok kode", () => {
    expect(() => parseJsonLoose('{"report": {"transcript": "x", ')).toThrow();
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("membuang kode kapabilitas ilegal dan menormalkan penulisan", () => {
    const raw = load("nyeri-dada.json");
    raw.needs = [
      { code: " cath-lab ", required: true, reason: "x" },
      { code: "RADIOTERAPI", required: true, reason: "tidak dikenal" },
      { code: "igd_dasar", required: true, reason: "y" },
    ];
    const r = normalizeAiOutput(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.needs.map((n) => n.code)).toEqual(["CATH_LAB", "IGD_DASAR"]);
    expect(r.warnings.some((w) => w.includes("RADIOTERAPI"))).toBe(true);
  });

  it("kebutuhan kosong → IGD_DASAR wajib sementara + perlu peninjauan", () => {
    const r = normalizeAiOutput(load("tidak-jelas.json"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.needs).toEqual([expect.objectContaining({ code: "IGD_DASAR", required: true })]);
    expect(r.needs_review).toBe(true);
  });

  it("nilai tidak diketahui tetap null dan urgensi null ditandai peninjauan", () => {
    const raw = load("lansia-lemas.json");
    raw.urgency.level = null;
    const r = normalizeAiOutput(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.needs_review).toBe(true);
    expect(r.result.soap.objective.find((o) => o.label === "Tekanan darah")?.value).toBeNull();
  });

  it("asal PHOTO_READING dan kualitas FOTO_TIDAK_TERBACA tidak lagi diterima (fitur foto dihapus)", () => {
    const raw = load("lansia-lemas.json");
    raw.soap.objective[0].origin = "PHOTO_READING";
    expect(normalizeAiOutput(raw).ok).toBe(false);
    const raw2 = load("lansia-lemas.json");
    raw2.input_quality = "FOTO_TIDAK_TERBACA";
    expect(normalizeAiOutput(raw2).ok).toBe(false);
  });

  it("item Plan berisi dosis/terapi dihapus, angka mg/dL tidak dianggap dosis", () => {
    const raw = load("lansia-lemas.json");
    raw.soap.plan = [
      "Berikan dextrose 40% 25 ml intravena",
      "Minumkan obat glukosa 2 tablet",
      "Laporkan gula darah 46 mg/dL ke IGD tujuan",
    ];
    const r = normalizeAiOutput(raw);
    if (!r.ok) throw new Error("harus valid");
    expect(r.result.soap.plan).toEqual(["Laporkan gula darah 46 mg/dL ke IGD tujuan"]);
  });

  it("assessment selalu berasal dari interpretasi AI", () => {
    const raw = load("nyeri-dada.json");
    raw.soap.assessment.origin = "USER_STATEMENT";
    const r = normalizeAiOutput(raw);
    if (!r.ok) throw new Error("harus valid");
    expect(r.result.soap.assessment.origin).toBe("AI_INTERPRETATION");
  });

  it("tanpa kebutuhan wajib → satu kebutuhan dijadikan wajib dan perlu ditinjau", () => {
    const raw = load("nyeri-dada.json");
    raw.needs = [{ code: "CATH_LAB", required: false, reason: "x" }];
    const r = normalizeAiOutput(raw);
    if (!r.ok) throw new Error("harus valid");
    expect(r.result.needs[0].required).toBe(true);
    expect(r.needs_review).toBe(true);
  });
});
