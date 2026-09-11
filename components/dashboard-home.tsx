"use client";

import { PresetGallery } from "@/components/preset-gallery";
import { SetupGate } from "@/components/setup-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { knowledgeCoverage } from "@/lib/completeness";
import { BUSINESS_TYPE_LABEL } from "@/lib/labels";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS, PAGE_TITLE_CLASS, SECTION_HEADING_CLASS } from "@/lib/ui/type-scale";
import { useWorkspace } from "@/lib/workspace-store";
import { BookOpen, Inbox, MessageSquare, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function DashboardHome() {
  return (
    <SetupGate
      title="A support desk for any kind of business"
      description="Teach BizPilot who you are — products or services, prices, hours, policies, and when a human must take over. Website chat, email drafts, and social drafts share that knowledge. Neither one is a store plugin."
    >
      <LoadedDashboard />
    </SetupGate>
  );
}

function LoadedDashboard() {
  const {
    knowledge,
    emails,
    socials,
    chats,
    resetWorkspace,
  } = useWorkspace();
  if (!knowledge) return null;

  const coverage = knowledgeCoverage(knowledge);
  const pending = emails.filter((e) => e.status === "draft_ready" || e.status === "escalated" || e.status === "needs_review");
  const pendingSocial = socials.filter(
    (row) => row.status === "draft_ready" || row.status === "escalated" || row.status === "needs_review",
  );
  const waiting = chats.filter((c) => c.waitingOnHuman).length;
  const auto = chats.flatMap((c) => c.messages).filter((m) => m.autoAnswered).length;

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            {BUSINESS_TYPE_LABEL[knowledge.businessType]}
          </p>
          <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>
            {knowledge.name}
          </h1>
          <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS}`}>
            {knowledge.tagline || knowledge.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/demo/knowledge" />}>
            Edit knowledge
          </Button>
          <Button variant="ghost" onClick={resetWorkspace}>
            Switch business
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Knowledge coverage"
          value={`${coverage.percent}%`}
          hint="Shared by chat, email, and social"
        />
        <Stat
          label="Email drafts waiting"
          value={String(pending.length)}
          hint="Nothing sends without approval"
        />
        <Stat
          label="Social drafts waiting"
          value={String(pendingSocial.length)}
          hint="Nothing posts without you"
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
            <CardTitle>Same knowledge, three channels</CardTitle>
            <CardDescription>
              Website chat may reply on its own when the answer is already published. Email and
              social write an editable draft and stop until someone on your team sends or posts it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
            <ChannelCard
              href="/demo/chat"
              icon={MessageSquare}
              title="Website chat"
              body="Answers hours, prices, and public FAQs from the knowledge base. Emergencies show the safety line, then a human is flagged."
            />
            <ChannelCard
              href="/demo/inbox"
              icon={Inbox}
              title="Email drafts"
              body="Every inbound email gets a draft grounded in the same articles. Approve, edit, or escalate — never auto-send."
            />
            <ChannelCard
              href="/demo/social"
              icon={Share2}
              title="Social drafts"
              body="Paste an Instagram, Facebook, TikTok, or Messenger message. Copy the draft and post it yourself — BizPilot never posts."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Knowledge checklist</CardTitle>
            <CardDescription>Fill these once. Chat, email, and social drafts read them live.</CardDescription>
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
            <Button className="mt-2" render={<Link href="/demo/knowledge" />}>
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
            BizPilot is not a Shopify app, a stock system, or a clinic EHR. Store-only fields such
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
        <CardTitle className={SECTION_HEADING_CLASS}>{value}</CardTitle>
        <p className={HELPER_TEXT_CLASS}>{hint}</p>
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
