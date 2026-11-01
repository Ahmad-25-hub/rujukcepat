"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

// Registrasi service worker (hanya build produksi) dan tombol pemasangan PWA.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

const subscribeNone = () => () => {};
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  const standalone = useSyncExternalStore(subscribeNone, isStandalone, () => true);
  const ios = useSyncExternalStore(subscribeNone, isIos, () => false);

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const installed = () => setDone(true);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", on);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (standalone || done) return null;

  if (evt) {
    return (
      <button
        type="button"
        onClick={async () => {
          await evt.prompt();
          const choice = await evt.userChoice;
          if (choice.outcome === "accepted") setDone(true);
          setEvt(null);
        }}
        className="btn btn-glass w-full border-dashed !border-[#c7ceda]"
      >
        <Download className="h-4 w-4" aria-hidden />
        Pasang aplikasi di perangkat
      </button>
    );
  }
  if (ios) {
    return (
      <p className="flex items-start gap-2 rounded-2xl border border-dashed border-[#c7ceda] p-3 text-sm text-ink-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Di iPhone/iPad: ketuk tombol Bagikan lalu “Tambah ke Layar Utama” untuk memasang.
      </p>
    );
  }
  return null;
}
