import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard/dashboard-app";

export const metadata: Metadata = { title: "Dashboard IGD – RujukCepat" };

export default function DashboardPage() {
  return <DashboardApp />;
}
