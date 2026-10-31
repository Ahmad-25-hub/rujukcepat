// Petunjuk belok demi belok dari langkah OSRM. Murni, tanpa I/O.

export type RouteStep = {
  instruction: string;
  distance_m: number;
  duration_s: number;
  road: string | null;
  /** [lat, lng] titik manuver, untuk menandai di peta. */
  at: [number, number];
  kind: "depart" | "turn" | "roundabout" | "arrive" | "continue";
};

type OsrmStep = {
  distance: number;
  duration: number;
  name?: string;
  maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] };
};

const MODIFIER_ID: Record<string, string> = {
  uturn: "putar balik",
  "sharp right": "belok kanan tajam",
  right: "belok kanan",
  "slight right": "belok sedikit ke kanan",
  straight: "lurus",
  "slight left": "belok sedikit ke kiri",
  left: "belok kiri",
  "sharp left": "belok kiri tajam",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function instructionFor(step: OsrmStep, isLast: boolean): { text: string; kind: RouteStep["kind"] } {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name?.trim() ? step.name.trim() : null;
  const onto = road ? ` ke ${road}` : "";
  const mod = modifier ? MODIFIER_ID[modifier] : undefined;

  if (type === "depart") return { text: `Mulai berkendara${road ? ` di ${road}` : ""}`, kind: "depart" };
  if (type === "arrive" || isLast) {
    const side = modifier === "left" ? " (di sisi kiri)" : modifier === "right" ? " (di sisi kanan)" : "";
    return { text: `Tiba di tujuan${side}`, kind: "arrive" };
  }
  if (type === "roundabout" || type === "rotary" || type === "roundabout turn") {
    const ex = exit ? ` ambil jalan keluar ke-${exit}` : " keluar dari bundaran";
    return { text: `Masuk bundaran,${ex}${onto}`, kind: "roundabout" };
  }
  if (type === "exit roundabout") return { text: `Keluar dari bundaran${onto}`, kind: "roundabout" };
  if (type === "merge") return { text: `Bergabung${onto || " ke jalan utama"}`, kind: "turn" };
  if (type === "on ramp") return { text: `Masuk jalan tol/layang${onto}`, kind: "turn" };
  if (type === "off ramp") return { text: `Keluar dari jalan tol/layang${onto}`, kind: "turn" };
  if (type === "fork") return { text: `${cap(mod ?? "ikuti percabangan")}${onto}`, kind: "turn" };
  if (type === "end of road") return { text: `${cap(mod ?? "belok")} di ujung jalan${onto}`, kind: "turn" };
  if (type === "continue" || modifier === "straight") {
    return { text: `Lanjutkan lurus${road ? ` di ${road}` : ""}`, kind: "continue" };
  }
  if (type === "new name") return { text: `Lanjutkan${onto || " mengikuti jalan"}`, kind: "continue" };
  return { text: `${cap(mod ?? "lanjutkan")}${onto}`, kind: "turn" };
}

/** Ubah langkah OSRM menjadi daftar petunjuk. Langkah tanpa jarak (kecuali depart/arrive) dilewati. */
export function buildSteps(raw: OsrmStep[] | undefined): RouteStep[] {
  if (!raw?.length) return [];
  const out: RouteStep[] = [];
  raw.forEach((s, i) => {
    const isLast = i === raw.length - 1;
    const { text, kind } = instructionFor(s, isLast);
    if (kind !== "depart" && kind !== "arrive" && s.distance < 1 && s.maneuver.type !== "roundabout") return;
    out.push({
      instruction: text,
      distance_m: Math.round(s.distance),
      duration_s: Math.round(s.duration),
      road: s.name?.trim() || null,
      at: [s.maneuver.location[1], s.maneuver.location[0]],
      kind,
    });
  });
  return out;
}

export function formatStepDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}

/** Tautan buka navigasi di aplikasi peta pengguna (tanpa kunci API). */
export function externalNavLinks(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`,
    waze: `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`,
  };
}
