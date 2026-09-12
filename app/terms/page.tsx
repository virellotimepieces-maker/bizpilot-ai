import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — BizPilot AI",
  description: "BizPilot Pro subscription, usage limits, and human-in-the-loop drafts.",
};

export default function TermsPage() {
  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Legal</p>
        <h1 className="font-heading mt-2 text-4xl tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated 12 September 2026.</p>
        <div className="mt-8 grid gap-6 text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-xl">The product</h2>
            <p className="mt-2 text-muted-foreground">
              BizPilot Pro is USD $29 per month for one business workspace, one website widget, and
              500 AI-generated customer replies per Stripe billing month. When the allowance is
              used, AI replies pause and visitors are offered a human. There are no automatic
              overage charges. Cancel anytime in Billing.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">What the AI may do</h2>
            <p className="mt-2 text-muted-foreground">
              Website chat may answer from your published knowledge and indexed public pages. It
              must not invent prices, policies, or capabilities. It is not a doctor or a lawyer.
              You are responsible for the knowledge you publish and for any reply a teammate sends
              from Inbox.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Drafts and Gmail send</h2>
            <p className="mt-2 text-muted-foreground">
              Suggested email replies are never sent automatically. If you connect Gmail, a reply
              goes out through that Gmail account only after you press Send reply and confirm.
              Social drafts are never posted by BizPilot. There is no Meta or TikTok connection.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Demo versus paid</h2>
            <p className="mt-2 text-muted-foreground">
              /demo is a browser-only preview. It is not a customer workspace, does not take
              payment, and does not call an AI model. Paid features require an active BizPilot Pro
              subscription.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Acceptable use</h2>
            <p className="mt-2 text-muted-foreground">
              Do not use the widget or drafts to harass visitors, collect data you are not entitled
              to, impersonate another business, or publish unlawful content. We may suspend a
              workspace that breaks these terms or that we cannot bill.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Accounts</h2>
            <p className="mt-2 text-muted-foreground">
              Keep your password confidential. Change it on Account while signed in. There is no
              automated reset email. One account maps to one workspace in this version of the
              product.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
