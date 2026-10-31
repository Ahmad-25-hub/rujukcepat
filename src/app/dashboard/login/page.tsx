import type { Metadata } from "next";
import { BrandLink } from "@/components/badges";
import { LoginForm } from "@/components/dashboard/login-form";

export const metadata: Metadata = { title: "Masuk petugas – RujukCepat" };

export default function LoginPage() {
  return (
    <div className="hero-dark relative isolate flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="hero-grid absolute inset-0" />
        <div className="aurora-a -left-32 -top-40 h-[480px] w-[480px]" />
        <div className="aurora-b -right-40 bottom-0 h-[520px] w-[520px]" />
      </div>
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <BrandLink dark />
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:py-14">
        <div className="anim-rise text-white">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-[#ff8fa3]">Dashboard IGD</p>
          <p className="mt-2 text-[clamp(26px,6vw,34px)] font-extrabold leading-tight tracking-[-0.03em]">Perbarui kesiapan IGD — portal pelapor ikut berubah secara langsung.</p>
        </div>
        <div className="anim-rise anim-d2">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
