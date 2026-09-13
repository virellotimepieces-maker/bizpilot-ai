"use client";

import { StoreLiveBanner, StoreLivePill } from "@/components/store-live-banner";
import { storeLiveStatus, type StoreLiveStatus } from "@/lib/operator-setup";
import { useEffect, useState } from "react";

type OperatorPayload = {
  operator?: {
    stripeMode?: "unset" | "test" | "live" | "unknown";
    readyForLiveCustomers?: boolean;
  };
};

type PublicPayload = {
  kind?: StoreLiveStatus["kind"];
  label?: string;
  detail?: string;
};

function readStatus(payload: OperatorPayload): StoreLiveStatus | null {
  if (!payload.operator) return null;
  return storeLiveStatus({
    stripeMode: payload.operator.stripeMode ?? "unset",
    readyForLiveCustomers: payload.operator.readyForLiveCustomers === true,
  });
}

function usePublicLiveStatus() {
  const [status, setStatus] = useState<StoreLiveStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/live-status")
      .then((response) => response.json() as Promise<PublicPayload>)
      .then((payload) => {
        if (cancelled || !payload.kind || !payload.label || !payload.detail) return;
        setStatus({
          kind: payload.kind,
          label: payload.label,
          detail: payload.detail,
        });
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

export function StoreLiveHeaderBadge() {
  const status = usePublicLiveStatus();
  if (!status) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <StoreLivePill status={status} />
      {status.kind === "live" ? (
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
          Open to subscribers
        </span>
      ) : null}
    </span>
  );
}

export function StoreLivePublicStrip() {
  const status = usePublicLiveStatus();
  if (!status) return null;
  return (
    <div
      className={
        status.kind === "live"
          ? "border-t border-emerald-700/20 bg-emerald-700/10"
          : status.kind === "test"
            ? "border-t border-amber-700/20 bg-amber-700/10"
            : "border-t bg-muted/70"
      }
    >
      <p className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 py-2 text-sm sm:px-6">
        <StoreLivePill status={status} />
        <span className="font-medium">{status.detail}</span>
      </p>
    </div>
  );
}

export function StoreLivePageBanner() {
  const [status, setStatus] = useState<StoreLiveStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/app/bootstrap")
      .then((response) => response.json() as Promise<OperatorPayload>)
      .then((payload) => {
        if (!cancelled) setStatus(readStatus(payload));
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  return <StoreLiveBanner status={status} />;
}
