import { formatHoursList } from "@/lib/reply-engine";
import type { KnowledgeBase } from "@/lib/types";

export function knowledgePrompt(knowledge: KnowledgeBase | null) {
  if (!knowledge) {
    return "The business has not published a knowledge base yet. Do not invent offerings, prices, or policies.";
  }
  return [
    `Business name: ${knowledge.name || "(untitled)"}`,
    knowledge.tagline && `Tagline: ${knowledge.tagline}`,
    knowledge.industry && `Industry: ${knowledge.industry}`,
    knowledge.voice && `Voice: ${knowledge.voice}`,
    knowledge.description && `About the business:\n${knowledge.description}`,
    knowledge.hours &&
      `Published hours (${knowledge.hours.timezone || "local"}):\n${formatHoursList(knowledge)}${
        knowledge.hours.notes ? `\n${knowledge.hours.notes}` : ""
      }`,
    knowledge.pricingNotes && `Prices or rates:\n${knowledge.pricingNotes}`,
    knowledge.offerings
      ?.filter((row) => row.name.trim())
      .map(
        (row) =>
          `- ${row.name}: ${row.summary} ${row.price ? `Price ${row.price}.` : ""} ${row.availability ? `Availability ${row.availability}.` : ""}`,
      )
      .join("\n"),
    knowledge.policies
      ?.filter((row) => row.title.trim())
      .map((row) => `- ${row.title}: ${row.summary}`)
      .join("\n"),
    knowledge.faqs
      ?.filter((row) => row.question.trim())
      .map((row) => `Q: ${row.question}\nA: ${row.answer}`)
      .join("\n"),
    knowledge.documents
      ?.filter((row) => row.visibility === "public" && row.body.trim())
      .map((row) => `${row.title}:\n${row.body}`)
      .join("\n"),
    knowledge.store &&
      [
        knowledge.store.shippingPolicy && `Shipping: ${knowledge.store.shippingPolicy}`,
        knowledge.store.stockMessaging && `Stock: ${knowledge.store.stockMessaging}`,
        knowledge.store.paymentMethods && `Payments: ${knowledge.store.paymentMethods}`,
        knowledge.store.orderTrackingNotes && `Orders: ${knowledge.store.orderTrackingNotes}`,
      ]
        .filter(Boolean)
        .join("\n"),
    knowledge.serviceOps &&
      [
        knowledge.serviceOps.serviceArea && `Service area: ${knowledge.serviceOps.serviceArea}`,
        knowledge.serviceOps.bookingLeadTime && `Booking: ${knowledge.serviceOps.bookingLeadTime}`,
        knowledge.serviceOps.onsiteVsRemote && `On-site vs remote: ${knowledge.serviceOps.onsiteVsRemote}`,
        knowledge.serviceOps.emergencyCallout && `Emergency call-out: ${knowledge.serviceOps.emergencyCallout}`,
      ]
        .filter(Boolean)
        .join("\n"),
    knowledge.clinicOps &&
      [
        knowledge.clinicOps.appointmentBooking && `Booking: ${knowledge.clinicOps.appointmentBooking}`,
        knowledge.clinicOps.insuranceAccepted && `Insurance: ${knowledge.clinicOps.insuranceAccepted}`,
        knowledge.clinicOps.newPatientProcess && `New patients: ${knowledge.clinicOps.newPatientProcess}`,
        knowledge.clinicOps.emergencyProtocol && `Emergency protocol: ${knowledge.clinicOps.emergencyProtocol}`,
        knowledge.clinicOps.clinicalAdvicePolicy &&
          `Clinical advice policy: ${knowledge.clinicOps.clinicalAdvicePolicy}`,
      ]
        .filter(Boolean)
        .join("\n"),
    knowledge.contact &&
      `Contact: ${[
        knowledge.contact.phone,
        knowledge.contact.email,
        knowledge.contact.address,
        knowledge.contact.website,
        knowledge.contact.instagram && `Instagram ${knowledge.contact.instagram}`,
        knowledge.contact.facebook && `Facebook ${knowledge.contact.facebook}`,
        knowledge.contact.tiktok && `TikTok ${knowledge.contact.tiktok}`,
        knowledge.contact.messenger && `Messenger ${knowledge.contact.messenger}`,
      ]
        .filter(Boolean)
        .join(" · ")}`,
    knowledge.escalation?.alwaysEscalateTopics &&
      `Always hand these topics to a human: ${knowledge.escalation.alwaysEscalateTopics}`,
    knowledge.escalation?.neverAutoAnswer &&
      `Never auto-answer: ${knowledge.escalation.neverAutoAnswer}`,
    knowledge.escalation?.emergencyInstructions &&
      `Emergency instructions: ${knowledge.escalation.emergencyInstructions}`,
    knowledge.escalation?.handoffMessage &&
      `When you cannot answer, offer this handoff: ${knowledge.escalation.handoffMessage}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const WIDGET_SYSTEM_RULES = `You are the website chat assistant for one BizPilot subscriber. Answer only from that subscriber's indexed website pages and published knowledge below. If those sources do not contain the answer, say the information is unavailable and offer a human teammate. Never invent prices, policies, or capabilities. Never use another business's content. Never give medical diagnoses, medication names, or legal advice. If the visitor may be in danger, tell them to call emergency services, then offer a human. Match the visitor's language when you can.`;
