import { WEEKDAYS } from "./labels";
import { nid } from "./id";
import type {
  BusinessHours,
  BusinessType,
  KnowledgeBase,
  OfferingKind,
} from "./types";

export function defaultHours(): BusinessHours {
  return {
    timezone: "America/Los_Angeles",
    notes: "",
    days: WEEKDAYS.map((day) => ({
      day,
      closed: day === "sunday",
      open: "09:00",
      close: "17:00",
    })),
  };
}

export function emptyKnowledge(type: BusinessType = "custom"): KnowledgeBase {
  const kind: OfferingKind = type === "online_store" ? "product" : "service";
  return {
    businessType: type,
    name: "",
    tagline: "",
    description: "",
    industry: "",
    voice: "Clear, warm, and concise. Never invent policies or prices.",
    contact: {
      email: "",
      phone: "",
      address: "",
      website: "",
      extra: "",
    },
    hours: defaultHours(),
    offerings: [
      {
        id: nid("off"),
        kind,
        name: "",
        summary: "",
        price: "",
        availability: "",
        details: "",
      },
    ],
    pricingNotes: "",
    policies: [
      {
        id: nid("pol"),
        title: "",
        summary: "",
      },
    ],
    faqs: [
      {
        id: nid("faq"),
        question: "",
        answer: "",
      },
    ],
    documents: [],
    escalation: {
      autoAnswerChat: true,
      alwaysEscalateTopics:
        "Billing disputes, legal threats, complaints about staff, anything involving personal account data",
      neverAutoAnswer:
        "Medical or legal advice, promises of refunds outside published policy, account-specific lookups",
      emergencyInstructions:
        "If someone may be in danger, tell them to call emergency services and notify a human immediately.",
      handoffMessage:
        "I want to make sure you get a precise answer. I'm looping in a teammate who can take it from here.",
      afterHoursNote:
        "Outside published hours, take a message. Do not promise an exact callback time.",
    },
    store:
      type === "online_store"
        ? {
            shippingPolicy: "",
            stockMessaging: "",
            paymentMethods: "",
            cashOnDelivery: false,
            orderTrackingNotes: "",
          }
        : undefined,
    serviceOps:
      type === "service"
        ? {
            serviceArea: "",
            bookingLeadTime: "",
            onsiteVsRemote: "",
            emergencyCallout: "",
          }
        : undefined,
    clinicOps:
      type === "clinic"
        ? {
            appointmentBooking: "",
            insuranceAccepted: "",
            newPatientProcess: "",
            emergencyProtocol:
              "Chest pain, trouble breathing, severe bleeding, stroke symptoms, or a fever in an infant: tell them to call emergency services or go to the nearest ER. Never give clinical advice in chat.",
            clinicalAdvicePolicy:
              "Do not diagnose, suggest medications, or interpret symptoms. Collect the question and hand it to a clinician.",
          }
        : undefined,
  };
}
