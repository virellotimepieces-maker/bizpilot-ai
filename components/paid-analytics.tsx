"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { HELPER_TEXT_CLASS, LABEL_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import { ANALYTICS_HINT, type SerializedAnalytics } from "@/lib/v2/analytics";
import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString();
}

function MetricCard({
  title,
  description,
  value,
  href,
  action,
}: {
  title: string;
  description: string;
  value: string | number;
  href?: string;
  action?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {href ? (
          <Button size="sm" variant="outline" render={<Link href={href} />}>
            {action ?? "Open"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BreakdownList({
  title,
  description,
  rows,
  empty,
}: {
  title: string;
  description: string;
  rows: { id: string; label: string; count: number }[];
  empty: string;
}) {
  const visible = rows.filter((row) => row.count > 0);
  const max = visible.reduce((n, row) => Math.max(n, row.count), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {visible.length === 0 ? (
          <p className={HELPER_TEXT_CLASS}>{empty}</p>
        ) : (
          visible.map((row) => (
            <div key={row.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className={LABEL_CLASS}>{row.label}</p>
                <p className="text-sm tabular-nums">{row.count}</p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${max > 0 ? Math.round((row.count / max) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function PaidAnalytics() {
  const [data, setData] = useState<SerializedAnalytics | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/app/analytics");
    const payload = (await response.json()) as { analytics?: SerializedAnalytics; error?: string };
    if (!response.ok || !payload.analytics) {
      setError(payload.error || "Could not load analytics.");
      return;
    }
    setError("");
    setData(payload.analytics);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (data === null && !error) {
    return (
      <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading analytics">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={PAGE_SHELL_CLASS}>
        <PageHeader eyebrow="Workspace" title="Analytics" description={ANALYTICS_HINT} />
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader eyebrow="Workspace" title="Analytics" description={ANALYTICS_HINT} />
      <p className={HELPER_TEXT_CLASS}>
        AI replies counted {formatWhen(data.usage.periodStart)} – {formatWhen(data.usage.periodEnd)}.
        Allowance is {data.usage.limit} per billing month. There is no overage charge.
      </p>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="AI replies this period"
          description="Counted after a successful model response. Not estimated traffic."
          value={`${data.usage.used} / ${data.usage.limit}`}
          href="/app/billing"
          action="Billing"
        />
        <MetricCard
          title="Needs a person"
          description="Website conversations where AI replies are paused."
          value={data.conversations.waitingOnHuman}
          href="/app/inbox"
          action="Open inbox"
        />
        <MetricCard
          title="Unanswered questions"
          description="Visitor questions that were not grounded in published Knowledge."
          value={data.unanswered.open}
          href="/app/knowledge"
          action="Open knowledge"
        />
      </section>

      {data.hasVisitorActivity ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Conversations"
              description="Stored website threads. Open and resolved are inbox statuses."
              value={data.conversations.total}
              href="/app/inbox"
              action="Open inbox"
            />
            <MetricCard
              title="Leads"
              description="Contacts stored from the widget. Status is owner-marked."
              value={data.leads.total}
              href="/app/leads"
              action="Open contacts"
            />
            <MetricCard
              title="Quote requests"
              description="Visitor quote or estimate asks. Not issued quotes."
              value={data.quotes.total}
              href="/app/quotes"
              action="Open quote requests"
            />
            <MetricCard
              title="Appointment requests"
              description="Visitor booking asks. Not calendar bookings."
              value={data.appointments.total}
              href="/app/appointments"
              action="Open appointment requests"
            />
            <MetricCard
              title="Published knowledge facts"
              description="Enabled Knowledge entries in this workspace."
              value={`${data.knowledge.enabled} / ${data.knowledge.total}`}
              href="/app/knowledge"
              action="Open knowledge"
            />
            <MetricCard
              title="Indexed website pages"
              description="Pages stored from a verified site sync. Zero means none indexed."
              value={data.websitePages}
              href="/app/knowledge"
              action="Open knowledge"
            />
          </section>
          <section className="grid gap-3 lg:grid-cols-2">
            <BreakdownList
              title="Conversation intent"
              description="Stored on each conversation. High-intent tags are not confirmed purchases."
              rows={data.intents}
              empty="No conversation intents stored yet."
            />
            <BreakdownList
              title="Lead status"
              description="Owner-marked only. Converted is not a Stripe payment."
              rows={data.leadStatuses}
              empty="No leads stored yet."
            />
          </section>
        </>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No visitor activity stored yet"
          description="Counts stay at zero until the website widget stores a conversation, contact, quote request, appointment request, or counted AI reply. This page does not invent traffic or close rates."
          action={
            <Button size="sm" variant="outline" render={<Link href="/app/widget" />}>
              Open widget
            </Button>
          }
        />
      )}
    </div>
  );
}
