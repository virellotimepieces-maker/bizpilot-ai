"use client";

import { PaidLeads } from "@/components/paid-leads";
import { PaidQuotes } from "@/components/paid-quotes";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_SHELL_CLASS, TAB_ITEM_CLASS, TAB_ROW_CLASS } from "@/lib/ui/type-scale";
import { QUOTE_REQUEST_HINT } from "@/lib/v2/quotes";
import Link from "next/link";

export function PaidSales({ tab }: { tab: "contacts" | "quotes" }) {
  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader
        eyebrow="Sales"
        title="Leads"
        description="Contacts and quote requests from the website widget. Status is owner-marked. Quote rows are requests you review — not issued prices."
      />
      <nav aria-label="Leads sections" className={TAB_ROW_CLASS}>
        <Button
          size="sm"
          variant={tab === "contacts" ? "default" : "outline"}
          className={TAB_ITEM_CLASS}
          aria-current={tab === "contacts" ? "page" : undefined}
          render={<Link href="/app/leads" />}
        >
          Contacts
        </Button>
        <Button
          size="sm"
          variant={tab === "quotes" ? "default" : "outline"}
          className={TAB_ITEM_CLASS}
          aria-current={tab === "quotes" ? "page" : undefined}
          render={<Link href="/app/quotes" />}
        >
          Quote requests
        </Button>
      </nav>
      {tab === "quotes" ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_REQUEST_HINT}</p>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Converted is not a Stripe payment or a calendar booking.
        </p>
      )}
      {tab === "contacts" ? <PaidLeads embedded /> : <PaidQuotes embedded />}
    </div>
  );
}
