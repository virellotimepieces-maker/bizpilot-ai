"use client";

import { PaidAppointments } from "@/components/paid-appointments";
import { PaidLeads } from "@/components/paid-leads";
import { PaidQuotes } from "@/components/paid-quotes";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_SHELL_CLASS, TAB_ITEM_CLASS, TAB_ROW_CLASS } from "@/lib/ui/type-scale";
import { APPOINTMENT_REQUEST_HINT } from "@/lib/v2/appointments";
import { QUOTE_REQUEST_HINT } from "@/lib/v2/quotes";
import Link from "next/link";

export function PaidSales({ tab }: { tab: "contacts" | "quotes" | "appointments" }) {
  const hint =
    tab === "quotes"
      ? QUOTE_REQUEST_HINT
      : tab === "appointments"
        ? APPOINTMENT_REQUEST_HINT
        : "Converted is not a Stripe payment or a calendar booking.";

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader
        eyebrow="Sales"
        title="Leads"
        description="Contacts, quote requests, and appointment requests from the website widget. Status is owner-marked. Requests are not issued quotes or calendar bookings."
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
        <Button
          size="sm"
          variant={tab === "appointments" ? "default" : "outline"}
          className={TAB_ITEM_CLASS}
          aria-current={tab === "appointments" ? "page" : undefined}
          render={<Link href="/app/appointments" />}
        >
          Appointment requests
        </Button>
      </nav>
      <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
      {tab === "contacts" ? (
        <PaidLeads embedded />
      ) : tab === "quotes" ? (
        <PaidQuotes embedded />
      ) : (
        <PaidAppointments embedded />
      )}
    </div>
  );
}
