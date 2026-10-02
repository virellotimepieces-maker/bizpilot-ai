"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import { INTEGRATIONS_HINT, type SerializedWorkspaceIntegrations } from "@/lib/v2/integrations";
import { CalendarClock, Mail, MessagesSquare, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const FUTURE_ICONS = {
  woocommerce: Store,
  calendar: CalendarClock,
} as const;

function badgeVariant(label: string) {
  if (label === "Connected") return "default" as const;
  if (label === "Syncing" || label === "Connecting") return "secondary" as const;
  if (label === "Needs reconnect" || label === "Connection error") return "destructive" as const;
  return "outline" as const;
}

function formatSynced(iso: string | null) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function gmailQueryNotice(flag: string) {
  if (flag === "connected") return "Gmail is connected. Drafts still wait for your Send confirmation.";
  if (flag === "denied") return "Gmail connection was cancelled.";
  if (flag === "error" || flag === "signin") return "Gmail connection error. Try Connect Gmail again.";
  if (flag === "misconfigured") return "Google OAuth is not configured on the server yet.";
  return "";
}

function shopifyQueryNotice(flag: string, sync: string) {
  if (flag === "connected" && sync === "error") {
    return "Shopify is connected, but the first catalog sync failed. Use Sync now.";
  }
  if (flag === "connected") return "Shopify is connected. Catalog data is scoped to this workspace.";
  if (flag === "denied") return "Shopify connection was cancelled.";
  if (flag === "error" || flag === "signin") return "Shopify connection error. Try Connect Shopify again.";
  if (flag === "misconfigured") return "Shopify OAuth is not configured on the server yet.";
  if (flag === "conflict") return "That Shopify store is already connected to another BizPilot workspace.";
  return "";
}

export function PaidIntegrations() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SerializedWorkspaceIntegrations | null>(null);
  const [error, setError] = useState("");
  const [shop, setShop] = useState("");
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifySyncing, setShopifySyncing] = useState(false);
  const [busy, setBusy] = useState("");
  const [gmailActionNotice, setGmailNotice] = useState("");
  const [shopifyActionNotice, setShopifyNotice] = useState("");
  const gmailNotice = gmailActionNotice || gmailQueryNotice(searchParams.get("gmail") ?? "");
  const shopifyNotice = shopifyActionNotice || shopifyQueryNotice(searchParams.get("shopify") ?? "", searchParams.get("sync") ?? "");

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

  async function disconnectGmail() {
    setBusy("gmail-disconnect");
    const response = await fetch("/api/app/gmail", { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setGmailNotice(payload.error || "Could not disconnect Gmail.");
      setBusy("");
      return;
    }
    setGmailNotice("Gmail is disconnected.");
    setBusy("");
    await load();
  }

  async function connectShopify() {
    setShopifyConnecting(true);
    setShopifyNotice("");
    const response = await fetch("/api/app/shopify/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop }),
    });
    const payload = (await response.json()) as { authorizeUrl?: string; error?: string };
    if (!response.ok || !payload.authorizeUrl) {
      setShopifyConnecting(false);
      setShopifyNotice(payload.error || "Could not start Shopify connection.");
      return;
    }
    window.location.href = payload.authorizeUrl;
  }

  async function syncShopify() {
    setShopifySyncing(true);
    const response = await fetch("/api/app/shopify/sync", { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setShopifyNotice(payload.error || "Catalog sync failed.");
      setShopifySyncing(false);
      await load();
      return;
    }
    setShopifyNotice("Catalog sync finished.");
    setShopifySyncing(false);
    await load();
  }

  async function disconnectShopify() {
    setBusy("shopify-disconnect");
    const response = await fetch("/api/app/shopify", { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setShopifyNotice(payload.error || "Could not disconnect Shopify.");
      setBusy("");
      return;
    }
    setShopifyNotice("Shopify is disconnected.");
    setBusy("");
    await load();
  }

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

  const gmailLabel = data.gmail.label;
  const shopifyLabel = shopifyConnecting
    ? "Connecting"
    : shopifySyncing || data.shopify.lastSyncStatus === "syncing"
      ? "Syncing"
      : data.shopify.label;

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
              <Badge variant={badgeVariant(gmailLabel)}>{gmailLabel}</Badge>
            </div>
            <CardDescription>
              Connected inboxes still require you to confirm AI drafts before send.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {gmailNotice ? (
              <Alert variant={gmailNotice.includes("error") || gmailNotice.includes("cancelled") ? "destructive" : "default"}>
                <AlertTitle>{data.gmail.needsReconnect ? "Reconnect Gmail" : "Gmail"}</AlertTitle>
                <AlertDescription>{gmailNotice}</AlertDescription>
              </Alert>
            ) : null}
            {data.gmail.needsReconnect ? (
              <Alert variant="destructive">
                <AlertTitle>Connection error</AlertTitle>
                <AlertDescription>
                  Access was revoked or expired. Connect Gmail again. Nothing is sent until you confirm.
                </AlertDescription>
              </Alert>
            ) : null}
            {data.gmail.connected && data.gmail.googleEmail ? (
              <p className={HELPER_TEXT_CLASS}>Connected mailbox: {data.gmail.googleEmail}.</p>
            ) : null}
            {!data.gmail.configured ? (
              <p className={HELPER_TEXT_CLASS}>
                Google OAuth is not configured on the server yet. You can still open Gmail drafts and
                add an email manually.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {data.gmail.configured && (!data.gmail.connected || data.gmail.needsReconnect) ? (
                <Button
                  size="sm"
                  render={<a href="/api/app/gmail/connect?returnTo=/app/integrations" />}
                >
                  {data.gmail.needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}
                </Button>
              ) : null}
              {data.gmail.connected && !data.gmail.needsReconnect ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void disconnectGmail()}
                  disabled={busy === "gmail-disconnect"}
                >
                  Disconnect
                </Button>
              ) : null}
              <Button size="sm" variant="outline" render={<Link href="/app/email" />}>
                Open Gmail drafts
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ShoppingBag className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <CardTitle>Shopify</CardTitle>
              </div>
              <Badge variant={badgeVariant(shopifyLabel)}>{shopifyLabel}</Badge>
            </div>
            <CardDescription>
              Catalog sync is workspace-scoped. Website chat uses active products only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {shopifyNotice ? (
              <Alert
                variant={
                  shopifyNotice.includes("error") || shopifyNotice.includes("cancelled") || shopifyNotice.includes("already connected")
                    ? "destructive"
                    : "default"
                }
              >
                <AlertTitle>Shopify</AlertTitle>
                <AlertDescription>{shopifyNotice}</AlertDescription>
              </Alert>
            ) : null}
            {data.shopify.connectionError ? (
              <Alert variant="destructive">
                <AlertTitle>Connection error</AlertTitle>
                <AlertDescription>{data.shopify.connectionError}</AlertDescription>
              </Alert>
            ) : null}
            {data.shopify.lastSyncError ? (
              <Alert variant="destructive">
                <AlertTitle>Sync error</AlertTitle>
                <AlertDescription>{data.shopify.lastSyncError}</AlertDescription>
              </Alert>
            ) : null}
            {data.shopify.connected && data.shopify.shopDomain ? (
              <p className={HELPER_TEXT_CLASS}>
                Connected store: {data.shopify.shopName ? `${data.shopify.shopName} · ` : ""}
                {data.shopify.shopDomain}. {data.shopify.productCount} products in catalog. Last synced:{" "}
                {formatSynced(data.shopify.lastSyncedAt)}.
              </p>
            ) : null}
            {!data.shopify.configured ? (
              <p className={HELPER_TEXT_CLASS}>
                Shopify OAuth is not configured on the server yet. After it is added, Connect Shopify
                will appear here.
              </p>
            ) : null}
            {data.shopify.configured && !data.shopify.connected ? (
              <div className="grid gap-2">
                <Label htmlFor="shopify-domain">Shopify store domain</Label>
                <Input
                  id="shopify-domain"
                  value={shop}
                  onChange={(event) => setShop(event.target.value)}
                  placeholder="your-store.myshopify.com"
                  autoComplete="off"
                />
                <Button size="sm" onClick={() => void connectShopify()} disabled={shopifyConnecting || !shop.trim()}>
                  {shopifyConnecting ? "Connecting" : "Connect Shopify"}
                </Button>
              </div>
            ) : null}
            {data.shopify.connected ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void syncShopify()} disabled={shopifySyncing}>
                  {shopifySyncing || data.shopify.lastSyncStatus === "syncing" ? "Syncing" : "Sync now"}
                </Button>
                {data.shopify.needsReconnect ? (
                  <div className="grid min-w-56 flex-1 gap-2">
                    <Label htmlFor="shopify-reconnect">Shopify store domain</Label>
                    <Input
                      id="shopify-reconnect"
                      value={shop}
                      onChange={(event) => setShop(event.target.value)}
                      placeholder="your-store.myshopify.com"
                    />
                    <Button size="sm" onClick={() => void connectShopify()} disabled={shopifyConnecting || !shop.trim()}>
                      Reconnect Shopify
                    </Button>
                  </div>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void disconnectShopify()}
                  disabled={busy === "shopify-disconnect"}
                >
                  Disconnect
                </Button>
              </div>
            ) : null}
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

      <section className="grid gap-3 sm:grid-cols-2">
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
