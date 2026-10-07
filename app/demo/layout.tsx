import { AppShell } from "@/components/app-shell";
import { DemoPresetFromQuery } from "@/components/demo-preset-from-query";
import { Suspense } from "react";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell basePath="/demo" demo>
      <Suspense fallback={null}>
        <DemoPresetFromQuery />
      </Suspense>
      {children}
    </AppShell>
  );
}
