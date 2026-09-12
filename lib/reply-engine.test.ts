import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { emptyKnowledge } from "./empty-knowledge";
import {
  formatOffering,
  generateReply,
  hasEmptyFieldLabels,
  customerEmailQuery,
  thinInboundEmailAsk,
  unavailableKnowledgeMessage,
} from "./reply-engine";
import { PRESETS } from "./presets";
import type { BusinessType, KnowledgeBase, Offering } from "./types";

const ENGINE_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "reply-engine.ts"),
  "utf8",
);

const HOSTING_QUESTION = "Do you provide website hosting?";
const HOSTING_FACT =
  "We do not provide hosting unless it is included in the project agreement.";

function customDesk(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  return {
    ...emptyKnowledge("custom"),
    name: "Northwind Studio",
    industry: "Web projects",
    ...overrides,
  };
}

function assertNoEmptyLabels(body: string) {
  assert.equal(hasEmptyFieldLabels(body), false, body);
  assert.doesNotMatch(body, /^\s*\([^)]+\)\s*:/m);
  assert.doesNotMatch(body, /\bPrice:\s*\./);
  assert.doesNotMatch(body, /\bAvailability:\s*$/m);
}

describe("reply engine source", () => {
  it("does not hard-code the production hosting question or answer", () => {
    assert.equal(ENGINE_SOURCE.includes(HOSTING_QUESTION), false);
    assert.equal(ENGINE_SOURCE.includes("project agreement"), false);
    assert.equal(ENGINE_SOURCE.includes("Elmer"), false);
  });
});

describe("formatOffering", () => {
  it("returns null when every product/service field is blank", () => {
    const blank: Offering = {
      id: "off_blank",
      kind: "service",
      name: "",
      summary: "",
      price: "",
      availability: "",
      details: "",
    };
    assert.equal(formatOffering(blank), null);
  });

  it("omits Price and Availability labels when those fields are blank", () => {
    const partial: Offering = {
      id: "off_partial",
      kind: "service",
      name: "Strategy workshop",
      summary: "Half-day planning for a new site.",
      price: "",
      availability: "",
      details: "",
    };
    const text = formatOffering(partial);
    assert.ok(text);
    assert.match(text!, /Strategy workshop/);
    assert.match(text!, /Half-day planning/);
    assert.doesNotMatch(text!, /\bPrice:/);
    assert.doesNotMatch(text!, /\bAvailability:/);
    assert.equal(hasEmptyFieldLabels(text!), false);
  });

  it("includes price and availability only when they have values", () => {
    const priced: Offering = {
      id: "off_priced",
      kind: "product",
      name: "Trail jacket",
      summary: "Boiled wool.",
      price: "$248",
      availability: "In stock in M",
      details: "",
    };
    const text = formatOffering(priced);
    assert.ok(text);
    assert.match(text!, /Price: \$248/);
    assert.match(text!, /Availability: In stock in M/);
  });
});

describe("website chat uses published business information", () => {
  const types: BusinessType[] = ["custom", "service", "clinic", "online_store"];

  for (const businessType of types) {
    it(`answers from About the business for ${businessType} desks`, () => {
      const kb = {
        ...emptyKnowledge(businessType),
        name: "Northwind Studio",
        description: HOSTING_FACT,
      };
      const reply = generateReply({
        query: HOSTING_QUESTION,
        kb,
        channel: "chat",
      });

      assert.match(reply.body, /hosting/i);
      assert.match(reply.body, /project agreement/i);
      assert.equal(reply.body.includes(HOSTING_FACT), true);
      assert.equal(reply.safeForChatAuto, true);
      assert.ok(reply.sources.some((source) => source.kind === "business"));
      assertNoEmptyLabels(reply.body);
    });
  }

  it("does not invent an answer when the knowledge base is silent", () => {
    const kb = customDesk({ description: "" });
    const reply = generateReply({
      query: HOSTING_QUESTION,
      kb,
      channel: "chat",
    });

    assert.equal(reply.body, unavailableKnowledgeMessage(kb));
    assert.match(reply.body, /not available/i);
    assert.match(reply.body, /teammate|human|looping/i);
    assert.doesNotMatch(reply.body, /project agreement/i);
    assert.equal(reply.requiresHuman, true);
    assertNoEmptyLabels(reply.body);
  });

  it("reads FAQs and public documents, not only offerings", () => {
    const kb = customDesk({
      description: "We design and build marketing websites.",
      faqs: [
        {
          id: "faq_1",
          question: "Do you maintain the sites you build?",
          answer: "Yes. Maintenance is billed monthly after launch.",
        },
      ],
      documents: [
        {
          id: "doc_1",
          title: "Public billing note",
          body: "Invoices are sent on the first business day of each month.",
          visibility: "public",
        },
      ],
    });

    const faqReply = generateReply({
      query: "Do you maintain the sites you build?",
      kb,
      channel: "chat",
    });
    assert.match(faqReply.body, /maintenance is billed monthly/i);
    assert.ok(faqReply.sources.some((source) => source.kind === "faq"));

    const docReply = generateReply({
      query: "When do you send invoices?",
      kb,
      channel: "chat",
    });
    assert.match(docReply.body, /first business day/i);
    assert.ok(docReply.sources.some((source) => source.kind === "document"));
  });
});

