export type ShopifyConnectionStatus = "connected" | "needs_reconnect" | "pending";

export type ShopifySyncStatus = "idle" | "syncing" | "success" | "error";

export type ShopifyVariantRecord = {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string | null;
  available: boolean | null;
  inventoryQuantity: number | null;
  inventoryTracked: boolean;
};

export type ShopifyProductRecord = {
  id: string;
  workspaceId: string;
  shopifyProductId: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  productType: string;
  vendor: string;
  tags: string;
  url: string;
  imageUrls: string[];
  variants: ShopifyVariantRecord[];
  publishedAt: Date | null;
  shopifyUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ShopifyConnectionRecord = {
  id: string;
  workspaceId: string;
  shopDomain: string;
  shopName: string;
  primaryDomain: string;
  encryptedAccessToken: string;
  scopes: string;
  status: string;
  lastSyncedAt: Date | null;
  lastSyncStatus: ShopifySyncStatus;
  lastSyncError: string | null;
  productCount: number;
  connectedAt: Date;
  updatedAt: Date;
};

export type ShopifyConnectionWrite = {
  workspaceId: string;
  shopDomain: string;
  shopName?: string;
  primaryDomain?: string;
  encryptedAccessToken: string;
  scopes: string;
  status: string;
  lastSyncedAt?: Date | null;
  lastSyncStatus?: ShopifySyncStatus;
  lastSyncError?: string | null;
  productCount?: number;
};

export type ShopifyProductWrite = Omit<
  ShopifyProductRecord,
  "id" | "createdAt" | "updatedAt"
>;
