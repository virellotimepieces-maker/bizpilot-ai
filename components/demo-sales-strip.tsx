"use client";

import { Button } from "@/components/ui/button";
import {
  LANDING_PRIMARY_CTA,
  formatPlanPriceUsd,
} from "@/lib/marketing/copy";
import { INDUSTRY_DEMO_LABEL } from "@/lib/industry-demos";
import Link from "next/link";

export function DemoSalesStrip() {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
        {INDUSTRY_DEMO_LABEL}
      </p>
      <h2 className="font-heading mt-2 text-xl tracking-tight text-foreground sm:text-2xl">
        See Bizlyro answer from published facts, then capture a lead
      </h2>
      <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-muted-foreground">
        <li>The website widget answers published questions 24/7.</li>
        <li>Honest AI — never invents prices, policies, or business information.</li>
        <li>
          Bizlyro AI is {formatPlanPriceUsd()} per month after you create an account. Cancel anytime.
        </li>
      </ul>
      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <Button nativeButton={false} render={<Link href={LANDING_PRIMARY_CTA.href} />}>
          {LANDING_PRIMARY_CTA.label}
        </Button>
      </div>
    </section>
  );
}
