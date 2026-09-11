export const WEBSITE_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const WEBSITE_MAX_PAGES = 60;
export const WEBSITE_MAX_SITEMAPS = 8;
export const WEBSITE_FETCH_TIMEOUT_MS = 15000;

export type WebsitePageKind =
  | "product"
  | "service"
  | "faq"
  | "about"
  | "contact"
  | "shipping"
  | "returns"
  | "privacy"
  | "terms"
  | "policy"
  | "other";

export type WebsiteSyncStatus = "idle" | "syncing" | "success" | "error";

export type WebsiteReplySource = {
  title: string;
  url: string;
  kind: WebsitePageKind;
};

export type WebsitePageRecord = {
  id: string;
  workspaceId: string;
  widgetKey: string;
  sourceId: string;
  url: string;
  title: string;
  kind: WebsitePageKind;
  content: string;
  contentHash: string;
  lastModified: Date | null;
  fetchedAt: Date;
};

export type WebsiteSourceRecord = {
  id: string;
  workspaceId: string;
  widgetKey: string;
  domain: string;
  verifyToken: string;
  verifiedAt: Date | null;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  lastSyncStatus: WebsiteSyncStatus;
  lastSyncError: string | null;
  lastSyncPageCount: number;
  conflictWarning: string | null;
  createdAt: Date;
  updatedAt: Date;
};
