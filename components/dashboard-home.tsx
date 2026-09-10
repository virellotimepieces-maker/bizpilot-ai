"use client";

import { PresetGallery } from "@/components/preset-gallery";
import { SetupGate } from "@/components/setup-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { knowledgeCoverage } from "@/lib/completeness";
import { BUSINESS_TYPE_LABEL } from "@/lib/labels";
import { useWorkspace } from "@/lib/workspace-store";
import { BookOpen, Inbox, MessageSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function DashboardHome() {
  return (
    <SetupGate
      title="A support desk for any kind of business"
      description="Teach ReplyPilot who you are — products or services, prices, hours, policies, and when a human must take over. Website chat and email drafts share that knowledge. Neither one is a store plugin."
    >
      <LoadedDashboard />
    </SetupGate>
  );
}

function LoadedDashboard() {
  const { knowledge, emails, chats, resetWorkspace } = useWorkspace();
  if (!knowledge) return null;

  const coverage = knowledgeCoverage(knowledge);
  const pending = emails.filter((e) => e.status === "draft_ready" || e.status === "escalated" || e.status === "needs_review");
  const waiting = chats.filter((c) => c.waitingOnHuman).length;
  const auto = chats.flatMap((c) => c.messages).filter((m) => m.autoAnswered).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            {BUSINESS_TYPE_LABEL[knowledge.businessType]}
          </p>
          <h1 className="font-heading mt-2 text-3xl tracking-tight sm:text-4xl">
            {knowledge.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {knowledge.tagline || knowledge.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/knowledge" />}>
            Edit knowledge
          </Button>
          <Button variant="ghost" onClick={resetWorkspace}>
            Switch business
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Knowledge coverage"
          value={`${coverage.percent}%`}
          hint="Shared by chat and email"
        />
        <Stat
          label="Email drafts waiting"
          value={String(pending.length)}
          hint="Nothing sends without approval"
        />
        <Stat
          label="Chat answers from the KB"
          value={String(auto)}
          hint={waiting ? `${waiting} handed to a human` : "Safe questions only"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Same knowledge, two channels</CardTitle>
            <CardDescription>
              Website chat may reply on its own when the answer is already published. Email support
              writes an editable draft and stops until someone on your team sends it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
            <ChannelCard
              href="/chat"
              icon={MessageSquare}
              title="Website chat"
              body="Answers hours, prices, and public FAQs from the knowledge base. Emergencies show the safety line, then a human is flagged."
            />
            <ChannelCard
              href="/inbox"
              icon={Inbox}
              title="Email drafts"
              body="Every inbound email gets a draft grounded in the same articles. Approve, edit, or escalate — never auto-send."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Knowledge checklist</CardTitle>
            <CardDescription>Fill these once. Both channels read them live.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 pt-4">
            {coverage.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{item.label}</span>
                <Badge variant={item.filled ? "secondary" : "outline"}>
                  {item.filled ? "Ready" : "Missing"}
                </Badge>
              </div>
            ))}
            <Button className="mt-2" render={<Link href="/knowledge" />}>
              <BookOpen className="size-4" />
              Open knowledge base
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <CardTitle>What this is not</CardTitle>
          </div>
          <CardDescription>
            ReplyPilot is not a Shopify app, a stock system, or a clinic EHR. Store-only fields such
            as shipping, inventory, and cash on delivery appear only if you choose the online-store
            type.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <PresetGallery heading="Try another sample business" compact />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-heading text-3xl">{value}</CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
    </Card>
  );
}

function ChannelCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: typeof MessageSquare;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-muted/40 p-3 transition hover:border-primary/30 hover:bg-muted"
    >
      <div className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Link>
  );
}
