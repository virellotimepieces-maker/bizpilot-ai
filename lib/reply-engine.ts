import { DAY_LABEL } from "./labels";
import type {
  GeneratedReply,
  KnowledgeBase,
  KnowledgeDocument,
  Offering,
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
    re: /\b(phone|call you|email|address|where are you|located|fax|instagram|facebook|tiktok|messenger|dm|direct message|social (media|page|account))\b/i,
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

function filled(value: string | undefined) {
  return Boolean(value?.trim());
}

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function tokenMatches(queryToken: string, targetToken: string) {
  if (queryToken === targetToken) return true;
  if (queryToken.length >= 4 && targetToken.length >= 4) {
    return targetToken.includes(queryToken) || queryToken.includes(targetToken);
  }
  return false;
}

function scoreText(queryTokens: string[], text: string) {
  if (!text.trim() || queryTokens.length === 0) return 0;
  const target = tokens(text);
  if (target.length === 0) return 0;
  const hits = queryTokens.filter((t) => target.some((x) => tokenMatches(t, x))).length;
  return hits / Math.max(queryTokens.length, 2);
}

function offeringHasContent(off: Offering) {
  return [off.name, off.summary, off.price, off.availability, off.details].some(filled);
}

export function formatOffering(off: Offering): string | null {
  const name = off.name.trim();
  const summary = off.summary.trim();
  const price = off.price.trim();
  const availability = off.availability.trim();
  const details = off.details.trim();
  const parts: string[] = [];

  if (name) {
    parts.push(off.kind ? `${name} (${off.kind}):` : `${name}:`);
  }
  if (summary) parts.push(summary);
  if (price) parts.push(`Price: ${price}.`);
  if (availability) parts.push(`Availability: ${availability}`);
  if (details) parts.push(details);

  if (!parts.length) return null;
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function formatPublishedBusiness(kb: KnowledgeBase) {
  const lines = [
    kb.name.trim(),
    kb.tagline.trim(),
    kb.industry.trim() ? `Industry: ${kb.industry.trim()}` : "",
    kb.description.trim(),
  ].filter(filled);
  return lines.join("\n");
}

export function unavailableKnowledgeMessage(kb: KnowledgeBase) {
  const handoff =
    kb.escalation.handoffMessage.trim() ||
    "I can connect you with a teammate who can help.";
  return `That information is not available in the published knowledge base. ${handoff}`;
}

const EMPTY_LABEL_RE =
  /(?:^|\n)\s*\([^)]*\)\s*:?\s*(?:Price:\s*\.?\s*)?(?:Availability:\s*)?$/i;

export function hasEmptyFieldLabels(text: string) {
  if (EMPTY_LABEL_RE.test(text.trim())) return true;
  if (/\bPrice:\s*\.(?:\s|$)/.test(text)) return true;
  if (/\bAvailability:\s*(?:\n|$)/.test(text)) return true;
  if (/(?:^|\n)\s*\([^)]+\)\s*:?\s*(?=Price:|Availability:|$)/.test(text)) return true;
  return false;
}

function sanitizeReplyBody(text: string) {
  return text
    .replace(/(?:^|\n)\s*\([^)]+\)\s*:?\s*(?=Price:|Availability:|$)/g, "\n")
    .replace(/\bPrice:\s*\.(?=\s|$)/g, "")
    .replace(/\bPrice:\s*(?=Availability:|$)/g, "")
    .replace(/\bAvailability:\s*(?=\s*$)/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/  +/g, " ")
    .trim();
}

type RankedSource = {
  source: ReplySource;
  snippet: string;
  score: number;
};

