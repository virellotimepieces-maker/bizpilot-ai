-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "draftSubject" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "sources" JSONB,
    "operatorNote" TEXT NOT NULL,
    "usedInternalKnowledge" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDraft_workspaceId_createdAt_idx" ON "EmailDraft"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDraft_workspaceId_widgetKey_idx" ON "EmailDraft"("workspaceId", "widgetKey");

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
