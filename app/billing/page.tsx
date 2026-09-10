import { Suspense } from "react";
import { BillingPanel } from "@/components/billing-panel";

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading billing…</p>}>
      <BillingPanel />
    </Suspense>
  );
}