function consider(
  ranked: RankedSource[],
  source: ReplySource,
  snippet: string | null | undefined,
  score: number,
  minScore = 0.16,
) {
  const text = snippet?.trim() ?? "";
  if (!text || hasEmptyFieldLabels(text)) return;
  if (score < minScore) return;
  ranked.push({ source, snippet: text, score });
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
  channel: ReplyChannel,
): { sources: ReplySource[]; snippets: string[]; usedInternal: boolean } {
  const qTokens = tokens(query);
  const q = query.toLowerCase();
  const ranked: RankedSource[] = [];
  let usedInternal = false;

  const about = formatPublishedBusiness(kb);
  const aboutNarrative = [kb.tagline, kb.description].filter(filled).join("\n");
  if (about) {
    const aboutBlob = [kb.name, kb.tagline, kb.industry, kb.description]
      .filter(filled)
      .join("\n");
    const aboutIntent =
      /\b(what do you (do|offer|provide|sell)|who are you|about (the )?business|tell me about (you|the (business|company|studio|shop|clinic|practice)))\b/i.test(
        query,
      );
    const score =
      scoreText(qTokens, aboutBlob) + (aboutIntent && aboutNarrative ? 0.5 : 0);
    consider(
      ranked,
      { kind: "business", title: "About the business" },
      about,
      score,
      aboutIntent && aboutNarrative ? 0.05 : 0.16,
    );
  }

  if (intent === "hours" || /hour|open|saturday|sunday/.test(q)) {
    consider(
      ranked,
      { kind: "hours", title: "Operating hours" },
      formatHoursList(kb) + (kb.hours.notes ? `\n${kb.hours.notes}` : ""),
      1,
      0.5,
    );
  }

  if (intent === "contact") {
    consider(ranked, { kind: "contact", title: "Contact details" }, contactBlock(kb), 1, 0.5);
  } else if (contactBlock(kb)) {
    consider(
      ranked,
      { kind: "contact", title: "Contact details" },
      contactBlock(kb),
      scoreText(qTokens, contactBlock(kb)),
    );
  }

  for (const off of kb.offerings) {
    if (!offeringHasContent(off)) continue;
    const formatted = formatOffering(off);
    if (!formatted) continue;
    const blob = [off.name, off.summary, off.price, off.availability, off.details]
      .filter(filled)
      .join(" ");
    const firstName = off.name.trim().toLowerCase().split(/\s+/).find((part) => part.length >= 3);
    const nameBoost =
      firstName && q.includes(firstName) ? 0.4 : 0;
    const s = scoreText(qTokens, blob) + nameBoost;
    const intentBoost =
      intent === "offerings" || intent === "pricing" || intent === "store_stock" ? 0.05 : 0;
    consider(
      ranked,
      { kind: "offering", title: off.name.trim() || "Offering" },
      formatted,
      s + intentBoost,
    );
  }

  if (filled(kb.pricingNotes)) {
    const s =
      scoreText(qTokens, kb.pricingNotes) + (intent === "pricing" ? 0.5 : 0);
    consider(ranked, { kind: "pricing", title: "Prices or rates" }, kb.pricingNotes, s);
  }

  for (const policy of kb.policies) {
    if (!filled(policy.title) && !filled(policy.summary)) continue;
    const blob = `${policy.title} ${policy.summary}`;
    const snippet = [policy.title.trim() && `${policy.title.trim()}:`, policy.summary.trim()]
      .filter(Boolean)
      .join(" ");
    const s = scoreText(qTokens, blob) + (intent === "policy" ? 0.4 : 0);
    consider(
      ranked,
      { kind: "policy", title: policy.title.trim() || "Policy" },
      snippet,
      s,
      intent === "policy" ? 0.1 : 0.14,
    );
  }

  for (const faq of kb.faqs) {
    if (!filled(faq.question) && !filled(faq.answer)) continue;
    const blob = `${faq.question} ${faq.answer}`;
    consider(
      ranked,
      { kind: "faq", title: faq.question.trim() || "FAQ" },
      `${faq.question.trim()} ${faq.answer.trim()}`.trim(),
      scoreText(qTokens, blob),
    );
  }

  for (const doc of kb.documents) {
    if (!filled(doc.title) && !filled(doc.body)) continue;
    if (channel === "chat" && doc.visibility === "internal") continue;
    const s = scoreText(qTokens, `${doc.title} ${doc.body}`);
    if (s >= 0.16) {
      if (doc.visibility === "internal") usedInternal = true;
      consider(
        ranked,
        { kind: "document", title: doc.title, visibility: doc.visibility },
        doc.body,
        s,
      );
    }
  }

  if (kb.store && kb.businessType === "online_store") {
    if (
      intent === "store_shipping" ||
      /\b(ship|shipping|delivery|alaska|hawaii|pickup|pick up)\b/.test(q)
    ) {
      consider(
        ranked,
        { kind: "store", title: "Shipping & pickup" },
        kb.store.shippingPolicy,
        1,
        0.5,
      );
    }
    if (
      intent === "store_payment" ||
      /\b(cash on delivery|\bcod\b|pay cash|payment methods?)\b/.test(q)
    ) {
      consider(
        ranked,
        { kind: "store", title: "Payments" },
        kb.store.paymentMethods
          ? kb.store.paymentMethods +
            (kb.store.cashOnDelivery
              ? " Cash on delivery is offered only under the conditions above."
              : " Cash on delivery is not offered.")
          : "",
        1,
        0.5,
      );
    }
    if (intent === "store_stock" || /\b(in stock|waitlist|size)\b/.test(q)) {
      consider(
        ranked,
        { kind: "store", title: "Stock messaging" },
        kb.store.stockMessaging,
        1,
        0.5,
      );
    }
  }

  if (kb.serviceOps && kb.businessType === "service") {
    if (intent === "service_area" || /city|cities|berkeley|oakland/.test(q)) {
      consider(
        ranked,
        { kind: "service", title: "Service area" },
        kb.serviceOps.serviceArea,
        1,
        0.5,
      );
    }
    if (intent === "emergency") {
      consider(
        ranked,
        { kind: "service", title: "Emergency call-out" },
        kb.serviceOps.emergencyCallout,
        1,
        0.5,
      );
    }
    if (intent === "appointments" || intent === "availability") {
      consider(
        ranked,
        { kind: "service", title: "Booking lead time" },
        kb.serviceOps.bookingLeadTime,
        1,
        0.5,
      );
    }
    consider(
      ranked,
      { kind: "service", title: "On-site vs remote" },
      kb.serviceOps.onsiteVsRemote,
      scoreText(qTokens, kb.serviceOps.onsiteVsRemote),
    );
  }

  if (kb.clinicOps && kb.businessType === "clinic") {
    if (intent === "appointments") {
      consider(
        ranked,
        { kind: "clinic", title: "Appointment booking" },
        kb.clinicOps.appointmentBooking,
        1,
        0.5,
      );
    }
    if (intent === "insurance") {
      consider(
        ranked,
        { kind: "clinic", title: "Insurance" },
        kb.clinicOps.insuranceAccepted,
        1,
        0.5,
      );
    }
    if (intent === "emergency" || intent === "medical_advice") {
      consider(
        ranked,
        { kind: "clinic", title: "Clinical advice policy" },
        kb.clinicOps.clinicalAdvicePolicy,
        1,
        0.5,
      );
      if (intent === "emergency") {
        consider(
          ranked,
          { kind: "clinic", title: "Emergency protocol" },
          kb.clinicOps.emergencyProtocol,
          1,
          0.5,
        );
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score);

  if (
    ranked.length === 0 &&
    (intent === "offerings" || intent === "unknown")
  ) {
    const listed = kb.offerings
      .map((o) => formatOffering(o))
      .filter((line): line is string => Boolean(line));
    if (listed.length) {
      consider(
        ranked,
        { kind: "offering", title: "Offerings" },
        listed.join("\n"),
        0.2,
        0.1,
      );
    }
  }

  const unique = new Map<string, RankedSource>();
  for (const row of ranked) {
    const key = `${row.source.kind}:${row.source.title}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  const chosen = [...unique.values()].slice(0, 5);
  return {
    sources: chosen.map((row) => row.source),
    snippets: chosen.map((row) => row.snippet),
    usedInternal,
  };
}

function contactBlock(kb: KnowledgeBase) {
  return [
    kb.contact.phone && `Phone: ${kb.contact.phone}`,
    kb.contact.email && `Email: ${kb.contact.email}`,
    kb.contact.address && `Address: ${kb.contact.address}`,
    kb.contact.website && `Website: ${kb.contact.website}`,
    kb.contact.instagram && `Instagram: ${kb.contact.instagram}`,
    kb.contact.facebook && `Facebook: ${kb.contact.facebook}`,
    kb.contact.tiktok && `TikTok: ${kb.contact.tiktok}`,
    kb.contact.messenger && `Messenger: ${kb.contact.messenger}`,
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
        matchedOffer ? formatOffering(matchedOffer) : null,
        kb.store?.stockMessaging,
        sizeDoc?.body,
      ].filter(Boolean);
      if (parts.length) return parts.join("\n\n");
    }
    return snippets.slice(0, 3).join("\n\n");
  }

  return unavailableKnowledgeMessage(kb);
}

function wrapEmail(kb: KnowledgeBase, customerName: string | undefined, body: string) {
  const first = customerName?.split(" ")[0] ?? "there";
  const sign = kb.name || "Support";
  return `Hi ${first},\n\n${body}\n\nIf you need anything else, reply to this email or call us${kb.contact.phone ? ` at ${kb.contact.phone}` : ""}.\n\n— ${sign}`;
}

function wrapSocial(kb: KnowledgeBase, customerName: string | undefined, body: string) {
  const first = customerName?.split(" ")[0];
  const sign = kb.name || "Support";
  const greeting = first ? `Hi ${first},\n\n` : "";
  return `${greeting}${body}\n\n— ${sign}`;
}

function lockHumanChannel(channel: ReplyChannel, operatorNote: string) {
  if (channel === "email") {
    const extra = operatorNote.toLowerCase().includes("email")
      ? ""
      : " Email never auto-sends.";
    return { requiresHuman: true as const, safeForChatAuto: false as const, operatorNote: `${operatorNote}${extra}`.trim() };
  }
  if (channel === "social") {
    return {
      requiresHuman: true as const,
      safeForChatAuto: false as const,
      operatorNote: `${operatorNote} Social replies stay drafts — copy and post them yourself. BizPilot never posts to Instagram, Facebook, TikTok, or Messenger.`,
    };
  }
  return null;
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

  const collected = collectSources(kb, query, intent, channel);
  const usedInternal = collected.usedInternal;
  const snippets = collected.snippets.filter(
    (snippet) => snippet.trim() && !hasEmptyFieldLabels(snippet),
  );

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
  } else if (!snippets.length) {
    body = unavailableKnowledgeMessage(kb);
    confidence = 0.42;
    requiresHuman = true;
    safeForChatAuto = kb.escalation.autoAnswerChat;
    operatorNote =
      "No published knowledge matched this question. Tell the visitor the information is unavailable and offer a human. Do not invent details.";
  } else {
    const answer = composeSafeAnswer(kb, query, intent, snippets);
    body = answer;
    const matchedPublished = snippets.length > 0 && !hasEmptyFieldLabels(answer);
    confidence = matchedPublished
      ? collected.sources.length >= 2
        ? 0.86
        : 0.74
      : 0.48;
    const low = confidence < 0.55 || !matchedPublished;
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
  } else if (channel === "social") {
    body = wrapSocial(kb, customerName, body);
  } else if (intent === "emergency") {
    body = `${body}\n\n${kb.escalation.handoffMessage}`;
  }

  const locked = lockHumanChannel(channel, operatorNote);
  if (locked) {
    requiresHuman = locked.requiresHuman;
    safeForChatAuto = locked.safeForChatAuto;
    operatorNote = locked.operatorNote;
  }

  body = sanitizeReplyBody(body);
  if (!body || hasEmptyFieldLabels(body)) {
    body = unavailableKnowledgeMessage(kb);
    if (intent !== "emergency" && intent !== "medical_advice") {
      requiresHuman = true;
      confidence = Math.min(confidence, 0.42);
      if (channel === "chat") safeForChatAuto = kb.escalation.autoAnswerChat;
    }
  }

  return {
    channel,
    intent,
    body: body.trim(),
    greetingName: customerName,
    confidence,
    sources: collected.sources.filter((source) => source.title.trim()),
    operatorNote,
    safeForChatAuto: channel === "chat" ? safeForChatAuto || intent === "emergency" : false,
    requiresHuman: channel === "chat" ? requiresHuman : true,
    usedInternalKnowledge: usedInternal,
  };
}

export function emailSubjectFor(original: string, kb: KnowledgeBase) {
  const trimmed = original.replace(/^(re:\s*)+/i, "").trim();
  return `Re: ${trimmed || kb.name || "your message"}`;
}
