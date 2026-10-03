import { SignJWT, jwtVerify } from "jose";
import { CALENDAR_OAUTH_COOKIE } from "./config";

type OAuthState = {
  userId: string;
  workspaceId: string;
  nonce: string;
  returnTo: "/app/integrations";
};

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(value);
}

export async function createCalendarOAuthState(input: OAuthState) {
  return new SignJWT({ ...input, purpose: "google-calendar" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function readCalendarOAuthState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "google-calendar") return null;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.workspaceId !== "string" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      nonce: payload.nonce,
      returnTo: "/app/integrations",
    };
  } catch {
    return null;
  }
}

export function calendarOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  };
}

export { CALENDAR_OAUTH_COOKIE };
