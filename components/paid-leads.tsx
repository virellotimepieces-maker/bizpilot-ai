"use client";

import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { HELPER_TEXT_CLASS, LABEL_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import {
  CUSTOMER_INTENT_LABEL,
  LEAD_STATUS_LABEL,
  leadDisplayName,
  type SerializedLead,
} from "@/lib/v2/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/v2/enums";
import { UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function statusVariant(status: LeadStatus): "default" | "secondary" | "outline" {
  if (status === "new") return "default";
  if (status === "qualified" || status === "follow_up") return "secondary";
  return "outline";
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function PaidLeads() {
  const [leads, setLeads] = useState<SerializedLead[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"all" | LeadStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    const response = await fetch(`/api/app/leads${params}`);
    const payload = (await response.json()) as { leads?: SerializedLead[]; error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not load leads.");
      setLeads((current) => current ?? []);
      return;
    }
    setError("");
    setLeads(payload.leads ?? []);
  }, [status]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const selected = useMemo(
    () => leads?.find((row) => row.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const visible = useMemo(() => {
    const rows = leads ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.name}\n${row.email}\n${row.phone}\n${row.interest}\n${row.request}\n${row.notes}`
        .toLowerCase()
        .includes(needle),
    );
  }, [leads, query]);

  async function patchLead(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/app/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { lead?: SerializedLead; error?: string };
      if (!response.ok || !payload.lead) {
        setError(payload.error || "Could not update the lead.");
        return;
      }
      setLeads((current) =>
        (current ?? []).map((row) => (row.id === payload.lead!.id ? payload.lead! : row)),
      );
      if (payload.lead.id === selectedId) setNotes(payload.lead.notes);
    } catch {
      setError("Could not update the lead.");
    } finally {
      setBusy(false);
    }
  }

  if (leads === null) {
    return (
      <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading leads">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader
        eyebrow="Sales"
        title="Leads"
        description="Contacts captured from the website widget. Status is owner-marked — converted is not a Stripe payment or a calendar booking."
      />
      <p className={HELPER_TEXT_CLASS}>
        {leads.length === 0
          ? "No leads stored yet."
          : `${leads.filter((row) => row.status === "new").length} new · ${leads.filter((row) => row.status === "qualified").length} qualified · ${leads.length} total`}
      </p>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Search" className="min-w-0 flex-1" htmlFor="lead-query">
          <Input
            id="lead-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, or note"
          />
        </Field>
        <Field label="Status" className="sm:w-48">
          <Select value={status} onValueChange={(value) => setStatus(value as "all" | LeadStatus)}>
            <SelectTrigger className="h-11 min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LEAD_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {LEAD_STATUS_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={UserRoundPlus}
          title={leads.length === 0 ? "No leads stored yet" : "No leads match that filter"}
          description={
            leads.length === 0
              ? "This list stays empty until a visitor leaves a real name or email on the website widget. BizPilot will not invent contacts or conversion counts."
              : "Try a different status or search. Matching uses stored names, emails, and notes only."
          }
          action={
            leads.length === 0 ? (
              <Button size="sm" variant="outline" render={<Link href="/app/widget" />}>
                Open widget
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {visible.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full min-w-0 rounded-lg border bg-card px-3 py-3 text-left"
                  onClick={() => {
                    setSelectedId(row.id);
                    setNotes(row.notes);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{leadDisplayName(row)}</p>
                    <Badge variant={statusVariant(row.status)}>{LEAD_STATUS_LABEL[row.status]}</Badge>
                  </div>
                  <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>{row.email || "No email stored"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.source} · {CUSTOMER_INTENT_LABEL[row.intent]}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Captured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(row.id);
                      setNotes(row.notes);
                    }}
                  >
                    <TableCell>
                      <p className="font-medium">{leadDisplayName(row)}</p>
                      <p className={HELPER_TEXT_CLASS}>{row.email || "No email stored"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{LEAD_STATUS_LABEL[row.status]}</Badge>
                    </TableCell>
                    <TableCell>{CUSTOMER_INTENT_LABEL[row.intent]}</TableCell>
                    <TableCell className="capitalize">{row.source}</TableCell>
                    <TableCell>{formatWhen(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{leadDisplayName(selected)}</SheetTitle>
                <SheetDescription>
                          Stored from the website widget. Changing status here does not charge a card or
                          book a calendar slot.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <p className={HELPER_TEXT_CLASS}>
                  {selected.email || "No email"}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {CUSTOMER_INTENT_LABEL[selected.intent]} · {selected.source} ·{" "}
                  {formatWhen(selected.createdAt)}
                </p>
                {selected.request ? (
                  <div>
                    <p className={LABEL_CLASS}>Visitor request</p>
                    <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>{selected.request}</p>
                  </div>
                ) : null}
                {selected.interest ? (
                  <div>
                    <p className={LABEL_CLASS}>Interest</p>
                    <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>{selected.interest}</p>
                  </div>
                ) : null}
                <Field label="Status">
                  <Select
                    value={selected.status}
                    onValueChange={(value) => void patchLead(selected.id, { status: value })}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-11 min-h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {LEAD_STATUS_LABEL[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Owner notes" hint="Private to this workspace. Not shown in the widget." htmlFor="lead-notes">
                  <Textarea
                    id="lead-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                  />
                </Field>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    disabled={busy || notes === selected.notes}
                    onClick={() => void patchLead(selected.id, { notes })}
                  >
                    Save notes
                  </Button>
                  {selected.conversationId ? (
                    <Button variant="outline" render={<Link href="/app/inbox" />}>
                      Open inbox
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
