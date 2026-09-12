import { BillingError } from "@/lib/billing/types";

type FetchLike = typeof fetch;

function googleError(status: number, mode: "connect" | "refresh" | "gmail"): BillingError {
  if (status === 401 || status === 403) {
    return new BillingError(
      mode === "connect"
        ? "Google denied this Gmail connection. Try Connect Gmail again."
        : "Gmail access was revoked or expired. Connect Gmail again.",
      mode === "connect" ? "invalid" : "reconnect",
    );
  }
  if (status === 429) {
    return new BillingError("Gmail is rate-limiting this inbox. Try Refresh Inbox in a moment.", "limit");
  }
  if (status >= 500) {
    return new BillingError("Gmail is temporarily unavailable. Try again shortly.", "invalid");
  }
  return new BillingError("Gmail request failed.", "invalid");
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
};

export async function exchangeGoogleAuthorizationCode(
  input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<GoogleTokenSet> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = await readJson(response);
  if (!response.ok) {
    const err = asRecord(json)?.error;
    if (err === "invalid_client") {
      throw new BillingError("Gmail is not configured.", "misconfigured");
    }
    throw googleError(response.status, "connect");
  }
  const row = asRecord(json);
  const accessToken = typeof row?.access_token === "string" ? row.access_token : "";
  const refreshToken = typeof row?.refresh_token === "string" ? row.refresh_token : "";
  const expiresIn = typeof row?.expires_in === "number" ? row.expires_in : 3600;
  const scope = typeof row?.scope === "string" ? row.scope : "";
  if (!accessToken || !refreshToken) {
    throw new BillingError(
      "Google did not grant offline Gmail access. Connect Gmail again and approve the requested permissions.",
      "invalid",
    );
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + Math.max(60, expiresIn) * 1000),
    scope,
  };
}

export async function refreshGoogleAccessToken(
  input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<GoogleTokenSet> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = await readJson(response);
    if (!response.ok) {
      const err = asRecord(json)?.error;
      if (err === "invalid_grant") {
        throw new BillingError("Gmail access was revoked or expired. Connect Gmail again.", "reconnect");
      }
      throw googleError(response.status, "refresh");
    }
  const row = asRecord(json);
  const accessToken = typeof row?.access_token === "string" ? row.access_token : "";
  const expiresIn = typeof row?.expires_in === "number" ? row.expires_in : 3600;
  const scope = typeof row?.scope === "string" ? row.scope : "";
  if (!accessToken) {
    throw new BillingError("Gmail access was revoked or expired. Connect Gmail again.", "reconnect");
  }
  return {
    accessToken,
    expiresAt: new Date(Date.now() + Math.max(60, expiresIn) * 1000),
    scope,
  };
}

export async function fetchGoogleUserEmail(
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ email: string; sub: string | null }> {
  const response = await fetchImpl("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const json = await readJson(response);
  if (!response.ok) {
    throw googleError(response.status, "connect");
  }
  const row = asRecord(json);
  const email = typeof row?.email === "string" ? row.email : "";
  const sub = typeof row?.sub === "string" ? row.sub : null;
  if (!email) {
    throw new BillingError("Google did not return the Gmail address.", "invalid");
  }
  return { email, sub };
}

export async function revokeGoogleToken(token: string, fetchImpl: FetchLike = fetch) {
  try {
    await fetchImpl("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Revocation is best-effort; local disconnect still proceeds.
  }
}

export async function gmailApiJson<T>(
  input: {
    accessToken: string;
    path: string;
    method?: string;
    body?: unknown;
  },
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const response = await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/me${input.path}`, {
    method: input.method ?? "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
      ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  });
  const json = await readJson(response);
  if (!response.ok) {
    throw googleError(response.status, "gmail");
  }
  return json as T;
}
