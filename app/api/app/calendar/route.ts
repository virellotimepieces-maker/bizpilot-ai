import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { publicCalendarStatus } from "@/lib/calendar/public";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { decryptSecret } from "@/lib/gmail/token-crypto";
import { revokeGoogleToken } from "@/lib/gmail/google";

export async function DELETE() {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const connection = await store.getGoogleCalendarConnection(workspace.id);
    if (connection?.workspaceId === workspace.id) {
      try {
        await revokeGoogleToken(decryptSecret(connection.encryptedRefreshToken));
      } catch {
        // The local connection still has to go if Google revoke fails.
      }
    }
    await store.deleteGoogleCalendarConnection(workspace.id);
    return NextResponse.json(publicCalendarStatus(null, null));
  } catch (error) {
    return jsonError(error, "Could not disconnect Google Calendar.");
  }
}
