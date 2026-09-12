import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";

async function paidContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspaces = await store.listWorkspacesForUser(userId);
  const workspace = workspaces[0];
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const paid = await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
  return { store, service: new BillingService(store), ...paid };
}

export async function GET() {
  try {
    const { store, workspace } = await paidContext();
    const conversations = await store.listConversations(workspace.id);
    const withMessages = await Promise.all(
      conversations.map(async (conversation) => ({
        ...conversation,
        messages: await store.listMessages(conversation.id, workspace.id),
      })),
    );
    return NextResponse.json({ conversations: withMessages });
  } catch (error) {
    return jsonError(error, "Could not load conversations.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { service, workspace } = await paidContext();
    const body = (await request.json()) as {
      conversationId?: string;
      content?: string;
      resumeAi?: boolean;
    };
    if (!body.conversationId) throw new BillingError("Conversation is required.", "invalid");
    if (body.resumeAi) {
      const conversation = await service.resumeAi(workspace.id, body.conversationId);
      return NextResponse.json({ conversation });
    }
    const result = await service.sendOperatorReply({
      workspaceId: workspace.id,
      conversationId: body.conversationId,
      content: body.content ?? "",
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Could not send the reply.");
  }
}
