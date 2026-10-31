import type { Metadata } from "next";
import { BrandLink } from "@/components/badges";
import { LoginForm } from "@/components/dashboard/login-form";

export const metadata: Metadata = { title: "Masuk petugas – RujukCepat" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#eef1f5]">
      <header className="bg-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
          <BrandLink dark />
        </div>
      </header>
      <main id="main" className="anim-rise mx-auto w-full max-w-md flex-1 px-4 py-10">
        <LoginForm />
      </main>
    </div>
  );
}
