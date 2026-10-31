import type { Metadata } from "next";
import Link from "next/link";
import { SimBadge } from "@/components/badges";
import { LoginForm } from "@/components/dashboard/login-form";

export const metadata: Metadata = { title: "Masuk petugas – RujukCepat" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between bg-slate-900 px-6 py-3 text-white">
        <Link href="/" className="text-lg font-extrabold">
          RujukCepat
        </Link>
        <SimBadge>Demo – data simulasi</SimBadge>
      </header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <LoginForm />
      </main>
    </div>
  );
}
