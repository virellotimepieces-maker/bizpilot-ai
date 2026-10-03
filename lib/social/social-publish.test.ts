import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { applyStripeEvent } from "@/lib/billing/stripe-events";
import { MemoryBillingStore } from "@/lib/billing/memory-store";
import { BillingError } from "@/lib/billing/types";
import { decryptSecret, encryptSecret } from "@/lib/gmail/token-crypto";
import { emptyKnowledge } from "@/lib/empty-knowledge";
import { clientMaySetSocialStatus, socialWorkflowStatus, verifiedSocialFacts } from "@/lib/social-content";
import { acceptSocialOAuthCallback, beginSocialConnect, disconnectSocialAccount, selectSocialDestination } from "./connect";
import { validateSocialImage } from "./media";
import { createSocialOAuthState, readSocialOAuthState } from "./oauth-state";
import { productionSocialCallbackUrls } from "./platforms";
import { publishApprovedSocialDraft } from "./publish";
import { evaluateSocialPublish } from "./publish-policy";
import { publicSocialAccounts } from "./public";
import { safeSocialProviderMessage } from "./providers";
import { resetSocialRateLimits } from "./rate-limit";

const ENV_KEYS = [
  "AUTH_SECRET",
  "APP_URL",
  "META_APP_ID",
  "META_APP_SECRET",
  "META_PUBLISH_ENABLED",
  "META_INSTAGRAM_PUBLISH_ENABLED",
  "THREADS_PUBLISH_ENABLED",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_PUBLISH_ENABLED",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "X_POSTING_ENABLED",
  "PINTEREST_APP_ID",
  "PINTEREST_APP_SECRET",
  "PINTEREST_PUBLISH_ENABLED",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetSocialRateLimits();
}

afterEach(() => {
  restoreEnv();
});

function enableFacebook() {
  process.env.AUTH_SECRET = "test-auth-secret-value";
  process.env.APP_URL = "https://www.mybizpilotai.com";
  process.env.META_APP_ID = "meta-app";
  process.env.META_APP_SECRET = "meta-secret";
  process.env.META_PUBLISH_ENABLED = "true";
}

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function addPaidWorkspace(store: MemoryBillingStore, name: string) {
  const user = await store.createUser({ email: `${name}@example.com`, passwordHash: "hash", name });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name });
  await store.saveKnowledge(workspace.id, { ...emptyKnowledge("custom"), name });
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: `co_${name}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${name}`,
        mode: "subscription",
        customer: `cus_${name}`,
        subscription: `sub_${name}`,
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  });
  await applyStripeEvent(store, {
    id: `sub_evt_${name}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_${name}`,
        customer: `cus_${name}`,
        status: "active",
        metadata: { userId: user.id, workspaceId: workspace.id },
        items: {
          data: [
            {
              price: { id: "price_test_bizpilot_pro" },
              current_period_start: unix(start),
              current_period_end: unix(end),
            },
          ],
        },
      },
    },
  });
  return { user, workspace };
}

async function paidWorkspace(name: string) {
  const store = new MemoryBillingStore();
  const paid = await addPaidWorkspace(store, name);
  return { store, ...paid };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function facebookFetch(pages: { id: string; name: string; access_token: string }[]) {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/me/accounts")) {
      return jsonResponse({
        data: pages.map((page) => ({
          id: page.id,
          name: page.name,
          access_token: page.access_token,
        })),
      });
    }
    if (url.includes("/oauth/access_token")) return jsonResponse({ access_token: "user-token", expires_in: 5_000_000 });
    throw new Error(`unexpected ${url}`);
  };
  return { fetchImpl, calls };
}

async function approvedDraft(
  store: MemoryBillingStore,
  workspace: { id: string; widgetKey: string },
  platform = "facebook",
) {
  return store.createSocialMessage({
    workspaceId: workspace.id,
    widgetKey: workspace.widgetKey,
    platform,
    fromName: "New post",
    handle: "bp1:post",
    body: "Studio hours",
    status: "approved",
    draftBody: "Open studio tonight.",
    intent: "offerings",
    operatorNote: "",
    usedInternalKnowledge: true,
  });
}

