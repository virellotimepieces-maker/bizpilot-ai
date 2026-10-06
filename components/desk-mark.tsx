import Link from "next/link";
import { cn } from "@/lib/utils";

export function DeskMark({
  href = "/app",
  subtitle,
  className,
  name = "BizPilot AI",
  mark = "BP",
}: {
  href?: string;
  subtitle?: string;
  className?: string;
  name?: string;
  mark?: string;
}) {
  return (
    <Link href={href} className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold tracking-wide text-primary-foreground">
        {mark}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
          {name}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
