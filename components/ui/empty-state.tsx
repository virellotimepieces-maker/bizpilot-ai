import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HELPER_TEXT_CLASS, SECTION_HEADING_CLASS } from "@/lib/ui/type-scale";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-start gap-2 rounded-lg border border-dashed bg-card px-4 py-5",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      ) : null}
      <h2 className={SECTION_HEADING_CLASS}>{title}</h2>
      <p className={cn("max-w-xl", HELPER_TEXT_CLASS)}>{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
