import type { Metadata } from "next";
import { ReportWizard } from "@/components/portal/report-wizard";

export const metadata: Metadata = { title: "Laporkan kondisi pasien – RujukCepat" };

export default function LaporPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <ReportWizard />
    </div>
  );
}
