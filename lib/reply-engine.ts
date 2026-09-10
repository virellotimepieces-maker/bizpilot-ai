import { DAY_LABEL } from "./labels";
import type {
  GeneratedReply,
  KnowledgeBase,
  KnowledgeDocument,
  ReplyChannel,
  ReplyIntent,
  ReplySource,
} from "./types";

const STOP = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "do",
  "you",
  "your",
  "to",
  "of",
  "and",
  "or",
  "for",
  "in",
  "on",
  "my",
  "me",
  "we",
  "i",
  "what",
  "when",
  "where",
  "how",
  "can",
  "please",
  "hi",
  "hello",
  "thanks",
  "just",
  "also",
  "with",
  "this",
  "that",
  "from",
  "have",
  "has",
  "be",
  "our",
  "us",
  "if",
  "at",
  "it",
]);

const UNSAFE: ReplyIntent[] = [
  "emergency",
  "complaint",
  "medical_advice",
  "legal",
  "account_specific",
];

const INTENT_PATTERNS: { intent: ReplyIntent; re: RegExp }[] = [
  {
    intent: "emergency",
    re: /\b(911|chest pain|can'?t breathe|trouble breathing|suicidal|stroke|anaphylaxis|unconscious|sparking|on fire|gas leak|burning smell|severe bleeding|seizure|104|lethargic|infant under)\b/i,
  },
  {
    intent: "medical_advice",
    re: /\b(diagnos|antibiotic|what should i take|which antibiotic|dosage|symptom|prescription|sore throat|fever of|is this serious|what medicine|interpret (my )?labs?)\b/i,
  },
  {
    intent: "legal",
    re: /\b(sue|lawyer|attorney|chargeback|legal action|better business bureau|bbb)\b/i,
  },
  {
    intent: "complaint",
    re: /\b(horrible|worst|broke my|cracked my|compensation|manager|unacceptable|scam|pay for it immediately)\b/i,
  },
  {
    intent: "account_specific",
    re: /\b(order\s*#|order number|invoice|tracking number|confirmation number|my appointment on|look up my)\b/i,
  },
  {
    intent: "hours",
    re: /\b(hours|open|close[sd]?|opening|when are you|saturday|sunday|weekend|after hours)\b/i,
  },
  {
    intent: "contact",
    re: /\b(phone|call you|email|address|where are you|located|fax)\b/i,
  },
  {
    intent: "store_shipping",
    re: /\b(ship|shipping|delivery|deliver|alaska|hawaii|pickup|pick up)\b/i,
  },
  {
    intent: "store_stock",
    re: /\b(in stock|stock|size|waitlist|restock|available in)\b/i,
  },
  {
    intent: "store_payment",
    re: /\b(cod|cash on delivery|pay cash|payment methods?|shop pay|visa)\b/i,
  },
  {
    intent: "service_area",
    re: /\b(berkeley|oakland|service area|do you (work|serve|cover)|which cities|travel to)\b/i,
  },
  {
    intent: "appointments",
    re: /\b(book|appointment|schedule|physical|same-day|new patient|reserve)\b/i,
  },
  {
    intent: "insurance",
    re: /\b(insurance|aetna|medicare|medi-cal|kaiser|blue shield|copay|self-pay)\b/i,
  },
  {
    intent: "pricing",
    re: /\b(price|prices|cost|rate|how much|fee|charge)\b/i,
  },
  {
    intent: "availability",
    re: /\b(available|availability|lead time|how soon|wait)\b/i,
  },
  {
    intent: "policy",
    re: /\b(return|refund|cancel|warranty|privacy|policy|no-show)\b/i,
  },
];

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function scoreText(queryTokens: string[], text: string) {
  if (!text.trim()) return 0;
  const target = new Set(tokens(text));
  if (target.size === 0) return 0;
  const hits = queryTokens.filter((t) => target.has(t)).length;
  return hits / Math.max(queryTokens.length, 2);
}

function formatClock(value: string) {
  const [hRaw, m] = value.split(":");
  const h = Number(hRaw);
  if (Number.isNaN(h)) return value;
  const suffix = h >= 12 ? "p.m." : "a.m.";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === "00" ? `${hour} ${suffix}` : `${hour}:${m} ${suffix}`;
}

export function formatHoursList(kb: KnowledgeBase) {
  return kb.hours.days
    .map((d) => {
      const label = DAY_LABEL[d.day];
      if (d.closed) return `${label}: closed`;
      return `${label}: ${formatClock(d.open)}–${formatClock(d.close)}`;
    })
    .join("\n");
}

function detectIntent(query: string, kb: KnowledgeBase): ReplyIntent {
  const type = kb.businessType;
  for (const row of INTENT_PATTERNS) {
    if (!row.re.test(query)) continue;
    const intent = row.intent;
    if (intent.startsWith("store_") && type !== "online_store") continue;
    if (intent === "service_area" && type !== "service") continue;
    if (intent === "insurance" && type !== "clinic") continue;
    if (intent === "appointments" && type !== "clinic" && type !== "service") continue;
    if (intent === "medical_advice" && type !== "clinic") continue;
    return intent;
  }
  return "unknown";
}

function escalationHit(query: string, kb: KnowledgeBase) {
  const bag = [
    kb.escalation.alwaysEscalateTopics,
    kb.escalation.neverAutoAnswer,
  ]
    .join(" ")
    .toLowerCase();
  const q = query.toLowerCase();
  const phrases = bag
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  return phrases.some((p) => q.includes(p.toLowerCase()) || tokens(p).every((t) => q.includes(t)));
}

function collectSources(
  kb: KnowledgeBase,
  query: string,
  intent: ReplyIntent,
): { sources: ReplySource[]; snippets: string[]; usedInternal: boolean } {
  const qTokens = tokens(query);
  const sources: ReplySource[] = [];
  const snippets: string[] = [];
  let usedInternal = false;

  if (intent === "hours" || /hour|open|saturday|sunday/.test(query.toLowerCase())) {
    sources.push({ kind: "hours", title: "Operating hours" });
    snippets.push(formatHoursList(kb) + (kb.hours.notes ? `\n${kb.hours.notes}` : ""));
  }

  if (intent === "contact") {
    sources.push({ kind: "contact", title: "Contact details" });
    snippets.push(contactBlock(kb));
  }

  for (const off of kb.offerings) {
    const blob = `${off.name} ${off.summary} ${off.price} ${off.availability} ${off.details}`;
    const s = scoreText(qTokens, blob) + (query.toLowerCase().includes(off.name.toLowerCase().split(" ")[0] ?? "") ? 0.4 : 0);
    if (s >= 0.18 || intent === "offerings" || intent === "pricing" || intent === "store_stock") {
      if (s >= 0.18 || qTokens.some((t) => off.name.toLowerCase().includes(t))) {
        sources.push({ kind: "offering", title: off.name });
        snippets.push(
          `${off.name} (${off.kind}): ${off.summary} Price: ${off.price}. Availability: ${off.availability}${off.details ? ` ${off.details}` : ""}`,
        );
      }
    }
  }

  if (intent === "pricing" && kb.pricingNotes.trim()) {
    sources.push({ kind: "pricing", title: "Prices or rates" });
    snippets.push(kb.pricingNotes);
  }

  for (const policy of kb.policies) {
    if (scoreText(qTokens, `${policy.title} ${policy.summary}`) >= 0.14 || intent === "policy") {
      if (
        intent === "policy" ||
        scoreText(qTokens, `${policy.title} ${policy.summary}`) >= 0.14
      ) {
        if (
          intent !== "policy" &&
          scoreText(qTokens, `${policy.title} ${policy.summary}`) < 0.14
        ) {
          continue;
        }
        sources.push({ kind: "policy", title: policy.title });
        snippets.push(`${policy.title}: ${policy.summary}`);
      }
    }
  }

  for (const faq of kb.faqs) {
    if (scoreText(qTokens, `${faq.question} ${faq.answer}`) >= 0.16) {
      sources.push({ kind: "faq", title: faq.question });
      snippets.push(`${faq.question} ${faq.answer}`);
    }
  }

  for (const doc of kb.documents) {
    const s = scoreText(qTokens, `${doc.title} ${doc.body}`);
    if (s >= 0.16) {
      sources.push({
        kind: "document",
        title: doc.title,
        visibility: doc.visibility,
      });
      snippets.push(doc.body);
      if (doc.visibility === "internal") usedInternal = true;
    }
  }

  const q = query.toLowerCase();
  if (kb.store && kb.businessType === "online_store") {
    if (
      intent === "store_shipping" ||
      /\b(ship|shipping|delivery|alaska|hawaii|pickup|pick up)\b/.test(q)
    ) {
      sources.push({ kind: "store", title: "Shipping & pickup" });
      snippets.push(kb.store.shippingPolicy);
    }
    if (
      intent === "store_payment" ||
      /\b(cash on delivery|\bcod\b|pay cash|payment methods?)\b/.test(q)
    ) {
      sources.push({ kind: "store", title: "Payments" });
      snippets.push(
        kb.store.paymentMethods +
          (kb.store.cashOnDelivery
            ? " Cash on delivery is offered only under the conditions above."
            : " Cash on delivery is not offered."),
      );
    }
    if (intent === "store_stock" || /\b(in stock|waitlist|size)\b/.test(q)) {
      sources.push({ kind: "store", title: "Stock messaging" });
      snippets.push(kb.store.stockMessaging);
    }
  }

  if (kb.serviceOps && kb.businessType === "service") {
    if (intent === "service_area" || /city|cities|berkeley|oakland/.test(query.toLowerCase())) {
      sources.push({ kind: "service", title: "Service area" });
      snippets.push(kb.serviceOps.serviceArea);
    }
    if (intent === "emergency") {
      sources.push({ kind: "service", title: "Emergency call-out" });
      snippets.push(kb.serviceOps.emergencyCallout);
    }
    if (intent === "appointments" || intent === "availability") {
      sources.push({ kind: "service", title: "Booking lead time" });
      snippets.push(kb.serviceOps.bookingLeadTime);
    }
  }

  if (kb.clinicOps && kb.businessType === "clinic") {
    if (intent === "appointments") {
      sources.push({ kind: "clinic", title: "Appointment booking" });
      snippets.push(kb.clinicOps.appointmentBooking);
    }
    if (intent === "insurance") {
      sources.push({ kind: "clinic", title: "Insurance" });
      snippets.push(kb.clinicOps.insuranceAccepted);
    }
    if (intent === "emergency" || intent === "medical_advice") {
      sources.push({ kind: "clinic", title: "Clinical advice policy" });
      snippets.push(kb.clinicOps.clinicalAdvicePolicy);
      if (intent === "emergency") {
        sources.push({ kind: "clinic", title: "Emergency protocol" });
        snippets.push(kb.clinicOps.emergencyProtocol);
      }
    }
  }

  if (sources.length === 0 && kb.offerings.some((o) => o.name.trim())) {
    if (intent === "offerings" || intent === "unknown") {
      const listed = kb.offerings
        .filter((o) => o.name.trim())
        .map((o) => `${o.name} — ${o.price}. ${o.summary}`)
        .join("\n");
      sources.push({ kind: "offering", title: "Offerings" });
      snippets.push(listed);
    }
  }

  const unique = new Map<string, ReplySource>();
  for (const s of sources) unique.set(`${s.kind}:${s.title}`, s);
  return {
    sources: [...unique.values()],
    snippets: snippets.filter(Boolean),
    usedInternal,
  };
}

function contactBlock(kb: KnowledgeBase) {
  return [
    kb.contact.phone && `Phone: ${kb.contact.phone}`,
    kb.contact.email && `Email: ${kb.contact.email}`,
    kb.contact.address && `Address: ${kb.contact.address}`,
    kb.contact.website && `Website: ${kb.contact.website}`,
    kb.contact.extra,
  ]
    .filter(Boolean)
    .join("\n");
}

function uniqueDocs(kb: KnowledgeBase, pred: (d: KnowledgeDocument) => boolean) {
  return kb.documents.filter(pred);
}

function composeSafeAnswer(
  kb: KnowledgeBase,
  query: string,
  intent: ReplyIntent,
  snippets: string[],
) {
  const name = kb.name || "our team";
  const q = query.toLowerCase();

  if (intent === "hours") {
    return `Here are the published hours for ${name}:\n\n${formatHoursList(kb)}${kb.hours.notes ? `\n\n${kb.hours.notes}` : ""}`;
  }

  if (intent === "contact") {
    return `You can reach ${name} here:\n\n${contactBlock(kb)}`;
  }

  if (intent === "insurance" && kb.clinicOps) {
    return kb.clinicOps.insuranceAccepted;
  }

  if (intent === "appointments" && kb.clinicOps) {
    const extra = kb.faqs.find((f) => /book|appointment/i.test(f.question));
    return [kb.clinicOps.appointmentBooking, extra?.answer, kb.clinicOps.newPatientProcess]
      .filter(Boolean)
      .join("\n\n");
  }

  if (intent === "store_shipping" && kb.store) {
    return kb.store.shippingPolicy;
  }

  if (intent === "store_payment" && kb.store) {
    return kb.store.paymentMethods;
  }

  if (intent === "service_area" && kb.serviceOps) {
    const faq = kb.faqs.find((f) => /cit(y|ies)|serve|area/i.test(f.question));
    return [kb.serviceOps.serviceArea, faq?.answer].filter(Boolean).join("\n\n");
  }

  if (snippets.length) {
    if (intent === "store_stock" || /size|stock|medium|jacket/.test(q)) {
      const sizeDoc = uniqueDocs(kb, (d) => /size/i.test(d.title) && d.visibility === "public")[0];
      const matchedOffer = kb.offerings.find((o) =>
        tokens(o.name).some((t) => q.includes(t)),
      );
      const parts = [
        matchedOffer
          ? `${matchedOffer.name}: ${matchedOffer.availability}${matchedOffer.price ? ` Listed price ${matchedOffer.price}.` : ""}`
          : null,
        kb.store?.stockMessaging,
        sizeDoc?.body,
      ].filter(Boolean);
      if (parts.length) return parts.join("\n\n");
    }
    return snippets.slice(0, 3).join("\n\n");
  }

  return `I checked the ${name} knowledge base and I don't have a published answer for that yet. A teammate can take it from here.`;
}

function wrapEmail(kb: KnowledgeBase, customerName: string | undefined, body: string) {
  const first = customerName?.split(" ")[0] ?? "there";
  const sign = kb.name || "Support";
  return `Hi ${first},\n\n${body}\n\nIf you need anything else, reply to this email or call us${kb.contact.phone ? ` at ${kb.contact.phone}` : ""}.\n\n— ${sign}`;
}

export function generateReply(options: {
  query: string;
  kb: KnowledgeBase;
  channel: ReplyChannel;
  customerName?: string;
}): GeneratedReply {
  const { query, kb, channel, customerName } = options;
  const intent = detectIntent(query, kb);
  const forcedEscalate =
    UNSAFE.includes(intent) ||
    (kb.businessType === "clinic" && intent === "medical_advice") ||
    escalationHit(query, kb);

  const collected = collectSources(kb, query, intent);
  const usedInternal = collected.usedInternal;

  let body: string;
  let operatorNote: string;
  let safeForChatAuto = false;
  let requiresHuman = false;
  let confidence = 0.4;

  if (intent === "emergency") {
    requiresHuman = true;
    confidence = 0.95;
    if (kb.businessType === "clinic" && kb.clinicOps) {
      body = kb.clinicOps.emergencyProtocol;
    } else if (kb.businessType === "service" && kb.serviceOps) {
      body = kb.serviceOps.emergencyCallout;
    } else {
      body = kb.escalation.emergencyInstructions;
    }
    operatorNote =
      "Emergency language detected. A human must be notified immediately. Chat may show the safety instruction, then hand off.";
    safeForChatAuto = true;
    collected.sources.unshift({ kind: "escalation", title: "Emergency protocol" });
  } else if (intent === "medical_advice") {
    requiresHuman = true;
    confidence = 0.9;
    body =
      kb.clinicOps?.clinicalAdvicePolicy ??
      "This sounds like a clinical question. We can't advise on symptoms or medications here. Please call the clinic or use the patient portal so a clinician can respond.";
    if (kb.clinicOps?.emergencyProtocol && /104|letharg|breath|chest/.test(query.toLowerCase())) {
      body = `${kb.clinicOps.emergencyProtocol}\n\n${body}`;
    }
    operatorNote =
      "Do not add medical advice. Keep the draft as a handoff to a clinician. Email must not send until a human approves.";
    safeForChatAuto = false;
  } else if (forcedEscalate) {
    requiresHuman = true;
    confidence = 0.82;
    body = kb.escalation.handoffMessage;
    if (intent === "policy") {
      const policy = kb.policies.find((p) =>
        /return|refund|cancel|warranty/i.test(p.title),
      );
      if (policy) {
        body = `${kb.escalation.handoffMessage}\n\nFor reference, our published ${policy.title.toLowerCase()} policy is: ${policy.summary}`;
        collected.sources.push({ kind: "policy", title: policy.title });
      }
    }
    operatorNote =
      intent === "legal" || intent === "complaint"
        ? "Complaint or legal language. Draft a holding reply only. A human must review before anything is sent."
        : "This matched an escalation rule or looks account-specific. Draft only — do not auto-send.";
    safeForChatAuto = false;
    collected.sources.unshift({ kind: "escalation", title: "Human-escalation rules" });
  } else {
    const answer = composeSafeAnswer(kb, query, intent, collected.snippets);
    body = answer;
    confidence =
      collected.sources.length >= 2 ? 0.86 : collected.sources.length === 1 ? 0.72 : 0.48;
    const low = confidence < 0.55;
    requiresHuman = low || usedInternal;
    safeForChatAuto =
      kb.escalation.autoAnswerChat &&
      !low &&
      !usedInternal &&
      !UNSAFE.includes(intent);
    operatorNote = usedInternal
      ? "This draft used an internal document. Review before sending — website chat will not auto-answer from internal notes."
      : safeForChatAuto
        ? "Published knowledge only. Safe for website chat to answer automatically. Email still needs approval."
        : "Low confidence or incomplete knowledge. Keep as a draft for a human.";
  }

  if (channel === "email") {
    body = wrapEmail(kb, customerName, body);
    requiresHuman = true;
    safeForChatAuto = false;
  } else if (intent === "emergency") {
    body = `${body}\n\n${kb.escalation.handoffMessage}`;
  }

  return {
    channel,
    intent,
    body: body.trim(),
    greetingName: customerName,
    confidence,
    sources: collected.sources,
    operatorNote,
    safeForChatAuto: channel === "chat" ? safeForChatAuto || intent === "emergency" : false,
    requiresHuman: channel === "email" ? true : requiresHuman,
    usedInternalKnowledge: usedInternal,
  };
}

export function emailSubjectFor(original: string, kb: KnowledgeBase) {
  const trimmed = original.replace(/^(re:\s*)+/i, "").trim();
  return `Re: ${trimmed || kb.name || "your message"}`;
}
