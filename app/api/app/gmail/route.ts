import { NextResponse } from "next/server";
import { requirePaidGmailContext } from "@/lib/gmail/access";
import { decryptSecret } from "@/lib/gmail/token-crypto";
import { revokeGoogleToken } from "@/lib/gmail/google";
import { publicGmailStatus } from "@/lib/gmail/public";
import { jsonError } from "@/lib/http";

export async function GET() {
  try {
    const { store, workspace } = await requirePaidGmailContext();
    const connection = await store.getGmailConnection(workspace.id);
    return NextResponse.json(publicGmailStatus(connection));
  } catch (error) {
    return jsonError(error, "Could not load Gmail status.");
  }
}

export async function DELETE() {
  try {
    const { store, workspace } = await requirePaidGmailContext();
    const connection = await store.getGmailConnection(workspace.id);
    if (connection) {
      try {
        const refreshToken = decryptSecret(connection.encryptedRefreshToken);
        await revokeGoogleToken(refreshToken);
      } catch {
        // Still disconnect locally if Google revoke fails.
      }
    }
    await store.deleteGmailConnection(workspace.id);
    return NextResponse.json(publicGmailStatus(null));
  } catch (error) {
    return jsonError(error, "Could not disconnect Gmail.");
  }
}

export async function POST() {
  return DELETE();
}
