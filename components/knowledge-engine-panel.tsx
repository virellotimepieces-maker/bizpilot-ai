"use client";

import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HELPER_TEXT_CLASS, LABEL_CLASS, SECTION_HEADING_CLASS } from "@/lib/ui/type-scale";
import { EXTRA_FACT_KINDS, KNOWLEDGE_KIND_LABEL } from "@/lib/v2/kind-labels";
import { isExtraKnowledgeEntry } from "@/lib/v2/entry-scope";
import type { KnowledgeKind } from "@/lib/v2/enums";
import type { KnowledgeEntryRecord, UnansweredQuestionRecord } from "@/lib/v2/types";
import { MessageCircleQuestion, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export type EngineEntry = Omit<KnowledgeEntryRecord, "lastUpdatedAt" | "createdAt"> & {
  lastUpdatedAt: string;
  createdAt: string;
};

export type EngineUnanswered = Omit<UnansweredQuestionRecord, "createdAt" | "resolvedAt"> & {
  createdAt: string;
  resolvedAt: string | null;
};

export function KnowledgeEnginePanel({
  entries,
  unanswered,
  onEntries,
  onUnanswered,
}: {
  entries: EngineEntry[];
  unanswered: EngineUnanswered[];
  onEntries: (next: EngineEntry[]) => void;
  onUnanswered: (next: EngineUnanswered[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | KnowledgeKind | "disabled" | "extra">("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [extraKind, setExtraKind] = useState<KnowledgeKind>("faq");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const openGaps = unanswered.filter((row) => row.status === "open");
  const visible = useMemo(() => {
    return entries.filter((row) => {
      if (kind === "disabled") return !row.enabled;
      if (kind === "extra") return isExtraKnowledgeEntry(row);
      if (kind !== "all" && row.kind !== kind) return false;
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return `${row.title}\n${row.content}\n${row.sourceLabel}`.toLowerCase().includes(needle);
    });
  }, [entries, kind, query]);

  async function patchEntry(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/app/knowledge/entries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { entry?: EngineEntry; error?: string };
      if (!response.ok || !payload.entry) {
        setError(payload.error || "Could not update that fact.");
        return;
      }
      onEntries(entries.map((row) => (row.id === id ? payload.entry! : row)));
    } catch {
      setError("Could not update that fact.");
    } finally {
      setBusy("");
    }
  }

  async function removeEntry(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/app/knowledge/entries/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Could not delete that fact.");
        return;
      }
      onEntries(entries.filter((row) => row.id !== id));
    } catch {
      setError("Could not delete that fact.");
    } finally {
      setBusy("");
    }
  }

  async function addFact() {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setBusy("add");
    setError("");
    try {
      const response = await fetch("/api/app/knowledge/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: extraKind, title, content }),
      });
      const payload = (await response.json()) as { entry?: EngineEntry; error?: string };
      if (!response.ok || !payload.entry) {
        setError(payload.error || "Could not add the fact.");
        return;
      }
      onEntries([payload.entry, ...entries]);
      setTitle("");
      setContent("");
    } catch {
      setError("Could not add the fact.");
    } finally {
      setBusy("");
    }
  }

  async function setGapStatus(id: string, status: "answered" | "ignored") {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/app/knowledge/unanswered/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { question?: EngineUnanswered; error?: string };
      if (!response.ok || !payload.question) {
        setError(payload.error || "Could not update that question.");
        return;
      }
      onUnanswered(unanswered.map((row) => (row.id === id ? payload.question! : row)));
    } catch {
      setError("Could not update that question.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid min-w-0 gap-3">
        <div>
          <h2 className={SECTION_HEADING_CLASS}>Unanswered questions</h2>
          <p className={HELPER_TEXT_CLASS}>
            When website chat cannot answer from published knowledge, the question lands here. Add
            a fact, then mark it answered. BizPilot does not invent the missing answer.
          </p>
        </div>
        {openGaps.length === 0 ? (
          <EmptyState
            icon={MessageCircleQuestion}
            title="No unanswered questions"
            description="This list stays empty until a real visitor asks something that is not in Knowledge."
          />
        ) : (
          <ul className="grid min-w-0 gap-2">
            {openGaps.map((row) => (
              <li key={row.id} className="min-w-0 rounded-lg border bg-card p-3">
                <p className="text-sm font-medium">{row.question}</p>
                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === row.id}
                    onClick={() => void setGapStatus(row.id, "answered")}
                  >
                    Mark answered
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === row.id}
                    onClick={() => void setGapStatus(row.id, "ignored")}
                  >
                    Ignore
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid min-w-0 gap-3">
        <div>
          <h2 className={SECTION_HEADING_CLASS}>Approved facts</h2>
          <p className={HELPER_TEXT_CLASS}>
            Search and disable facts without deleting them. Disabled facts are hidden from website
            chat. Structured fields still edit in the Edit tab.
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search facts"
            aria-label="Search facts"
          />
          <select
            className="h-11 min-h-11 rounded-md border bg-background px-3 text-sm"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            aria-label="Filter facts"
          >
            <option value="all">All kinds</option>
            <option value="extra">Owner extras</option>
            <option value="disabled">Disabled</option>
            {Object.entries(KNOWLEDGE_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title="No matching facts"
            description={
              entries.length === 0
                ? "Save the knowledge form once to project published fields into this list."
                : "Nothing matches this search. Clear the filter or add an extra fact below."
            }
          />
        ) : (
          <ul className="grid min-w-0 gap-2">
            {visible.map((row) => (
              <li key={row.id} className="min-w-0 rounded-lg border bg-card p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{row.title}</p>
                      <Badge variant="secondary">{KNOWLEDGE_KIND_LABEL[row.kind]}</Badge>
                      {isExtraKnowledgeEntry(row) ? <Badge variant="outline">Extra</Badge> : null}
                    </div>
                    <p className={`mt-1 line-clamp-3 ${HELPER_TEXT_CLASS}`}>{row.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.sourceLabel || "Approved business knowledge"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <label className={`${LABEL_CLASS} flex items-center gap-2`}>
                      <span className="text-xs">{row.enabled ? "On" : "Off"}</span>
                      <Switch
                        checked={row.enabled}
                        disabled={busy === row.id}
                        onCheckedChange={(checked) => void patchEntry(row.id, { enabled: checked })}
                        aria-label={`Publish ${row.title}`}
                      />
                    </label>
                    {isExtraKnowledgeEntry(row) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === row.id}
                        onClick={() => void removeEntry(row.id)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid min-w-0 gap-3 rounded-lg border bg-card p-4">
        <div>
          <h2 className={SECTION_HEADING_CLASS}>Add a fact</h2>
          <p className={HELPER_TEXT_CLASS}>
            Extra facts are not part of the structured form. Chat can use them when they are on.
            They never invent prices or inventory.
          </p>
        </div>
        <Field label="Kind">
          <select
            className="h-11 min-h-11 w-full rounded-md border bg-background px-3 text-sm"
            value={extraKind}
            onChange={(event) => setExtraKind(event.target.value as KnowledgeKind)}
          >
            {EXTRA_FACT_KINDS.map((value) => (
              <option key={value} value={value}>
                {KNOWLEDGE_KIND_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Content">
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} />
        </Field>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full min-w-0 sm:w-auto" disabled={busy === "add"} onClick={() => void addFact()}>
          <Plus className="size-4" aria-hidden />
          Add fact
        </Button>
      </section>
    </div>
  );
}
