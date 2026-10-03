-- AlterTable
ALTER TABLE "SocialMessage" ADD COLUMN "destinationName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialMessage" ADD COLUMN "destinationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialMessage" ADD COLUMN "platformPostId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialMessage" ADD COLUMN "publishError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialMessage" ADD COLUMN "publishMeta" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialMessage" ADD COLUMN "mediaAssetId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialMessage" ADD COLUMN "publishLockId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL DEFAULT '',
    "accountName" TEXT NOT NULL DEFAULT '',
    "accountType" TEXT NOT NULL DEFAULT '',
    "scopes" TEXT NOT NULL DEFAULT '',
    "encryptedAccessToken" TEXT NOT NULL DEFAULT '',
    "encryptedRefreshToken" TEXT NOT NULL DEFAULT '',
    "accessTokenExpiresAt" TIMESTAMP(3),
    "pendingDestinationsEnc" TEXT NOT NULL DEFAULT '',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMediaAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_workspaceId_platform_key" ON "SocialAccount"("workspaceId", "platform");

-- CreateIndex
CREATE INDEX "SocialAccount_workspaceId_idx" ON "SocialAccount"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaAsset_token_key" ON "SocialMediaAsset"("token");

-- CreateIndex
CREATE INDEX "SocialMediaAsset_workspaceId_idx" ON "SocialMediaAsset"("workspaceId");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMediaAsset" ADD CONSTRAINT "SocialMediaAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