describe("blank product and service fields", () => {
  it("never renders empty (service) Price Availability labels in chat", () => {
    const kb = customDesk({
      description: HOSTING_FACT,
      offerings: [
        {
          id: "off_empty",
          kind: "service",
          name: "",
          summary: "",
          price: "",
          availability: "",
          details: "",
        },
      ],
    });
    const reply = generateReply({
      query: HOSTING_QUESTION,
      kb,
      channel: "chat",
    });
    assert.doesNotMatch(reply.body, /\(service\)/);
    assert.doesNotMatch(reply.body, /Price:/);
    assert.doesNotMatch(reply.body, /Availability:/);
    assertNoEmptyLabels(reply.body);
  });

  it("skips blank offerings even when asking a general question", () => {
    const kb = customDesk({
      description: "",
      offerings: [
        {
          id: "off_empty_product",
          kind: "product",
          name: "   ",
          summary: "",
          price: "",
          availability: "",
          details: "",
        },
      ],
    });
    const reply = generateReply({
      query: "What do you sell?",
      kb,
      channel: "chat",
    });
    assert.equal(reply.body, unavailableKnowledgeMessage(kb));
    assertNoEmptyLabels(reply.body);
  });
});

describe("email drafts stay customer-facing", () => {
  const virello = customDesk({
    name: "Virello Timepieces",
    tagline: "Modern watches for everyday style",
    industry: "Online watch store",
    description:
      "Virello Timepieces is an online store selling watches. We assist customers with product questions, payments, orders, shipping, returns, and customer support. Never invent store policies or payment options. If information is unavailable, refer the question to a person.",
    contact: {
      ...emptyKnowledge("custom").contact,
      email: "hello@virello.test",
    },
  });

  it("does not paste the knowledge profile into an empty no-subject email", () => {
    const reply = generateReply({
      query: customerEmailQuery("(no subject)", ""),
      kb: virello,
      channel: "email",
      customerName: "BOFOWO",
    });
    assert.match(reply.body, /^Hi BOFOWO,/);
    assert.match(reply.body, new RegExp(thinInboundEmailAsk().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(reply.body, /Never invent/i);
    assert.doesNotMatch(reply.body, /refer the question to a person/i);
    assert.doesNotMatch(reply.body, /Industry:/);
    assert.doesNotMatch(reply.body, /Modern watches for everyday style/);
    assert.equal(reply.requiresHuman, true);
    assertNoEmptyLabels(reply.body);
  });

  it("answers the body of a no-subject email from published knowledge", () => {
    const reply = generateReply({
      query: customerEmailQuery("(no subject)", "When are you open on Monday?"),
      kb: {
        ...virello,
        hours: {
          ...virello.hours,
          days: virello.hours.days.map((day) =>
            day.day === "mon" ? { ...day, closed: false, open: "09:00", close: "17:00" } : day,
          ),
        },
      },
      channel: "email",
      customerName: "BOFOWO",
    });
    assert.match(reply.body, /^Hi BOFOWO,/);
    assert.match(reply.body, /monday/i);
    assert.match(reply.body, /9 a\.m\./i);
    assert.doesNotMatch(reply.body, /Could you share a bit more/i);
    assert.doesNotMatch(reply.body, /Never invent/i);
    assertNoEmptyLabels(reply.body);
  });

  it("still answers a real email question from published knowledge", () => {
    const reply = generateReply({
      query: "Hours\nWhen are you open on Monday?",
      kb: {
        ...virello,
        hours: {
          ...virello.hours,
          days: virello.hours.days.map((day) =>
            day.day === "mon" ? { ...day, closed: false, open: "09:00", close: "17:00" } : day,
          ),
        },
      },
      channel: "email",
      customerName: "Pat",
    });
    assert.match(reply.body, /monday/i);
    assert.match(reply.body, /9 a\.m\./i);
    assert.doesNotMatch(reply.body, /Never invent/i);
    assertNoEmptyLabels(reply.body);
  });

  it("strips operator instructions when chat answers from About the business", () => {
    const reply = generateReply({
      query: "Tell me about the business",
      kb: virello,
      channel: "chat",
    });
    assert.match(reply.body, /online store selling watches/i);
    assert.doesNotMatch(reply.body, /Never invent/i);
    assert.doesNotMatch(reply.body, /refer the question to a person/i);
    assertNoEmptyLabels(reply.body);
  });
});

describe("sample presets still answer from published knowledge", () => {
  it("answers Field & Ember hours from the published calendar", () => {
    const preset = PRESETS.find((row) => row.id.includes("ember") || row.businessType === "online_store");
    assert.ok(preset);
    const reply = generateReply({
      query: "What are your hours?",
      kb: preset!.knowledge,
      channel: "chat",
    });
    assert.match(reply.body, /tuesday/i);
    assert.equal(reply.safeForChatAuto, true);
    assertNoEmptyLabels(reply.body);
  });
});
