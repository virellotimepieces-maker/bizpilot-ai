"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { WorkspaceProvider } from "@/lib/workspace-store";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <WorkspaceProvider>
        {children}
        <Toaster theme="light" />
      </WorkspaceProvider>
    </TooltipProvider>
  );
}
