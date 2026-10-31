import { ArrowRight, Check, ChevronDown, Hospital, Mic, Phone, PhoneCall, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/badges";
import { FacilityFeedProvider } from "@/components/home/facility-feed";
import { Faq } from "@/components/home/faq";
import { HomeHeader } from "@/components/home/home-header";
import { PrepChecklist } from "@/components/home/prep-checklist";
import { ReadinessPanel, ReadinessSnapshot, StateLegend } from "@/components/home/readiness";
import { ServicesGrid } from "@/components/home/services-grid";
import { DestinationPreview, RecordPreview, SummaryPreview } from "@/components/home/step-previews";
import { Reveal } from "@/components/motion";
import { InstallButton } from "@/components/pwa";

// Foto: Pexels (lisensi Pexels) dan Wikimedia Commons (CC BY 4.0). Atribusi di footer dan README.
const PHOTO = {
  hero: { src: "/images/beranda-jakarta-malam.jpg", w: 1200, h: 1600, credit: "David Tumpal / Pexels" },
  pelapor: { src: "/images/beranda-pelapor.jpg", w: 1000, h: 1778, credit: "Tia Rahayu / Pexels" },
  petugas: { src: "/images/beranda-petugas-igd.jpg", w: 1000, h: 1777, credit: "Adarsh Mp / Pexels" },
  ambulans: { src: "/images/beranda-ambulans.jpg", w: 1920, h: 1080, credit: "Secretdriver / Wikimedia Commons, CC BY 4.0" },
};

const STEPS = [
  {
    title: "Ceritakan kondisi pasien",
    body: "Tekan rekam dan jelaskan keluhan dengan kata-kata sendiri, sekitar 15 detik. Bisa juga diketik. Tambahkan foto tensimeter atau glukometer bila ada.",
    preview: <RecordPreview />,
  },
  {
    title: "Periksa ringkasannya",
    body: "AI menyusun ringkasan terstruktur, perkiraan tingkat urgensi, dan layanan yang mungkin dibutuhkan. Anda bisa mengoreksinya sebelum lanjut.",
    preview: <SummaryPreview />,
  },
  {
    title: "Berangkat ke IGD yang siap",
    body: "Lihat rumah sakit yang layanannya siap dan masih ada kuota, diurutkan menurut perkiraan waktu tempuh. Navigasi memandu sampai tiba.",
    preview: <DestinationPreview />,
  },
];

export default function Home() {
  return (
    <FacilityFeedProvider>
      <div className="flex min-h-screen flex-col bg-white">
        {/* Peringatan darurat selalu di paling atas */}
        <div className="border-b border-[#f6cdd4] bg-[#fff3f5]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-[13px] text-[#7a0c20]">
            <p className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span>
                <strong className="font-bold">Tidak sadar, tidak bernapas, atau perdarahan hebat?</strong>
                <span className="max-sm:hidden"> Telepon ambulans sekarang, jangan menunggu aplikasi.</span>
              </span>
            </p>
            <a href="tel:119" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-bold text-white hover:bg-brand-strong">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              119
            </a>
          </div>
        </div>

        <HomeHeader />

        <main id="main" className="flex-1">
          {/* ============ HERO ============ */}
          <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-14 lg:pb-24">
            <div className="flex flex-col gap-6">
              <p className="anim-rise flex items-center gap-2 text-[13px] font-semibold text-muted">
                <span className="h-2 w-2 rounded-[3px] bg-brand" aria-hidden />
                Koordinasi rujukan prarumah sakit · DKI Jakarta & Jawa Timur
              </p>
              <h1 id="hero-title" className="anim-rise anim-d1 text-balance text-[clamp(34px,5.6vw,54px)] font-bold leading-[1.08] tracking-[-0.03em] text-ink">
                Tahu IGD mana yang siap, sebelum berangkat.
              </h1>
              <p className="anim-rise anim-d2 max-w-[34rem] text-[17px] leading-relaxed text-ink-2 sm:text-lg">
                Ceritakan kondisi pasien lewat suara atau ketikan. RujukCepat merangkum laporan Anda, lalu menunjukkan rumah sakit terdekat yang punya layanan
                yang dibutuhkan dan masih ada kuota IGD.
              </p>
              <div className="anim-rise anim-d3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/lapor" className="btn btn-brand btn-lg min-h-14 px-6 text-[17px]">
                  <Mic className="h-5 w-5" aria-hidden />
                  Laporkan kondisi pasien
                </Link>
                <a href="#cara-kerja" className="btn btn-secondary btn-lg min-h-14 px-5 text-[16px] font-semibold">
                  Lihat cara kerja
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <ul className="anim-rise anim-d4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink-2">
                {["Tanpa membuat akun", "Bisa lewat suara atau ketik", "Rekaman tidak disimpan"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-ok" strokeWidth={2.5} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="anim-rise anim-d2 relative">
              <figure className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink sm:aspect-[16/11] lg:aspect-[4/5]">
                <Image
                  src={PHOTO.hero.src}
                  alt="Jalan protokol Jakarta pada malam hari dengan jejak lampu kendaraan"
                  fill
                  priority
                  sizes="(min-width: 1024px) 520px, 100vw"
                  className="hero-photo object-cover object-[50%_65%]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden />
                <figcaption className="absolute bottom-2.5 right-3 text-[11px] text-white/75">Foto: {PHOTO.hero.credit}</figcaption>
              </figure>
              <div className="relative z-10 mx-3 -mt-16 sm:mx-auto sm:max-w-sm lg:absolute lg:-left-12 lg:bottom-10 lg:mx-0 lg:mt-0 lg:w-[310px]">
                <ReadinessSnapshot />
              </div>
            </div>
          </section>

          {/* ============ CARA KERJA ============ */}
          <section id="cara-kerja" aria-labelledby="cara-title" className="scroll-mt-16 border-y border-line bg-soft">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
              <Reveal className="max-w-2xl">
                <p className="kicker">Cara kerja</p>
                <h2 id="cara-title" className="section-title mt-2">
                  Tiga langkah dari laporan sampai tiba di IGD
                </h2>
                <p className="mt-3 text-[17px] leading-relaxed text-ink-2">Anda tetap memegang keputusan di setiap langkah.</p>
              </Reveal>
              <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
                {STEPS.map((s, i) => (
                  <Reveal as="li" key={s.title} delay={i * 100} className="flex flex-col gap-4">
                    <div className="md:h-[192px] [&>div]:h-full">{s.preview}</div>
                    <div className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{i + 1}</span>
                      <div>
                        <h3 className="text-[17px] font-bold text-ink">{s.title}</h3>
                        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </ol>
              <p className="mt-10 flex items-start gap-2 text-[14px] text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Ringkasan AI adalah perkiraan, bukan diagnosis. Keputusan klinis tetap pada tenaga kesehatan.
              </p>
            </div>
          </section>

          {/* ============ KESIAPAN IGD ============ */}
          <section id="kesiapan" aria-labelledby="kesiapan-title" className="scroll-mt-16">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
              <Reveal className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
                <div>
                  <p className="kicker">Terhubung dengan rumah sakit</p>
                  <h2 id="kesiapan-title" className="section-title mt-2">
                    Kesiapan IGD saat ini
                  </h2>
                  <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
                    Petugas IGD memperbarui status layanan dan kuota lewat dashboard RujukCepat. Perubahannya langsung terlihat di sini dan dipakai untuk
                    rekomendasi.
                  </p>
                </div>
                <StateLegend />
                <Link href="/dashboard" className="inline-flex w-fit items-center gap-1.5 text-[15px] font-bold text-accent hover:underline">
                  Saya petugas IGD, perbarui data
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Reveal>
              <Reveal delay={100}>
                <ReadinessPanel />
              </Reveal>
            </div>
          </section>

          {/* ============ LAYANAN ============ */}
          <section id="layanan" aria-labelledby="layanan-title" className="scroll-mt-16 border-y border-line bg-soft">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-14">
                <Reveal>
                  <p className="kicker">Layanan yang dicocokkan</p>
                  <h2 id="layanan-title" className="section-title mt-2">
                    Bukan sekadar rumah sakit terdekat
                  </h2>
                  <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
                    Rumah sakit terdekat belum tentu punya layanan yang dibutuhkan, atau sedang penuh. RujukCepat menyaring dulu, baru mengurutkan.
                  </p>
                </Reveal>
                <Reveal delay={100}>
                  <ol className="grid gap-x-6 gap-y-3 text-[15px] text-ink sm:grid-cols-2" aria-label="Urutan penyaringan rumah sakit">
                    {["Punya layanan yang dibutuhkan pasien", "Status layanan siap dan masih baru", "Masih ada kuota IGD", "Baru diurutkan menurut waktu tempuh"].map((t, i) => (
                      <li key={t} className="flex items-start gap-3">
                        <span className="mt-px font-mono text-[13px] font-bold text-brand">0{i + 1}</span>
                        <span className="font-medium leading-snug">{t}</span>
                      </li>
                    ))}
                  </ol>
                </Reveal>
              </div>
              <div className="mt-10">
                <ServicesGrid />
              </div>
            </div>
          </section>

          {/* ============ UNTUK SIAPA ============ */}
          <section aria-labelledby="siapa-title">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
              <Reveal className="max-w-2xl">
                <p className="kicker">Untuk siapa</p>
                <h2 id="siapa-title" className="section-title mt-2">
                  Satu sistem, dua sisi
                </h2>
                <p className="mt-3 text-[17px] leading-relaxed text-ink-2">Pelapor melihat kesiapan IGD; petugas IGD yang memperbaruinya.</p>
              </Reveal>
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                <AudienceCard
                  photo={PHOTO.pelapor}
                  alt="Perempuan berhijab membaca informasi di ponselnya"
                  position="object-[50%_40%]"
                  title="Keluarga dan pendamping pasien"
                  points={["Laporkan kondisi dengan suara atau ketik", "Dapatkan rekomendasi IGD yang siap", "Ikuti navigasi sampai tiba"]}
                  href="/lapor"
                  cta="Mulai laporan"
                  icon={<Mic className="h-4 w-4" aria-hidden />}
                  primary
                />
                <AudienceCard
                  photo={PHOTO.petugas}
                  alt="Dua perawat berdiskusi di koridor rumah sakit"
                  position="object-[50%_55%]"
                  title="Petugas IGD rumah sakit"
                  points={["Perbarui status delapan layanan", "Atur kuota IGD kapan saja", "Pantau kesiapan rumah sakit lain"]}
                  href="/dashboard"
                  cta="Masuk dashboard petugas"
                  icon={<Hospital className="h-4 w-4" aria-hidden />}
                />
              </div>
            </div>
          </section>

          {/* ============ PERSIAPAN ============ */}
          <section id="persiapan" aria-labelledby="siap-title" className="scroll-mt-16 border-y border-line bg-soft">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
              <Reveal>
                <p className="kicker">Siapkan sebelum berangkat</p>
                <h2 id="siap-title" className="section-title mt-2">
                  Empat hal kecil yang menghemat waktu di IGD
                </h2>
                <p className="mt-3 text-[17px] leading-relaxed text-ink-2">Daftar praktis untuk keluarga atau pendamping. Centang sambil bersiap.</p>
                <p className="mt-5 flex items-start gap-2 text-[14px] text-muted">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Ini bukan saran medis. Ikuti arahan petugas 119 atau tenaga kesehatan.
                </p>
              </Reveal>
              <Reveal delay={100}>
                <PrepChecklist />
              </Reveal>
            </div>
          </section>

          {/* ============ TANYA JAWAB ============ */}
          <section id="tanya-jawab" aria-labelledby="faq-title" className="scroll-mt-16">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
              <Reveal className="flex flex-col gap-6">
                <div>
                  <p className="kicker">Tanya jawab</p>
                  <h2 id="faq-title" className="section-title mt-2">
                    Yang sering ditanyakan
                  </h2>
                </div>
                <figure className="relative overflow-hidden rounded-2xl bg-ink">
                  <Image
                    src={PHOTO.ambulans.src}
                    alt="Ambulans di depan gedung di Jakarta"
                    width={PHOTO.ambulans.w}
                    height={PHOTO.ambulans.h}
                    sizes="(min-width: 1024px) 420px, 100vw"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" aria-hidden />
                  <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 text-white">
                    <p className="text-[17px] font-bold leading-snug">Kondisi mengancam nyawa? Telepon ambulans lebih dulu.</p>
                    <div className="flex flex-wrap gap-2">
                      <a href="tel:119" className="btn min-h-11 bg-white px-4 text-ink hover:bg-[#f1f3f6]">
                        <Phone className="h-4 w-4 text-brand" aria-hidden />
                        Ambulans 119
                      </a>
                      <a href="tel:112" className="btn min-h-11 border-white/50 bg-transparent px-4 text-white hover:bg-white/10">
                        Darurat 112
                      </a>
                    </div>
                    <span className="text-[11px] text-white/70">Foto: {PHOTO.ambulans.credit}</span>
                  </figcaption>
                </figure>
              </Reveal>
              <Reveal delay={100}>
                <Faq />
              </Reveal>
            </div>
          </section>

          {/* ============ PENUTUP ============ */}
          <section aria-labelledby="cta-title" className="px-4 pb-16">
            <Reveal className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl bg-ink px-6 py-10 text-white sm:px-10 md:flex-row md:items-center">
              <div>
                <h2 id="cta-title" className="text-[clamp(24px,3.4vw,32px)] font-bold leading-tight tracking-[-0.02em]">
                  Siap melaporkan kondisi pasien?
                </h2>
                <p className="mt-2 text-[16px] text-[#b7c3d6]">Mulai dengan rekaman suara sekitar 15 detik.</p>
              </div>
              <div className="flex w-full flex-col gap-3 md:w-auto">
                <Link href="/lapor" className="btn btn-brand btn-lg min-h-14 px-6">
                  <Mic className="h-5 w-5" aria-hidden />
                  Laporkan kondisi pasien
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <InstallButton />
              </div>
            </Reveal>
          </section>
        </main>

        <footer className="border-t border-line bg-soft">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-[13px] text-muted md:grid-cols-[1.2fr_1fr_1fr]">
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2 text-base font-bold text-ink">
                <BrandMark size={26} />
                RujukCepat
              </span>
              <p className="max-w-xs leading-relaxed">Koordinasi rujukan prarumah sakit untuk DKI Jakarta dan Jawa Timur. Prototipe demo; data kesiapan dan kuota adalah simulasi.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-ink">Aplikasi</span>
              <Link href="/lapor" className="hover:text-ink">
                Laporkan kondisi pasien
              </Link>
              <Link href="/dashboard" className="hover:text-ink">
                Dashboard petugas IGD
              </Link>
              <a href="#tanya-jawab" className="hover:text-ink">
                Tanya jawab
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-ink">Atribusi</span>
              <span className="leading-relaxed">
                Foto: David Tumpal, Tia Rahayu, Adarsh Mp (
                <a href="https://www.pexels.com/license/" className="underline hover:text-ink" rel="noopener noreferrer" target="_blank">
                  Pexels
                </a>
                ); Secretdriver (
                <a
                  href="https://commons.wikimedia.org/wiki/File:Toyota_HiAce_ambulance_in_Jakarta,_Indonesia.jpg"
                  className="underline hover:text-ink"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Wikimedia Commons
                </a>
                ,{" "}
                <a href="https://creativecommons.org/licenses/by/4.0/" className="underline hover:text-ink" rel="noopener noreferrer" target="_blank">
                  CC BY 4.0
                </a>
                ). Orang di foto adalah model stok. Peta © OpenStreetMap contributors.
              </span>
            </div>
          </div>
          <div className="border-t border-line">
            <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">TwinTech · Universitas Negeri Jakarta · INCEPTION 2026</p>
          </div>
        </footer>
      </div>
    </FacilityFeedProvider>
  );
}

function AudienceCard({
  photo,
  alt,
  position,
  title,
  points,
  href,
  cta,
  icon,
  primary = false,
}: {
  photo: { src: string; credit: string };
  alt: string;
  position: string;
  title: string;
  points: string[];
  href: string;
  cta: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Reveal className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <figure className="relative aspect-[16/10] overflow-hidden bg-ink">
        <Image
          src={photo.src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 560px, 100vw"
          className={`object-cover ${position} transition-transform duration-700 ease-out group-hover:scale-[1.03]`}
        />
        <figcaption className="absolute bottom-2 right-3 text-[11px] text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">Foto: {photo.credit}</figcaption>
      </figure>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h3 className="text-xl font-bold text-ink">{title}</h3>
        <ul className="flex flex-col gap-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[15px] text-ink-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.5} aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <Link href={href} className={`btn mt-auto w-fit ${primary ? "btn-brand" : "btn-secondary"}`}>
          {icon}
          {cta}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Reveal>
  );
}
