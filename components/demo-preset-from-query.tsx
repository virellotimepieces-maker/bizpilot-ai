"use client";

import { presetById } from "@/lib/presets";
import { useWorkspace } from "@/lib/workspace-store";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function DemoPresetFromQuery() {
  const params = useSearchParams();
  const requested = params.get("preset");
  const { hydrated, presetId, loadPreset } = useWorkspace();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !requested || !presetById(requested)) return;
    if (applied.current === requested || presetId === requested) {
      applied.current = requested;
      return;
    }
    applied.current = requested;
    loadPreset(requested);
  }, [hydrated, requested, presetId, loadPreset]);

  return null;
}
