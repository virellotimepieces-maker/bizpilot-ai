import type { BillingStore } from "@/lib/billing/store";
import { crawlWebsitePages, nextWebsiteSyncAt } from "./sync";
import type { FetchLike } from "./sync";
import type { WebsiteSourceRecord } from "./types";

export async function runWebsiteSync(input: {
  store: BillingStore;
  source: WebsiteSourceRecord;
  fetchImpl?: FetchLike;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const syncing = await input.store.saveWebsiteSource({
    ...input.source,
    lastSyncStatus: "syncing",
    lastSyncError: null,
  });
  try {
    const crawled = await crawlWebsitePages({
      source: syncing,
      fetchImpl: input.fetchImpl,
      now,
    });
    await input.store.replaceWebsitePages(
      syncing.workspaceId,
      syncing.widgetKey,
      syncing.id,
      crawled.pages,
    );
    const saved = await input.store.saveWebsiteSource({
      ...syncing,
      lastSyncStatus: "success",
      lastSyncError: null,
      lastSyncAt: now,
      nextSyncAt: nextWebsiteSyncAt(now),
      lastSyncPageCount: crawled.pages.length,
      conflictWarning: crawled.conflictWarning,
    });
    if (crawled.conflictWarning) {
      const workspace = await input.store.getWorkspace(saved.workspaceId);
      if (workspace) {
        await input.store.addNotification({
          userId: workspace.ownerUserId,
          workspaceId: workspace.id,
          type: "website_conflict",
          message: crawled.conflictWarning,
        });
      }
    }
    return saved;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Website sync failed.";
    const saved = await input.store.saveWebsiteSource({
      ...syncing,
      lastSyncStatus: "error",
      lastSyncError: message,
      nextSyncAt: nextWebsiteSyncAt(now),
    });
    const workspace = await input.store.getWorkspace(saved.workspaceId);
    if (workspace) {
      await input.store.addNotification({
        userId: workspace.ownerUserId,
        workspaceId: workspace.id,
        type: "website_sync_error",
        message,
      });
    }
    return saved;
  }
}
