import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { persistFutureIntegrationStatus } from "./assert";
import { BillingError, type StripeLikeEvent } from "../billing/types";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import { publicGmailStatus } from "../gmail/public";
import { publicShopifyStatus } from "../shopify/public";
import { FUTURE_INTEGRATION_PROVIDERS } from "./enums";
import {
  FUTURE_INTEGRATION_CATALOG,
  INTEGRATIONS_HINT,
  buildWorkspaceIntegrations,
  displayFutureIntegrationStatus,
  gmailStatusLabel,
  serializeWorkspaceIntegrations,
} from "./integrations";
import { newIntegrationConnection } from "./records";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace(email = "integrations@example.com") {
  const store = new MemoryBillingStore();
  const user = await store.createUser({
    email,
    passwordHash: "hash",
    name: "Integrations",
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor" });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: `evt_int_${email}_co`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_int_${email}`,
        mode: "subscription",
        customer: `cus_int_${email}`,
        subscription: `sub_int_${email}`,
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  } satisfies StripeLikeEvent);
  await applyStripeEvent(store, {
    id: `evt_int_${email}_sub`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_int_${email}`,
        customer: `cus_int_${email}`,
        status: "active",
        cancel_at_period_end: false,
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
  } satisfies StripeLikeEvent);
  return { store, user, workspace, start, service: new BillingService(store) };
}

describe("Integration helpers", () => {
  it("lists Gmail, Shopify, social drafts, and remaining future providers", () => {
    const snapshot = buildWorkspaceIntegrations({
      gmail: publicGmailStatus(null),
      shopify: publicShopifyStatus(null),
      connections: [
        newIntegrationConnection({
          workspaceId: "w1",
          provider: "woocommerce",
          status: "connected",
        }),
      ],
    });
    assert.equal(snapshot.gmail.connected, false);
    assert.equal(snapshot.gmail.href, "/app/email");
    assert.equal(snapshot.shopify.connected, false);
    assert.equal(snapshot.shopify.label, "Not configured");
    assert.equal(snapshot.social.status, "drafts_only");
    assert.equal(snapshot.social.href, "/app/social");
    assert.deepEqual(
      snapshot.future.map((row) => row.provider),
      ["woocommerce"],
    );
    assert.equal(snapshot.calendar.connected, false);
    assert.ok(snapshot.calendar.label === "Not configured" || snapshot.calendar.label === "Not connected");
    assert.ok(snapshot.future.every((row) => row.status === "disconnected"));
    assert.ok(snapshot.future.every((row) => row.label === "Not connected"));
    const serialized = serializeWorkspaceIntegrations(snapshot);
    assert.equal(serialized.shopify.connected, false);
    assert.doesNotMatch(JSON.stringify(serialized), /encrypted|refresh_token|access_token|ciphertext|shpat_/);
  });

  it("labels Gmail from the live connection payload only", () => {
    assert.equal(
      gmailStatusLabel({
        configured: true,
        connected: true,
        needsReconnect: false,
        googleEmail: "owner@gmail.com",
        connectedAt: "2026-09-01T00:00:00.000Z",
      }),
      "Connected",
    );
    assert.equal(
      gmailStatusLabel({
        configured: true,
        connected: false,
        needsReconnect: true,
        googleEmail: "owner@gmail.com",
        connectedAt: null,
      }),
      "Needs reconnect",
    );
    assert.equal(
      gmailStatusLabel({
        configured: false,
        connected: false,
        needsReconnect: false,
        googleEmail: null,
        connectedAt: null,
      }),
      "Not configured",
    );
    assert.equal(displayFutureIntegrationStatus({ status: "connected" }), "disconnected");
    assert.equal(persistFutureIntegrationStatus("shopify", "connected"), "connected");
    assert.equal(persistFutureIntegrationStatus("shopify", "pending"), "pending");
    assert.equal(persistFutureIntegrationStatus("calendar", "connected"), "disconnected");
    assert.equal(persistFutureIntegrationStatus("woocommerce", "pending"), "disconnected");
    assert.throws(() => persistFutureIntegrationStatus("calendar", "live"), BillingError);
  });

  it("keeps WooCommerce as the remaining future provider and Calendar on its own connection", () => {
    assert.deepEqual(
      FUTURE_INTEGRATION_CATALOG.map((item) => item.provider),
      ["woocommerce"],
    );
    assert.ok(FUTURE_INTEGRATION_PROVIDERS.includes("shopify"));
    assert.ok(FUTURE_INTEGRATION_PROVIDERS.includes("calendar"));
  });
});

describe("Workspace integrations", () => {
  it("persists WooCommerce and Calendar as disconnected and Shopify from the real connection", async () => {
    const { store, workspace, service } = await paidWorkspace();
    const snapshot = await service.listWorkspaceIntegrations(workspace.id);
    const stored = await store.listIntegrationConnections(workspace.id);
    assert.deepEqual(
      stored.map((row) => row.provider).sort(),
      [...FUTURE_INTEGRATION_PROVIDERS].sort(),
    );
    assert.equal(stored.find((row) => row.provider === "woocommerce")?.status, "disconnected");
    assert.equal(stored.find((row) => row.provider === "calendar")?.status, "disconnected");
    assert.equal(stored.find((row) => row.provider === "shopify")?.status, "disconnected");
    assert.equal(snapshot.gmail.connected, false);
    assert.equal(snapshot.shopify.connected, false);
    assert.equal(snapshot.social.label, "Drafts only");
    assert.ok(snapshot.future.every((row) => row.status === "disconnected"));
  });

  it("returns a connected Shopify store without leaking tokens", async () => {
    const { store, workspace, service } = await paidWorkspace("integrations-shopify@example.com");
    await store.upsertShopifyConnection({
      workspaceId: workspace.id,
      shopDomain: "virello.myshopify.com",
      shopName: "Virello",
      primaryDomain: "www.virellotimepieces.com",
      encryptedAccessToken: "ciphertext-shopify",
      scopes: "read_products,read_inventory",
      status: "connected",
      lastSyncedAt: new Date("2026-10-02T12:00:00Z"),
      lastSyncStatus: "success",
      productCount: 12,
    });
    const snapshot = await service.listWorkspaceIntegrations(workspace.id);
    assert.equal(snapshot.shopify.connected, true);
    assert.equal(snapshot.shopify.shopDomain, "virello.myshopify.com");
    assert.equal(snapshot.shopify.label, "Connected");
    assert.equal(snapshot.shopify.productCount, 12);
    assert.equal(
      (await store.listIntegrationConnections(workspace.id)).find((row) => row.provider === "shopify")
        ?.status,
      "connected",
    );
    const raw = JSON.stringify(serializeWorkspaceIntegrations(snapshot));
    assert.doesNotMatch(raw, /ciphertext|encryptedAccessToken|shpat_|SHOPIFY_API_SECRET/);
    assert.match(raw, /virello\.myshopify\.com/);
  });

  it("rewrites a tampered calendar connection and never returns Gmail tokens", async () => {
    const { store, workspace, service } = await paidWorkspace("integrations-gmail@example.com");
    await store.upsertGmailConnection({
      workspaceId: workspace.id,
      googleEmail: "owner@gmail.com",
      encryptedRefreshToken: "ciphertext-refresh",
      encryptedAccessToken: "ciphertext-access",
      accessTokenExpiresAt: new Date("2026-10-02T12:00:00Z"),
      scopes: "gmail.readonly gmail.send",
      status: "connected",
    });
    await service.listWorkspaceIntegrations(workspace.id);
    const tampered = store.integrationConnections.find(
      (row) => row.workspaceId === workspace.id && row.provider === "calendar",
    );
    assert.ok(tampered);
    tampered.status = "connected";
    const snapshot = await service.listWorkspaceIntegrations(workspace.id);
    assert.equal(snapshot.gmail.connected, true);
    assert.equal(snapshot.gmail.googleEmail, "owner@gmail.com");
    assert.equal(snapshot.gmail.label, "Connected");
    assert.equal(snapshot.future.find((row) => row.provider === "calendar"), undefined);
    assert.equal(snapshot.calendar.connected, false);
    assert.equal(
      (await store.listIntegrationConnections(workspace.id)).find((row) => row.provider === "calendar")
        ?.status,
      "disconnected",
    );
    const raw = JSON.stringify(serializeWorkspaceIntegrations(snapshot));
    assert.doesNotMatch(raw, /ciphertext|encryptedRefreshToken|refresh_token|access_token/);
    assert.match(raw, /owner@gmail.com/);
  });

  it("keeps the paid integrations page honest", () => {
    const ui = readFileSync("components/paid-integrations.tsx", "utf8");
    const calendarUi = readFileSync("components/calendar-integration-card.tsx", "utf8");
    const page = readFileSync("app/app/integrations/page.tsx", "utf8");
    const api = readFileSync("app/api/app/integrations/route.ts", "utf8");
    assert.match(page, /PaidIntegrations/);
    assert.doesNotMatch(page, /DeskPlaceholderPage/);
    assert.match(ui, /INTEGRATIONS_HINT/);
    assert.match(ui, /\/app\/email/);
    assert.match(ui, /\/app\/social/);
    assert.match(ui, /Connect Gmail/);
    assert.match(ui, /Connect Shopify/);
    assert.match(ui, /Sync now/);
    assert.match(ui, /Disconnect/);
    assert.match(ui, /Last synced/);
    assert.match(ui, /fetch\("\/api\/app\/integrations"\)/);
    assert.match(ui, /\/api\/app\/gmail\/connect\?returnTo=\/app\/integrations/);
    assert.match(ui, /\/api\/app\/shopify\/connect/);
    assert.match(ui, /\/api\/app\/shopify\/sync/);
    assert.match(api, /export async function GET/);
    assert.doesNotMatch(api, /export async function (POST|PATCH|PUT)/);
    assert.match(ui, /CalendarIntegrationCard/);
    assert.match(calendarUi, /Connect Google Calendar/);
    assert.match(calendarUi, /\/api\/app\/calendar\/connect/);
    assert.match(calendarUi, /Disconnect/);
    assert.doesNotMatch(`${ui}\n${calendarUi}`, /Connect WooCommerce|Start Free/i);
    assert.doesNotMatch(ui, /GOOGLE_CLIENT_SECRET|SHOPIFY_API_SECRET|encryptedAccessToken|shpat_/);
    assert.match(INTEGRATIONS_HINT, /Shopify catalog sync is available/);
  });
});
