import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BizPilot AI",
  description: "How BizPilot AI stores account, knowledge, and conversation data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Legal</p>
        <h1 className="font-heading mt-2 text-4xl tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated 12 September 2026.</p>
        <div className="mt-8 grid gap-6 text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-xl">What this product stores</h2>
            <p className="mt-2 text-muted-foreground">
              BizPilot AI is a paid customer-support desk for one business workspace. If you create
              an account we store your name, email, password hash, workspace knowledge, website
              widget conversations, email drafts, and social drafts. Demo mode at /demo stays in
              your browser and is not this account.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Payments</h2>
            <p className="mt-2 text-muted-foreground">
              Card details are processed by Stripe. We store subscription status, Stripe customer
              and subscription identifiers, and the monthly AI-reply usage count. We do not store
              full card numbers.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Website chat</h2>
            <p className="mt-2 text-muted-foreground">
              The installed widget sends visitor questions to this workspace only. Paid AI replies
              are generated with OpenAI using that workspace’s published knowledge and indexed
              public pages. Workspaces are isolated: another subscriber cannot read your
              conversations, knowledge, or drafts.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Email and social drafts</h2>
            <p className="mt-2 text-muted-foreground">
              Inbound messages you paste here stay in your workspace as drafts. BizPilot does not
              send email and does not post to Instagram, Facebook, TikTok, or Messenger. There is
              no live connection to those networks.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Cookies</h2>
            <p className="mt-2 text-muted-foreground">
              A signed-in session cookie keeps you logged in. The website widget stores a visitor
              key in session storage on the customer’s browser so the same chat can continue.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl">Access and deletion</h2>
            <p className="mt-2 text-muted-foreground">
              You can change your password while signed in on Account. There is no automated
              password-reset email. To review or delete workspace data, sign in and use the
              dashboard, or email the address on your account from that same mailbox. Cancelling
              BizPilot Pro stops new AI replies; stored knowledge and conversations remain until
              you ask us to delete the workspace.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
