"use client";

import { KnowledgeEditor } from "@/components/knowledge-editor";
import { WebsiteKnowledgePanel } from "@/components/website-knowledge-panel";
import { emptyKnowledge, normalizeKnowledge } from "@/lib/empty-knowledge";
import {
  getKnowledgeSaveView,
  isKnowledgeDirty,
  KNOWLEDGE_SAVED_VISIBLE_MS,
  shouldStartKnowledgeSave,
} from "@/lib/knowledge-save-state";
import type { BusinessType, KnowledgeBase } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";
import { useEffect, useRef, useState } from "react";

export function PaidKnowledge() {
  const [knowledge, setKnowledge] = useState<KnowledgeBase | null>(null);
  const [persisted, setPersisted] = useState<KnowledgeBase | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetch("/api/app/knowledge")
      .then((response) => response.json())
      .then((payload: { knowledge?: KnowledgeBase | null; error?: string }) => {
        if (payload.error) {
          setError(payload.error);
          return;
        }
        const loaded = normalizeKnowledge(payload.knowledge ?? emptyKnowledge("custom"));
        setKnowledge(loaded);
        setPersisted(loaded);
        setJustSaved(false);
        setError(null);
      })
      .catch(() => {
        setError("Could not load knowledge.");
      });
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const dirty = isKnowledgeDirty(knowledge, persisted);
  const saveView = getKnowledgeSaveView({ dirty, saving, justSaved, error });

  async function save() {
    if (!knowledge || !shouldStartKnowledgeSave({ dirty, saving }) || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    const snapshot = knowledge;
    try {
      const response = await fetch("/api/app/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge: snapshot }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "Could not save knowledge.");
        return;
      }
      const payload = (await response.json()) as { knowledge?: KnowledgeBase };
      const stored = payload.knowledge ?? snapshot;
      setPersisted(stored);
      setKnowledge((current) =>
        current && JSON.stringify(current) === JSON.stringify(snapshot) ? stored : current,
      );
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        setJustSaved(false);
      }, KNOWLEDGE_SAVED_VISIBLE_MS);
    } catch {
      setError("Could not save knowledge.");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  function patchLocal(next: KnowledgeBase) {
    setKnowledge(next);
    if (justSaved) setJustSaved(false);
    if (error) setError(null);
  }

  if (!knowledge) {
    return (
      <p className={HELPER_TEXT_CLASS}>
        {error ?? "Loading knowledge…"}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <WebsiteKnowledgePanel />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={HELPER_TEXT_CLASS} aria-live="polite">
          Stored in your paid workspace, not in demo localStorage.
        </p>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void save()}
            disabled={saveView.disabled}
            aria-busy={saving}
          >
            {saveView.label}
          </Button>
          {saveView.error ? (
            <p className="text-sm text-destructive" role="alert">
              {saveView.error}
            </p>
          ) : null}
        </div>
      </div>
      <KnowledgeEditor
        knowledge={knowledge}
        updateKnowledge={patchLocal}
        setBusinessType={(type: BusinessType) =>
          patchLocal({ ...emptyKnowledge(type), ...knowledge, businessType: type })
        }
      />
    </div>
  );
}
