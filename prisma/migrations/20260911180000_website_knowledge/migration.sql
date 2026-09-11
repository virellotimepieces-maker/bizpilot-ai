-- AlterTable
ALTER TABLE "Message" ADD COLUMN "sources" JSONB;

-- CreateTable
CREATE TABLE "WebsiteSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastSyncError" TEXT,
    "lastSyncPageCount" INTEGER NOT NULL DEFAULT 0,
    "conflictWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsitePage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "lastModified" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteSource_workspaceId_key" ON "WebsiteSource"("workspaceId");

-- CreateIndex
CREATE INDEX "WebsiteSource_widgetKey_idx" ON "WebsiteSource"("widgetKey");

-- CreateIndex
CREATE INDEX "WebsiteSource_nextSyncAt_idx" ON "WebsiteSource"("nextSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePage_workspaceId_url_key" ON "WebsitePage"("workspaceId", "url");

-- CreateIndex
CREATE INDEX "WebsitePage_workspaceId_widgetKey_idx" ON "WebsitePage"("workspaceId", "widgetKey");

-- AddForeignKey
ALTER TABLE "WebsiteSource" ADD CONSTRAINT "WebsiteSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsitePage" ADD CONSTRAINT "WebsitePage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WebsiteSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsitePage" ADD CONSTRAINT "WebsitePage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
