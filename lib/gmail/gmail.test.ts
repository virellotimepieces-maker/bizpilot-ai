import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MemoryBillingStore } from "../billing/memory-store";
import { BillingError } from "../billing/types";
import { emptyKnowledge } from "../empty-knowledge";
import { jsonError } from "../http";
import { GMAIL_SCOPES, gmailCallbackUrl, googleAuthUrl } from "./config";
import { ensureGmailReplyDraft } from "./drafts";
import { refreshGoogleAccessToken } from "./google";
import { buildReplyRfc822, gmailSendPayload } from "./mime";
import { htmlToText, parseFromHeader, summarizeGmailMessage } from "./parse";
import { publicGmailStatus } from "./public";
import { assertCanSendDraft, assertSendConfirmed } from "./send";
import { decryptSecret, encryptSecret } from "./token-crypto";

describe("Gmail OAuth config", () => {
  it("requests only read, send, openid, and email scopes", () => {
    const url = googleAuthUrl({
      clientId: "test-client.apps.googleusercontent.com",
      redirectUri: gmailCallbackUrl("https://bizpilot.example"),
      state: "signed-state",
    });
    assert.equal(gmailCallbackUrl("https://bizpilot.example/"), "https://bizpilot.example/api/app/gmail/callback");
    assert.match(url, /access_type=offline/);
    assert.match(url, /prompt=consent/);
    assert.doesNotMatch(url, /client_secret/);
    assert.doesNotMatch(url, /gmail\.modify/);
    assert.doesNotMatch(url, /gmail\.compose/);
    assert.deepEqual([...GMAIL_SCOPES], [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ]);
    for (const scope of GMAIL_SCOPES) {
      assert.ok(url.includes(encodeURIComponent(scope)));
    }
  });
});

describe("Gmail token encryption", () => {
  it("round-trips a secret and never stores plaintext", () => {
    process.env.AUTH_SECRET = "test-auth-secret-value-32chars!!";
    const plain = "refresh-token-value";
    const encrypted = encryptSecret(plain);
    assert.notEqual(encrypted, plain);
    assert.doesNotMatch(encrypted, /refresh-token-value/);
    assert.equal(decryptSecret(encrypted), plain);
    assert.notEqual(encryptSecret(plain), encrypted);
  });
});

describe("Gmail parse and MIME", () => {
  it("reads sender, unread, and plain body from Gmail payloads", () => {
    const parsed = summarizeGmailMessage(
      {
        id: "m1",
        threadId: "t1",
        snippet: "When are you open?",
        labelIds: ["INBOX", "UNREAD"],
        internalDate: "1694500000000",
        payload: {
          headers: [
            { name: "From", value: `"Pat Lee" <pat@example.com>` },
            { name: "Subject", value: "Hours" },
            { name: "Date", value: "Thu, 12 Sep 2024 12:00:00 +0000" },
            { name: "Message-ID", value: "<abc@mail.gmail.com>" },
          ],
          parts: [
            {
              mimeType: "text/plain",
              body: { data: Buffer.from("When are you open on Monday?", "utf8").toString("base64url") },
            },
          ],
        },
      },
      true,
    );
    assert.equal(parsed.fromName, "Pat Lee");
    assert.equal(parsed.fromEmail, "pat@example.com");
    assert.equal(parsed.unread, true);
    assert.equal(parsed.body, "When are you open on Monday?");
    assert.equal(parsed.rfcMessageId, "<abc@mail.gmail.com>");
    assert.deepEqual(parseFromHeader("pat@example.com"), {
      name: "pat@example.com",
      email: "pat@example.com",
    });
    assert.match(htmlToText("<p>Hello&nbsp;<b>there</b></p>"), /Hello there/);
  });

  it("reads an HTML-only no-subject email from nested multipart parts", () => {
    const parsed = summarizeGmailMessage(
      {
        id: "m2",
        threadId: "t2",
        snippet: "When are you open on Monday?",
        payload: {
          mimeType: "multipart/alternative",
          headers: [
            { name: "From", value: "BOFOWO <bofowo@example.com>" },
            { name: "Subject", value: "" },
          ],
          parts: [
            {
              mimeType: "text/plain",
              body: { data: Buffer.from(" \n", "utf8").toString("base64url") },
            },
            {
              mimeType: "text/html",
              body: {
                data: Buffer.from(
                  "<div dir=\"auto\">When are you open on Monday?</div>",
                  "utf8",
                ).toString("base64url"),
              },
            },
          ],
        },
      },
      true,
    );
    assert.equal(parsed.subject, "(no subject)");
    assert.match(parsed.body, /When are you open on Monday\?/);
  });

  it("builds a threaded Gmail send payload", () => {
    const rfc = buildReplyRfc822({
      fromEmail: "owner@gmail.com",
      toEmail: "pat@example.com",
      subject: "Re: Hours",
      body: "Nine to five.",
      inReplyTo: "<abc@mail.gmail.com>",
    });
    assert.match(rfc, /In-Reply-To: <abc@mail.gmail.com>/);
    assert.match(rfc, /References: <abc@mail.gmail.com>/);
    assert.match(rfc, /To: pat@example.com/);
    const payload = gmailSendPayload({
      fromEmail: "owner@gmail.com",
      toEmail: "pat@example.com",
      subject: "Re: Hours",
      body: "Nine to five.",
      threadId: "thread-1",
      inReplyTo: "<abc@mail.gmail.com>",
    });
    assert.equal(payload.threadId, "thread-1");
    assert.doesNotMatch(payload.raw, /Nine to five/);
    assert.ok(payload.raw.length > 20);
  });
});

