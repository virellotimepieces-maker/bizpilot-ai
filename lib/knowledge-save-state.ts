import type { KnowledgeBase } from "@/lib/types";

export const KNOWLEDGE_SAVED_VISIBLE_MS = 3200;

export type KnowledgeSaveView = {
  label: "Save changes" | "Saving…" | "Saved";
  disabled: boolean;
  error: string | null;
};

export function isKnowledgeDirty(
  current: KnowledgeBase | null,
  persisted: KnowledgeBase | null,
) {
  if (!current || !persisted) return false;
  return JSON.stringify(current) !== JSON.stringify(persisted);
}

export function getKnowledgeSaveView(input: {
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  error: string | null;
}): KnowledgeSaveView {
  if (input.saving) {
    return { label: "Saving…", disabled: true, error: null };
  }
  if (input.error) {
    return {
      label: "Save changes",
      disabled: !input.dirty,
      error: input.error,
    };
  }
  if (input.justSaved && !input.dirty) {
    return { label: "Saved", disabled: true, error: null };
  }
  return { label: "Save changes", disabled: !input.dirty, error: null };
}

export function shouldStartKnowledgeSave(input: { dirty: boolean; saving: boolean }) {
  return input.dirty && !input.saving;
}

export function knowledgeAfterSuccessfulSave<T>(saved: T) {
  return saved;
}
