import { createHash, randomBytes } from "node:crypto";
import { BillingError } from "@/lib/billing/types";
import {
  socialPlatformConfig,
  type SocialOAuthPlatform,
} from "./platforms";

export type SocialFetch = typeof fetch;

export type SocialDestination = {
  id: string;
  name: string;
  type: string;
  token: string;
};

export type SocialAuthorization = {
  scopes: string;
  refreshToken: string;
  expiresAt: Date | null;
  destinations: SocialDestination[];
};

const GRAPH = "https://graph.facebook.com/v23.0";

export function createSocialPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function safeSocialProviderMessage(status: number, raw: string) {
  let message = "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const error = parsed.error;
    if (typeof error === "string") message = error;
    else if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      message = (error as { message: string }).message;
    } else if (typeof parsed.message === "string") message = parsed.message;
    else if (typeof parsed.detail === "string") message = parsed.detail;
    else if (typeof parsed.error_description === "string") message = parsed.error_description;
  } catch {
    message = "";
  }
  if (!message || /EAA[A-Za-z0-9]|access_token|refresh_token|client_secret|bearer\s+\S+/i.test(message)) {
    return `The platform declined the request (${status}).`;
  }
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function readProvider(response: Response) {
  const raw = await response.text();
  if (!response.ok) {
    throw new BillingError(safeSocialProviderMessage(response.status, raw), "invalid");
  }
  if (!raw) return {} as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new BillingError("The platform returned an unreadable response.", "invalid");
  }
}

function expiresFrom(seconds: unknown, now: Date) {
  return typeof seconds === "number" && seconds > 0 ? new Date(now.getTime() + seconds * 1000) : null;
}

function form(values: Record<string, string>) {
  return new URLSearchParams(values);
}

async function postForm(
  fetchImpl: SocialFetch,
  url: string,
  values: Record<string, string>,
  headers?: Record<string, string>,
) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: form(values),
  });
  return readProvider(response);
}

export function socialAuthorizeUrl(input: {
  platform: SocialOAuthPlatform;
  state: string;
  codeChallenge?: string;
}) {
  const config = socialPlatformConfig(input.platform);
  if (!config.configured || !config.redirectUri) {
    throw new BillingError(`${config.label} is not configured.`, "misconfigured");
  }
  if (input.platform === "facebook" || input.platform === "instagram") {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: input.state,
      response_type: "code",
      scope: config.scopes.join(","),
    });
    return `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
  }
  if (input.platform === "threads") {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: input.state,
      response_type: "code",
      scope: config.scopes.join(","),
    });
    return `https://threads.net/oauth/authorize?${params.toString()}`;
  }
  if (input.platform === "linkedin") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: input.state,
      scope: config.scopes.join(" "),
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }
  if (input.platform === "x") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
      state: input.state,
      code_challenge: input.codeChallenge || "",
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(","),
    state: input.state,
  });
  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