describe("Gmail send guards", () => {
  it("requires explicit confirm and blocks duplicate sends", () => {
    assert.throws(() => assertSendConfirmed(undefined), BillingError);
    assert.throws(() => assertSendConfirmed(false), BillingError);
    assert.doesNotThrow(() => assertSendConfirmed(true));
    assert.throws(() => assertCanSendDraft({ status: "sent" }), (error: unknown) => {
      return error instanceof BillingError && error.code === "conflict";
    });
    assert.throws(
      () => assertCanSendDraft({ status: "draft", sendLockAt: new Date() }),
      (error: unknown) => error instanceof BillingError && error.code === "conflict",
    );
  });
});

describe("Gmail Google errors", () => {
  it("maps a revoked refresh token without echoing Google bodies", async () => {
    await assert.rejects(
      () =>
        refreshGoogleAccessToken(
          {
            refreshToken: "stored-refresh",
            clientId: "client",
            clientSecret: "secret",
          },
          async () =>
            new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }), {
              status: 400,
            }),
        ),
      (error: unknown) =>
        error instanceof BillingError &&
        error.code === "reconnect" &&
        !error.message.includes("invalid_grant") &&
        !error.message.includes("stored-refresh"),
    );
  });
});

describe("Gmail drafts and isolation", () => {
  it("creates a knowledge draft once, then refuses a second send claim", async () => {
    const store = new MemoryBillingStore();
    const user = await store.createUser({
      email: "owner@example.com",
      passwordHash: "hash",
      name: "Owner",
    });
    const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor Clinic" });
    await store.saveKnowledge(workspace.id, {
      ...emptyKnowledge("custom"),
      name: "Harbor Clinic",
      description: "Walk-in family practice.",
    });
    const first = await ensureGmailReplyDraft(store, workspace, {
      gmailMessageId: "gm-1",
      gmailThreadId: "th-1",
      rfcMessageId: "<one@mail.gmail.com>",
      fromName: "Pat",
      fromEmail: "pat@example.com",
      subject: "Hours",
      body: "When are you open on Monday?",
    });
    assert.equal(first.status, "draft");
    assert.notEqual(first.draftBody.trim(), "");
    assert.match(first.draftSubject, /^Re:/);
    const second = await ensureGmailReplyDraft(store, workspace, {
      gmailMessageId: "gm-1",
      gmailThreadId: "th-1",
      fromName: "Pat",
      fromEmail: "pat@example.com",
      subject: "Hours",
      body: "When are you open on Monday?",
    });
    assert.equal(second.draftBody, first.draftBody);
    await store.claimGmailReplySend(workspace.id, "gm-1");
    await assert.rejects(() => store.claimGmailReplySend(workspace.id, "gm-1"));
    await store.updateGmailReplyDraft(workspace.id, "gm-1", { status: "sent", sendLockAt: null });
    await assert.rejects(() => store.claimGmailReplySend(workspace.id, "gm-1"));
  });

  it("never puts token fields on the public Gmail status payload", () => {
    const payload = publicGmailStatus({
      id: "c1",
      workspaceId: "w1",
      googleEmail: "owner@gmail.com",
      googleSub: "sub",
      encryptedRefreshToken: "ciphertext-refresh",
      encryptedAccessToken: "ciphertext-access",
      accessTokenExpiresAt: new Date(),
      scopes: "gmail.readonly",
      status: "connected",
      connectedAt: new Date(),
      updatedAt: new Date(),
    });
    const raw = JSON.stringify(payload);
    assert.equal(payload.connected, true);
    assert.equal(payload.googleEmail, "owner@gmail.com");
    assert.doesNotMatch(raw, /encrypted/);
    assert.doesNotMatch(raw, /refresh_token/);
    assert.doesNotMatch(raw, /access_token/);
    assert.doesNotMatch(raw, /ciphertext/);
  });
});

