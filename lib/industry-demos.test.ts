import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { generateReply } from "./reply-engine";
import { presetById } from "./presets";
import {
  INDUSTRY_DEMOS,
  INDUSTRY_DEMO_LABEL,
  demoHrefForSeoPath,
  industryDemoByPresetId,
} from "./industry-demos";

describe("industry sales demos", () => {
  it("covers contractors, dental clinics, and local service businesses with sample labels", () => {
    assert.deepEqual(
      INDUSTRY_DEMOS.map((demo) => demo.audience),
      ["Contractors / home services", "Dental clinics", "Local service businesses"],
    );
    assert.match(INDUSTRY_DEMO_LABEL, /Sample/);
    assert.match(INDUSTRY_DEMO_LABEL, /demo data/);
    assert.match(INDUSTRY_DEMO_LABEL, /Not a live customer/);
    for (const demo of INDUSTRY_DEMOS) {
      const preset = presetById(demo.presetId);
      assert.ok(preset, demo.presetId);
      assert.equal(industryDemoByPresetId(demo.presetId)?.id, demo.id);
      assert.equal(preset!.suggestedQuestions.includes(demo.knownQuestion), true);
      assert.equal(preset!.suggestedQuestions.includes(demo.refusalQuestion), true);
      assert.match(preset!.knowledge.description, /sample/i);
      assert.match(demo.lead.name, /\S/);
      assert.match(demo.lead.email, /@example\.com$/);
      assert.match(demo.lead.request, /\S/);
      assert.match(demo.lead.withheld, /\S/);
    }
  });

  it("answers a published question and refuses an unpublished price or promotion", () => {
    const cases = [
      {
        id: "service-lumen",
        known: /\$165/,
        refusal: /do not quote commercial work/i,
        invented: /\$\s*8,?000|\$\s*12,?000|warehouse bid is/i,
      },
      {
        id: "clinic-harbor-dental",
        known: /\$189/,
        refusal: /not published|not available in the published knowledge base/i,
        invented: /\$\d{3,}|20\s*%|whitening special/i,
      },
      {
        id: "service-cedar-lane",
        known: /\$145/,
        refusal: /not published|not available in the published knowledge base/i,
        invented: /coupon code|\$\d+\s+off/i,
      },
    ];
    for (const row of cases) {
      const demo = industryDemoByPresetId(row.id);
      const preset = presetById(row.id);
      assert.ok(demo && preset);
      const known = generateReply({
        query: demo!.knownQuestion,
        kb: preset!.knowledge,
        channel: "chat",
      });
      const refusal = generateReply({
        query: demo!.refusalQuestion,
        kb: preset!.knowledge,
        channel: "chat",
      });
      assert.match(known.body, row.known, known.body);
      assert.match(refusal.body, row.refusal, refusal.body);
      assert.doesNotMatch(refusal.body, row.invented, refusal.body);
      assert.equal(refusal.safeForChatAuto || /not published|not available/i.test(refusal.body), true);
    }
  });

  it("points industry landing pages at the matching demo and leaves other pages on /demo", () => {
    assert.equal(demoHrefForSeoPath("/ai-chatbot-for-contractors"), "/demo?preset=service-lumen");
    assert.equal(
      demoHrefForSeoPath("/ai-chatbot-for-dental-clinics"),
      "/demo?preset=clinic-harbor-dental",
    );
    assert.equal(
      demoHrefForSeoPath("/ai-chatbot-for-local-businesses"),
      "/demo?preset=service-cedar-lane",
    );
    assert.equal(demoHrefForSeoPath("/ai-chatbot-for-small-business"), "/demo");
    assert.equal(demoHrefForSeoPath("/"), "/demo");
    const landing = readFileSync("components/seo-landing.tsx", "utf8");
    assert.match(landing, /demoHrefForSeoPath\(page\.path\)/);
    const playbook = readFileSync("docs/sales/outreach-playbook.md", "utf8");
    assert.match(playbook, /utm_source/);
    assert.match(playbook, /utm_medium/);
    assert.match(playbook, /utm_campaign/);
    assert.match(playbook, /does not record/);
    assert.doesNotMatch(playbook, /nodemailer|sendgrid|mailgun|smtp/i);
  });
});
