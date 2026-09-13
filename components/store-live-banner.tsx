import { cn } from "@/lib/utils";
import type { StoreLiveStatus } from "@/lib/operator-setup";

const KIND_CLASS: Record<StoreLiveStatus["kind"], string> = {
  live: "bg-emerald-700 text-white",
  test: "bg-amber-700 text-white",
  setup: "bg-muted text-muted-foreground",
};

export function StoreLivePill({ status, className }: { status: StoreLiveStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        KIND_CLASS[status.kind],
        className,
      )}
    >
      {status.label}
    </span>
  );
}

export function StoreLiveBanner({ status }: { status: StoreLiveStatus }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        status.kind === "live"
          ? "border-emerald-700/30 bg-emerald-700/8"
          : status.kind === "test"
            ? "border-amber-700/30 bg-amber-700/8"
            : "bg-muted/60",
      )}
    >
      <p className="flex flex-wrap items-center gap-2">
        <StoreLivePill status={status} />
        <span className="font-medium">{status.detail}</span>
      </p>
    </div>
  );
}
