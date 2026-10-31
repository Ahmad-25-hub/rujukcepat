// Membuat ikon PWA (PNG) tanpa dependensi gambar: persegi merah bersudut bulat + salib putih.
// Jalankan: npm run make:icons  (hasil di public/icons, sudah di-commit; jalankan ulang hanya bila desain berubah)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const RED = [185, 28, 28]; // #b91c1c
const WHITE = [255, 255, 255];

function crc32(buf: Buffer) {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size: number, rgba: Uint8Array) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * @param radiusFrac sudut bulat (0 = persegi penuh, untuk ikon maskable)
 * @param crossFrac  ukuran salib relatif terhadap sisi
 */
function render(size: number, radiusFrac: number, crossFrac: number) {
  const px = new Uint8Array(size * size * 4);
  const SS = 3;
  const r = size * radiusFrac;
  const arm = size * crossFrac * 0.5;
  const thick = size * crossFrac * 0.18;
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0;
      let cross = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          const dx = Math.max(Math.abs(fx - c) - (c - r), 0);
          const dy = Math.max(Math.abs(fy - c) - (c - r), 0);
          const inside = dx * dx + dy * dy <= r * r || r === 0;
          if (inside) a++;
          const inCross = (Math.abs(fx - c) <= thick && Math.abs(fy - c) <= arm) || (Math.abs(fy - c) <= thick && Math.abs(fx - c) <= arm);
          if (inside && inCross) cross++;
        }
      }
      const total = SS * SS;
      const o = (y * size + x) * 4;
      const t = cross / Math.max(a, 1);
      px[o] = Math.round(RED[0] * (1 - t) + WHITE[0] * t);
      px[o + 1] = Math.round(RED[1] * (1 - t) + WHITE[1] * t);
      px[o + 2] = Math.round(RED[2] * (1 - t) + WHITE[2] * t);
      px[o + 3] = Math.round((a / total) * 255);
    }
  }
  return px;
}

const out = path.resolve(process.cwd(), "public", "icons");
mkdirSync(out, { recursive: true });
const jobs: [string, number, number, number][] = [
  ["icon-192.png", 192, 0.2, 0.62],
  ["icon-512.png", 512, 0.2, 0.62],
  ["maskable-512.png", 512, 0, 0.5], // zona aman maskable: salib lebih kecil, tanpa sudut bulat
  ["apple-touch-icon.png", 180, 0, 0.6],
];
for (const [name, size, rad, cross] of jobs) {
  writeFileSync(path.join(out, name), png(size, render(size, rad, cross)));
  console.log(`dibuat ${name} (${size}x${size})`);
}
