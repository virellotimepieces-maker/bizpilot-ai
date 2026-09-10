"use client";

import { Button } from "@/components/ui/button";
import { PRESETS } from "@/lib/presets";
import { BUSINESS_TYPE_LABEL } from "@/lib/labels";
import { useWorkspace } from "@/lib/workspace-store";
import { Building2, Stethoscope, Store, Wrench } from "lucide-react";
import { toast } from "sonner";

const ICONS = {
  online_store: Store,
  service: Wrench,
  clinic: Stethoscope,
  custom: Building2,
};

export function PresetGallery({
  heading = "Start from a business type",
  compact = false,
}: {
  heading?: string;
  compact?: boolean;
}) {
  const { loadPreset, startBlank, knowledge } = useWorkspace();

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl tracking-tight text-foreground">{heading}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            BizPilot is a customer-support desk for any business. Online selling is one sample,
            not the product. Chat and email both read the same knowledge base.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            startBlank("custom");
            toast.success("Blank knowledge base ready");
          }}
        >
          Start blank
        </Button>
      </div>
      <div className={`grid gap-3 ${compact ? "md:grid-cols-3" : "lg:grid-cols-3"}`}>
        {PRESETS.map((preset) => {
          const Icon = ICONS[preset.businessType];
          const selected = knowledge?.name === preset.knowledge.name;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                loadPreset(preset.id);
                toast.success(`Loaded ${preset.subtitle}`);
              }}
              className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${
                selected ? "border-primary ring-3 ring-primary/15" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 text-primary">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-4" />
                </span>
                <span className="text-xs font-medium tracking-wide uppercase">
                  {BUSINESS_TYPE_LABEL[preset.businessType]}
                </span>
              </div>
              <p className="font-heading mt-3 text-lg leading-snug">{preset.subtitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{preset.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
