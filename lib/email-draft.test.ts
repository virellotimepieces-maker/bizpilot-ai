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
});
