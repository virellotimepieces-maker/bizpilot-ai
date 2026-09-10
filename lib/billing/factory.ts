import { BillingError } from "@/lib/billing/types";
import { PrismaBillingStore } from "@/lib/billing/prisma-store";
import type { BillingStore } from "@/lib/billing/store";
import { missingPaidEnv } from "@/lib/env";

let prismaStore: PrismaBillingStore | null = null;

export function getBillingStore(): BillingStore {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new BillingError(
      "Paid BizPilot workspaces need DATABASE_URL. Demo mode at /demo does not use this database.",
      "misconfigured",
    );
  }
  prismaStore ??= new PrismaBillingStore();
  return prismaStore;
}

export function assertPaidPlatformOrThrow() {
  const missing = missingPaidEnv();
  if (missing.length) {
    throw new BillingError(
      `Paid platform is not configured yet. Missing: ${missing.join(", ")}`,
      "misconfigured",
    );
  }
}
