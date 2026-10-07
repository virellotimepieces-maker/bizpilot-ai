"use client";

import { Button } from "@/components/ui/button";
import { INDUSTRY_DEMO_LABEL, industryDemoByPresetId } from "@/lib/industry-demos";
import { generateReply } from "@/lib/reply-engine";
import { useWorkspace } from "@/lib/workspace-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export function IndustryDemoPanel() {
  const { knowledge, presetId, resetChat, sendVisitorMessage } = useWorkspace();
  const router = useRouter();
  const demo = industryDemoByPresetId(presetId);

  const replies = useMemo(() => {
    if (!demo || !knowledge) return null;
    return {
      known: generateReply({ query: demo.knownQuestion, kb: knowledge, channel: "chat" }),
      refusal: generateReply({ query: demo.refusalQuestion, kb: knowledge, channel: "chat" }),
    };
  }, [demo, knowledge]);

  if (!demo || !knowledge || !replies) return null;

  function openInChat() {
    resetChat();
    sendVisitorMessage(demo!.knownQuestion);
    sendVisitorMessage(demo!.refusalQuestion);
    router.push("/demo/chat");
  }

  return (
    <section className="grid min-w-0 gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
          {demo.audience}
        </p>
        <h2 className="font-heading mt-2 text-xl tracking-tight">Sample conversation</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {INDUSTRY_DEMO_LABEL} Answers below come from this browser demo and the sample knowledge
          for {knowledge.name}. They do not call a paid AI model.
        </p>
      </div>

      <DemoTurn label="Visitor" text={demo.knownQuestion} />
      <DemoTurn label="Bizlyro, from published sample facts" text={replies.known.body} />
      <DemoTurn label="Visitor asks for something that was not published" text={demo.refusalQuestion} />
      <DemoTurn label="Bizlyro refuses to invent it" text={replies.refusal.body} />

      <div className="min-w-0 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
          Owner view — sample lead
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is the lead a business owner would review. It stays in this preview. It is not written
          to the paid Leads desk.
        </p>
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium break-words">{demo.lead.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{demo.lead.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Request</dt>
            <dd className="leading-relaxed">{demo.lead.request}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Left for the owner</dt>
            <dd className="leading-relaxed">{demo.lead.withheld}</dd>
          </div>
        </dl>
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        <Button type="button" onClick={openInChat}>
          Try this sample in website chat
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={demo.landingPath} />}>
          Industry page
        </Button>
      </div>
    </section>
  );
}

function DemoTurn({ label, text }: { label: string; text: string }) {
  return (
    <article className="min-w-0 rounded-xl border bg-background p-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    </article>
  );
}
