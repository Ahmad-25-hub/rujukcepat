import { ArrowRight, FlaskConical, Hospital, MapPin, Mic, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BrandLink, SimBadge } from "@/components/badges";
import { InstallButton } from "@/components/pwa";

const STEPS = [
  { title: "Rekam laporan", body: "Suara atau teks, plus foto alat ukur bila ada." },
  { title: "Tinjau ringkasan AI", body: "SOAP, perkiraan urgensi, dan kebutuhan layanan — Anda yang memutuskan." },
  { title: "Menuju IGD yang siap", body: "Rekomendasi RS sesuai kebutuhan dan kuota terkini, lalu navigasi sampai tiba." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <BrandLink />
          <div className="flex items-center gap-1">
            <SimBadge>
              <span className="max-[420px]:hidden">Demo ·</span> simulasi
            </SimBadge>
            <Link href="/dashboard" aria-label="Dashboard IGD untuk petugas" className="btn btn-ghost min-w-11 px-3 text-sm font-semibold">
              <Hospital className="h-[18px] w-[18px]" aria-hidden />
              <span className="max-[420px]:hidden">Petugas IGD</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-wrap items-start gap-8 px-4 pb-10 pt-7">
        <section aria-labelledby="hero-title" className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <p className="anim-rise flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.04em] text-ink-2">
            <span className="anim-blink h-2 w-2 rounded-full bg-brand" aria-hidden />
            Rujukan prarumah sakit · DKI Jakarta
          </p>
          <h1 id="hero-title" className="anim-rise anim-d1 text-[clamp(30px,7.4vw,52px)] font-extrabold leading-[1.06] tracking-[-0.035em]">
            Ceritakan kondisinya. Kami carikan IGD yang siap.
          </h1>
          <p className="anim-rise anim-d2 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Rekam laporan suara sekitar 15 detik. AI menyusun ringkasan SOAP dan perkiraan urgensi, lalu RujukCepat mencocokkan kebutuhan pasien dengan kesiapan
            IGD sebelum Anda berangkat.
          </p>

          <div className="anim-rise anim-d3 card flex flex-col gap-3 rounded-3xl p-4 shadow-[0_1px_2px_rgba(11,19,36,.04),0_20px_40px_-28px_rgba(11,19,36,.35)]">
            <Link
              href="/lapor"
              className="group flex min-h-[88px] items-center gap-4 rounded-[18px] bg-brand py-3.5 pl-3 pr-4 text-white transition hover:bg-brand-strong hover:shadow-[0_10px_30px_-12px_rgba(196,18,47,.6)] active:scale-[.985]"
            >
              <span className="relative grid h-[60px] w-[60px] shrink-0 place-items-center">
                <span className="anim-ring absolute inset-0 rounded-full bg-white/35" aria-hidden />
                <span className="anim-ring anim-ring-late absolute inset-0 rounded-full bg-white/35" aria-hidden />
                <span className="relative grid h-[60px] w-[60px] place-items-center rounded-full bg-white text-brand">
                  <Mic className="h-7 w-7" aria-hidden />
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-lg font-extrabold leading-tight sm:text-xl">Laporkan kondisi pasien</span>
                <span className="text-sm font-medium text-[#ffe3e7]">Suara ± 15 detik atau ketik</span>
              </span>
              <ArrowRight className="h-[22px] w-[22px] shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <a href="tel:119" className="btn btn-secondary min-h-[52px] gap-1.5 whitespace-nowrap px-2 text-[15px]">
                <Phone className="h-[18px] w-[18px] text-brand" aria-hidden />
                Ambulans 119
              </a>
              <a href="tel:112" className="btn btn-secondary min-h-[52px] gap-1.5 whitespace-nowrap px-2 text-[15px]">
                <Phone className="h-[18px] w-[18px] text-brand" aria-hidden />
                Darurat 112
              </a>
            </div>
          </div>
          <p className="anim-rise anim-d4 text-[13px] leading-normal text-muted">
            Jika pasien tidak sadar, tidak bernapas, atau perdarahan hebat: hubungi 119 terlebih dahulu.
          </p>
        </section>

        <aside aria-label="Tentang RujukCepat" className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <section aria-labelledby="cara-title" className="anim-rise anim-d3 flex flex-col gap-4 rounded-3xl bg-ink p-6 text-[#e6ebf3]">
            <h2 id="cara-title" className="eyebrow !text-[#9fb0c8]">
              Cara kerja
            </h2>
            <ol className="flex flex-col">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3.5">
                  <span className="flex flex-col items-center">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold text-white ${i === STEPS.length - 1 ? "bg-brand" : "bg-[#1c2a44]"}`}
                    >
                      {i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="my-1 w-0.5 flex-1 bg-[#24324d]" aria-hidden />}
                  </span>
                  <span className={i < STEPS.length - 1 ? "pb-4" : ""}>
                    <span className="block text-base font-bold text-white">{s.title}</span>
                    <span className="block text-sm leading-normal text-[#b7c3d6]">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="batas-title" className="anim-rise anim-d4 card px-5 pb-1.5 pt-4">
            <h2 id="batas-title" className="eyebrow mb-1">
              Yang perlu Anda ketahui
            </h2>
            <ul className="divide-y divide-[#eef1f5]">
              <li className="flex gap-3 py-3 text-sm leading-normal text-ink-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <strong className="text-ink">Bukan diagnosis.</strong> Ringkasan AI adalah perkiraan; keputusan klinis tetap pada tenaga kesehatan.
                </span>
              </li>
              <li className="flex gap-3 py-3 text-sm leading-normal text-ink-2">
                <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-warn-ink" aria-hidden />
                <span>
                  <strong className="text-ink">Data simulasi.</strong> Kapasitas dan kesiapan rumah sakit di demo hackathon ini tidak nyata.
                </span>
              </li>
              <li className="flex gap-3 py-3 text-sm leading-normal text-ink-2">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" aria-hidden />
                <span>
                  <strong className="text-ink">Lokasi dari OpenStreetMap</strong> tidak menyiratkan kemitraan atau penerimaan pasien.
                </span>
              </li>
            </ul>
          </section>

          <InstallButton />
        </aside>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-3.5 text-xs text-muted">
          <span>TwinTech · Universitas Negeri Jakarta · INCEPTION 2026</span>
          <span>Peta © OpenStreetMap contributors</span>
        </div>
      </footer>
    </div>
  );
}
