import { NextResponse } from "next/server";
import { gmailGet, requirePaidGmailContext } from "@/lib/gmail/access";
import { GMAIL_INBOX_PAGE_SIZE } from "@/lib/gmail/config";
import type { GmailApiMessage } from "@/lib/gmail/parse";
import { summarizeGmailMessage } from "@/lib/gmail/parse";
import { jsonError } from "@/lib/http";

type GmailListResponse = {
  messages?: { id?: string; threadId?: string }[];
};

export async function GET() {
  try {
    const { store, workspace } = await requirePaidGmailContext();
    const list = await gmailGet<GmailListResponse>(
      store,
      workspace,
      `/messages?maxResults=${GMAIL_INBOX_PAGE_SIZE}&labelIds=INBOX`,
    );
    const ids = (list.messages ?? []).map((row) => row.id).filter((id): id is string => Boolean(id));
    const messages = await Promise.allSettled(
      ids.map(async (id) => {
        const raw = await gmailGet<GmailApiMessage>(
          store,
          workspace,
          `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
        );
        const summary = summarizeGmailMessage(raw, false);
        const draft = await store.getGmailReplyDraft(workspace.id, id);
        return {
          ...summary,
          replyStatus: draft?.status === "sent" ? "sent" : "none",
        };
      }),
    );
    return NextResponse.json({
      messages: messages.flatMap((row) => (row.status === "fulfilled" ? [row.value] : [])),
    });
  } catch (error) {
    return jsonError(error, "Could not load Gmail messages.");
  }
}
