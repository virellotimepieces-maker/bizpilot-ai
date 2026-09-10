import { NextRequest, NextResponse } from "next/server";
import { getBillingStore } from "@/lib/billing/factory";
import { hashPassword, validateCredentials } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; name?: string; businessName?: string };
    const parsed = validateCredentials(body.email ?? "", body.password ?? "", body.name ?? "");
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    }
    const store = getBillingStore();
    if (await store.findUserByEmail(parsed.email)) {
      return NextResponse.json({ error: "An account with that email already exists.", code: "conflict" }, { status: 409 });
    }
    const user = await store.createUser({
      email: parsed.email,
      passwordHash: await hashPassword(parsed.password),
      name: parsed.name,
    });
    const existing = await store.listWorkspacesForUser(user.id);
    const workspace =
      existing[0] ??
      (await store.createWorkspace({
        ownerUserId: user.id,
        name: body.businessName?.trim() || `${parsed.name}'s business`,
      }));
    await setSessionCookie(user.id);
    return NextResponse.json({ userId: user.id, workspaceId: workspace.id });
  } catch (error) {
    return jsonError(error, "Could not create the account.");
  }
}
