import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyKnowledge } from "./empty-knowledge";
import {
  getKnowledgeSaveView,
  isKnowledgeDirty,
  knowledgeAfterSuccessfulSave,
  KNOWLEDGE_SAVED_VISIBLE_MS,
  shouldStartKnowledgeSave,
} from "./knowledge-save-state";

describe("knowledge save state", () => {
  it("keeps Save changes disabled when there are no unsaved changes", () => {
    const view = getKnowledgeSaveView({
      dirty: false,
      saving: false,
      justSaved: false,
      error: null,
    });
    assert.equal(view.label, "Save changes");
    assert.equal(view.disabled, true);
    assert.equal(shouldStartKnowledgeSave({ dirty: false, saving: false }), false);
  });

  it("enables Save changes only when dirty and idle", () => {
    const view = getKnowledgeSaveView({
      dirty: true,
      saving: false,
      justSaved: false,
      error: null,
    });
    assert.equal(view.label, "Save changes");
    assert.equal(view.disabled, false);
    assert.equal(shouldStartKnowledgeSave({ dirty: true, saving: false }), true);
  });

  it("shows Saving… and blocks duplicate submissions", () => {
    const view = getKnowledgeSaveView({
      dirty: true,
      saving: true,
      justSaved: false,
      error: null,
    });
    assert.equal(view.label, "Saving…");
    assert.equal(view.disabled, true);
    assert.equal(shouldStartKnowledgeSave({ dirty: true, saving: true }), false);
  });

  it("shows Saved long enough to notice on mobile", () => {
    const view = getKnowledgeSaveView({
      dirty: false,
      saving: false,
      justSaved: true,
      error: null,
    });
    assert.equal(view.label, "Saved");
    assert.equal(view.disabled, true);
    assert.ok(KNOWLEDGE_SAVED_VISIBLE_MS >= 3000);
  });

  it("shows an inline error and still allows retry when dirty", () => {
    const view = getKnowledgeSaveView({
      dirty: true,
      saving: false,
      justSaved: false,
      error: "Could not save knowledge.",
    });
    assert.equal(view.label, "Save changes");
    assert.equal(view.disabled, false);
    assert.equal(view.error, "Could not save knowledge.");
  });

  it("treats a refresh of the saved payload as persisted database values", () => {
    const draft = emptyKnowledge("service");
    draft.name = "Northwind Studio";
    draft.hours.days[0]!.open = "08:30";
    const persisted = knowledgeAfterSuccessfulSave(structuredClone(draft));
    assert.equal(isKnowledgeDirty(draft, persisted), false);
    const reloaded = structuredClone(persisted);
    assert.equal(isKnowledgeDirty(reloaded, persisted), false);
    assert.equal(reloaded.hours.days[0]!.open, "08:30");
    reloaded.name = "Changed";
    assert.equal(isKnowledgeDirty(reloaded, persisted), true);
  });
});
