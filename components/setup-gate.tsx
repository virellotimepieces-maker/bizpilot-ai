"use client";

import { PresetGallery } from "@/components/preset-gallery";
import { useWorkspace } from "@/lib/workspace-store";
import type { ReactNode } from "react";

export function SetupGate({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  const { knowledge } = useWorkspace();

  if (!knowledge) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-6">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">BizPilot AI</p>
          <h1 className="font-heading mt-2 text-3xl tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
        <PresetGallery />
      </div>
    );
  }

  return <>{children}</>;
}
