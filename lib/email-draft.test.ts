import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftEmailFromInbound, isEmailStatus } from "./email-draft";
import { emptyKnowledge } from "./empty-knowledge";

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
});
