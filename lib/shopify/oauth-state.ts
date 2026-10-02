import { SignJWT, jwtVerify } from "jose";
import { SHOPIFY_OAUTH_COOKIE } from "./config";

type OAuthState = {
  userId: string;
  workspaceId: string;
  shop: string;
  nonce: string;
};

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(value);
}

export async function createShopifyOAuthState(input: OAuthState) {
  return new SignJWT(input)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function readShopifyOAuthState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.workspaceId !== "string" ||
      typeof payload.shop !== "string" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      shop: payload.shop,
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

export function shopifyOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  };
}

export { SHOPIFY_OAUTH_COOKIE };
