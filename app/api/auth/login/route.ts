import { NextRequest, NextResponse } from "next/server";
import { getBillingStore } from "@/lib/billing/factory";
import { validateCredentials, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const parsed = validateCredentials(body.email ?? "", body.password ?? "");
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    }
    const store = getBillingStore();
    const user = await store.findUserByEmail(parsed.email);
    if (!user || !(await verifyPassword(parsed.password, user.passwordHash))) {
      return NextResponse.json({ error: "Email or password is incorrect.", code: "unauthorized" }, { status: 401 });
    }
    await setSessionCookie(user.id);
    return NextResponse.json({ userId: user.id });
  } catch (error) {
    return jsonError(error, "Could not sign in.");
  }
}
