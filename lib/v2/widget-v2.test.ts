import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BillingError, type StripeLikeEvent } from "../billing/types";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import {
  DEFAULT_WIDGET_ACCENT,
  DEFAULT_WIDGET_WELCOME,
  looksLikeEmail,
  parseAccentColor,
  parseWidgetSettingsInput,
  publicWidgetAppearance,
  resolvedAccentColor,
} from "./widget-settings";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace() {
  const store = new MemoryBillingStore();
  const user = await store.createUser({
    email: "widgetv2@example.com",
    passwordHash: "hash",
    name: "Widget",
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor Outfitters" });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  const checkout: StripeLikeEvent = {
    id: "evt_widget_v2_co",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_widget_v2",
        mode: "subscription",
        customer: "cus_widget_v2",
        subscription: "sub_widget_v2",
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  };
  const subscription: StripeLikeEvent = {
    id: "evt_widget_v2_sub",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_widget_v2",
        customer: "cus_widget_v2",
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
  };
  await applyStripeEvent(store, checkout);
  await applyStripeEvent(store, subscription);
  return { store, user, workspace, start, service: new BillingService(store) };
}

describe("Widget V2 appearance", () => {
  it("resolves a blank accent to indigo and never teal", () => {
    assert.equal(DEFAULT_WIDGET_ACCENT, "#3d4eb8");
    assert.equal(resolvedAccentColor(""), DEFAULT_WIDGET_ACCENT);
    assert.equal(resolvedAccentColor("not-a-color"), DEFAULT_WIDGET_ACCENT);
    assert.equal(parseAccentColor("#112233"), "#112233");
    assert.doesNotMatch(DEFAULT_WIDGET_ACCENT, /teal|#0f766e|#115e59/i);
    const published = publicWidgetAppearance(null, "Harbor");
    assert.equal(published.accentColor, DEFAULT_WIDGET_ACCENT);
    assert.equal(published.position, "bottom-right");
    assert.equal(published.identifyAsAi, true);
    assert.equal(published.leadCaptureEnabled, true);
    assert.equal(published.collectPhone, false);
    assert.equal(published.businessDisplayName, "Harbor");
    assert.match(published.welcomeMessage, /AI assistant/);
    assert.equal(published.welcomeMessage, DEFAULT_WIDGET_WELCOME);
  });

  it("validates appearance input without accepting javascript logo URLs", () => {
    const patch = parseWidgetSettingsInput({
      businessDisplayName: "Harbor",
      welcomeMessage: "Hi — I’m the AI assistant for Harbor.",
      suggestedQuestions: ["What do you offer?", "", "Hours?"],
      accentColor: "#3D4EB8",
      position: "bottom-left",
      identifyAsAi: true,
      leadCaptureEnabled: true,
      collectPhone: true,
      placeholderPrompt: "Ask Harbor",
      logoUrl: "https://cdn.example.com/logo.png",
    });
    assert.equal(patch.position, "bottom-left");
    assert.equal(patch.accentColor, "#3d4eb8");
    assert.deepEqual(patch.suggestedQuestions, ["What do you offer?", "Hours?"]);
    assert.equal(patch.collectPhone, true);
    assert.throws(
      () => parseWidgetSettingsInput({ logoUrl: "javascript:alert(1)" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
    assert.throws(
      () => parseWidgetSettingsInput({ accentColor: "teal" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
    assert.throws(
      () => parseWidgetSettingsInput({ position: "top-right" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
  });

  it("publishes saved settings for an active widget and blocks inactive keys", async () => {
    const { store, workspace, service } = await paidWorkspace();
    await store.upsertWidgetSettings(workspace.id, {
      businessDisplayName: "Harbor Desk",
      accentColor: "#1e3a8a",
      position: "bottom-left",
      welcomeMessage: "Hi — I’m the AI assistant for Harbor Desk.",
    });
    const appearance = await service.loadPublicWidgetAppearance(workspace.widgetKey);
    assert.equal(appearance.businessDisplayName, "Harbor Desk");
    assert.equal(appearance.position, "bottom-left");
    assert.equal(appearance.accentColor, "#1e3a8a");

    const inactive = new MemoryBillingStore();
    const user = await inactive.createUser({
      email: "off@example.com",
      passwordHash: "hash",
      name: "Off",
    });
    const offWorkspace = await inactive.createWorkspace({ ownerUserId: user.id, name: "Off" });
    await assert.rejects(
      () => new BillingService(inactive).loadPublicWidgetAppearance(offWorkspace.widgetKey),
      (error: unknown) => error instanceof BillingError && error.code === "inactive",
    );
  });
});

describe("Widget V2 conversation contact capture", () => {
  it("stores name and email on the conversation and creates one Lead", async () => {
    const { store, workspace, service } = await paidWorkspace();
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true, collectPhone: true });
    const conversation = await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-harbor",
      name: "Pat Rivera",
      email: "pat@example.com",
      phone: "555-0100",
    });
    assert.equal(conversation.visitorName, "Pat Rivera");
    assert.equal(conversation.visitorEmail, "pat@example.com");
    assert.equal(conversation.visitorPhone, "555-0100");
    const leads = await store.listLeads(workspace.id);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].email, "pat@example.com");
    assert.equal(leads[0].conversationId, conversation.id);
    assert.equal(leads[0].source, "website");
    assert.equal(leads[0].status, "new");
    await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-harbor",
      conversationId: conversation.id,
      name: "Pat Rivera",
      email: "pat@example.com",
      phone: "555-0100",
    });
    assert.equal((await store.listLeads(workspace.id)).length, 1);
    assert.equal(looksLikeEmail("pat@example.com"), true);
    assert.equal(looksLikeEmail("not-an-email"), false);
  });

  it("ignores phone when collectPhone is off and refuses capture when disabled", async () => {
    const { store, workspace, service } = await paidWorkspace();
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true, collectPhone: false });
    const conversation = await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-nophone",
      name: "Kim",
      email: "kim@example.com",
      phone: "555-0199",
    });
    assert.equal(conversation.visitorPhone, "");
    assert.equal((await store.listLeads(workspace.id)).length, 1);
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: false });
    await assert.rejects(
      () =>
        service.saveWidgetVisitorContact({
          widgetKey: workspace.widgetKey,
          visitorKey: "visitor-off",
          email: "off@example.com",
        }),
      (error: unknown) => error instanceof BillingError && error.code === "forbidden",
    );
    assert.equal((await store.listLeads(workspace.id)).length, 1);
  });
});

