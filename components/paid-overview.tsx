"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PAGE_TITLE_CLASS, PAGE_SHELL_CLASS, HELPER_TEXT_CLASS, SECTION_HEADING_CLASS } from "@/lib/ui/type-scale";

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
  paidAccess: boolean;
  missingEnv: string[];
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

  if (!data) return <p className={HELPER_TEXT_CLASS}>Loading workspace…</p>;
  if (data.missingEnv?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paid platform is paused</CardTitle>
          <CardDescription>
            Signup, Stripe, and the website widget need credentials that are not in this environment
            yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">Missing: {data.missingEnv.join(", ")}</CardContent>
      </Card>
    );
  }
  if (!data.paidAccess) {
    return <p className="text-sm">Redirecting to billing…</p>;
  }

  const openItems = data.setup?.items.filter((item) => !item.done) ?? [];

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div>
        <p className="text-xs tracking-[0.2em] text-primary uppercase">Paid workspace</p>
        <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>{data.workspace?.name}</h1>
      </div>
      {data.notifications
        .filter(
          (row) =>
            row.type === "usage_limit" ||
            row.type === "payment_failed" ||
            row.type === "human_needed",
        )
        .slice(0, 3)
        .map((row) => (
          <div key={row.id} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
            {row.message}
          </div>
        ))}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>AI replies this month</CardTitle>
            <CardDescription>Counted only after a successful model response.</CardDescription>
          </CardHeader>
          <CardContent className={`${SECTION_HEADING_CLASS} font-heading`}>
            {data.usage ? `${data.usage.used} / ${data.usage.limit}` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Waiting on a person</CardTitle>
            <CardDescription>Website visitors whose AI is paused.</CardDescription>
          </CardHeader>
          <CardContent className={`${SECTION_HEADING_CLASS} font-heading`}>
            {data.waitingOnHuman ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>{data.subscription?.status}</p>
            <Button size="sm" variant="outline" render={<Link href="/app/email" />}>
              Email
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/app/social" />}>
              Social drafts
            </Button>
          </CardContent>
        </Card>
      </div>

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
              className="flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {item.done ? "Done" : "To do"} — {item.label}
                </p>
                <p className="text-sm text-muted-foreground">{item.hint}</p>
              </div>
              <Button
                size="sm"
                variant={item.done ? "outline" : "default"}
                render={<Link href={SETUP_HREF[item.key] ?? "/app"} />}
              >
                {item.done ? "Open" : "Fix"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
