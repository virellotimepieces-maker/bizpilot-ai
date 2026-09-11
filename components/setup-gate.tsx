"use client";

import { PresetGallery } from "@/components/preset-gallery";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS, PAGE_TITLE_CLASS } from "@/lib/ui/type-scale";
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
      <div className={`${PAGE_SHELL_CLASS} max-w-5xl py-4`}>
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">BizPilot AI</p>
          <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>{title}</h1>
          <p className={`mt-3 max-w-2xl ${HELPER_TEXT_CLASS}`}>
            {description}
          </p>
        </div>
        <PresetGallery />
      </div>
    );
  }

  return <>{children}</>;
}
