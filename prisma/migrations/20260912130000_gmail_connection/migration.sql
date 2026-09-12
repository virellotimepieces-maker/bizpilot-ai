-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "googleSub" TEXT,
    "encryptedRefreshToken" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailReplyDraft" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "rfcMessageId" TEXT,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "draftSubject" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "sources" JSONB,
    "operatorNote" TEXT NOT NULL,
    "usedInternalKnowledge" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sendLockAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailReplyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_workspaceId_key" ON "GmailConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "GmailReplyDraft_workspaceId_gmailMessageId_key" ON "GmailReplyDraft"("workspaceId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "GmailReplyDraft_workspaceId_createdAt_idx" ON "GmailReplyDraft"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailReplyDraft" ADD CONSTRAINT "GmailReplyDraft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
