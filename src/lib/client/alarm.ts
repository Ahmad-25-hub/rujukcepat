"use client";

// Alarm suara dashboard (Web Audio). Browser hanya mengizinkan audio setelah gerakan pengguna,
// jadi alarm harus "diaktifkan" lewat tombol. Bila diblokir/tidak didukung, pemanggil tetap
// menampilkan notifikasi visual (alarm tidak pernah menjadi satu-satunya penanda).

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function ctor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ?? null;
}

export const alarmSupported = () => ctor() !== null;

/** Panggil dari handler klik. Mengembalikan true bila audio benar-benar dapat diputar. */
export async function unlockAlarm(): Promise<boolean> {
  const C = ctor();
  if (!C) return false;
  try {
    ctx ??= new C();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/** Bunyi tiga nada. false bila diblokir/tidak aktif. */
export async function playAlarm(): Promise<boolean> {
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return false;
    const c = ctx;
    const t0 = c.currentTime;
    [880, 660, 880].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.28 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.22);
      osc.connect(gain).connect(c.destination);
      osc.start(t0 + i * 0.28);
      osc.stop(t0 + i * 0.28 + 0.25);
    });
    return true;
  } catch {
    return false;
  }
}
