"use client";

import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/client/api";

const DEMO_EMAILS = [
  ["rscm@rujukcepat.demo", "RSCM"],
  ["fatmawati@rujukcepat.demo", "RSUP Fatmawati"],
  ["tarakan@rujukcepat.demo", "RSUD Tarakan"],
  ["pasarminggu@rujukcepat.demo", "RSUD Pasar Minggu"],
  ["pon@rujukcepat.demo", "RS PON"],
  ["admin@rujukcepat.demo", "Admin (RSCM, dapat reset data)"],
] as const;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Masuk gagal. Silakan coba lagi.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[26px] border border-white/10 bg-white p-6 shadow-[0_40px_90px_-40px_rgba(0,0,0,.9)] sm:p-7" aria-labelledby="login-title">
      <h1 id="login-title" className="text-2xl font-extrabold">
        Masuk petugas IGD
      </h1>
      <p className="text-sm text-ink-2">
        Gunakan akun petugas rumah sakit Anda. Untuk mendapatkan akses atau bantuan kata sandi, hubungi pengelola.
      </p>
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          list="demo-emails"
          className="field w-full"
        />
        <datalist id="demo-emails">
          {DEMO_EMAILS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </datalist>
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-semibold">
          Kata sandi
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field w-full"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border-2 border-[#f3c6ce] bg-brand-tint p-3 text-sm text-[#6e0a1b]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary btn-lg w-full"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
        Masuk
      </button>
      <details className="text-sm text-ink-2">
        <summary className="cursor-pointer font-semibold">Akun petugas yang tersedia</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {DEMO_EMAILS.map(([v, l]) => (
            <li key={v}>
              <code>{v}</code> – {l}
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
