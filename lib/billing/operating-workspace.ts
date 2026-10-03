import type { BillingStore } from "@/lib/billing/store";

export async function selectOperatingWorkspace(store: BillingStore, userId: string) {
  const workspaces = await store.listWorkspacesForUser(userId);
  if (workspaces.length <= 1) return workspaces[0] ?? null;
  const ranked = await Promise.all(
    workspaces.map(async (workspace) => {
      const [calendar, gmail, shopify] = await Promise.all([
        store.getGoogleCalendarConnection(workspace.id),
        store.getGmailConnection(workspace.id),
        store.getShopifyConnection(workspace.id),
      ]);
      const score = (calendar ? 4 : 0) + (gmail ? 2 : 0) + (shopify ? 1 : 0);
      return { workspace, score };
    }),
  );
  ranked.sort((a, b) => b.score - a.score || a.workspace.id.localeCompare(b.workspace.id));
  return ranked[0]?.workspace ?? null;
}
