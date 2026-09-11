import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emptyKnowledge } from "./empty-knowledge";
import { MemoryBillingStore } from "./billing/memory-store";
import { applyStripeEvent } from "./billing/stripe-events";
import { BillingService } from "./billing/service";
import { BillingError } from "./billing/types";
import {
  COPY_SNIPPET_FEEDBACK_MS,
  copySnippetLabel,
  previewUsesCustomerWidget,
  WIDGET_CHAT_API_PATH,
  WIDGET_PREVIEW_IFRAME_CLASS,
  widgetInstallSnippet,
  widgetPreviewButtonLabel,
  widgetPreviewEmbedUrl,
} from "./widget-preview";

const PRICE = "price_test_bizpilot_pro";
const ORIGIN = "https://bizpilot-ai-mocha.vercel.app";
const KEY = "bpw_live_preview_key";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

describe("live widget preview", () => {
  it("loads the same production embed and script origin a customer website uses", () => {
    const snippet = widgetInstallSnippet(ORIGIN, KEY);
    const preview = widgetPreviewEmbedUrl(ORIGIN, KEY);
    assert.equal(snippet, `<script src="${ORIGIN}/w/${KEY}.js" async></script>`);
    assert.equal(preview, `${ORIGIN}/embed/${KEY}`);
    assert.equal(previewUsesCustomerWidget(ORIGIN, KEY), true);
    assert.doesNotMatch(preview, /\/demo/);
    assert.equal(WIDGET_CHAT_API_PATH, "/api/widget/chat");
    assert.match(WIDGET_PREVIEW_IFRAME_CLASS, /w-full/);
    assert.match(WIDGET_PREVIEW_IFRAME_CLASS, /max-w-full/);
    assert.equal(widgetPreviewButtonLabel(), "Open widget preview");
  });

  it("shows Copied after the snippet is copied", () => {
    assert.equal(copySnippetLabel(false), "Copy snippet");
    assert.equal(copySnippetLabel(true), "Copied");
    assert.ok(COPY_SNIPPET_FEEDBACK_MS >= 2000);
  });

  it("does not put server secrets in browser widget code", () => {
    const files = [
      "components/widget-chat.tsx",
      "components/paid-widget.tsx",
      "lib/widget-preview.ts",
      "lib/widget-install-guides.ts",
      "app/embed/[widgetKey]/page.tsx",
      "app/w/[widgetKey]/route.ts",
      "lib/widget-embed-script.ts",
      "lib/widget-chat-scroll.ts",
      "lib/website/sync.ts",
      "lib/website/run-sync.ts",
      "components/website-knowledge-panel.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /OPENAI_API_KEY/);
      assert.doesNotMatch(source, /DATABASE_URL/);
      assert.doesNotMatch(source, /STRIPE_SECRET_KEY/);
      assert.doesNotMatch(source, /AUTH_SECRET/);
    }
    const chat = readFileSync("components/widget-chat.tsx", "utf8");
    assert.match(chat, /WIDGET_CHAT_API_PATH/);
    assert.match(chat, /startOpen = false/);
    assert.match(chat, /aria-label="Open chat"/);
    assert.match(chat, /aria-label="Close chat"/);
    assert.match(chat, /Send/);
    assert.doesNotMatch(chat, /h-dvh/);
    assert.match(chat, /scrollMessagesToLatest/);
    assert.match(chat, /data-widget-scroll-anchor/);
    assert.match(chat, /overscroll-contain/);
  });
});

describe("live widget preview access and usage", () => {
  async function paidWorkspace() {
    const store = new MemoryBillingStore();
    const user = await store.createUser({
      email: "preview@example.com",
      passwordHash: "hash",
      name: "Preview",
    });
    const workspace = await store.createWorkspace({
      ownerUserId: user.id,
      name: "Preview Studio",
    });
    await store.saveKnowledge(workspace.id, {
      ...emptyKnowledge("service"),
      name: "Preview Studio",
      description: "We repair commercial HVAC systems in the East Bay.",
    });
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    await applyStripeEvent(store, {
      id: "evt_preview_co",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_preview",
          subscription: "sub_preview",
          metadata: { userId: user.id, workspaceId: workspace.id },
        },
      },
    });
    await applyStripeEvent(store, {
      id: "evt_preview_sub",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_preview",
          customer: "cus_preview",
          status: "active",
          metadata: { userId: user.id, workspaceId: workspace.id },
          items: {
            data: [
              {
                price: { id: PRICE },
                current_period_start: unix(start),
                current_period_end: unix(end),
              },
            ],
          },
        },
      },
    });
    return { store, user, workspace, start, service: new BillingService(store) };
  }

  it("blocks the live widget when the subscription is inactive", async () => {
    const store = new MemoryBillingStore();
    const user = await store.createUser({
      email: "inactive@example.com",
      passwordHash: "hash",
      name: "Inactive",
    });
    const workspace = await store.createWorkspace({
      ownerUserId: user.id,
      name: "Inactive Studio",
    });
    const service = new BillingService(store);
    await assert.rejects(
      () => service.assertWidgetCanReply(workspace.widgetKey, new Date()),
      (error: unknown) => error instanceof BillingError && error.code === "inactive",
    );
  });

  it("counts a successful live-widget AI reply once and not after a failed model call", async () => {
    const { workspace, start, service } = await paidWorkspace();
    await assert.rejects(
      () =>
        service.generateCountedAiReply({
          widgetKey: workspace.widgetKey,
          visitorKey: "preview-fail",
          question: "What do you repair?",
          now: start,
          generate: async () => {
            throw new Error("model_down");
          },
        }),
      /model_down/,
    );
    assert.equal((await service.peekUsage(workspace.id, start)).period.repliesUsed, 0);

    const first = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "preview-ok",
      question: "What do you repair?",
      now: start,
      generate: async (knowledge) => {
        assert.equal(knowledge?.name, "Preview Studio");
        return "We repair commercial HVAC systems in the East Bay.";
      },
    });
    assert.equal(first.usage.used, 1);
    assert.equal((await service.peekUsage(workspace.id, start)).period.repliesUsed, 1);
  });
});
