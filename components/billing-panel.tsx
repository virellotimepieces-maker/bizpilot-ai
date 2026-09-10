"use client";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BIZPILOT_PRO } from "@/lib/plan";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Bootstrap = {
  user: { email: string; name: string };
  workspace: { id: string; name: string } | null;
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  } | null;
  paidAccess: boolean;
  missingEnv: string[];
  error?: string;
  code?: string;
};

export function BillingPanel() {
  const search = useSearchParams();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/app/bootstrap")
      .then((response) => response.json() as Promise<Bootstrap>)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load billing.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCheckout() {
    setPending("checkout");
    setError("");
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const payload = (await response.json()) as { url?: string; error?: string };
    setPending(null);
    if (!response.ok || !payload.url) {
      setError(payload.error || "Checkout is not available yet.");
      return;
    }
    window.location.href = payload.url;
  }

  async function openPortal() {
    setPending("portal");
    setError("");
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const payload = (await response.json()) as { url?: string; error?: string };
    setPending(null);
    if (!response.ok || !payload.url) {
      setError(payload.error || "Customer Portal is not available yet.");
      return;
    }
    window.location.href = payload.url;
  }

  const checkoutState = search.get("checkout");

  return (
    <div className="min-h-full">
      <SiteHeader signedIn />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              {BIZPILOT_PRO.name} is USD $29 per month for one business. Cancel anytime. There are
              no automatic overage charges.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4">
            {checkoutState === "success" ? (
              <p className="text-sm">
                Checkout finished. If the webhook is configured, this workspace will unlock within a
                few seconds.
              </p>
            ) : null}
            {data?.missingEnv?.length ? (
              <p className="text-sm text-muted-foreground">
                Paid billing is paused until these environment variables are set:{" "}
                {data.missingEnv.join(", ")}.
              </p>
            ) : null}
            <p className="text-sm">
              Status: <strong>{data?.subscription?.status ?? "not subscribed"}</strong>
              {data?.subscription?.cancelAtPeriodEnd ? " (cancels at period end)" : ""}
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={startCheckout} disabled={pending !== null || data?.paidAccess}>
                {pending === "checkout" ? "Redirecting…" : "Subscribe — $29 / month"}
              </Button>
              <Button variant="outline" onClick={openPortal} disabled={pending !== null}>
                {pending === "portal" ? "Opening…" : "Manage in Stripe Customer Portal"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Account and billing stay available when a subscription is inactive. The dashboard and
              website widget do not.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
