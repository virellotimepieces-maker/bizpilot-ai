import type { ReactNode } from "react";
import { PAGE_TITLE_CLASS, HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>
        ) : null}
        <h1 className={cn(PAGE_TITLE_CLASS, eyebrow ? "mt-1" : undefined)}>{title}</h1>
        {description ? <p className={cn("mt-1 max-w-2xl", HELPER_TEXT_CLASS)}>{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
