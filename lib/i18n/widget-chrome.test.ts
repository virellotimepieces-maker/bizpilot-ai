import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryBillingStore } from "@/lib/billing/memory-store";
import { applyStripeEvent } from "@/lib/billing/stripe-events";
import type { StripeLikeEvent } from "@/lib/billing/types";
import { handleCalendarWidgetTurn } from "@/lib/calendar/booking";
import { CALENDAR_SCOPES } from "@/lib/calendar/config";
import { encryptSecret } from "@/lib/gmail/token-crypto";
import {
  applyWidgetChromeState,
  fillWidgetChrome,
  WIDGET_CHROME_EN,
  widgetTextDirection,
  type WidgetChrome,
} from "./widget-chrome";
import {
  clearWidgetChromeCache,
  localizeWidgetChrome,
  readWidgetChromeTranslation,
  widgetChromeForConversation,
} from "./widget-chrome-server";

function prefix(language: string) {
  return async (text: string) => `[[${language}]] ${text}`;
}

describe("widget chrome localization", () => {
  it("keeps the English widget labels and does not call a translator", async () => {
    let calls = 0;
    const chrome = await localizeWidgetChrome("en", async (text) => {
      calls += 1;
      return `[[en]] ${text}`;
    });
    assert.equal(calls, 0);
    assert.equal(chrome.talkToPerson, "Talk to a person");
    assert.equal(chrome.askQuestion, "Ask a question");
    assert.equal(chrome.send, "Send");
    assert.equal(chrome.leaveContact, "Leave your name and email (optional)");
    assert.equal(chrome.assistantFor, "AI assistant for {business}");
    assert.equal(chrome.teammateWillReply, "A teammate will reply here");
  });

  it("localizes the same labels for any language and keeps placeholders", async () => {
    for (const language of ["ja", "fr", "tl", "es", "pt"]) {
      const chrome = await localizeWidgetChrome(language, prefix(language));
      assert.match(chrome.assistantFor, new RegExp(`^\\[\\[${language}\\]\\]`));
      assert.match(chrome.assistantFor, /\{business\}/);
      assert.match(chrome.leaveContact, new RegExp(`^\\[\\[${language}\\]\\]`));
      assert.match(chrome.talkToPerson, new RegExp(`^\\[\\[${language}\\]\\]`));
      assert.match(chrome.askQuestion, new RegExp(`^\\[\\[${language}\\]\\]`));
      assert.match(chrome.send, new RegExp(`^\\[\\[${language}\\]\\]`));
      assert.match(chrome.teammateWillReply, new RegExp(`^\\[\\[${language}\\]\\]`));
      assert.match(chrome.showMore, /\{count\}/);
      assert.doesNotMatch(chrome.viewProduct, /@|https?:|Mon, /);
    }
  });

  it("falls back to English when localization drops a placeholder", async () => {
    const chrome = await localizeWidgetChrome("ja", async (text) => text.replace(/\{business\}|\{count\}/g, ""));
    assert.equal(chrome.assistantFor, WIDGET_CHROME_EN.assistantFor);
    assert.equal(chrome.send, WIDGET_CHROME_EN.send);
    assert.equal(chrome.showMore, WIDGET_CHROME_EN.showMore);
  });

  it("inserts the workspace name without translating it", () => {
    const label = fillWidgetChrome("[[ja]] AI assistant for {business}", {
      business: "Virello Timepieces",
    });
    assert.equal(label, "[[ja]] AI assistant for Virello Timepieces");
    assert.equal(
      fillWidgetChrome(WIDGET_CHROME_EN.assistantFor, { business: "owner@example.com" }),
      "AI assistant for owner@example.com",
    );
    assert.equal(fillWidgetChrome(WIDGET_CHROME_EN.showMore, { count: "3" }), "Show 3 more");
    assert.equal(widgetTextDirection("ar"), "rtl");
    assert.equal(widgetTextDirection("ja"), "ltr");
  });

  it("follows the conversation language and switches when that language changes", async () => {
    const store = new MemoryBillingStore();
    const user = await store.createUser({
      email: "chrome@example.com",
      passwordHash: "hash",
      name: "Harbor",
    });
    const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Virello Timepieces" });
    const other = await store.createWorkspace({
      ownerUserId: (await store.createUser({
        email: "other-chrome@example.com",
        passwordHash: "hash",
        name: "Other",
      })).id,
      name: "Other Studio",
    });
    const conversation = await store.createConversation({
      workspaceId: workspace.id,
      visitorKey: "visitor-chrome",
    });
    const otherConversation = await store.createConversation({
      workspaceId: other.id,
      visitorKey: "visitor-other",
    });
    await store.updateConversation(otherConversation.id, other.id, { detectedLanguage: "fr" });

    const before = await widgetChromeForConversation(store, workspace.widgetKey, conversation.id, prefix("ja"));
    assert.equal(before.detectedLanguage, "en");
    assert.equal(before.chrome.send, "Send");

    await store.updateConversation(conversation.id, workspace.id, { detectedLanguage: "ja" });
    const japanese = await widgetChromeForConversation(store, workspace.widgetKey, conversation.id, prefix("ja"));
    assert.equal(japanese.detectedLanguage, "ja");
    assert.match(japanese.chrome.talkToPerson, /^\[\[ja\]\]/);
    assert.equal(
      fillWidgetChrome(japanese.chrome.assistantFor, { business: workspace.name }),
      "[[ja]] AI assistant for Virello Timepieces",
    );

    await store.updateConversation(conversation.id, workspace.id, { detectedLanguage: "es" });
    const spanish = await widgetChromeForConversation(store, workspace.widgetKey, conversation.id, prefix("es"));
    assert.equal(spanish.detectedLanguage, "es");
    assert.match(spanish.chrome.askQuestion, /^\[\[es\]\]/);
    assert.doesNotMatch(spanish.chrome.send, /\[\[ja\]\]/);

    await store.updateConversation(conversation.id, workspace.id, { detectedLanguage: "en" });
    let calls = 0;
    const english = await widgetChromeForConversation(store, workspace.widgetKey, conversation.id, async (text) => {
      calls += 1;
      return text;
    });
    assert.equal(english.detectedLanguage, "en");
    assert.equal(english.chrome.leaveContact, WIDGET_CHROME_EN.leaveContact);
    assert.equal(calls, 0);

    const isolated = await widgetChromeForConversation(
      store,
      workspace.widgetKey,
      otherConversation.id,
      prefix("fr"),
    );
    assert.equal(isolated.detectedLanguage, "en");
    assert.equal(isolated.chrome.talkToPerson, "Talk to a person");
  });

  it("updates the visible widget chrome in the same session after a Japanese message", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const previousSecret = process.env.AUTH_SECRET;
    process.env.OPENAI_API_KEY = "test-chrome-key";
    process.env.AUTH_SECRET = previousSecret && previousSecret.length >= 16 ? previousSecret : "test-auth-secret-value";
    clearWidgetChromeCache();
    const japanese = localizedChrome();
    const modelText = `Sure, here is the translation:\n\`\`\`json\n${JSON.stringify(japanese)}\n\`\`\``;
    assert.throws(() => JSON.parse(modelText.replace(/^```(?:json)?\s*|\s*```$/g, "")));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: modelText } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      let ui = { language: "en", chrome: { ...WIDGET_CHROME_EN } };
      assert.equal(ui.chrome.send, "Send");
      assert.equal(
        fillWidgetChrome(ui.chrome.assistantFor, { business: "Virello Timepieces" }),
        "AI assistant for Virello Timepieces",
      );

      const store = new MemoryBillingStore();
      const user = await store.createUser({
        email: "ja-widget@example.com",
        passwordHash: "hash",
        name: "Harbor",
      });
      const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Virello Timepieces" });
      const start = new Date("2026-09-01T00:00:00Z");
      const end = new Date("2026-12-01T00:00:00Z");
      await applyStripeEvent(store, {
        id: "evt_ja_widget_co",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_ja_widget",
            mode: "subscription",
            customer: "cus_ja_widget",
            subscription: "sub_ja_widget",
            client_reference_id: user.id,
            metadata: { userId: user.id, workspaceId: workspace.id },
          },
        },
      } satisfies StripeLikeEvent);
      await applyStripeEvent(store, {
        id: "evt_ja_widget_sub",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_ja_widget",
            customer: "cus_ja_widget",
            status: "active",
            cancel_at_period_end: false,
            metadata: { userId: user.id, workspaceId: workspace.id },
            items: {
              data: [
                {
                  price: { id: "price_test_bizpilot_pro" },
                  current_period_start: Math.floor(start.getTime() / 1000),
                  current_period_end: Math.floor(end.getTime() / 1000),
                },
              ],
            },
          },
        },
      } satisfies StripeLikeEvent);
      await store.upsertGoogleCalendarConnection({
        workspaceId: workspace.id,
        googleEmail: "calendar@gmail.com",
        encryptedRefreshToken: encryptSecret("refresh-calendar"),
        encryptedAccessToken: encryptSecret("access-calendar"),
        accessTokenExpiresAt: new Date("2026-10-10T18:00:00.000Z"),
        scopes: CALENDAR_SCOPES.join(" "),
        status: "connected",
        calendarId: "harbor-calendar",
        calendarSummary: "Harbor",
      });
      await store.upsertCalendarBookingSettings({
        workspaceId: workspace.id,
        durationMinutes: 30,
        availableDays: ["mon", "tue", "wed", "thu", "fri"],
        startMinutes: 9 * 60,
        endMinutes: 17 * 60,
        timezone: "America/New_York",
        minNoticeMinutes: 0,
        bufferMinutes: 0,
      });
      const fetchImpl: typeof fetch = async (url) => {
        if (String(url).includes("freeBusy")) {
          return new Response(JSON.stringify({ calendars: { "harbor-calendar": { busy: [] } } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 404 });
      };
      const turn = await handleCalendarWidgetTurn({
        store,
        widgetKey: workspace.widgetKey,
        visitorKey: "visitor-ja-ui",
        question: "明日の予約をしたいです。何時が空いていますか？",
        now: new Date("2026-10-08T15:00:00.000Z"),
        fetchImpl,
        translate: async (text, language) => `[[${language}]] ${text}`,
      });
      const chrome = await localizeWidgetChrome("ja");
      const response = {
        ...turn,
        detectedLanguage: "ja",
        chrome,
      };
      ui = applyWidgetChromeState(ui, response);
      assert.match(turn?.answer ?? "", /^\[\[ja\]\]/);
      assert.match(turn?.sources[0]?.title ?? "", /\d{1,2}:\d{2}/);
      assert.equal(ui.language, "ja");
      assert.equal(ui.chrome.send, "送信");
      assert.equal(ui.chrome.askQuestion, "質問する");
      assert.equal(ui.chrome.talkToPerson, "人と話す");
      assert.equal(ui.chrome.leaveContact, "お名前とメールアドレスを残してください（任意）");
      assert.equal(
        fillWidgetChrome(ui.chrome.assistantFor, { business: "Virello Timepieces" }),
        "Virello TimepiecesのためのAIアシスタント",
      );
      assert.equal(readWidgetChromeTranslation(modelText)?.send, "送信");
      const stored = await store.getConversation(turn?.conversationId ?? "", workspace.id);
      assert.equal(stored?.detectedLanguage, "ja");
      ui = applyWidgetChromeState(ui, { detectedLanguage: "ja", chrome: { ...WIDGET_CHROME_EN } });
      assert.equal(ui.chrome.send, "送信");
      assert.equal(ui.chrome.askQuestion, "質問する");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.OPENAI_API_KEY = previousKey;
      process.env.AUTH_SECRET = previousSecret;
      clearWidgetChromeCache();
    }
  });
});

function localizedChrome(): WidgetChrome {
  return {
    ...WIDGET_CHROME_EN,
    assistantFor: "{business}のためのAIアシスタント",
    leaveContact: "お名前とメールアドレスを残してください（任意）",
    talkToPerson: "人と話す",
    askQuestion: "質問する",
    send: "送信",
    teammateWillReply: "チームメイトがここで返信します",
  };
}
