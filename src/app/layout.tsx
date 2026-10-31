import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RujukCepat – Demo koordinasi rujukan",
  description:
    "Demo koordinasi rujukan prarumah sakit DKI Jakarta: laporan suara, ringkasan AI, dan pencocokan kapabilitas IGD. Data simulasi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b91c1c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
