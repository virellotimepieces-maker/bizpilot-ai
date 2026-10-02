import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";

export default function AppLoading() {
  return (
    <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
