"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import { INTEGRATIONS_HINT, type SerializedWorkspaceIntegrations } from "@/lib/v2/integrations";
import { CalendarClock, Mail, MessagesSquare, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const FUTURE_ICONS = {
  shopify: ShoppingBag,
  woocommerce: Store,
  calendar: CalendarClock,
} as const;

function gmailBadgeVariant(label: string) {
  if (label === "Connected") return "default" as const;
  if (label === "Needs reconnect") return "destructive" as const;
  return "outline" as const;
}

export function PaidIntegrations() {
  const [data, setData] = useState<SerializedWorkspaceIntegrations | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/app/integrations");
    const payload = (await response.json()) as {
      integrations?: SerializedWorkspaceIntegrations;
      error?: string;
    };
    if (!response.ok || !payload.integrations) {
      setError(payload.error || "Could not load integrations.");
      return;
    }
    setError("");
    setData(payload.integrations);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (data === null && !error) {
    return (
      <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading integrations">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-40" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={PAGE_SHELL_CLASS}>
        <PageHeader eyebrow="Workspace" title="Integrations" description={INTEGRATIONS_HINT} />
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader eyebrow="Workspace" title="Integrations" description={INTEGRATIONS_HINT} />

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <CardTitle>Gmail</CardTitle>
              </div>
              <Badge variant={gmailBadgeVariant(data.gmail.label)}>{data.gmail.label}</Badge>
            </div>
            <CardDescription>
              Connected inboxes still require you to confirm AI drafts before send.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.gmail.needsReconnect ? (
              <Alert variant="destructive">
                <AlertTitle>Reconnect Gmail</AlertTitle>
                <AlertDescription>
                  Access was revoked or expired. Open Gmail drafts to connect again. Nothing is sent
                  until you confirm.
                </AlertDescription>
              </Alert>
            ) : null}
            {data.gmail.connected && data.gmail.googleEmail ? (
              <p className={HELPER_TEXT_CLASS}>Connected as {data.gmail.googleEmail}.</p>
            ) : null}
            {!data.gmail.configured ? (
              <p className={HELPER_TEXT_CLASS}>
                Google OAuth is not configured on the server yet. You can still open Gmail drafts and
                add an email manually.
              </p>
            ) : null}
            {!data.gmail.connected && data.gmail.configured && !data.gmail.needsReconnect ? (
              <p className={HELPER_TEXT_CLASS}>
                Connect from the Gmail drafts page. OAuth, draft generation, and send confirmation
                are unchanged from the live product.
              </p>
            ) : null}
            <Button size="sm" render={<Link href="/app/email" />}>
              Open Gmail drafts
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <MessagesSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <CardTitle>Social drafts</CardTitle>
              </div>
              <Badge variant="outline">{data.social.label}</Badge>
            </div>
            <CardDescription>Drafts wait for you. BizPilot does not post on your behalf.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className={HELPER_TEXT_CLASS}>
              There is no Instagram, Facebook, TikTok, or Messenger connection. Suggested copy is for
              you to paste.
            </p>
            <Button size="sm" variant="outline" render={<Link href="/app/social" />}>
              Open social drafts
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {data.future.map((item) => {
          const Icon = FUTURE_ICONS[item.provider];
          return (
            <Card key={item.provider}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <CardTitle>{item.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{item.label}</Badge>
                </div>
                <CardDescription>Not connected</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={HELPER_TEXT_CLASS}>{item.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