describe("Widget V2 UI wiring", () => {
  it("adds appearance controls and points contact capture at Leads", () => {
    const paid = readFileSync("components/paid-widget.tsx", "utf8");
    const form = readFileSync("components/widget-appearance-form.tsx", "utf8");
    const chat = readFileSync("components/widget-chat.tsx", "utf8");
    const leads = readFileSync("app/app/leads/page.tsx", "utf8");
    assert.match(paid, /Appearance/);
    assert.match(paid, /Install widget/);
    assert.match(paid, /WIDGET_APP_SETTINGS_PATH/);
    assert.match(form, /Identify as an AI assistant/);
    assert.match(form, /Ask for name and email/);
    assert.match(form, /creates a Lead/);
    assert.match(form, /DEFAULT_WIDGET_ACCENT/);
    assert.match(chat, /WIDGET_PUBLIC_SETTINGS_PATH/);
    assert.match(chat, /suggestedQuestions/);
    assert.match(chat, /leadCaptureEnabled/);
    assert.match(chat, /identifyAsAi/);
    assert.doesNotMatch(chat, /createLead|listLeads/);
    assert.match(leads, /PaidLeads/);
    assert.doesNotMatch(leads, /DeskPlaceholderPage/);
  });

  it("does not put secrets in widget appearance files", () => {
    for (const file of [
      "lib/v2/widget-settings.ts",
      "components/widget-appearance-form.tsx",
      "app/api/widget/settings/route.ts",
      "app/api/app/widget-settings/route.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /OPENAI_API_KEY|DATABASE_URL|STRIPE_SECRET_KEY|AUTH_SECRET/);
    }
  });
});
