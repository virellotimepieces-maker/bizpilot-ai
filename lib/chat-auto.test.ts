import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatAutoDecision, freezeVisitorText } from "./chat-auto";
import { emptyKnowledge } from "./empty-knowledge";

describe("website chat auto-answer gate", () => {
  it("lets safe published-knowledge questions auto-answer", () => {
    const kb = {
      ...emptyKnowledge("custom"),
      name: "Harbor Clinic",
      description: "Walk-in family practice on the waterfront.",
    };
    const decision = chatAutoDecision(kb, "Tell me about the clinic");
    assert.equal(decision.autoAnswer, true);
    assert.equal(decision.reply.requiresHuman, false);
  });

  it("freezes legal and complaint questions without auto-answer", () => {
    const kb = {
      ...emptyKnowledge("custom"),
      name: "Harbor Clinic",
      description: "Walk-in family practice on the waterfront.",
    };
    const decision = chatAutoDecision(kb, "I will sue you and call my lawyer.");
    assert.equal(decision.autoAnswer, false);
    assert.equal(decision.reply.intent, "legal");
  });

  it("uses the handoff text when auto-answer is turned off", () => {
    const kb = emptyKnowledge("custom");
    kb.name = "Harbor Clinic";
    kb.description = "Walk-in family practice.";
    kb.escalation.autoAnswerChat = false;
    kb.escalation.handoffMessage = "A teammate will take this.";
    const decision = chatAutoDecision(kb, "What are your hours?");
    assert.equal(decision.autoAnswer, false);
    assert.equal(freezeVisitorText(kb, decision.reply), "A teammate will take this.");
  });

  it("still auto-answers website questions that are not in the knowledge base", () => {
    const kb = {
      ...emptyKnowledge("custom"),
      name: "Harbor & Pine",
      description: "A clothing shop.",
    };
    const decision = chatAutoDecision(kb, "How fast is shipping and do you include tracking?");
    assert.equal(decision.autoAnswer, true);
  });
});