describe("Gmail HTTP and browser sources", () => {
  it("redacts credential-like error messages", async () => {
    const response = jsonError(
      new Error("refresh_token=1//abcdEFGH and access_token=ya29.secret"),
      "Could not send the Gmail reply.",
    );
    const body = (await response.json()) as { error?: string };
    const raw = JSON.stringify(body);
    assert.equal(body.error, "Could not send the Gmail reply.");
    assert.doesNotMatch(raw, /ya29/);
    assert.doesNotMatch(raw, /refresh_token/);
  });

  it("keeps Google secrets out of the Email UI and browser sources", () => {
    const files = [
      "components/paid-email-inbox.tsx",
      "components/email-inbox.tsx",
      "app/app/email/page.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /GOOGLE_CLIENT_SECRET/);
      assert.doesNotMatch(source, /GOOGLE_CLIENT_ID/);
      assert.doesNotMatch(source, /refresh_token/);
      assert.doesNotMatch(source, /access_token/);
      assert.doesNotMatch(source, /AUTH_SECRET/);
      assert.doesNotMatch(source, /encryptedRefreshToken/);
      assert.doesNotMatch(source, /ya29\./);
    }
    const paid = readFileSync("components/paid-email-inbox.tsx", "utf8");
    assert.match(paid, /Connect Gmail/);
    assert.match(paid, /Refresh Inbox/);
    assert.match(paid, /Disconnect Gmail/);
    assert.match(paid, /Add email manually/);
    assert.match(paid, /Send reply/);
    assert.match(paid, /Regenerate reply/);
    assert.match(paid, /confirm: true/);
    assert.doesNotMatch(paid, /Paste a received email/);
  });

  it("wires the paid Email tab to the Gmail inbox, not the legacy paste form", () => {
    const page = readFileSync("app/app/email/page.tsx", "utf8");
    const shell = readFileSync("components/paid-app-shell.tsx", "utf8");
    const paid = readFileSync("components/paid-email-inbox.tsx", "utf8");
    assert.match(page, /PaidEmailInbox/);
    assert.doesNotMatch(page, /from "@\/components\/email-inbox"/);
    assert.match(shell, /href: "\/app\/email"/);
    assert.match(paid, /fetch\("\/api\/app\/gmail"\)/);
    assert.match(paid, /\/api\/app\/gmail\/connect/);
    assert.match(paid, /\/api\/app\/gmail\/messages/);
    assert.match(paid, /\/api\/app\/gmail\/messages\/\$\{encodeURIComponent\(detail\.id\)\}\/send/);
    assert.match(paid, /Add email manually/);
    assert.doesNotMatch(paid, /Drafts you send yourself/);
    assert.doesNotMatch(paid, /Paste a received email/);
    assert.doesNotMatch(paid, /There is no SMTP connection/);
    assert.doesNotMatch(page, /Drafts you send yourself/);
    assert.doesNotMatch(page, /Paste a received email/);
  });
});
