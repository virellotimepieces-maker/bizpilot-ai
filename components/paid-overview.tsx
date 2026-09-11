"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PAGE_TITLE_CLASS, PAGE_SHELL_CLASS, HELPER_TEXT_CLASS, SECTION_HEADING_CLASS } from "@/lib/ui/type-scale";

type Bootstrap = {
  workspace: { name: string } | null;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
  usage: { used: number; limit: number; remaining: number } | null;
  notifications: { id: string; type: string; message: string }[];
  paidAccess: boolean;
  missingEnv: string[];
  error?: string;
  code?: string;
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

    return (
      <div className={PAGE_SHELL_CLASS}>
      <div>
        <p className="text-xs tracking-[0.2em] text-primary uppercase">Paid workspace</p>
        <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>{data.workspace?.name}</h1>
      </div>
      {data.notifications
        .filter((row) => row.type === "usage_limit" || row.type === "payment_failed")
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
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{data.subscription?.status}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button size="sm" render={<Link href="/app/knowledge" />}>
              Edit knowledge
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/app/social" />}>
              Social drafts
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/app/widget" />}>
              Install widget
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
