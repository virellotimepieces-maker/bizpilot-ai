import { Suspense } from "react";
import { BillingPanel } from "@/components/billing-panel";
import { HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";

export default function AppBillingPage() {
  return (
    <Suspense fallback={<p className={HELPER_TEXT_CLASS}>Loading billing…</p>}>
      <BillingPanel chrome="desk" />
    </Suspense>
  );
}