async function metaPages(token: string, fetchImpl: SocialFetch) {
  const response = await fetchImpl(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const payload = await readProvider(response);
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

export async function exchangeSocialAuthorization(input: {
  platform: SocialOAuthPlatform;
  code: string;
  codeVerifier?: string;
  fetchImpl?: SocialFetch;
  now?: Date;
}): Promise<SocialAuthorization> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? new Date();
  const config = socialPlatformConfig(input.platform);
  if (!config.configured) throw new BillingError(`${config.label} is not configured.`, "misconfigured");
  if (input.platform === "facebook" || input.platform === "instagram") {
    const shortLived = await postForm(fetchImpl, `${GRAPH}/oauth/access_token`, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code: input.code,
    });
    const shortToken = typeof shortLived.access_token === "string" ? shortLived.access_token : "";
    if (!shortToken) throw new BillingError("Facebook did not return an access token.", "invalid");
    const longLived = await postForm(fetchImpl, `${GRAPH}/oauth/access_token`, {
      grant_type: "fb_exchange_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      fb_exchange_token: shortToken,
    });
    const userToken = typeof longLived.access_token === "string" ? longLived.access_token : shortToken;
    const pages = await metaPages(userToken, fetchImpl);
    const destinations: SocialDestination[] =
      input.platform === "facebook"
        ? pages
            .filter((page) => typeof page.id === "string" && typeof page.access_token === "string")
            .map((page) => ({
              id: String(page.id),
              name: typeof page.name === "string" ? page.name : "Facebook Page",
              type: "page",
              token: String(page.access_token),
            }))
        : pages.flatMap((page) => {
            const ig = page.instagram_business_account;
            if (!ig || typeof ig !== "object") return [];
            const account = ig as { id?: unknown; username?: unknown };
            if (typeof account.id !== "string" || typeof page.access_token !== "string") return [];
            return [
              {
                id: account.id,
                name: typeof account.username === "string" ? account.username : "Instagram",
                type: "instagram_professional",
                token: String(page.access_token),
              },
            ];
          });
    return {
      scopes: config.scopes.join(","),
      refreshToken: userToken,
      expiresAt: expiresFrom(longLived.expires_in, now),
      destinations,
    };
  }
  if (input.platform === "threads") {
    const token = await postForm(fetchImpl, "https://graph.threads.net/oauth/access_token", {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code: input.code,
    });
    const shortToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!shortToken) throw new BillingError("Threads did not return an access token.", "invalid");
    const longLived = await postForm(fetchImpl, "https://graph.threads.net/access_token", {
      grant_type: "th_exchange_token",
      client_secret: config.clientSecret,
      access_token: shortToken,
    });
    const accessToken = typeof longLived.access_token === "string" ? longLived.access_token : shortToken;
    const profileResponse = await fetchImpl("https://graph.threads.net/v1.0/me?fields=id,username", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const profile = await readProvider(profileResponse);
    const id = typeof profile.id === "string" ? profile.id : "";
    if (!id) throw new BillingError("Threads did not return a profile.", "invalid");
    return {
      scopes: config.scopes.join(","),
      refreshToken: "",
      expiresAt: expiresFrom(longLived.expires_in, now),
      destinations: [
        {
          id,
          name: typeof profile.username === "string" ? profile.username : "Threads",
          type: "threads_user",
          token: accessToken,
        },
      ],
    };
  }
  if (input.platform === "linkedin") {
    const token = await postForm(fetchImpl, "https://www.linkedin.com/oauth/v2/accessToken", {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new BillingError("LinkedIn did not return an access token.", "invalid");
    const profileResponse = await fetchImpl("https://api.linkedin.com/v2/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const profile = await readProvider(profileResponse);
    const id = typeof profile.sub === "string" ? profile.sub : "";
    if (!id) throw new BillingError("LinkedIn did not return a member id.", "invalid");
    const name = typeof profile.name === "string" ? profile.name : "LinkedIn member";
    return {
      scopes: typeof token.scope === "string" ? token.scope : config.scopes.join(" "),
      refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : "",
      expiresAt: expiresFrom(token.expires_in, now),
      destinations: [{ id, name, type: "member", token: accessToken }],
    };
  }
  if (input.platform === "x") {
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const token = await postForm(
      fetchImpl,
      "https://api.x.com/2/oauth2/token",
      {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: config.redirectUri,
        code_verifier: input.codeVerifier || "",
      },
      { authorization: `Basic ${basic}` },
    );
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new BillingError("X did not return an access token.", "invalid");
    const profileResponse = await fetchImpl("https://api.x.com/2/users/me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const profile = await readProvider(profileResponse);
    const data = profile.data && typeof profile.data === "object" ? (profile.data as { id?: unknown; username?: unknown }) : {};
    const id = typeof data.id === "string" ? data.id : "";
    if (!id) throw new BillingError("X did not return a user id.", "invalid");
    return {
      scopes: typeof token.scope === "string" ? token.scope : config.scopes.join(" "),
      refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : "",
      expiresAt: expiresFrom(token.expires_in, now),
      destinations: [
        {
          id,
          name: typeof data.username === "string" ? data.username : "X",
          type: "x_user",
          token: accessToken,
        },
      ],
    };
  }
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const token = await postForm(
    fetchImpl,
    "https://api.pinterest.com/v5/oauth/token",
    { grant_type: "authorization_code", code: input.code, redirect_uri: config.redirectUri },
    { authorization: `Basic ${basic}` },
  );
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  if (!accessToken) throw new BillingError("Pinterest did not return an access token.", "invalid");
  const boardsResponse = await fetchImpl("https://api.pinterest.com/v5/boards?page_size=25", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const boardsPayload = await readProvider(boardsResponse);
  const items = Array.isArray(boardsPayload.items) ? boardsPayload.items : [];
  const destinations = items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const board = item as { id?: unknown; name?: unknown };
    if (typeof board.id !== "string") return [];
    return [
      {
        id: board.id,
        name: typeof board.name === "string" ? board.name : "Pinterest board",
        type: "board",
        token: accessToken,
      },
    ];
  });
  return {
    scopes: typeof token.scope === "string" ? token.scope : config.scopes.join(","),
    refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : "",
    expiresAt: expiresFrom(token.expires_in, now),
    destinations,
  };
}

export async function refreshSocialAccessToken(input: {
  platform: SocialOAuthPlatform;
  refreshToken: string;
  fetchImpl?: SocialFetch;
  now?: Date;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? new Date();
  const config = socialPlatformConfig(input.platform);
  if (!config.configured) throw new BillingError(`${config.label} is not configured.`, "misconfigured");
  if (!input.refreshToken) throw new BillingError(`Reconnect ${config.label}.`, "reconnect");
  if (input.platform === "linkedin") {
    const token = await postForm(fetchImpl, "https://www.linkedin.com/oauth/v2/accessToken", {
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new BillingError("Reconnect LinkedIn.", "reconnect");
    return {
      accessToken,
      refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : input.refreshToken,
      expiresAt: expiresFrom(token.expires_in, now),
    };
  }
  if (input.platform === "x") {
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const token = await postForm(
      fetchImpl,
      "https://api.x.com/2/oauth2/token",
      { grant_type: "refresh_token", refresh_token: input.refreshToken },
      { authorization: `Basic ${basic}` },
    );
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new BillingError("Reconnect X.", "reconnect");
    return {
      accessToken,
      refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : input.refreshToken,
      expiresAt: expiresFrom(token.expires_in, now),
    };
  }
  if (input.platform === "pinterest") {
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const token = await postForm(
      fetchImpl,
      "https://api.pinterest.com/v5/oauth/token",
      { grant_type: "refresh_token", refresh_token: input.refreshToken },
      { authorization: `Basic ${basic}` },
    );
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new BillingError("Reconnect Pinterest.", "reconnect");
    return {
      accessToken,
      refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : input.refreshToken,
      expiresAt: expiresFrom(token.expires_in, now),
    };
  }
  if (input.platform === "threads") {
    const response = await fetchImpl(
      `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(input.refreshToken)}`,
    );
    const token = await readProvider(response);
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new BillingError("Reconnect Threads.", "reconnect");
    return { accessToken, refreshToken: accessToken, expiresAt: expiresFrom(token.expires_in, now) };
  }
  throw new BillingError(`Reconnect ${config.label}.`, "reconnect");
}

export async function revokeSocialAccess(input: {
  platform: SocialOAuthPlatform;
  accessToken: string;
  fetchImpl?: SocialFetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const config = socialPlatformConfig(input.platform);
  try {
    if (input.platform === "facebook" || input.platform === "instagram") {
      await fetchImpl(`${GRAPH}/me/permissions`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${input.accessToken}` },
      });
      return;
    }
    if (input.platform === "linkedin" && config.configured) {
      await postForm(fetchImpl, "https://www.linkedin.com/oauth/v2/revoke", {
        token: input.accessToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });
      return;
    }
    if (input.platform === "x" && config.configured) {
      const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
      await postForm(
        fetchImpl,
        "https://api.x.com/2/oauth2/revoke",
        { token: input.accessToken, token_type_hint: "access_token" },
        { authorization: `Basic ${basic}` },
      );
    }
  } catch {
    console.error("social_revoke_failed", input.platform);
  }
}

export async function publishToSocialPlatform(input: {
  platform: SocialOAuthPlatform;
  accessToken: string;
  destinationId: string;
  text: string;
  mediaUrl?: string;
  fetchImpl?: SocialFetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const text = input.text.trim();
  if (!text) throw new BillingError("The draft is empty.", "invalid");
  if (input.platform === "x" && text.length > 280) {
    throw new BillingError("X posts must be 280 characters or fewer.", "invalid");
  }
  if (input.platform === "facebook") {
    const path = input.mediaUrl ? `${input.destinationId}/photos` : `${input.destinationId}/feed`;
    const payload = await postForm(fetchImpl, `${GRAPH}/${path}`, {
      access_token: input.accessToken,
      ...(input.mediaUrl ? { url: input.mediaUrl, caption: text } : { message: text }),
    });
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!id) throw new BillingError("Facebook did not confirm a post id.", "invalid");
    return { platformPostId: id, httpStatus: 200 };
  }
  if (input.platform === "instagram") {
    if (!input.mediaUrl) throw new BillingError("Instagram requires an image before publishing.", "invalid");
    const container = await postForm(fetchImpl, `${GRAPH}/${input.destinationId}/media`, {
      access_token: input.accessToken,
      image_url: input.mediaUrl,
      caption: text,
    });
    const creationId = typeof container.id === "string" ? container.id : "";
    if (!creationId) throw new BillingError("Instagram did not confirm an image container.", "invalid");
    const published = await postForm(fetchImpl, `${GRAPH}/${input.destinationId}/media_publish`, {
      access_token: input.accessToken,
      creation_id: creationId,
    });
    const id = typeof published.id === "string" ? published.id : "";
    if (!id) throw new BillingError("Instagram did not confirm a post id.", "invalid");
    return { platformPostId: id, httpStatus: 200 };
  }
  if (input.platform === "threads") {
    const container = await postForm(fetchImpl, `https://graph.threads.net/v1.0/${input.destinationId}/threads`, {
      access_token: input.accessToken,
      media_type: input.mediaUrl ? "IMAGE" : "TEXT",
      text,
      ...(input.mediaUrl ? { image_url: input.mediaUrl } : {}),
    });
    const creationId = typeof container.id === "string" ? container.id : "";
    if (!creationId) throw new BillingError("Threads did not confirm a container.", "invalid");
    const published = await postForm(
      fetchImpl,
      `https://graph.threads.net/v1.0/${input.destinationId}/threads_publish`,
      { access_token: input.accessToken, creation_id: creationId },
    );
    const id = typeof published.id === "string" ? published.id : "";
    if (!id) throw new BillingError("Threads did not confirm a post id.", "invalid");
    return { platformPostId: id, httpStatus: 200 };
  }
  if (input.platform === "linkedin") {
    const author = input.destinationId.startsWith("urn:li:") ? input.destinationId : `urn:li:person:${input.destinationId}`;
    const response = await fetchImpl("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
        "linkedin-version": "202510",
        "x-restli-protocol-version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        commentary: text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    const raw = await response.text();
    if (!response.ok) throw new BillingError(safeSocialProviderMessage(response.status, raw), "invalid");
    const headerId = response.headers.get("x-restli-id") || "";
    let bodyId = "";
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { id?: unknown };
        if (typeof parsed.id === "string") bodyId = parsed.id;
      } catch {
        bodyId = "";
      }
    }
    const platformPostId = headerId || bodyId;
    if (!platformPostId) throw new BillingError("LinkedIn did not confirm a post id.", "invalid");
    return { platformPostId, httpStatus: response.status };
  }
  if (input.platform === "x") {
    const response = await fetchImpl("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const payload = await readProvider(response);
    const data = payload.data && typeof payload.data === "object" ? (payload.data as { id?: unknown }) : {};
    const id = typeof data.id === "string" ? data.id : "";
    if (!id) throw new BillingError("X did not confirm a post id.", "invalid");
    return { platformPostId: id, httpStatus: response.status };
  }
  if (!input.mediaUrl) throw new BillingError("Pinterest requires an image before publishing.", "invalid");
  const response = await fetchImpl("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      board_id: input.destinationId,
      description: text,
      media_source: { source_type: "image_url", url: input.mediaUrl },
    }),
  });
  const payload = await readProvider(response);
  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) throw new BillingError("Pinterest did not confirm a pin id.", "invalid");
  return { platformPostId: id, httpStatus: response.status };
}
