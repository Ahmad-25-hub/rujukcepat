import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "RujukCepat – Demo koordinasi rujukan",
  description:
    "Demo koordinasi rujukan prarumah sakit DKI Jakarta: laporan suara, ringkasan AI, dan pencocokan kapabilitas IGD. Data simulasi.",
  applicationName: "RujukCepat",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "RujukCepat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b91c1c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-blue-900 focus:shadow-lg"
        >
          Lompat ke konten utama
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
