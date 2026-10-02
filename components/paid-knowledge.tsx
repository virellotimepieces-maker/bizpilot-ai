"use client";

import { KnowledgeEditor } from "@/components/knowledge-editor";
import { KnowledgeEnginePanel, type EngineEntry, type EngineUnanswered } from "@/components/knowledge-engine-panel";
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
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS, TAB_ITEM_CLASS, TAB_ROW_CLASS } from "@/lib/ui/type-scale";
import { useEffect, useRef, useState } from "react";

type EnginePayload = {
  knowledge?: KnowledgeBase | null;
  entries?: EngineEntry[];
  unanswered?: EngineUnanswered[];
  error?: string;
};

export function PaidKnowledge() {
  const [knowledge, setKnowledge] = useState<KnowledgeBase | null>(null);
  const [persisted, setPersisted] = useState<KnowledgeBase | null>(null);
  const [entries, setEntries] = useState<EngineEntry[]>([]);
  const [unanswered, setUnanswered] = useState<EngineUnanswered[]>([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetch("/api/app/knowledge")
      .then((response) => response.json())
      .then((payload: EnginePayload) => {
        if (payload.error) {
          setError(payload.error);
          return;
        }
        const loaded = normalizeKnowledge(payload.knowledge ?? emptyKnowledge("custom"));
        setKnowledge(loaded);
        setPersisted(loaded);
        setEntries(payload.entries ?? []);
        setUnanswered(payload.unanswered ?? []);
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
      const payload = (await response.json()) as EnginePayload;
      if (!response.ok) {
        setError(payload.error || "Could not save knowledge.");
        return;
      }
      const stored = payload.knowledge ?? snapshot;
      setPersisted(stored);
      setKnowledge((current) =>
        current && JSON.stringify(current) === JSON.stringify(snapshot) ? stored : current,
      );
      setEntries(payload.entries ?? []);
      setUnanswered(payload.unanswered ?? unanswered);
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
      <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading knowledge">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-40" />
        {error ? <p className={HELPER_TEXT_CLASS}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader
        eyebrow="Knowledge"
        title="Knowledge engine"
        description="Publish facts the widget may answer from. Disabled facts stay stored but are hidden from chat. JSON in the Edit tab remains the structured source of truth."
        actions={
          <div className="flex min-w-0 flex-col items-stretch gap-1 sm:items-end">
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
        }
      />
      <p className={HELPER_TEXT_CLASS} aria-live="polite">
        Stored in your paid workspace, not in demo localStorage.
      </p>
      <Tabs defaultValue="facts" className="min-w-0">
        <TabsList variant="line" className={`${TAB_ROW_CLASS} w-full max-w-full justify-start`}>
          <TabsTrigger value="facts" className={TAB_ITEM_CLASS}>
            Facts
          </TabsTrigger>
          <TabsTrigger value="edit" className={TAB_ITEM_CLASS}>
            Edit
          </TabsTrigger>
          <TabsTrigger value="website" className={TAB_ITEM_CLASS}>
            Website
          </TabsTrigger>
        </TabsList>
        <TabsContent value="facts" className="min-w-0 pt-4">
          <KnowledgeEnginePanel
            entries={entries}
            unanswered={unanswered}
            onEntries={setEntries}
            onUnanswered={setUnanswered}
          />
        </TabsContent>
        <TabsContent value="edit" className="min-w-0 pt-4">
          <KnowledgeEditor
            knowledge={knowledge}
            updateKnowledge={patchLocal}
            setBusinessType={(type: BusinessType) =>
              patchLocal({ ...emptyKnowledge(type), ...knowledge, businessType: type })
            }
          />
        </TabsContent>
        <TabsContent value="website" className="min-w-0 pt-4">
          <WebsiteKnowledgePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
