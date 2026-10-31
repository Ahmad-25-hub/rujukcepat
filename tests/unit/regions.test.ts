import { describe, expect, it } from "vitest";
import { inServiceArea, regionOf, SERVICE_REGIONS } from "@/lib/regions";
import { LatLngSchema } from "@/lib/schema/api";

describe("wilayah layanan", () => {
  it("mengenali Jakarta dan Jawa Timur, termasuk Madura dan Bawean", () => {
    expect(regionOf({ lat: -6.1767, lng: 106.8416 })).toBe("JAKARTA"); // Senen
    expect(regionOf({ lat: -7.3338, lng: 112.7889 })).toBe("JAWA_TIMUR"); // UPN Veteran Jatim
    expect(regionOf({ lat: -7.9666, lng: 112.6326 })).toBe("JAWA_TIMUR"); // Malang
    expect(regionOf({ lat: -8.2192, lng: 114.3691 })).toBe("JAWA_TIMUR"); // Banyuwangi
    expect(regionOf({ lat: -7.1186, lng: 113.4769 })).toBe("JAWA_TIMUR"); // Pamekasan, Madura
    expect(regionOf({ lat: -5.79, lng: 112.66 })).toBe("JAWA_TIMUR"); // Bawean
  });

  it("menolak lokasi di luar kedua wilayah", () => {
    expect(inServiceArea({ lat: -6.9175, lng: 107.6191 })).toBe(false); // Bandung
    expect(inServiceArea({ lat: -6.9667, lng: 110.4167 })).toBe(false); // Semarang
    expect(inServiceArea({ lat: -8.65, lng: 115.2167 })).toBe(false); // Denpasar
    expect(LatLngSchema.safeParse({ lat: -6.9175, lng: 107.6191 }).success).toBe(false);
    expect(LatLngSchema.safeParse({ lat: -7.3338, lng: 112.7889 }).success).toBe(true);
  });

  it("titik contoh dan tampilan peta tiap wilayah berada di wilayahnya sendiri", () => {
    for (const r of SERVICE_REGIONS) {
      expect(regionOf(r.sample)).toBe(r.id);
      const [[s, w], [n, e]] = r.view;
      expect(regionOf({ lat: (s + n) / 2, lng: (w + e) / 2 })).toBe(r.id);
    }
  });
});
