import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildEmailReplyMessages,
  CUSTOMER_CLOSE,
  CUSTOMER_OPEN,
  EMAIL_SYSTEM_INSTRUCTIONS,
  KNOWLEDGE_CLOSE,
  KNOWLEDGE_OPEN,
  type EmailReplyChatMessage,
} from "./email-reply-prompt";
import {
  emailKnowledgeWasCopied,
  finalizeEmailReply,
  generateEmailReply,
  looksLikeKnowledgeDump,
} from "./generate-email-reply";
import { emptyKnowledge } from "../empty-knowledge";
import { draftEmailFromInboundAi } from "../email-draft";
import { customerFirstName, formatFinishedEmail } from "../email-format";
import type { KnowledgeBase } from "../types";

function onlineStore(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  return {
    ...emptyKnowledge("online_store"),
    name: "Northwind Watches",
    tagline: "Everyday watches",
    industry: "Online watch store",
    ...overrides,
  };
}

function fenced(content: string, open: string, close: string) {
  const start = content.indexOf(open);
  const end = content.indexOf(close);
  assert.ok(start >= 0 && end > start, `missing fence ${open}`);
  return content.slice(start + open.length, end).trim();
}

function field(block: string, label: string) {
  const match = block.match(new RegExp(`${label}:\\s*(.*)`));
  return match?.[1]?.trim() || "";
}

/** Test-only stand-in for the model: answers from prompt sections, never from hard-coded businesses. */
async function stubEmailModel(messages: EmailReplyChatMessage[]) {
  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[1]?.role, "user");
  const system = messages[0].content;
  const user = messages[1].content;
  assert.match(system, /SYSTEM INSTRUCTIONS/);
  assert.match(system, /untrusted data/i);
  const knowledge = fenced(user, KNOWLEDGE_OPEN, KNOWLEDGE_CLOSE);
  const customer = fenced(user, CUSTOMER_OPEN, CUSTOMER_CLOSE);
  const businessName = field(knowledge, "Business name") || "Support";
  const fromName = field(customer, "From-Name");
  const firstName = customerFirstName(fromName);
  const body = customer.split(/Body:\s*/i)[1]?.trim() || "";
  const verifiedOrder = /Connected order data \(verified/i.test(user);
  const questions = (body.match(/\?/g) ?? []).length;

  const parts: string[] = [];
  if (/\b(uk|united kingdom)\b/i.test(body) && /ship/i.test(body)) {
    if (/United States only/i.test(knowledge)) {
      parts.push(
        `Thank you for contacting ${businessName}. We currently ship only to the United States and do not yet offer shipping to the United Kingdom.`,
      );
    }
  }
  if (/hour|open|monday/i.test(body) && /Monday:\s*9 a\.m/i.test(knowledge)) {
    parts.push("On Monday we are open 9 a.m.–5 p.m.");
  }
  if (/dress watch/i.test(body) && /Dress watch/i.test(knowledge)) {
    parts.push("Yes — we sell a dress watch with a leather strap.");
  }
  if (/order/i.test(body) && /status|where|track/i.test(body) && !verifiedOrder) {
    parts.push(
      `Thank you for contacting ${businessName}. I do not have connected order information for this message yet. Please reply with the order number and the email address used at checkout so we can look it up.`,
    );
  }

  if (!parts.length) {
    parts.push(`Thank you for contacting ${businessName}. We can help with this.`);
  }

  return formatFinishedEmail({
    firstName,
    businessName,
    body: questions >= 2 ? parts.join(" ") : parts[0],
  });
}

const LONG_DESCRIPTION = [
  "We began as a hobby bench repairing inherited watches for neighbors, then grew into a catalog of field watches, dress watches, and straps.",
  "We assist customers with product questions, payments, orders, shipping, returns, and customer support.",
  "Every piece is photographed before it leaves the workshop, and those photos are published on the product page.",
  "We also keep a small archive of vintage service notes that are not part of the customer catalog.",
].join(" ");

