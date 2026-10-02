"use client";

import { OperatorSetupList } from "@/components/operator-setup-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { OperatorCheck } from "@/lib/operator-setup";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import { Inbox, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SetupItem = {
  key: string;
  label: string;
  done: boolean;
  hint: string;
};

type Bootstrap = {
  workspace: { name: string } | null;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
  usage: { used: number; limit: number; remaining: number } | null;
  notifications: { id: string; type: string; message: string }[];
  setup?: { items: SetupItem[]; readyForWidget: boolean };
  waitingOnHuman?: number;
  leads?: { total: number; new: number; qualified: number };
  paidAccess: boolean;
  missingEnv: string[];
  operator?: { items: OperatorCheck[]; readyForSubscribers: boolean };
  error?: string;
  code?: string;
};

const SETUP_HREF: Record<string, string> = {
  knowledge: "/app/knowledge",
  contact: "/app/knowledge",
  website: "/app/widget",
  sync: "/app/widget",
  queue: "/app/inbox",
};

function OverviewSkeleton() {
  return (
    <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading workspace">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

export function PaidOverview() {
  const router = useRouter();
  const [data, setData] = useState<Bootstrap | null>(null);

  useEffect(() => {
    void fetch("/api/app/bootstrap")
      .then(async (response) => {
        const payload = (await response.json()) as Bootstrap;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        setData(payload);
        if (response.ok && payload.paidAccess === false) {
          router.replace("/billing");
        }
      });
  }, [router]);

  if (!data) return <OverviewSkeleton />;
  if (data.missingEnv?.length) {
    return (
      <div className={PAGE_SHELL_CLASS}>
        <PageHeader title="Paid platform is paused" description="Signup, Stripe, and the website widget need credentials that are not in this environment yet." />
        <Card>
          <CardHeader>
            <CardTitle>Operator setup</CardTitle>
            <CardDescription>Set these on Vercel Production, then redeploy. Do not paste secret keys into chat.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {data.operator ? (
              <OperatorSetupList items={data.operator.items} />
            ) : (
              <p className={HELPER_TEXT_CLASS}>Missing: {data.missingEnv.join(", ")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!data.paidAccess) {
    return <p className={HELPER_TEXT_CLASS}>Redirecting to billing…</p>;
  }

  const openItems = data.setup?.items.filter((item) => !item.done) ?? [];
  const alerts = data.notifications.filter(
    (row) => row.type === "usage_limit" || row.type === "payment_failed" || row.type === "human_needed",
  ).slice(0, 3);
  const waiting = data.waitingOnHuman ?? 0;
  const leadStats = data.leads ?? { total: 0, new: 0, qualified: 0 };

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader
        eyebrow="Overview"
        title={data.workspace?.name || "Workspace"}
        description="Work that needs a person first. Counts below come from stored workspace data only."
        actions={
          <Button size="sm" render={<Link href="/app/inbox" />}>
            Open inbox
          </Button>
        }
      />

      {alerts.map((row) => (
        <Alert key={row.id} variant={row.type === "payment_failed" ? "destructive" : "warning"}>
          <AlertTitle>{row.type === "human_needed" ? "Needs a person" : "Account notice"}</AlertTitle>
          <AlertDescription>{row.message}</AlertDescription>
        </Alert>
      ))}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Needs human attention</CardTitle>
            <CardDescription>Website conversations where AI replies are paused.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-2xl font-semibold tracking-tight">{waiting}</p>
            <Button size="sm" variant={waiting > 0 ? "default" : "outline"} render={<Link href="/app/inbox" />}>
              Review inbox
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI replies this month</CardTitle>
            <CardDescription>Counted only after a successful model response.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {data.usage ? `${data.usage.used} / ${data.usage.limit}` : "—"}
            </p>
            <p className={`mt-2 ${HELPER_TEXT_CLASS}`}>
              {data.usage ? `${data.usage.remaining} remaining in this billing period.` : "Usage appears after the subscription period is active."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>BizPilot Pro, billed in Stripe.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-sm font-medium capitalize">{data.subscription?.status ?? "unknown"}</p>
            <Button size="sm" variant="outline" render={<Link href="/app/billing" />}>
              Billing
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>
              Contacts stored from the website widget. Counts are from this workspace only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-2xl font-semibold tracking-tight">
              {leadStats.new} new
            </p>
            <p className={HELPER_TEXT_CLASS}>
              {leadStats.total === 0
                ? "No contacts stored yet. The widget will not invent names or emails."
                : `${leadStats.qualified} qualified · ${leadStats.total} total. Status is owner-marked, not a payment.`}
            </p>
            <Button size="sm" variant="outline" render={<Link href="/app/leads" />}>
              Open leads
            </Button>
          </CardContent>
        </Card>
        <EmptyState
          icon={MessageCircleQuestion}
          title="Unanswered questions"
          description="Questions the assistant could not ground in approved knowledge will be listed here after that tracker is connected to live chats."
          action={
            <Button size="sm" variant="outline" render={<Link href="/app/knowledge" />}>
              Open knowledge
            </Button>
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            {alerts.length === 0
              ? "No stored account notices right now."
              : "Latest account notices from this workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.notifications.length === 0 ? (
            <p className={HELPER_TEXT_CLASS}>There is no recent activity stored for this workspace.</p>
          ) : (
            data.notifications.slice(0, 6).map((row) => (
              <p key={row.id} className="rounded-md border px-3 py-2 text-sm">
                {row.message}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup checklist</CardTitle>
          <CardDescription>
            {openItems.length === 0
              ? "Knowledge, website, and the human queue are ready."
              : `${openItems.length} step${openItems.length === 1 ? "" : "s"} still open.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(data.setup?.items ?? []).map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-2 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.done ? "Done" : "To do"} — {item.label}
                </p>
                <p className={HELPER_TEXT_CLASS}>{item.hint}</p>
              </div>
              <Button
                size="sm"
                variant={item.done ? "outline" : "default"}
                render={<Link href={SETUP_HREF[item.key] ?? "/app" } />}
              >
                {item.done ? "Open" : "Fix"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className={HELPER_TEXT_CLASS}>
        Gmail drafts and social drafts are under Integrations. They still require you to confirm before anything is sent or posted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" render={<Link href="/app/email" />}>
          <Inbox className="size-4" />
          Gmail
        </Button>
        <Button size="sm" variant="outline" render={<Link href="/app/social" />}>
          Social drafts
        </Button>
      </div>
    </div>
  );
}
