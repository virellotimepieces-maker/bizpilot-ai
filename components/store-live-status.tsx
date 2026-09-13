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

function readStatus(payload: OperatorPayload): StoreLiveStatus | null {
  if (!payload.operator) return null;
  return storeLiveStatus({
    stripeMode: payload.operator.stripeMode ?? "unset",
    readyForLiveCustomers: payload.operator.readyForLiveCustomers === true,
  });
}

export function StoreLiveHeaderBadge() {
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
  return <StoreLivePill status={status} />;
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
