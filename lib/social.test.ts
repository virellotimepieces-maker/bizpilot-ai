import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyKnowledge } from "./empty-knowledge";
import { PRESETS } from "./presets";
import { generateReply } from "./reply-engine";
import { draftSocialFromInbound, rebuildSocialDraft } from "./social";
import type { KnowledgeBase, SocialMessage } from "./types";

function storeDesk(): KnowledgeBase {
  const preset = PRESETS.find((row) => row.businessType === "online_store");
  assert.ok(preset);
  return preset!.knowledge;
}

describe("social drafts", () => {
  it("never auto-posts and never uses email-send language", () => {
    const reply = generateReply({
      query: "Do you ship the Ember Enamel Mug pair to Anchorage, Alaska?",
      kb: storeDesk(),
      channel: "social",
      customerName: "Alex Chen",
    });
    assert.equal(reply.channel, "social");
    assert.equal(reply.requiresHuman, true);
    assert.equal(reply.safeForChatAuto, false);
    assert.doesNotMatch(reply.body, /reply to this email/i);
    assert.match(reply.operatorNote, /never posts/i);
    assert.match(reply.body, /alaska/i);
  });

  it("answers Instagram contact questions from published profiles", () => {
    const reply = generateReply({
      query: "What is your Instagram?",
      kb: storeDesk(),
      channel: "social",
      customerName: "Riley",
    });
    assert.equal(reply.intent, "contact");
    assert.match(reply.body, /@fieldandember/);
    assert.equal(reply.requiresHuman, true);
  });

  it("escalates clinical DMs and keeps them as drafts", () => {
    const clinic = PRESETS.find((row) => row.businessType === "clinic");
    assert.ok(clinic);
    const draft = draftSocialFromInbound({
      kb: clinic!.knowledge,
      platform: "instagram",
      fromName: "Chris Nguyen",
      handle: "@chris.n",
      body: "I've had a sore throat for four days. Can you tell me which antibiotic to start and the dosage?",
    });
    assert.equal(draft.status, "escalated");
    assert.equal(draft.intent, "medical_advice");
    assert.match(draft.operatorNote, /never posts/i);
    assert.doesNotMatch(draft.draftBody, /reply to this email/i);
  });

  it("does not regenerate a draft after the human marked it posted", () => {
    const posted: SocialMessage = {
      id: "soc_1",
      platform: "tiktok",
      fromName: "Alex",
      handle: "@alexc",
      body: "Do you ship to Alaska?",
      receivedAt: "Today",
      status: "posted",
      draftBody: "Already copied.",
      intent: "store_shipping",
      sources: [],
      operatorNote: "done",
      usedInternalKnowledge: false,
      postedAt: "2026-09-11T00:00:00.000Z",
    };
    const next = rebuildSocialDraft(posted, storeDesk());
    assert.equal(next.status, "posted");
    assert.equal(next.draftBody, "Already copied.");
  });

  it("keeps social drafts as drafts when the knowledge base is empty", () => {
    const kb = {
      ...emptyKnowledge("custom"),
      name: "Northwind Studio",
    };
    const reply = generateReply({
      query: "Can you reply to my Facebook DM about hosting?",
      kb,
      channel: "social",
    });
    assert.equal(reply.requiresHuman, true);
    assert.equal(reply.safeForChatAuto, false);
    assert.match(reply.operatorNote, /never posts/i);
  });
});
