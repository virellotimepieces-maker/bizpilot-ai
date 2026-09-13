import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  gmailRedirectUrl,
  operatorSetup,
  publicLiveStatusPayload,
  storeLiveStatus,
  stripeWebhookUrl,
  STRIPE_WEBHOOK_EVENTS,
} from "./operator-setup";

const complete = {
  DATABASE_URL: "postgres://bizpilot",
  AUTH_SECRET: "x".repeat(32),
  APP_URL: "https://www.mybizpilotai.com",
  STRIPE_SECRET_KEY: "sk_live_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_ID: "price_example",
  OPENAI_API_KEY: "sk-example",
  GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-secret",
};

describe("operator setup checklist", () => {
  it("keeps subscribers locked until foundation, Stripe, and OpenAI are set", () => {
    const blank = operatorSetup({});
    assert.equal(blank.readyForSubscribers, false);
    assert.deepEqual(
      blank.items.map((item) => [item.key, item.required, item.done]),
      [
        ["foundation", true, false],
        ["stripe", true, false],
        ["openai", true, false],
        ["gmail", false, false],
      ],
    );
    assert.deepEqual(blank.items.find((item) => item.key === "stripe")?.missing, [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_ID",
    ]);
  });

  it("treats Gmail as optional and ready only with OAuth plus APP_URL and AUTH_SECRET", () => {
    const withoutGmail = operatorSetup({
      ...complete,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    });
    assert.equal(withoutGmail.readyForSubscribers, true);
    assert.equal(withoutGmail.items.find((item) => item.key === "gmail")?.done, false);

    const withGmail = operatorSetup(complete);
    assert.equal(withGmail.readyForSubscribers, true);
    assert.equal(withGmail.readyForLiveCustomers, true);
    assert.equal(withGmail.stripeMode, "live");
    assert.equal(withGmail.items.every((item) => item.done), true);
  });

  it("treats Stripe Test keys as not live", () => {
    const testMode = operatorSetup({ ...complete, STRIPE_SECRET_KEY: "sk_test_example" });
    assert.equal(testMode.stripeMode, "test");
    assert.equal(testMode.readyForSubscribers, true);
    assert.equal(testMode.readyForLiveCustomers, false);
    assert.match(testMode.items.find((item) => item.key === "stripe")?.hint ?? "", /Test mode/);
  });

  it("lists missing variable names without returning secret values", () => {
    const partial = operatorSetup({ STRIPE_SECRET_KEY: "sk_live_should_not_leak" });
    assert.deepEqual(partial.items.find((item) => item.key === "stripe")?.missing, [
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_ID",
    ]);
    const json = JSON.stringify(operatorSetup(complete));
    assert.doesNotMatch(
      `${JSON.stringify(partial)}${json}`,
      /sk_live_should_not_leak|sk_live_example|sk_test_example|whsec_example|sk-example|google-secret|postgres:\/\//,
    );
  });

  it("labels the store Live only when Live Stripe and required env are set", () => {
    assert.deepEqual(storeLiveStatus(operatorSetup(complete)), {
      kind: "live",
      label: "Live",
      detail: "This store is live. Checkout charges real cards.",
    });
    assert.equal(
      storeLiveStatus(operatorSetup({ ...complete, STRIPE_SECRET_KEY: "sk_test_example" })).kind,
      "test",
    );
    assert.equal(storeLiveStatus(operatorSetup({})).kind, "setup");
  });

  it("announces Live and open to subscribers without leaking keys", () => {
    const live = publicLiveStatusPayload(complete);
    assert.equal(live.openToSubscribers, true);
    assert.equal(live.label, "Live");
    assert.match(live.detail, /open to subscribers/);
    assert.doesNotMatch(JSON.stringify(live), /sk_live_example|whsec_example/);
    assert.equal(publicLiveStatusPayload({ ...complete, STRIPE_SECRET_KEY: "sk_test_example" }).openToSubscribers, false);
  });

  it("builds the production webhook and Gmail redirect URLs from APP_URL", () => {
    assert.equal(
      stripeWebhookUrl("https://www.mybizpilotai.com/"),
      "https://www.mybizpilotai.com/api/stripe/webhook",
    );
    assert.equal(
      gmailRedirectUrl("https://www.mybizpilotai.com"),
      "https://www.mybizpilotai.com/api/app/gmail/callback",
    );
    assert.deepEqual([...STRIPE_WEBHOOK_EVENTS], [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ]);
  });

  it("documents the production webhook and Gmail redirect for the operator", () => {
    const docs = readFileSync(new URL("../docs/operator-setup.md", import.meta.url), "utf8");
    assert.match(docs, /https:\/\/www\.mybizpilotai\.com\/api\/stripe\/webhook/);
    assert.match(docs, /https:\/\/www\.mybizpilotai\.com\/api\/app\/gmail\/callback/);
    assert.match(docs, /Live mode/);
  });

  it("does not expose secret names or values from the public live-status route", () => {
    const source = readFileSync(new URL("../app/api/public/live-status/route.ts", import.meta.url), "utf8");
    assert.match(source, /publicLiveStatusPayload/);
    assert.doesNotMatch(source, /STRIPE_SECRET_KEY|sk_live_|whsec_/);
  });
});
