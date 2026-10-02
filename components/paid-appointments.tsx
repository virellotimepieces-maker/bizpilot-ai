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
import { APPOINTMENT_REQUEST_STATUSES, type AppointmentRequestStatus } from "@/lib/v2/enums";
import {
  APPOINTMENT_DECLINED_HINT,
  APPOINTMENT_REQUEST_HINT,
  APPOINTMENT_STATUS_LABEL,
  appointmentDisplayName,
  type SerializedAppointmentRequest,
} from "@/lib/v2/appointments";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function statusVariant(status: AppointmentRequestStatus): "default" | "secondary" | "outline" {
  if (status === "requested") return "default";
  if (status === "in_review") return "secondary";
  return "outline";
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function PaidAppointments({ embedded = false }: { embedded?: boolean }) {
  const [appointments, setAppointments] = useState<SerializedAppointmentRequest[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"all" | AppointmentRequestStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    const response = await fetch(`/api/app/appointments${params}`);
    const payload = (await response.json()) as {
      appointments?: SerializedAppointmentRequest[];
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error || "Could not load appointment requests.");
      setAppointments((current) => current ?? []);
      return;
    }
    setError("");
    setAppointments(payload.appointments ?? []);
  }, [status]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const selected = useMemo(
    () => appointments?.find((row) => row.id === selectedId) ?? null,
    [appointments, selectedId],
  );

  const visible = useMemo(() => {
    const rows = appointments ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.customerName}\n${row.email}\n${row.phone}\n${row.requestedService}\n${row.preferredAt}\n${row.notes}`
        .toLowerCase()
        .includes(needle),
    );
  }, [appointments, query]);

  async function patchAppointment(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/app/appointments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        appointment?: SerializedAppointmentRequest;
        error?: string;
      };
      if (!response.ok || !payload.appointment) {
        setError(payload.error || "Could not update the appointment request.");
        return;
      }
      setAppointments((current) =>
        (current ?? []).map((row) =>
          row.id === payload.appointment!.id ? payload.appointment! : row,
        ),
      );
      if (payload.appointment.id === selectedId) setNotes(payload.appointment.notes);
    } catch {
      setError("Could not update the appointment request.");
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <>
      {embedded ? null : (
        <PageHeader eyebrow="Sales" title="Appointment requests" description={APPOINTMENT_REQUEST_HINT} />
      )}
      {appointments === null ? (
        <div aria-busy="true" aria-label="Loading appointment requests" className="grid gap-3">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <p className={HELPER_TEXT_CLASS}>
            {appointments.length === 0
              ? "No appointment requests stored yet."
              : `${appointments.filter((row) => row.status === "requested" || row.status === "in_review").length} to review · ${appointments.length} total`}
          </p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Search" className="min-w-0 flex-1" htmlFor="appointment-query">
              <Input
                id="appointment-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, or request"
              />
            </Field>
            <Field label="Status" className="sm:w-48">
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as "all" | AppointmentRequestStatus)}
              >
                <SelectTrigger className="h-11 min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {APPOINTMENT_REQUEST_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {APPOINTMENT_STATUS_LABEL[item]}
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
              icon={CalendarClock}
              title={
                appointments.length === 0
                  ? "No appointment requests stored yet"
                  : "No appointment requests match that filter"
              }
              description={
                appointments.length === 0
                  ? "When a visitor asks to book a visit in the website widget, a request appears here. BizPilot will not confirm a booking or write to a calendar."
                  : "Try a different status or search. Matching uses stored names, emails, and the visitor’s request only."
              }
              action={
                appointments.length === 0 ? (
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
                          {appointmentDisplayName(row)}
                        </p>
                        <Badge variant={statusVariant(row.status)}>
                          {APPOINTMENT_STATUS_LABEL[row.status]}
                        </Badge>
                      </div>
                      <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>
                        {row.requestedService || row.preferredAt || "Visitor request only"}
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
                      <TableHead>Preferred time</TableHead>
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
                          <p className="font-medium">{appointmentDisplayName(row)}</p>
                          <p className={HELPER_TEXT_CLASS}>{row.email || "No email stored"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(row.status)}>
                            {APPOINTMENT_STATUS_LABEL[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs [overflow-wrap:anywhere]">
                          {row.requestedService || "Visitor request"}
                        </TableCell>
                        <TableCell>{row.preferredAt || "Not specified"}</TableCell>
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
                    <SheetTitle>{appointmentDisplayName(selected)}</SheetTitle>
                    <SheetDescription>{APPOINTMENT_REQUEST_HINT}</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 px-4 pb-6">
                    <p className={HELPER_TEXT_CLASS}>
                      {selected.email || "No email"}
                      {selected.phone ? ` · ${selected.phone}` : ""}
                    </p>
                    {selected.requestedService ? (
                      <div>
                        <p className={LABEL_CLASS}>Visitor request</p>
                        <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>{selected.requestedService}</p>
                      </div>
                    ) : null}
                    {selected.preferredAt ? (
                      <div>
                        <p className={LABEL_CLASS}>Preferred time (visitor’s words)</p>
                        <p className={`mt-1 ${HELPER_TEXT_CLASS}`}>{selected.preferredAt}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stored as the visitor typed it. Not a calendar slot.
                        </p>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{APPOINTMENT_DECLINED_HINT}</p>
                    <Field label="Status">
                      <Select
                        value={selected.status}
                        onValueChange={(value) => void patchAppointment(selected.id, { status: value })}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-11 min-h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPOINTMENT_REQUEST_STATUSES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {APPOINTMENT_STATUS_LABEL[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      label="Owner notes"
                      hint="Private to this workspace. Not a booking confirmation and not shown in the widget."
                      htmlFor="appointment-notes"
                    >
                      <Textarea
                        id="appointment-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={4}
                      />
                    </Field>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        disabled={busy || notes === selected.notes}
                        onClick={() => void patchAppointment(selected.id, { notes })}
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
