-- CreateTable
CREATE TABLE "SocialMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "conversationUrl" TEXT,
    "status" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "sources" JSONB,
    "operatorNote" TEXT NOT NULL,
    "usedInternalKnowledge" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialMessage_workspaceId_createdAt_idx" ON "SocialMessage"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialMessage_workspaceId_widgetKey_idx" ON "SocialMessage"("workspaceId", "widgetKey");

-- AddForeignKey
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
