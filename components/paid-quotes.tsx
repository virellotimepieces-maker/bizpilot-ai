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
import { QUOTE_REQUEST_STATUSES, type QuoteRequestStatus } from "@/lib/v2/enums";
import {
  QUOTE_REQUEST_HINT,
  QUOTE_SENT_HINT,
  QUOTE_STATUS_LABEL,
  quoteDisplayName,
  type SerializedQuoteRequest,
} from "@/lib/v2/quotes";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function statusVariant(status: QuoteRequestStatus): "default" | "secondary" | "outline" {
  if (status === "requested") return "default";
  if (status === "in_review") return "secondary";
  return "outline";
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function PaidQuotes({ embedded = false }: { embedded?: boolean }) {
  const [quotes, setQuotes] = useState<SerializedQuoteRequest[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"all" | QuoteRequestStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    const response = await fetch(`/api/app/quotes${params}`);
    const payload = (await response.json()) as { quotes?: SerializedQuoteRequest[]; error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not load quote requests.");
      setQuotes((current) => current ?? []);
      return;
    }
    setError("");
    setQuotes(payload.quotes ?? []);
  }, [status]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const selected = useMemo(
    () => quotes?.find((row) => row.id === selectedId) ?? null,
    [quotes, selectedId],
  );

  const visible = useMemo(() => {
    const rows = quotes ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.customerName}\n${row.email}\n${row.phone}\n${row.productService}\n${row.requirements}\n${row.notes}`
        .toLowerCase()
        .includes(needle),
    );
  }, [quotes, query]);

  async function patchQuote(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/app/quotes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { quote?: SerializedQuoteRequest; error?: string };
      if (!response.ok || !payload.quote) {
        setError(payload.error || "Could not update the quote request.");
        return;
      }
      setQuotes((current) =>
        (current ?? []).map((row) => (row.id === payload.quote!.id ? payload.quote! : row)),
      );
      if (payload.quote.id === selectedId) setNotes(payload.quote.notes);
    } catch {
      setError("Could not update the quote request.");
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <>
      {embedded ? null : (
        <PageHeader eyebrow="Sales" title="Quote requests" description={QUOTE_REQUEST_HINT} />
      )}
      {quotes === null ? (
        <div aria-busy="true" aria-label="Loading quote requests" className="grid gap-3">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <p className={HELPER_TEXT_CLASS}>
            {quotes.length === 0
              ? "No quote requests stored yet."
              : `${quotes.filter((row) => row.status === "requested" || row.status === "in_review").length} to review · ${quotes.length} total`}
          </p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Search" className="min-w-0 flex-1" htmlFor="quote-query">
              <Input
                id="quote-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, or request"
              />
            </Field>
            <Field label="Status" className="sm:w-48">
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as "all" | QuoteRequestStatus)}
              >
                <SelectTrigger className="h-11 min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {QUOTE_REQUEST_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {QUOTE_STATUS_LABEL[item]}
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
              icon={ClipboardList}
              title={quotes.length === 0 ? "No quote requests stored yet" : "No quote requests match that filter"}
              description={
                quotes.length === 0
                  ? "When a visitor asks for a quote or estimate in the website widget, a request appears here. BizPilot will not invent prices or issue a quote."
                  : "Try a different status or search. Matching uses stored names, emails, and the visitor’s request only."
              }
              action={
                quotes.length === 0 ? (
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
                        <p className="min-w-0 font-medium [overflow-wrap:anywhere]">
                          {quoteDisplayName(row)}
                        </p>
                        <Badge variant={statusVariant(row.status)}>{QUOTE_STATUS_LABEL[row.status]}</Badge>
                      </div>
                      <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>
                        {row.productService || row.requirements || "No product named — visitor request only"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visitor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
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
                          <p className="font-medium">{quoteDisplayName(row)}</p>
                          <p className={HELPER_TEXT_CLASS}>{row.email || "No email stored"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(row.status)}>{QUOTE_STATUS_LABEL[row.status]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs [overflow-wrap:anywhere]">
                          {row.productService || row.requirements || "Visitor request"}
                        </TableCell>
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
                    <SheetTitle>{quoteDisplayName(selected)}</SheetTitle>
                    <SheetDescription>{QUOTE_REQUEST_HINT}</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 px-4 pb-6">
                    <p className={HELPER_TEXT_CLASS}>
                      {selected.email || "No email"}
                      {selected.phone ? ` · ${selected.phone}` : ""}
                    </p>
                    {selected.productService ? (
                      <div>
                        <p className={LABEL_CLASS}>Named in the request</p>
                        <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>{selected.productService}</p>
                      </div>
                    ) : null}
                    {selected.requirements ? (
                      <div>
                        <p className={LABEL_CLASS}>Visitor request</p>
                        <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>{selected.requirements}</p>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{QUOTE_SENT_HINT}</p>
                    <Field label="Status">
                      <Select
                        value={selected.status}
                        onValueChange={(value) => void patchQuote(selected.id, { status: value })}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-11 min-h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUOTE_REQUEST_STATUSES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {QUOTE_STATUS_LABEL[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      label="Owner notes"
                      hint="Private to this workspace. Not a quote and not shown in the widget."
                      htmlFor="quote-notes"
                    >
                      <Textarea
                        id="quote-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={4}
                      />
                    </Field>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        disabled={busy || notes === selected.notes}
                        onClick={() => void patchQuote(selected.id, { notes })}
                      >
                        Save notes
                      </Button>
                      {selected.conversationId ? (
                        <Button variant="outline" render={<Link href="/app/inbox" />}>
                          Open inbox
                        </Button>
                      ) : null}
                      {selected.leadId ? (
                        <Button variant="outline" render={<Link href="/app/leads" />}>
                          Open contact
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  );

  if (embedded) return body;
  return <div className={PAGE_SHELL_CLASS}>{body}</div>;
}
