import { Suspense } from "react";
import { PaidIntegrations } from "@/components/paid-integrations";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";

function IntegrationsFallback() {
  return (
    <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading integrations">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-40" />
      <Skeleton className="h-28" />
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<IntegrationsFallback />}>
      <PaidIntegrations />
    </Suspense>
  );
}
