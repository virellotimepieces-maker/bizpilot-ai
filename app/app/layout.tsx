import { PaidAppShell } from "@/components/paid-app-shell";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return <PaidAppShell>{children}</PaidAppShell>;
}
