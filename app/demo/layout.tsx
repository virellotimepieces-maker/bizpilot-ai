import { AppShell } from "@/components/app-shell";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell basePath="/demo" demo>
      {children}
    </AppShell>
  );
}
