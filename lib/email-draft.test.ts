import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftEmailFromInbound, draftEmailFromInboundAi, isEmailStatus } from "./email-draft";
import { emptyKnowledge } from "./empty-knowledge";
import { EMAIL_PAYMENT_CHECKOUT_GUIDANCE } from "./ai/email-identity";

describe("email drafts", () => {
  it("creates an editable draft and never marks it sent", () => {
    const kb = emptyKnowledge("custom");
    kb.name = "Harbor Clinic";
    kb.description = "Walk-in family practice.";
    const draft = draftEmailFromInbound({
      kb,
      fromName: "Pat",
      fromEmail: "pat@example.com",
      subject: "Hours",
      body: "When are you open on Monday?",
    });
    assert.notEqual(draft.status, "sent");
    assert.ok(draft.draftBody.trim().length > 0);
    assert.equal(isEmailStatus("sent"), true);
    assert.equal(isEmailStatus("posted"), false);
  });

  it("does not dump internal knowledge instructions into a blank inbound email", () => {
    const kb = emptyKnowledge("online_store");
    kb.name = "Virello Timepieces";
    kb.tagline = "Modern watches for everyday style";
    kb.industry = "Online watch store";
    kb.description =
      "Virello Timepieces is an online store selling watches. Never invent store policies or payment options. If information is unavailable, refer the question to a person.";
    const draft = draftEmailFromInbound({
      kb,
      fromName: "BOFOWO",
      fromEmail: "bofowo@example.com",
      subject: "(no subject)",
      body: "",
    });
    assert.notEqual(draft.status, "sent");
    assert.match(draft.draftBody, /^Hi BOFOWO,/);
    assert.match(draft.draftBody, /Could you share a bit more/i);
    assert.doesNotMatch(draft.draftBody, /Never invent/i);
    assert.doesNotMatch(draft.draftBody, /Industry:/);
  });

  it("answers a no-subject email from the body, not the missing subject", () => {
    const kb = emptyKnowledge("custom");
    kb.name = "Virello Timepieces";
    kb.hours.days = kb.hours.days.map((day) =>
      day.day === "monday" ? { ...day, closed: false, open: "09:00", close: "17:00" } : day,
    );
    const draft = draftEmailFromInbound({
      kb,
      fromName: "BOFOWO",
      fromEmail: "bofowo@example.com",
      subject: "(no subject)",
      body: "When are you open on Monday?",
    });
    assert.match(draft.draftBody, /monday/i);
    assert.match(draft.draftBody, /9 a\.m\./i);
    assert.doesNotMatch(draft.draftBody, /Could you share a bit more/i);
    assert.doesNotMatch(draft.draftBody, /Never invent/i);
  });

  it("does not emit canned knowledge-base wording for a PayPal question", async () => {
    const kb = emptyKnowledge("online_store");
    kb.name = "Harbor Goods";
    const heuristic = draftEmailFromInbound({
      kb,
      fromName: "Michael",
      fromEmail: "mike@example.com",
      subject: "Shipping inquiry",
      body: "Do you support PayPal and Shop Pay? I'd love to place an order.",
    });
    assert.doesNotMatch(heuristic.draftBody, /published knowledge/i);
    assert.doesNotMatch(heuristic.draftBody, /looping in a teammate/i);
    assert.doesNotMatch(heuristic.operatorNote, /No published knowledge matched/);
    assert.match(heuristic.draftBody, /checkout/i);

    const ai = await draftEmailFromInboundAi(
      {
        kb,
        fromName: "Michael",
        fromEmail: "mike@example.com",
        subject: "Shipping inquiry",
        body: "Do you support PayPal and Shop Pay? I'd love to place an order.",
      },
      {
        complete: async () => EMAIL_PAYMENT_CHECKOUT_GUIDANCE,
      },
    );
    assert.equal(ai.sources.length, 0);
    assert.match(ai.draftBody, /checkout/i);
    assert.doesNotMatch(ai.draftBody, /published knowledge/i);
    assert.doesNotMatch(ai.operatorNote, /No published knowledge matched/);
  });
});
