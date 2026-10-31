import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Jangan biarkan `next dev` menulis blok aturan bawaan ke AGENTS.md proyek.
  agentRules: false,
  // PGlite (Postgres WASM) dipakai sebagai database lokal; jangan dibundel.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=(self), geolocation=(self)",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
