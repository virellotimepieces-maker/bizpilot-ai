"use client";

import { KnowledgeEditor } from "@/components/knowledge-editor";
import { emptyKnowledge } from "@/lib/empty-knowledge";
import type { BusinessType, KnowledgeBase } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function PaidKnowledge() {
  const [knowledge, setKnowledge] = useState<KnowledgeBase | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/app/knowledge")
      .then((response) => response.json())
      .then((payload: { knowledge?: KnowledgeBase | null; error?: string }) => {
        if (payload.error) {
          toast.error(payload.error);
          return;
        }
        setKnowledge(payload.knowledge ?? emptyKnowledge("custom"));
      });
  }, []);

  async function save(next: KnowledgeBase) {
    setKnowledge(next);
    setSaving(true);
    const response = await fetch("/api/app/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledge: next }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      toast.error(payload.error || "Could not save knowledge.");
    }
  }

  function patchLocal(next: KnowledgeBase) {
    setKnowledge(next);
  }

  if (!knowledge) return <p className="text-sm text-muted-foreground">Loading knowledge…</p>;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {saving ? "Saving…" : "Stored in your paid workspace, not in demo localStorage."}
        </p>
        <Button size="sm" variant="outline" onClick={() => save(knowledge)} disabled={saving}>
          Save
        </Button>
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
