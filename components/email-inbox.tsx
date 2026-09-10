"use client";

import { Field } from "@/components/field";
import { SetupGate } from "@/components/setup-gate";
import { SourcePills } from "@/components/source-pills";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { INTENT_LABEL } from "@/lib/intent-labels";
import type { EmailMessage, EmailStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { MailPlus, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<EmailStatus, string> = {
  draft_ready: "Draft ready",
  needs_review: "Needs review",
  escalated: "Escalated",
  sent: "Sent",
  discarded: "Discarded",
};

export function EmailInbox() {
  return (
    <SetupGate
      title="Email support, with humans in the loop"
      description="Every inbound message becomes an editable draft from the same knowledge base as website chat. BizPilot never sends the email for you."
    >
      <InboxBody />
    </SetupGate>
  );
}

function InboxBody() {
  const {
    knowledge,
    emails,
    updateEmail,
    setEmailStatus,
    regenerateDraft,
    simulateIncomingEmail,
  } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(emails[0]?.id ?? null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [incoming, setIncoming] = useState({
    fromName: "",
    fromEmail: "",
    subject: "",
    body: "",
  });

  const selected = useMemo(
    () => emails.find((email) => email.id === selectedId) ?? emails[0] ?? null,
    [emails, selectedId],
  );

  if (!knowledge) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Email support
          </p>
          <h1 className="font-heading mt-2 text-3xl tracking-tight">Drafts that wait for you</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {knowledge.name} email is grounded in the shared knowledge base. Approve, edit, or
            escalate. There is no auto-send switch on this channel.
          </p>
        </div>
        <Button variant="outline" onClick={() => setComposeOpen(true)}>
          <MailPlus className="size-4" />
          Simulate inbound email
        </Button>
      </div>

      <Alert>
        <ShieldAlert />
        <AlertTitle>Human approval required</AlertTitle>
        <AlertDescription>
          Website chat may answer safe questions on its own. Email cannot. Sending from this inbox
          is a demo of the approval step — nothing leaves this browser.
        </AlertDescription>
      </Alert>

      {emails.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="font-heading text-xl">No mail yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Load a sample business on Overview, or simulate an inbound email to watch a draft appear
            from the current knowledge base.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-medium">Inbox</div>
            <div className="max-h-[70vh] overflow-y-auto">
              {emails.map((email) => (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => setSelectedId(email.id)}
                  className={`block w-full border-b px-4 py-3 text-left last:border-b-0 ${
                    selected?.id === email.id ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{email.fromName}</p>
                    <StatusBadge status={email.status} />
                  </div>
                  <p className="mt-1 truncate text-sm">{email.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{email.receivedAt}</p>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <EmailDetail
              email={selected}
              onDraftChange={(draftBody) => updateEmail(selected.id, { draftBody })}
              onSubjectChange={(draftSubject) => updateEmail(selected.id, { draftSubject })}
              onRegenerate={() => {
                regenerateDraft(selected.id);
                toast.success("Draft regenerated from the current knowledge base");
              }}
              onApprove={() => {
                setEmailStatus(selected.id, "sent");
                toast.success("Marked as sent after human approval");
              }}
              onEscalate={() => {
                setEmailStatus(selected.id, "escalated");
                toast.message("Kept in the human queue");
              }}
              onDiscard={() => {
                setEmailStatus(selected.id, "discarded");
                toast.message("Draft discarded");
              }}
            />
          ) : null}
        </div>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Simulate an inbound email</DialogTitle>
            <DialogDescription>
              BizPilot will write a draft from the current knowledge base. It still will not send.
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
              onClick={() => {
                if (!incoming.subject.trim() || !incoming.body.trim()) {
                  toast.error("Subject and message are required");
                  return;
                }
                simulateIncomingEmail({
                  fromName: incoming.fromName || "New customer",
                  fromEmail: incoming.fromEmail || "customer@example.com",
                  subject: incoming.subject,
                  body: incoming.body,
                });
                setComposeOpen(false);
                setIncoming({ fromName: "", fromEmail: "", subject: "", body: "" });
                toast.success("Draft created — waiting for approval");
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

function StatusBadge({ status }: { status: EmailStatus }) {
  const variant =
    status === "sent"
      ? "secondary"
      : status === "escalated" || status === "needs_review"
        ? "destructive"
        : status === "discarded"
          ? "outline"
          : "default";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

function EmailDetail({
  email,
  onDraftChange,
  onSubjectChange,
  onRegenerate,
  onApprove,
  onEscalate,
  onDiscard,
}: {
  email: EmailMessage;
  onDraftChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onEscalate: () => void;
  onDiscard: () => void;
}) {
  const locked = email.status === "sent" || email.status === "discarded";

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{email.fromName}</p>
            <p className="text-xs text-muted-foreground">{email.fromEmail}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={email.status} />
            <Badge variant="outline">{INTENT_LABEL[email.intent]}</Badge>
          </div>
        </div>
        <h2 className="mt-3 font-heading text-xl">{email.subject}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{email.receivedAt}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{email.body}</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading text-lg">Editable draft</h3>
            <p className="text-sm text-muted-foreground">{email.operatorNote}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={locked}>
            <RefreshCw className="size-4" />
            Regenerate from knowledge
          </Button>
        </div>
        <div className="mt-3">
          <SourcePills sources={email.sources} />
        </div>
        {email.usedInternalKnowledge ? (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            This draft touched an internal document. Website chat would not have auto-answered from
            that note.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3">
          <Field label="Subject">
            <Input
              value={email.draftSubject}
              disabled={locked}
              onChange={(e) => onSubjectChange(e.target.value)}
            />
          </Field>
          <Field label="Reply">
            <Textarea
              value={email.draftBody}
              disabled={locked}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={12}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onApprove} disabled={locked}>
            <Send className="size-4" />
            Approve and send
          </Button>
          <Button variant="outline" onClick={onEscalate} disabled={locked}>
            Keep with a human
          </Button>
          <Button variant="ghost" onClick={onDiscard} disabled={locked}>
            Discard draft
          </Button>
        </div>
      </div>
    </div>
  );
}
