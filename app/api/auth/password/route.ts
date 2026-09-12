import { NextRequest, NextResponse } from "next/server";
import { hashPassword, validateCredentials, verifyPassword } from "@/lib/auth/password";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) throw new BillingError("Sign in required.", "unauthorized");
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const parsed = validateCredentials("placeholder@example.com", body.newPassword ?? "");
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    }
    if (!body.currentPassword) {
      throw new BillingError("Current password is required.", "invalid");
    }
    const store = getBillingStore();
    const user = await store.findUserById(userId);
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw new BillingError("Current password is incorrect.", "unauthorized");
    }
    if (await verifyPassword(parsed.password, user.passwordHash)) {
      throw new BillingError("Choose a password that is different from the current one.", "invalid");
    }
    await store.updateUserPassword(user.id, await hashPassword(parsed.password));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Could not change the password.");
  }
}
