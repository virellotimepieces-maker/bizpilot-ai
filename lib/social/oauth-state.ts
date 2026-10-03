import { SignJWT, jwtVerify } from "jose";
import type { SocialOAuthPlatform } from "./platforms";

export const SOCIAL_OAUTH_COOKIE = "bizpilot_social_oauth";

export type SocialOAuthState = {
  userId: string;
  workspaceId: string;
  platform: SocialOAuthPlatform;
  nonce: string;
  returnTo: "/app/integrations" | "/app/social";
  codeVerifier: string;
};

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(value);
}

export async function createSocialOAuthState(input: SocialOAuthState) {
  return new SignJWT(input)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function readSocialOAuthState(token: string): Promise<SocialOAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.workspaceId !== "string" ||
      typeof payload.platform !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.codeVerifier !== "string"
    ) {
      return null;
    }
    const platform = payload.platform;
    if (
      platform !== "facebook" &&
      platform !== "instagram" &&
      platform !== "linkedin" &&
      platform !== "threads" &&
      platform !== "x" &&
      platform !== "pinterest"
    ) {
      return null;
    }
    const returnTo = payload.returnTo === "/app/social" ? "/app/social" : "/app/integrations";
    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      platform,
      nonce: payload.nonce,
      returnTo,
      codeVerifier: payload.codeVerifier,
    };
  } catch {
    return null;
  }
}

export function socialOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  };
}
