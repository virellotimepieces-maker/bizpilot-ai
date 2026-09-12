"use client";

import { Field } from "@/components/field";
import { SourcePills } from "@/components/source-pills";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_STATUS_LABEL } from "@/lib/email-draft";
import {
  GMAIL_ACTION_BUTTON_CLASS,
  GMAIL_ACTION_ROW_CLASS,
  GMAIL_BODY_CLASS,
  GMAIL_CARD_CLASS,
  GMAIL_CONTENT_BOX_CLASS,
  GMAIL_FIELD_CONTROL_CLASS,
  GMAIL_PAGE_TITLE_CLASS,
  GMAIL_PANE_GRID_CLASS,
  GMAIL_SUBJECT_CLASS,
  GMAIL_TOOLBAR_CLASS,
  GMAIL_WRAP_INLINE_CLASS,
  GMAIL_WRAP_TEXT_CLASS,
} from "@/lib/gmail/email-layout";
import { INTENT_LABEL } from "@/lib/intent-labels";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import type { EmailStatus, ReplySource } from "@/lib/types";
import { Copy, Link2Off, MailPlus, Pencil, RefreshCw, ShieldAlert, Unplug } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type GmailStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect: boolean;
  googleEmail: string | null;
};

type GmailListItem = {
  id: string;
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  replyStatus?: "sent" | "none";
};

type GmailDraft = {
  draftSubject: string;
  draftBody: string;
  intent: keyof typeof INTENT_LABEL;
  sources: ReplySource[] | null;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  status: "draft" | "sent" | string;
  sentAt: string | null;
};

type GmailDetail = GmailListItem & {
  body: string;
  rfcMessageId: string | null;
  draft: GmailDraft;
};

type PaidEmailMessage = {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  draftSubject: string;
  draftBody: string;
  intent: keyof typeof INTENT_LABEL;
  sources: ReplySource[] | null;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  createdAt: string;
};

function formatMailDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function PaidEmailInbox() {
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [inbox, setInbox] = useState<GmailListItem[]>([]);
  const [detail, setDetail] = useState<GmailDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [gmailError, setGmailError] = useState("");
  const [sentBanner, setSentBanner] = useState(false);
  const [manual, setManual] = useState<PaidEmailMessage[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [incoming, setIncoming] = useState({
    fromName: "",
    fromEmail: "",
    subject: "",
    body: "",
  });
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null);

  const loadManual = useCallback(async () => {
    const response = await fetch("/api/app/email");
    const payload = (await response.json()) as { messages?: PaidEmailMessage[]; error?: string };
    if (response.ok) {
      setManual(payload.messages ?? []);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/app/gmail");
    const payload = (await response.json()) as GmailStatus & { error?: string; code?: string };
    if (!response.ok) {
      setGmailError(payload.error || "Could not load Gmail status.");
      return null;
    }
    setGmailError("");
    setGmail(payload);
    return payload;
  }, []);

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    setGmailError("");
    const response = await fetch("/api/app/gmail/messages");
    const payload = (await response.json()) as {
      messages?: GmailListItem[];
      error?: string;
      code?: string;
    };
    setInboxLoading(false);
    if (!response.ok) {
      setInbox([]);
      setGmailError(payload.error || "Could not load Gmail messages.");
      if (payload.code === "reconnect") {
        setGmail((prev) => (prev ? { ...prev, connected: false, needsReconnect: true } : prev));
      }
      return;
    }
    setInbox(payload.messages ?? []);
  }, []);

  const openMessage = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setEditing(false);
    setSentBanner(false);
    const response = await fetch(`/api/app/gmail/messages/${encodeURIComponent(id)}`);
    const payload = (await response.json()) as {
      message?: GmailDetail;
      error?: string;
      code?: string;
    };
    setDetailLoading(false);
    if (!response.ok) {
      toast.error(payload.error || "Could not open this email.");
      if (payload.code === "reconnect") {
        setGmail((prev) => (prev ? { ...prev, connected: false, needsReconnect: true } : prev));
      }
      return;
    }
    if (payload.message) {
      setDetail(payload.message);
      setSentBanner(payload.message.draft.status === "sent");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadManual();
      const status = await loadStatus();
      if (status?.connected) {
        await loadInbox();
      }
    })();
  }, [loadInbox, loadManual, loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("gmail");
    if (!flag) return;
    if (flag === "connected") toast.success("Gmail connected");
    else if (flag === "denied") toast.error("Gmail access was not granted");
    else if (flag === "misconfigured") toast.error("Gmail is not configured on this server");
    else if (flag === "signin") toast.error("Sign in to connect Gmail");
    else toast.error("Could not connect Gmail");
    window.history.replaceState({}, "", "/app/email");
  }, []);

  const selectedManual = useMemo(
    () => manual.find((row) => row.id === manualSelectedId) ?? manual[0] ?? null,
    [manual, manualSelectedId],
  );

  async function patchManual(
    id: string,
    body: { draftBody?: string; draftSubject?: string; status?: EmailStatus; regenerate?: boolean },
  ) {
    const response = await fetch("/api/app/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const payload = (await response.json()) as { message?: PaidEmailMessage; error?: string };
    if (!response.ok) {
      toast.error(payload.error || "Could not update the draft");
      return;
    }
    if (payload.message) {
      setManual((prev) => prev.map((row) => (row.id === payload.message!.id ? payload.message! : row)));
    }
    if (body.regenerate) toast.success("Draft regenerated from the current knowledge base");
    if (body.status === "sent") toast.success("Marked as sent by you — this did not send through Gmail");
  }

  async function patchGmail(
    id: string,
    body: { draftBody?: string; draftSubject?: string; regenerate?: boolean },
  ) {
    const response = await fetch(`/api/app/gmail/messages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { message?: GmailDetail; error?: string };
    if (!response.ok) {
      toast.error(payload.error || "Could not update the suggested reply");
      return;
    }
    if (payload.message) {
      setDetail(payload.message);
      setInbox((prev) =>
        prev.map((row) =>
          row.id === payload.message!.id
            ? { ...row, replyStatus: payload.message!.draft.status === "sent" ? "sent" : row.replyStatus }
            : row,
        ),
      );
    }
    if (body.regenerate) {
      setEditing(false);
      toast.success("Reply regenerated from Knowledge");
    }
  }

  async function sendGmail() {
    if (!detail) return;
    setSending(true);
    const response = await fetch(`/api/app/gmail/messages/${encodeURIComponent(detail.id)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    const payload = (await response.json()) as {
      message?: GmailDetail;
      error?: string;
      code?: string;
    };
    setSending(false);
    setConfirmSend(false);
    if (!response.ok) {
      toast.error(payload.error || "Could not send the reply");
      if (payload.code === "reconnect") {
        setGmail((prev) => (prev ? { ...prev, connected: false, needsReconnect: true } : prev));
      }
      return;
    }
    if (payload.message) {
      setDetail(payload.message);
      setInbox((prev) =>
        prev.map((row) =>
          row.id === payload.message!.id ? { ...row, replyStatus: "sent" } : row,
        ),
      );
    }
    setSentBanner(true);
    setEditing(false);
    toast.success("Reply sent successfully");
  }

  async function disconnectGmail() {
    const response = await fetch("/api/app/gmail", { method: "DELETE" });
    const payload = (await response.json()) as GmailStatus & { error?: string };
    if (!response.ok) {
      toast.error(payload.error || "Could not disconnect Gmail");
      return;
    }
    setGmail(payload);
    setInbox([]);
    setDetail(null);
    setSelectedId(null);
    setSentBanner(false);
    toast.success("Gmail disconnected");
  }

  const connected = Boolean(gmail?.connected);
  const sent = detail?.draft.status === "sent";

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="flex min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-full">
          <p className="text-[10px] font-medium tracking-[0.16em] text-primary uppercase sm:text-xs sm:tracking-[0.2em]">
            Email support
          </p>
          <h1 className={GMAIL_PAGE_TITLE_CLASS}>Gmail inbox</h1>
          <p className={`mt-2 max-w-full text-xs leading-relaxed text-muted-foreground sm:max-w-2xl sm:text-sm md:text-base`}>
            Connect Gmail to read received mail and generate a suggested reply from Knowledge. Replies
            send only after you confirm. They never go out on their own.
          </p>
        </div>
        <div className={GMAIL_TOOLBAR_CLASS}>
          {connected ? (
            <>
              <Button
                variant="outline"
                className={GMAIL_ACTION_BUTTON_CLASS}
                onClick={() => void loadInbox()}
                disabled={inboxLoading}
              >
                <RefreshCw className="size-4" />
                Refresh Inbox
              </Button>
              <Button
                variant="outline"
                className={GMAIL_ACTION_BUTTON_CLASS}
                onClick={() => void disconnectGmail()}
              >
                <Unplug className="size-4" />
                Disconnect Gmail
              </Button>
            </>
          ) : gmail?.configured === false ? (
            <Button disabled className={GMAIL_ACTION_BUTTON_CLASS}>
              Connect Gmail
            </Button>
          ) : (
            <Button className={GMAIL_ACTION_BUTTON_CLASS} render={<a href="/api/app/gmail/connect" />}>
              Connect Gmail
            </Button>
          )}
        </div>
      </div>

      {gmail?.googleEmail ? (
        <p className={`${HELPER_TEXT_CLASS} ${GMAIL_WRAP_INLINE_CLASS}`}>
          {connected ? "Connected as" : "Last connected as"} {gmail.googleEmail}
        </p>
      ) : null}

      <Alert className={GMAIL_CONTENT_BOX_CLASS}>
        <ShieldAlert />
        <AlertTitle>Human send required</AlertTitle>
        <AlertDescription className={GMAIL_WRAP_INLINE_CLASS}>
          Opening a message writes a suggested reply from Knowledge. BizPilot will not send it until
          you press Send reply and confirm.
        </AlertDescription>
      </Alert>

      {gmail?.configured === false ? (
        <Alert className={GMAIL_CONTENT_BOX_CLASS}>
          <Link2Off />
          <AlertTitle>Gmail is not configured</AlertTitle>
          <AlertDescription className={GMAIL_WRAP_INLINE_CLASS}>
            Add Google OAuth credentials on the server, then Connect Gmail will appear. Manual email
            drafts still work below.
          </AlertDescription>
        </Alert>
      ) : null}

      {gmail?.needsReconnect ? (
        <Alert className={GMAIL_CONTENT_BOX_CLASS}>
          <ShieldAlert />
          <AlertTitle>Reconnect Gmail</AlertTitle>
          <AlertDescription className={GMAIL_WRAP_INLINE_CLASS}>
            Access was revoked or expired. Connect Gmail again to load the inbox. Nothing is sent
            while disconnected.
          </AlertDescription>
        </Alert>
      ) : null}

      {gmailError ? <p className="text-sm text-destructive md:text-base">{gmailError}</p> : null}

      {!gmail && !gmailError ? <p className={HELPER_TEXT_CLASS}>Loading Gmail status…</p> : null}

      {connected ? (
        inboxLoading && inbox.length === 0 ? (
          <p className={HELPER_TEXT_CLASS}>Loading Gmail messages…</p>
        ) : inbox.length === 0 ? (
          <div className={`${GMAIL_CARD_CLASS} p-6 text-center sm:p-8`}>
            <p className="font-heading text-lg sm:text-xl">Inbox is empty</p>
            <p className={`mx-auto mt-2 max-w-md ${HELPER_TEXT_CLASS}`}>
              Refresh after new mail arrives in this Gmail account.
            </p>
          </div>
        ) : (
          <div className={GMAIL_PANE_GRID_CLASS}>
            <div className={`${GMAIL_CONTENT_BOX_CLASS} rounded-2xl border bg-card shadow-sm`}>
              <div className="border-b px-3 py-2.5 text-sm font-medium sm:px-4 sm:py-3">Inbox</div>
              <div className="max-h-[70vh] overflow-x-hidden overflow-y-auto">
                {inbox.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => void openMessage(row.id)}
                    className={`block w-full min-w-0 max-w-full border-b px-3 py-2.5 text-left last:border-b-0 sm:px-4 sm:py-3 ${
                      selectedId === row.id ? "bg-muted/70" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex min-w-0 max-w-full items-start justify-between gap-2">
                      <p
                        className={`min-w-0 flex-1 truncate text-sm ${row.unread ? "font-semibold" : "font-medium"}`}
                      >
                        {row.fromName}
                      </p>
                      <div className="flex min-w-0 flex-wrap justify-end gap-1">
                        {row.unread ? <Badge>Unread</Badge> : <Badge variant="outline">Read</Badge>}
                        {row.replyStatus === "sent" ? <Badge variant="secondary">Replied</Badge> : null}
                      </div>
                    </div>
                    <p className={`mt-1 truncate text-sm ${row.unread ? "font-medium" : ""}`}>
                      {row.subject}
                    </p>
                    {row.snippet ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{row.snippet}</p>
                    ) : null}
                    <p className="mt-1 truncate text-xs text-muted-foreground">{formatMailDate(row.date)}</p>
                  </button>
                ))}
              </div>
            </div>
            {detailLoading && !detail ? (
              <p className={HELPER_TEXT_CLASS}>Loading message and suggested reply…</p>
            ) : detail ? (
              <div className={`${GMAIL_CONTENT_BOX_CLASS} grid gap-3 sm:gap-4`}>
                {sentBanner ? (
                  <Alert className={GMAIL_CONTENT_BOX_CLASS}>
                    <AlertTitle>Reply sent successfully</AlertTitle>
                    <AlertDescription className={GMAIL_WRAP_INLINE_CLASS}>
                      The reply was sent from {gmail?.googleEmail} in the original Gmail thread.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className={GMAIL_CARD_CLASS}>
                  <div className="flex min-w-0 max-w-full flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 max-w-full">
                      <p className={`text-sm font-medium ${GMAIL_WRAP_INLINE_CLASS}`}>{detail.fromName}</p>
                      <p className={`text-xs text-muted-foreground ${GMAIL_WRAP_INLINE_CLASS}`}>
                        {detail.fromEmail}
                      </p>
                    </div>
                    <div className="flex min-w-0 max-w-full flex-wrap gap-2">
                      {detail.unread ? <Badge>Unread</Badge> : <Badge variant="outline">Read</Badge>}
                      <Badge variant="outline">{formatMailDate(detail.date)}</Badge>
                    </div>
                  </div>
                  <h2 className={GMAIL_SUBJECT_CLASS}>{detail.subject}</h2>
                  <p className={GMAIL_BODY_CLASS}>{detail.body}</p>
                </div>
                <div className={GMAIL_CARD_CLASS}>
                  <div className="flex min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0 max-w-full">
                      <h3 className="font-heading text-base sm:text-lg">Suggested reply</h3>
                      <p className={`text-xs text-muted-foreground sm:text-sm ${GMAIL_WRAP_INLINE_CLASS}`}>
                        {detail.draft.operatorNote}
                      </p>
                    </div>
                    <Badge variant="outline" className="max-w-full whitespace-normal">
                      {INTENT_LABEL[detail.draft.intent] ?? detail.draft.intent}
                    </Badge>
                  </div>
                  <div className={`mt-3 ${GMAIL_CONTENT_BOX_CLASS}`}>
                    <SourcePills sources={detail.draft.sources ?? []} />
                  </div>
                  {detail.draft.usedInternalKnowledge ? (
                    <p className={`mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ${GMAIL_WRAP_INLINE_CLASS}`}>
                      This draft touched an internal document. Review before you send it.
                    </p>
                  ) : null}
                  <div className={`mt-4 grid gap-3 ${GMAIL_CONTENT_BOX_CLASS}`}>
                    <Field label="Subject" className={GMAIL_CONTENT_BOX_CLASS}>
                      <Input
                        className={GMAIL_FIELD_CONTROL_CLASS}
                        value={detail.draft.draftSubject}
                        disabled={sent || !editing}
                        onChange={(e) => {
                          const draftSubject = e.target.value;
                          setDetail((prev) =>
                            prev ? { ...prev, draft: { ...prev.draft, draftSubject } } : prev,
                          );
                        }}
                        onBlur={() =>
                          editing
                            ? void patchGmail(detail.id, { draftSubject: detail.draft.draftSubject })
                            : undefined
                        }
                      />
                    </Field>
                    <Field label="Reply" className={GMAIL_CONTENT_BOX_CLASS}>
                      <Textarea
                        className={`${GMAIL_FIELD_CONTROL_CLASS} ${GMAIL_WRAP_TEXT_CLASS} min-h-40 text-sm sm:min-h-64 sm:text-base`}
                        value={detail.draft.draftBody}
                        disabled={sent || !editing}
                        onChange={(e) => {
                          const draftBody = e.target.value;
                          setDetail((prev) =>
                            prev ? { ...prev, draft: { ...prev.draft, draftBody } } : prev,
                          );
                        }}
                        onBlur={() =>
                          editing
                            ? void patchGmail(detail.id, { draftBody: detail.draft.draftBody })
                            : undefined
                        }
                        rows={8}
                      />
                    </Field>
                  </div>
                  <div className={GMAIL_ACTION_ROW_CLASS}>
                    <Button
                      variant="outline"
                      className={GMAIL_ACTION_BUTTON_CLASS}
                      disabled={sent || detailLoading}
                      onClick={() => void patchGmail(detail.id, { regenerate: true })}
                    >
                      <RefreshCw className="size-4" />
                      Regenerate reply
                    </Button>
                    <Button
                      variant="outline"
                      className={GMAIL_ACTION_BUTTON_CLASS}
                      disabled={sent}
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="size-4" />
                      Edit reply
                    </Button>
                    <Button
                      variant="outline"
                      className={GMAIL_ACTION_BUTTON_CLASS}
                      onClick={async () => {
                        await navigator.clipboard.writeText(detail.draft.draftBody);
                        toast.success("Reply copied");
                      }}
                    >
                      <Copy className="size-4" />
                      Copy reply
                    </Button>
                    <Button
                      className={GMAIL_ACTION_BUTTON_CLASS}
                      disabled={sent || sending}
                      onClick={() => setConfirmSend(true)}
                    >
                      Send reply
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${GMAIL_CARD_CLASS} p-6 text-center sm:p-8`}>
                <p className="font-heading text-lg sm:text-xl">Select a message</p>
                <p className={`mx-auto mt-2 max-w-md ${HELPER_TEXT_CLASS}`}>
                  Opening an email generates a suggested reply from the current Knowledge section.
                </p>
              </div>
            )}
          </div>
        )
      ) : (
        <div className={`${GMAIL_CARD_CLASS} p-6 text-center sm:p-8`}>
          <p className="font-heading text-lg sm:text-xl">Connect Gmail to load received mail</p>
          <p className={`mx-auto mt-2 max-w-md ${HELPER_TEXT_CLASS}`}>
            After you authorize BizPilot, messages from this Gmail inbox appear here with sender,
            subject, and read status.
          </p>
        </div>
      )}

      <Accordion className={`${GMAIL_CONTENT_BOX_CLASS} rounded-2xl border bg-card px-3 sm:px-4`}>
        <AccordionItem value="manual">
          <AccordionTrigger>Add email manually</AccordionTrigger>
          <AccordionContent>
            <p className={HELPER_TEXT_CLASS}>
              Optional fallback if Gmail is unavailable. BizPilot still does not send these drafts
              unless you copy them yourself.
            </p>
            <div className="mt-3">
              <Button
                variant="outline"
                className={GMAIL_ACTION_BUTTON_CLASS}
                onClick={() => setManualOpen(true)}
              >
                <MailPlus className="size-4" />
                Add email manually
              </Button>
            </div>
            {manual.length ? (
              <div className={`mt-4 ${GMAIL_PANE_GRID_CLASS}`}>
                <div className={`${GMAIL_CONTENT_BOX_CLASS} rounded-xl border`}>
                  {manual.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setManualSelectedId(row.id)}
                      className={`block w-full min-w-0 max-w-full border-b px-3 py-2 text-left last:border-b-0 ${
                        selectedManual?.id === row.id ? "bg-muted/70" : "hover:bg-muted/40"
                      }`}
                    >
                      <p className="truncate text-sm font-medium">{row.fromName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.subject}</p>
                    </button>
                  ))}
                </div>
                {selectedManual ? (
                  <div className={`${GMAIL_CONTENT_BOX_CLASS} grid gap-3`}>
                    <p className={`text-sm ${GMAIL_WRAP_INLINE_CLASS}`}>
                      {selectedManual.fromName} &lt;{selectedManual.fromEmail}&gt;
                    </p>
                    <Badge variant="outline">{EMAIL_STATUS_LABEL[selectedManual.status]}</Badge>
                    <Textarea
                      className={`${GMAIL_FIELD_CONTROL_CLASS} ${GMAIL_WRAP_TEXT_CLASS} text-sm sm:text-base`}
                      value={selectedManual.draftBody}
                      disabled={
                        selectedManual.status === "sent" || selectedManual.status === "discarded"
                      }
                      onChange={(e) => {
                        const draftBody = e.target.value;
                        setManual((prev) =>
                          prev.map((row) =>
                            row.id === selectedManual.id ? { ...row, draftBody } : row,
                          ),
                        );
                      }}
                      onBlur={() =>
                        void patchManual(selectedManual.id, { draftBody: selectedManual.draftBody })
                      }
                      rows={8}
                    />
                    <div className={GMAIL_ACTION_ROW_CLASS}>
                      <Button
                        variant="outline"
                        className={GMAIL_ACTION_BUTTON_CLASS}
                        onClick={() => void patchManual(selectedManual.id, { regenerate: true })}
                      >
                        Regenerate reply
                      </Button>
                      <Button
                        variant="outline"
                        className={GMAIL_ACTION_BUTTON_CLASS}
                        onClick={async () => {
                          await navigator.clipboard.writeText(selectedManual.draftBody);
                          toast.success("Reply copied");
                        }}
                      >
                        Copy reply
                      </Button>
                      <Button
                        variant="outline"
                        className={GMAIL_ACTION_BUTTON_CLASS}
                        onClick={() => void patchManual(selectedManual.id, { status: "sent" })}
                      >
                        Mark as sent
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Send this reply?</DialogTitle>
            <DialogDescription className={GMAIL_WRAP_INLINE_CLASS}>
              This sends from {gmail?.googleEmail} to {detail?.fromEmail} and stays in the original
              Gmail conversation. It will not send unless you confirm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className={GMAIL_ACTION_BUTTON_CLASS}
              onClick={() => setConfirmSend(false)}
            >
              Cancel
            </Button>
            <Button className={GMAIL_ACTION_BUTTON_CLASS} disabled={sending} onClick={() => void sendGmail()}>
              {sending ? "Sending…" : "Confirm send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Add email manually</DialogTitle>
            <DialogDescription>
              Paste a received message to generate a Knowledge draft. This does not send mail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="From name">
              <Input
                value={incoming.fromName}
                onChange={(e) => setIncoming({ ...incoming, fromName: e.target.value })}
              />
            </Field>
            <Field label="From email">
              <Input
                type="email"
                value={incoming.fromEmail}
                onChange={(e) => setIncoming({ ...incoming, fromEmail: e.target.value })}
              />
            </Field>
            <Field label="Subject">
              <Input
                value={incoming.subject}
                onChange={(e) => setIncoming({ ...incoming, subject: e.target.value })}
              />
            </Field>
            <Field label="Message">
              <Textarea
                value={incoming.body}
                onChange={(e) => setIncoming({ ...incoming, body: e.target.value })}
                rows={5}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!incoming.body.trim() || !incoming.fromEmail.trim()) {
                  toast.error("Sender email and message are required");
                  return;
                }
                const response = await fetch("/api/app/email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fromName: incoming.fromName,
                    fromEmail: incoming.fromEmail,
                    subject: incoming.subject,
                    body: incoming.body,
                  }),
                });
                const payload = (await response.json()) as {
                  message?: PaidEmailMessage;
                  error?: string;
                };
                if (!response.ok) {
                  toast.error(payload.error || "Could not create a draft");
                  return;
                }
                if (payload.message) {
                  setManual((prev) => [payload.message!, ...prev]);
                  setManualSelectedId(payload.message.id);
                }
                setManualOpen(false);
                setIncoming({ fromName: "", fromEmail: "", subject: "", body: "" });
                toast.success("Manual draft created");
              }}
            >
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
