"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { websiteLastSyncSummary, websiteSyncButtonLabel } from "@/lib/website/status";
import type { WebsiteSourceRecord } from "@/lib/website/types";
import { HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";
import { useEffect, useState } from "react";

export function WebsiteKnowledgePanel() {
  const [domain, setDomain] = useState("");
  const [source, setSource] = useState<WebsiteSourceRecord | null>(null);
  const [verifyHint, setVerifyHint] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "verify" | "sync" | "">("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/app/website")
      .then(async (response) => {
        const payload = (await response.json()) as {
          source?: WebsiteSourceRecord | null;
          verifyHint?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error || "Could not load website indexing.");
          return;
        }
        setSource(payload.source ?? null);
        setDomain(payload.source?.domain ?? "");
        setVerifyHint(payload.verifyHint ?? "");
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load website indexing.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveDomain() {
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/app/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const payload = (await response.json()) as {
        source?: WebsiteSourceRecord;
        verifyHint?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error || "Could not save the domain.");
        return;
      }
      setSource(payload.source ?? null);
      setVerifyHint(payload.verifyHint ?? "");
    } catch {
      setError("Could not save the domain.");
    } finally {
      setBusy("");
    }
  }

  async function verify() {
    setBusy("verify");
    setError("");
    try {
      const response = await fetch("/api/app/website/verify", { method: "POST" });
      const payload = (await response.json()) as {
        source?: WebsiteSourceRecord;
        error?: string;
        diagnostic?: {
          fetchedUrl: string | null;
          status: number | null;
          expectedPath: string;
          foundScriptPathname: boolean;
        };
      };
      if (!response.ok) {
        const diagnostic = payload.diagnostic
          ? ` Fetched ${payload.diagnostic.fetchedUrl ?? "no URL"} (${
              payload.diagnostic.status == null ? "no HTTP status" : `HTTP ${payload.diagnostic.status}`
            }). Expected script path ${payload.diagnostic.expectedPath} ${
              payload.diagnostic.foundScriptPathname ? "was found" : "was not found"
            }.`
          : "";
        const base = payload.error || "Could not verify the domain.";
        setError(base.includes("Fetched ") || base.includes("could not be fetched") ? base : `${base}${diagnostic}`);
        return;
      }
      setSource(payload.source ?? null);
    } catch {
      setError("Could not verify the domain.");
    } finally {
      setBusy("");
    }
  }

  async function sync() {
    setBusy("sync");
    setError("");
    try {
      const response = await fetch("/api/app/website/sync", { method: "POST" });
      const payload = (await response.json()) as { source?: WebsiteSourceRecord; error?: string };
      if (!response.ok) {
        setError(payload.error || "Website sync failed.");
        return;
      }
      setSource(payload.source ?? null);
    } catch {
      setError("Website sync failed.");
    } finally {
      setBusy("");
    }
  }

  const syncing = busy === "sync" || source?.lastSyncStatus === "syncing";

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Website knowledge</CardTitle>
        <CardDescription>
          Verify your public domain once. BizPilot reads the sitemap (including Shopify product and
          policy pages) and answers only from this workspace’s indexed pages. Checkout, cart,
          account, and admin URLs are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-3">
        <Field
          label="Website domain"
          hint="Example: harborandpine.com. After the snippet is on the live site, verify, then sync."
          htmlFor="website-domain"
        >
          <Input
            id="website-domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="your-store.com"
            autoComplete="url"
            className="h-11 min-h-11"
          />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            onClick={() => void saveDomain()}
            disabled={busy !== "" || !domain.trim()}
          >
            {busy === "save" ? "Saving…" : "Save domain"}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            onClick={() => void verify()}
            disabled={busy !== "" || !source}
          >
            {busy === "verify" ? "Verifying…" : "Verify domain"}
          </Button>
          <Button
            className="w-full sm:w-fit"
            onClick={() => void sync()}
            disabled={busy !== "" || !source?.verifiedAt}
            aria-busy={syncing}
          >
            {websiteSyncButtonLabel(syncing ? "syncing" : source?.lastSyncStatus || "idle")}
          </Button>
        </div>
        <p className={HELPER_TEXT_CLASS} aria-live="polite">
          {websiteLastSyncSummary(source)}
          {source?.nextSyncAt
            ? ` Automatic re-sync is scheduled after ${new Date(source.nextSyncAt).toLocaleString()}.`
            : ""}
        </p>
        {source?.verifiedAt ? (
          <p className={HELPER_TEXT_CLASS}>Domain verified for this widget.</p>
        ) : verifyHint ? (
          <p className={`leading-relaxed ${HELPER_TEXT_CLASS}`}>{verifyHint}</p>
        ) : null}
        {source?.conflictWarning ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
            {source.conflictWarning}
          </p>
        ) : null}
        {source?.lastSyncStatus === "error" || error ? (
          <p className="text-sm text-destructive md:text-base" role="alert">
            {error || source?.lastSyncError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