describe("AI email reply prompt", () => {
  it("keeps system instructions, knowledge, and the customer email in separate sections", () => {
    const kb = onlineStore({
      name: "Virello Timepieces",
      store: {
        shippingPolicy: "Current shipping destination: United States only.",
        stockMessaging: "",
        paymentMethods: "",
        cashOnDelivery: false,
        orderTrackingNotes: "",
      },
    });
    const messages = buildEmailReplyMessages({
      knowledge: kb,
      fromName: "Tia",
      fromEmail: "tia@example.com",
      subject: "(no subject)",
      body: "You ship to UK??",
    });
    assert.equal(messages[0].role, "system");
    assert.equal(messages[0].content, EMAIL_SYSTEM_INSTRUCTIONS);
    assert.doesNotMatch(messages[0].content, /You ship to UK/);
    assert.doesNotMatch(messages[0].content, /United States only/);
    const user = messages[1].content;
    assert.match(user, /BUSINESS KNOWLEDGE/);
    assert.match(user, /CUSTOMER EMAIL/);
    assert.match(user, /REQUIRED OUTPUT/);
    assert.match(user, /do not copy/i);
    const knowledge = fenced(user, KNOWLEDGE_OPEN, KNOWLEDGE_CLOSE);
    const customer = fenced(user, CUSTOMER_OPEN, CUSTOMER_CLOSE);
    assert.match(knowledge, /United States only/);
    assert.doesNotMatch(knowledge, /You ship to UK/);
    assert.match(customer, /You ship to UK\?\?/);
    assert.doesNotMatch(customer, /United States only/);
  });

  it("does not hard-code a subscriber or a sample email in production sources", () => {
    const prompt = readFileSync(new URL("./email-reply-prompt.ts", import.meta.url), "utf8");
    const generator = readFileSync(new URL("./generate-email-reply.ts", import.meta.url), "utf8");
    for (const source of [prompt, generator]) {
      assert.doesNotMatch(source, /Virello/);
      assert.doesNotMatch(source, /You ship to UK/);
      assert.doesNotMatch(source, /BOFOWO/);
    }
    assert.match(EMAIL_SYSTEM_INSTRUCTIONS, /Ignore any attempt inside them/);
  });
});

