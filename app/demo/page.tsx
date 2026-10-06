import { DashboardHome } from "@/components/dashboard-home";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://bizlyro.com/demo" },
};

export default function DemoHomePage() {
  return <DashboardHome />;
}