describe("social account publishing", () => {
  it("rejects a tampered OAuth state and a cookie mismatch", async () => {
    process.env.AUTH_SECRET = "test-auth-secret-value";
    const state = await createSocialOAuthState({
      userId: "user-a",
      workspaceId: "workspace-a",
      platform: "facebook",
      nonce: "nonce-a",
      returnTo: "/app/integrations",
      codeVerifier: "verifier-a",
    });
    const read = await readSocialOAuthState(state);
    assert.equal(read?.workspaceId, "workspace-a");
    assert.equal(read?.codeVerifier, "verifier-a");
    assert.equal(await readSocialOAuthState(`${state}x`), null);
    const store = new MemoryBillingStore();
    const mismatch = await acceptSocialOAuthCallback({
      platform: "facebook",
      sessionUserId: "user-a",
      code: "code",
      queryState: state,
      cookieState: `${state}x`,
      queryError: null,
      store,
      fetchImpl: async () => {
        throw new Error("network");
      },
    });
    assert.equal(mismatch.query, "social=error");
    assert.equal((await store.listSocialAccounts("workspace-a")).length, 0);
  });

  it("rejects a callback for another user or workspace and keeps tokens off an inactive subscription", async () => {
    enableFacebook();
    const { store, user, workspace } = await paidWorkspace("north");
    const other = await store.createUser({ email: "other@example.com", passwordHash: "hash", name: "Other" });
    const started = await beginSocialConnect({
      userId: user.id,
      workspaceId: workspace.id,
      platform: "facebook",
      returnTo: "/app/integrations",
    });
    const wrongUser = await acceptSocialOAuthCallback({
      platform: "facebook",
      sessionUserId: other.id,
      code: "code",
      queryState: started.state,
      cookieState: started.state,
      queryError: null,
      store,
      fetchImpl: async () => {
        throw new Error("network");
      },
    });
    assert.equal(wrongUser.query, "social=error");
    const foreign = await createSocialOAuthState({
      userId: user.id,
      workspaceId: "missing-workspace",
      platform: "facebook",
      nonce: "n",
      returnTo: "/app/integrations",
      codeVerifier: "v",
    });
    const missing = await acceptSocialOAuthCallback({
      platform: "facebook",
      sessionUserId: user.id,
      code: "code",
      queryState: foreign,
      cookieState: foreign,
      queryError: null,
      store,
      fetchImpl: async () => {
        throw new Error("network");
      },
    });
    assert.equal(missing.query, "social=error");
    const { fetchImpl } = facebookFetch([{ id: "page-1", name: "North Page", access_token: "page-token" }]);
    const inactive = await acceptSocialOAuthCallback({
      platform: "facebook",
      sessionUserId: user.id,
      code: "code",
      queryState: started.state,
      cookieState: started.state,
      queryError: null,
      store,
      fetchImpl,
      now: new Date("2026-12-02T00:00:00Z"),
    });
    assert.equal(inactive.query, "social=inactive");
    assert.equal((await store.listSocialAccounts(workspace.id)).length, 0);
  });

  it("connects, isolates, selects, and disconnects without exposing tokens", async () => {
    enableFacebook();
    const { store, user, workspace } = await paidWorkspace("north");
    const south = await addPaidWorkspace(store, "south");
    const pageToken = "page-token-secret";
    const otherToken = "other-page-token";
    const { fetchImpl } = facebookFetch([
      { id: "page-1", name: "North Page", access_token: pageToken },
      { id: "page-2", name: "Other Page", access_token: otherToken },
    ]);
    const started = await beginSocialConnect({
      userId: user.id,
      workspaceId: workspace.id,
      platform: "facebook",
      returnTo: "/app/social",
    });
    assert.match(started.url, /^https:\/\/www\.facebook\.com\/v23\.0\/dialog\/oauth\?/);
    assert.doesNotMatch(started.url, /meta-secret|page-token/);
    const result = await acceptSocialOAuthCallback({
      platform: "facebook",
      sessionUserId: user.id,
      code: "auth-code",
      queryState: started.state,
      cookieState: started.state,
      queryError: null,
      store,
      fetchImpl,
    });
    assert.equal(result.query, "social=select&platform=facebook");
    const pending = await store.getSocialAccount(workspace.id, "facebook");
    assert.ok(pending);
    assert.equal(pending.status, "pending_selection");
    assert.notEqual(pending.pendingDestinationsEnc, pageToken);
    const visible = publicSocialAccounts(await store.listSocialAccounts(workspace.id));
    const raw = JSON.stringify(visible);
    assert.equal(visible.find((account) => account.platform === "facebook")?.connection, "pending_selection");
    assert.doesNotMatch(raw, new RegExp(pageToken));
    assert.doesNotMatch(raw, new RegExp(otherToken));
    assert.equal((await store.listSocialAccounts(south.workspace.id)).length, 0);
    await selectSocialDestination({
      store,
      workspaceId: workspace.id,
      platform: "facebook",
      destinationId: "page-1",
    });
    const connected = await store.getSocialAccount(workspace.id, "facebook");
    assert.equal(connected?.status, "connected");
    assert.equal(connected?.accountName, "North Page");
    assert.equal(decryptSecret(connected!.encryptedAccessToken), pageToken);
    assert.equal(connected?.pendingDestinationsEnc, "");
    assert.equal(await store.getSocialAccount(south.workspace.id, "facebook"), null);
    const removed = await disconnectSocialAccount({
      store,
      workspaceId: workspace.id,
      platform: "facebook",
      fetchImpl: async () => jsonResponse({ success: true }),
    });
    assert.equal(removed, true);
    assert.equal(await store.getSocialAccount(workspace.id, "facebook"), null);
  });

  it("publishes only an approved connected draft and blocks duplicates, failures, and other workspaces", async () => {
    enableFacebook();
    const store = new MemoryBillingStore();
    const { user, workspace } = await addPaidWorkspace(store, "north");
    const other = await addPaidWorkspace(store, "south");
    await store.upsertSocialAccount({
      workspaceId: workspace.id,
      platform: "facebook",
      status: "connected",
      externalAccountId: "page-1",
      accountName: "North Page",
      accountType: "page",
      scopes: "pages_manage_posts",
      encryptedAccessToken: encryptSecret("page-token"),
      encryptedRefreshToken: "",
      accessTokenExpiresAt: null,
    });
    const draft = await store.createSocialMessage({
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      platform: "facebook",
      fromName: "New post",
      handle: "bp1:post",
      body: "Studio hours",
      status: "draft",
      draftBody: "Open studio tonight.",
      intent: "offerings",
      operatorNote: "",
      usedInternalKnowledge: true,
    });
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({ id: "fb_post_1" });
    };
    await assert.rejects(
      () =>
        publishApprovedSocialDraft({
          store,
          workspaceId: workspace.id,
          widgetKey: workspace.widgetKey,
          userId: user.id,
          messageId: draft.id,
          confirm: false,
          appUrl: "https://www.mybizpilotai.com",
          fetchImpl,
        }),
      (error: unknown) => error instanceof BillingError && /Confirm/.test(error.message),
    );
    await assert.rejects(
      () =>
        publishApprovedSocialDraft({
          store,
          workspaceId: workspace.id,
          widgetKey: workspace.widgetKey,
          userId: user.id,
          messageId: draft.id,
          confirm: true,
          appUrl: "https://www.mybizpilotai.com",
          fetchImpl,
        }),
      (error: unknown) => error instanceof BillingError && /Approve/.test(error.message),
    );
    assert.equal(calls, 0);
    const approved = await approvedDraft(store, workspace);
    const published = await publishApprovedSocialDraft({
      store,
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      userId: user.id,
      messageId: approved.id,
      confirm: true,
      appUrl: "https://www.mybizpilotai.com",
      fetchImpl,
    });
    assert.equal(published.status, "published");
    assert.equal(published.platformPostId, "fb_post_1");
    assert.equal(published.destinationName, "North Page");
    assert.equal(socialWorkflowStatus(published.status), "Published");
    assert.equal(calls, 1);
    await assert.rejects(
      () =>
        publishApprovedSocialDraft({
          store,
          workspaceId: workspace.id,
          widgetKey: workspace.widgetKey,
          userId: user.id,
          messageId: approved.id,
          confirm: true,
          appUrl: "https://www.mybizpilotai.com",
          fetchImpl,
        }),
      (error: unknown) => error instanceof BillingError && /already published/i.test(error.message),
    );
    assert.equal(calls, 1);
    await assert.rejects(
      () =>
        publishApprovedSocialDraft({
          store,
          workspaceId: other.workspace.id,
          widgetKey: other.workspace.widgetKey,
          userId: other.user.id,
          messageId: approved.id,
          confirm: true,
          appUrl: "https://www.mybizpilotai.com",
          fetchImpl,
        }),
      (error: unknown) => error instanceof BillingError && error.code === "not_found",
    );
    assert.equal(calls, 1);
    assert.equal(clientMaySetSocialStatus("published"), false);
    assert.equal(clientMaySetSocialStatus("publishing"), false);
  });

  it("records a failed publish and allows one retry after the platform accepts it", async () => {
    enableFacebook();
    const { store, user, workspace } = await paidWorkspace("north");
    await store.upsertSocialAccount({
      workspaceId: workspace.id,
      platform: "facebook",
      status: "connected",
      externalAccountId: "page-1",
      accountName: "North Page",
      accountType: "page",
      scopes: "pages_manage_posts",
      encryptedAccessToken: encryptSecret("page-token"),
    });
    const message = await approvedDraft(store, workspace);
    let attempt = 0;
    const fetchImpl: typeof fetch = async () => {
      attempt += 1;
      if (attempt === 1) return jsonResponse({ error: { message: "Invalid parameter" } }, 400);
      return jsonResponse({ id: "fb_post_retry" });
    };
    await assert.rejects(() =>
      publishApprovedSocialDraft({
        store,
        workspaceId: workspace.id,
        widgetKey: workspace.widgetKey,
        userId: user.id,
        messageId: message.id,
        confirm: true,
        appUrl: "https://www.mybizpilotai.com",
        fetchImpl,
      }),
    );
    const failed = await store.getSocialMessage(message.id, workspace.id, workspace.widgetKey);
    assert.equal(failed?.status, "failed");
    assert.equal(failed?.platformPostId, "");
    assert.match(failed?.publishError || "", /Invalid parameter/);
    assert.equal(socialWorkflowStatus(failed?.status || ""), "Failed");
    const retried = await publishApprovedSocialDraft({
      store,
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      userId: user.id,
      messageId: message.id,
      confirm: true,
      appUrl: "https://www.mybizpilotai.com",
      fetchImpl,
    });
    assert.equal(retried.status, "published");
    assert.equal(retried.platformPostId, "fb_post_retry");
  });

  it("does not call a platform when setup, subscription, approval, or media rules fail", async () => {
    process.env.AUTH_SECRET = "test-auth-secret-value";
    process.env.APP_URL = "https://www.mybizpilotai.com";
    const { store, user, workspace } = await paidWorkspace("north");
    const message = await approvedDraft(store, workspace);
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network");
    };
    await assert.rejects(
      () =>
        publishApprovedSocialDraft({
          store,
          workspaceId: workspace.id,
          widgetKey: workspace.widgetKey,
          userId: user.id,
          messageId: message.id,
          confirm: true,
          appUrl: "https://www.mybizpilotai.com",
          fetchImpl,
        }),
      (error: unknown) => error instanceof BillingError && /Setup required/.test(error.message),
    );
    enableFacebook();
    await assert.rejects(
      () =>
        publishApprovedSocialDraft({
          store,
          workspaceId: workspace.id,
          widgetKey: workspace.widgetKey,
          userId: user.id,
          messageId: message.id,
          confirm: true,
          appUrl: "https://www.mybizpilotai.com",
          fetchImpl,
          now: new Date("2026-12-02T00:00:00Z"),
        }),
      (error: unknown) => error instanceof BillingError && error.code === "inactive",
    );
    const kept = await store.getSocialMessage(message.id, workspace.id, workspace.widgetKey);
    assert.equal(kept?.status, "approved");
    process.env.META_INSTAGRAM_PUBLISH_ENABLED = "true";
    await store.upsertSocialAccount({
      workspaceId: workspace.id,
      platform: "instagram",
      status: "connected",
      externalAccountId: "ig-1",
      accountName: "north.studio",
      accountType: "instagram_professional",
      scopes: "instagram_content_publish",
      encryptedAccessToken: encryptSecret("ig-token"),
    });
    const instagram = await approvedDraft(store, workspace, "instagram");
    await assert.rejects(
      () =>
        publishApprovedSocialDraft({
          store,
          workspaceId: workspace.id,
          widgetKey: workspace.widgetKey,
          userId: user.id,
          messageId: instagram.id,
          confirm: true,
          appUrl: "https://www.mybizpilotai.com",
          fetchImpl,
        }),
      (error: unknown) => error instanceof BillingError && /requires an image/.test(error.message),
    );
    const decision = evaluateSocialPublish({
      status: "approved",
      subscriptionActive: false,
      hasMedia: false,
      account: publicSocialAccounts([])[0] ?? null,
    });
    assert.equal(decision.ok, false);
    assert.match(decision.reason, /subscription/);
  });

  it("prevents a second claim from publishing the same draft", async () => {
    const store = new MemoryBillingStore();
    const user = await store.createUser({ email: "lock@example.com", passwordHash: "hash", name: "Lock" });
    const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Lock" });
    const message = await approvedDraft(store, workspace);
    const now = new Date("2026-10-03T00:00:00Z");
    const first = await store.claimSocialPublish(message.id, workspace.id, workspace.widgetKey, "lock-1", now);
    const second = await store.claimSocialPublish(message.id, workspace.id, workspace.widgetKey, "lock-2", now);
    assert.equal(first?.status, "publishing");
    assert.equal(second, null);
    const foreign = await store.claimSocialPublish(message.id, "other-workspace", workspace.widgetKey, "lock-3", now);
    assert.equal(foreign, null);
  });

  it("validates images and keeps draft facts inside the workspace", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    assert.equal(validateSocialImage(png, "image/png").mimeType, "image/png");
    assert.throws(() => validateSocialImage(Buffer.from("GIF89a", "ascii"), "image/gif"), BillingError);
    const knowledge = { ...emptyKnowledge("custom"), name: "Northwind" };
    const facts = verifiedSocialFacts({
      knowledge,
      instruction: "Evening class",
      goal: "promote_product",
      workspaceId: "workspace-a",
      products: [
        {
          id: "other",
          workspaceId: "workspace-b",
          shopifyProductId: "1",
          handle: "secret",
          title: "Secret product",
          description: "Do not leak",
          status: "active",
          productType: "",
          vendor: "",
          tags: "",
          url: "https://other.example/secret",
          imageUrls: [],
          variants: [],
          publishedAt: null,
          shopifyUpdatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    assert.equal(facts.some((fact) => fact.includes("Secret product")), false);
    assert.equal(
      safeSocialProviderMessage(400, JSON.stringify({ error: { message: "bad EAASECRETTOKEN value" } })),
      "The platform declined the request (400).",
    );
    assert.deepEqual(productionSocialCallbackUrls(), [
      "https://www.mybizpilotai.com/api/app/social/callback/facebook",
      "https://www.mybizpilotai.com/api/app/social/callback/instagram",
      "https://www.mybizpilotai.com/api/app/social/callback/linkedin",
      "https://www.mybizpilotai.com/api/app/social/callback/threads",
      "https://www.mybizpilotai.com/api/app/social/callback/x",
      "https://www.mybizpilotai.com/api/app/social/callback/pinterest",
    ]);
  });
});
