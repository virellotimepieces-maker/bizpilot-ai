import type { WebsiteSourceRecord } from "./types";

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function websiteSyncButtonLabel(status: WebsiteSourceRecord["lastSyncStatus"] | "syncing") {
  return status === "syncing" ? "Syncing…" : "Sync website";
}

export function websiteLastSyncSummary(
  source: (Omit<WebsiteSourceRecord, "lastSyncAt" | "nextSyncAt"> & {
    lastSyncAt: Date | string | null;
    nextSyncAt?: Date | string | null;
    lastSyncDiagnostic?: string | null;
  }) | null,
  now = new Date(),
) {
  if (!source) return "Add and verify a website domain to index public pages automatically.";
  if (!source.verifiedAt) return "Domain saved. Verify ownership before the first sync.";
  if (source.lastSyncStatus === "syncing") return "Sync in progress…";
  if (source.lastSyncStatus === "error") {
    return source.lastSyncError || "The last website sync failed.";
  }
  const lastSyncAt = asDate(source.lastSyncAt);
  if (!lastSyncAt) return "Verified. Sync the website to index public pages.";
  const minutes = Math.max(0, Math.round((now.getTime() - lastSyncAt.getTime()) / 60000));
  const when =
    minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} hr ago`;
  const count = `Last synced ${when} · ${source.lastSyncPageCount} public page${source.lastSyncPageCount === 1 ? "" : "s"}.`;
  return source.lastSyncDiagnostic ? `${count} ${source.lastSyncDiagnostic}` : count;
}
