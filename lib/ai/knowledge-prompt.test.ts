import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { knowledgePrompt, WIDGET_SYSTEM_RULES } from "./knowledge-prompt";
import { emptyKnowledge } from "../empty-knowledge";

describe("paid widget knowledge prompt", () => {
  it("includes hours, voice, and never-invent safety rules", () => {
    const kb = emptyKnowledge("custom");
    kb.name = "Harbor Clinic";
    kb.description = "Walk-in family practice.";
    kb.voice = "Calm and plain.";
    kb.hours.notes = "Closed on public holidays.";
    kb.contact.phone = "555-0100";
    kb.escalation.neverAutoAnswer = "medication names";
    const prompt = knowledgePrompt(kb);
    assert.match(prompt, /Harbor Clinic/);
    assert.match(prompt, /9 a\.m\./);
    assert.match(prompt, /Closed on public holidays/);
    assert.match(prompt, /Calm and plain/);
    assert.match(prompt, /555-0100/);
    assert.match(prompt, /medication names/);
    assert.match(WIDGET_SYSTEM_RULES, /Never invent/);
    assert.match(WIDGET_SYSTEM_RULES, /medical diagnoses/);
    assert.match(WIDGET_SYSTEM_RULES, /legal advice/);
  });
});
