import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-jbmono", display: "swap" });

export const metadata: Metadata = {
  title: "RujukCepat – Koordinasi rujukan",
  description:
    "Koordinasi rujukan prarumah sakit DKI Jakarta: laporan suara, ringkasan AI, dan pencocokan kapabilitas IGD.",
  applicationName: "RujukCepat",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "RujukCepat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1324",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`h-full antialiased ${jakarta.variable} ${jbmono.variable}`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-ink focus:shadow-lg"
        >
          Lompat ke konten utama
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
