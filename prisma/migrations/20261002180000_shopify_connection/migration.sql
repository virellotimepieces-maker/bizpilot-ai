-- CreateTable
CREATE TABLE "ShopifyConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "shopName" TEXT NOT NULL DEFAULT '',
    "primaryDomain" TEXT NOT NULL DEFAULT '',
    "encryptedAccessToken" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastSyncError" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyProduct" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "productType" TEXT NOT NULL DEFAULT '',
    "vendor" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "imageUrls" JSONB NOT NULL,
    "variants" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyConnection_workspaceId_key" ON "ShopifyConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyConnection_shopDomain_key" ON "ShopifyConnection"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProduct_workspaceId_shopifyProductId_key" ON "ShopifyProduct"("workspaceId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "ShopifyProduct_workspaceId_status_idx" ON "ShopifyProduct"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ShopifyProduct_workspaceId_idx" ON "ShopifyProduct"("workspaceId");

-- AddForeignKey
ALTER TABLE "ShopifyConnection" ADD CONSTRAINT "ShopifyConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyProduct" ADD CONSTRAINT "ShopifyProduct_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
