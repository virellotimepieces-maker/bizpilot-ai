import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryBillingStore } from "@/lib/billing/memory-store";
import { fillWidgetChrome, WIDGET_CHROME_EN, widgetTextDirection } from "./widget-chrome";
import { localizeWidgetChrome, widgetChromeForConversation } from "./widget-chrome-server";

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
});
