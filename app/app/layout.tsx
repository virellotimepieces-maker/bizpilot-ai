import { PaidAppShell } from "@/components/paid-app-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace · BizPilot AI",
  description: "BizPilot AI workspace for inbox, knowledge, widget, and billing.",
};

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return <PaidAppShell>{children}</PaidAppShell>;
}