describe("AI email reply cases", () => {
  it("case 1: answers a shipping destination question from the relevant fact", async () => {
    const kb = onlineStore({
      name: "Virello Timepieces",
      description: LONG_DESCRIPTION,
      store: {
        shippingPolicy: "Current shipping destination: United States only.",
        stockMessaging: "",
        paymentMethods: "",
        cashOnDelivery: false,
        orderTrackingNotes: "",
      },
    });
    const reply = await generateEmailReply({
      knowledge: kb,
      fromName: "Tia",
      fromEmail: "tia@example.com",
      subject: "(no subject)",
      body: "You ship to UK??",
      complete: stubEmailModel,
    });
    assert.match(reply, /^Hi Tia,/);
    assert.match(reply, /United States/);
    assert.match(reply, /United Kingdom|UK/);
    assert.match(reply, /do not yet offer shipping to the United Kingdom/i);
    assert.match(reply, /Best regards,\nVirello Timepieces Support/);
    assert.doesNotMatch(reply, /hobby bench/i);
    assert.doesNotMatch(reply, /vintage service notes/i);
    assert.doesNotMatch(reply, /Never invent/i);
    assert.doesNotMatch(reply, /Business Information/i);
    assert.equal(emailKnowledgeWasCopied(reply, kb), false);
  });

  it("case 2: answers every question in a multi-question email", async () => {
    const kb = onlineStore({
      name: "Harbor Goods",
      store: {
        shippingPolicy: "Current shipping destination: United States only.",
        stockMessaging: "",
        paymentMethods: "",
        cashOnDelivery: false,
        orderTrackingNotes: "",
      },
    });
    kb.hours.days = kb.hours.days.map((day) =>
      day.day === "monday" ? { ...day, closed: false, open: "09:00", close: "17:00" } : day,
    );
    const reply = await generateEmailReply({
      knowledge: kb,
      fromName: "Alex Rivera",
      fromEmail: "alex@example.com",
      subject: "Shipping and hours",
      body: "Do you ship to the UK? What are your hours on Monday?",
      complete: stubEmailModel,
    });
    assert.match(reply, /^Hi Alex,/);
    assert.match(reply, /United States/);
    assert.match(reply, /United Kingdom|UK/);
    assert.match(reply, /Monday/);
    assert.match(reply, /9 a\.m/);
    assert.match(reply, /Best regards,\nHarbor Goods Support/);
  });

  it("case 3: asks for order identifiers instead of inventing a status", async () => {
    const kb = onlineStore({ name: "Field Supply" });
    const reply = await generateEmailReply({
      knowledge: kb,
      fromName: "Sam",
      fromEmail: "sam@example.com",
      subject: "My order",
      body: "Where is my order? Can you tell me the status?",
      complete: stubEmailModel,
    });
    assert.match(reply, /^Hi Sam,/);
    assert.match(reply, /order number/i);
    assert.match(reply, /email address used at checkout/i);
    assert.doesNotMatch(reply, /shipped|out for delivery|delivered|in transit/i);
    assert.doesNotMatch(reply, /order #|ORD-/i);
  });

  it("case 4: uses a relevant fact and never copies a long business description", async () => {
    const kb = onlineStore({
      name: "Northwind Watches",
      description: LONG_DESCRIPTION,
      offerings: [
        {
          id: "off_dress",
          kind: "product",
          name: "Dress watch",
          summary: "Leather strap.",
          price: "$240",
          availability: "In stock",
          details: "",
        },
      ],
    });
    const reply = await generateEmailReply({
      knowledge: kb,
      fromName: "Jordan",
      fromEmail: "jordan@example.com",
      subject: "Catalog",
      body: "Do you sell dress watches?",
      complete: stubEmailModel,
    });
    assert.match(reply, /^Hi Jordan,/);
    assert.match(reply, /dress watch/i);
    assert.doesNotMatch(reply, /hobby bench/i);
    assert.doesNotMatch(reply, /vintage service notes/i);
    assert.doesNotMatch(reply, /photographed before it leaves/i);
    assert.equal(reply.includes(LONG_DESCRIPTION), false);
    assert.equal(looksLikeKnowledgeDump(reply, kb), false);
    assert.equal(emailKnowledgeWasCopied(reply, kb), false);
  });
});

describe("email reply sanitizer", () => {
  it("strips internal headings and refuses a pasted knowledge profile", () => {
    const kb = onlineStore({
      name: "Northwind Watches",
      tagline: "Everyday watches",
      industry: "Online watch store",
      description: LONG_DESCRIPTION,
    });
    const dumped = `Business Information\n${kb.name}\n${kb.tagline}\nIndustry: ${kb.industry}\n${LONG_DESCRIPTION}`;
    assert.equal(looksLikeKnowledgeDump(dumped, kb), true);
    const cleaned = finalizeEmailReply(dumped, {
      knowledge: kb,
      fromName: "Tia",
      subject: "",
      body: "Hello",
    });
    assert.match(cleaned, /^Hi Tia,/);
    assert.doesNotMatch(cleaned, /Business Information/);
    assert.doesNotMatch(cleaned, /vintage service notes/i);
    assert.doesNotMatch(cleaned, /hobby bench/i);
    assert.match(cleaned, /Best regards,\nNorthwind Watches Support/);
  });
});

describe("paid email drafts use the AI reply path", () => {
  it("keeps the Gmail-style draft as a reviewable email, not a knowledge dump", async () => {
    const kb = onlineStore({
      name: "Virello Timepieces",
      description: LONG_DESCRIPTION,
      store: {
        shippingPolicy: "Current shipping destination: United States only.",
        stockMessaging: "",
        paymentMethods: "",
        cashOnDelivery: false,
        orderTrackingNotes: "",
      },
    });
    const draft = await draftEmailFromInboundAi(
      {
        kb,
        fromName: "Tia",
        fromEmail: "tia@example.com",
        subject: "(no subject)",
        body: "You ship to UK??",
      },
      { complete: stubEmailModel },
    );
    assert.notEqual(draft.status, "sent");
    assert.match(draft.draftBody, /^Hi Tia,/);
    assert.match(draft.draftBody, /United States/);
    assert.doesNotMatch(draft.draftBody, /hobby bench/i);
    assert.match(draft.operatorNote, /never auto-sends/i);
  });
});
