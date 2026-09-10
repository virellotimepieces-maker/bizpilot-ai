import { emptyKnowledge } from "./empty-knowledge";
import type { BusinessPreset, KnowledgeBase } from "./types";

function hours(
  tz: string,
  notes: string,
  spec: Record<string, [string, string] | "closed">,
): KnowledgeBase["hours"] {
  const days: KnowledgeBase["hours"]["days"] = (
    [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ] as const
  ).map((day) => {
    const value = spec[day] ?? "closed";
    if (value === "closed") {
      return { day, closed: true, open: "09:00", close: "17:00" };
    }
    return { day, closed: false, open: value[0], close: value[1] };
  });
  return { timezone: tz, notes, days };
}

const storeKnowledge: KnowledgeBase = {
  ...emptyKnowledge("online_store"),
  businessType: "online_store",
  name: "Field & Ember Outfitters",
  tagline: "Trail-ready wool and camp goods",
  industry: "Outdoor retail",
  description:
    "Field & Ember is an independent outdoor shop based in Portland, Oregon. We sell a small, considered collection of wool layers, camp cookware, and trail accessories. Online selling is how many customers reach us; we also have a neighborhood workshop on Alberta Street.",
  voice:
    "Practical and neighborly. Talk about real products and published policies. Never invent stock, tracking, or discounts.",
  contact: {
    email: "hello@fieldandember.example",
    phone: "(503) 555-0148",
    address: "412 NE Alberta St, Portland, OR 97211",
    website: "https://fieldandember.example",
    extra: "Workshop pickup is available Tuesday–Saturday.",
  },
  hours: hours(
    "America/Los_Angeles",
    "The workshop floor is open to walk-ins. Online chat follows the same hours; after close we reply the next business morning.",
    {
      monday: "closed",
      tuesday: ["10:00", "18:00"],
      wednesday: ["10:00", "18:00"],
      thursday: ["10:00", "18:00"],
      friday: ["10:00", "18:00"],
      saturday: ["10:00", "17:00"],
      sunday: ["11:00", "16:00"],
    },
  ),
  offerings: [
    {
      id: "off_trail_jacket",
      kind: "product",
      name: "Hearth Trail Jacket",
      summary:
        "Unlined boiled-wool jacket with a two-way zip and storm cuffs. Made for shoulder-season hiking, not alpine storms.",
      price: "$248",
      availability: "In stock in S, M, L. XL ships in 10–12 days.",
      details: "Charcoal and cedar. Dry clean only. 30-day returns if unworn.",
    },
    {
      id: "off_enamel_mug",
      kind: "product",
      name: "Ember Enamel Mug",
      summary: "12 oz speckled enamel mug. Campfire-safe, not microwave-safe.",
      price: "$18, or $32 for a pair",
      availability: "In stock.",
      details: "Ships in recycled kraft. Not sold as a subscription.",
    },
    {
      id: "off_ridge_socks",
      kind: "product",
      name: "Ridge Merino Crew Socks",
      summary: "Midweight merino hiking socks with a reinforced heel.",
      price: "$22 / pair",
      availability: "Sizes S–XL in stock except burnt-orange XL, which is waitlisted.",
      details: "We do not restock waitlisted colors on a published date.",
    },
  ],
  pricingNotes:
    "Prices on this knowledge base are the current public prices. We do not price-match marketplace listings. Wholesale inquiries go to a human.",
  policies: [
    {
      id: "pol_returns",
      title: "Returns",
      summary:
        "Unworn items can be returned within 30 days with the packing slip. Sale items and worn footwear are final. Refunds go back to the original payment method in 5–8 business days.",
    },
    {
      id: "pol_privacy",
      title: "Privacy",
      summary:
        "We keep order emails and shipping addresses to fulfill purchases. We do not sell customer lists.",
    },
  ],
  faqs: [
    {
      id: "faq_pickup",
      question: "Can I pick up an online order at the workshop?",
      answer:
        "Yes. Choose workshop pickup at checkout. Orders placed before 1 p.m. local time are usually ready the same afternoon on days we are open.",
    },
    {
      id: "faq_wool_care",
      question: "How should I care for the Hearth Trail Jacket?",
      answer:
        "Spot clean when you can and dry clean when needed. Do not machine wash or tumble dry the boiled wool.",
    },
    {
      id: "faq_gift",
      question: "Do you offer gift wrap?",
      answer:
        "We can include a kraft sleeve and a blank card on request. There is no extra charge. We cannot print custom messages.",
    },
  ],
  documents: [
    {
      id: "doc_size_chart",
      title: "Hearth Trail Jacket size chart",
      visibility: "public",
      body: "S: chest 36–38 in. M: 39–41. L: 42–44. XL: 45–47. The jacket is meant to layer over a midweight sweater; size up if you want a very easy fit.",
    },
    {
      id: "doc_vip_returns",
      title: "Internal: goodwill returns",
      visibility: "internal",
      body: "Managers may extend a return to 45 days for repeat customers. Never advertise this. Website chat must not promise extra time. Email drafts may mention that a teammate will review an exception.",
    },
  ],
  store: {
    shippingPolicy:
      "We ship with USPS Ground from Portland. Lower 48: 3–6 business days, $8 flat or free over $120. Alaska and Hawaii: $18, 6–10 business days. We do not currently ship outside the United States.",
    stockMessaging:
      "Only list sizes and colors written on each product. If a size is waitlisted, say so. Never guess a restock date.",
    paymentMethods:
      "Visa, Mastercard, American Express, and Shop Pay. Cash on delivery is available only for workshop pickup orders inside Portland city limits, paid in cash at the counter.",
    cashOnDelivery: true,
    orderTrackingNotes:
      "Tracking is emailed when the label is created. BizPilot cannot look up a live order. Any message with an order number must go to a human.",
  },
  escalation: {
    autoAnswerChat: true,
    alwaysEscalateTopics:
      "Order lookups, damaged-in-transit claims, chargebacks, wholesale, custom sizing beyond the size chart, return exceptions",
    neverAutoAnswer:
      "Promises of restock dates, discounts, or returns outside the 30-day policy",
    emergencyInstructions:
      "This is a retail shop. If a visitor reports an unsafe product, collect details and hand off to a human the same day.",
    handoffMessage:
      "I want a teammate to look at this with the actual order in front of them. I'm passing it to the Field & Ember desk now.",
    afterHoursNote:
      "After hours, website chat should say we'll reply the next morning we are open. Do not promise same-night shipping.",
  },
};

const serviceKnowledge: KnowledgeBase = {
  ...emptyKnowledge("service"),
  businessType: "service",
  name: "Lumen Electrical Co.",
  tagline: "Licensed residential electricians for the East Bay",
  industry: "Home services / electrical",
  description:
    "Lumen Electrical is a licensed, insured residential electrical contractor. We handle repairs, panel upgrades, lighting, and EV charger installs for homes in Oakland, Berkeley, Alameda, and nearby East Bay cities. We are not a retail store and we do not sell products online.",
  voice:
    "Calm, direct, and safety-first. Quote published rates only. Never diagnose a hazard as 'probably fine'.",
  contact: {
    email: "dispatch@lumenelectrical.example",
    phone: "(510) 555-0192",
    address: "Serving the East Bay from our Oakland shop, 880 27th St",
    website: "https://lumenelectrical.example",
    extra: "CSLB #1048821. Text the dispatch line for same-day triage.",
  },
  hours: hours(
    "America/Los_Angeles",
    "Office and dispatch: weekdays. Emergency call-out is available nights and weekends at the emergency rate.",
    {
      monday: ["08:00", "17:00"],
      tuesday: ["08:00", "17:00"],
      wednesday: ["08:00", "17:00"],
      thursday: ["08:00", "17:00"],
      friday: ["08:00", "16:00"],
      saturday: "closed",
      sunday: "closed",
    },
  ),
  offerings: [
    {
      id: "off_repair",
      kind: "service",
      name: "Diagnostic visit & small repair",
      summary:
        "On-site diagnosis for outlets, switches, breakers, and lighting. First hour includes troubleshooting.",
      price: "$165 first hour, $95 each additional half hour",
      availability: "Weekday visits usually 2–5 business days out.",
      details: "Parts are quoted before we install them. We do not leave mystery charges.",
    },
    {
      id: "off_panel",
      kind: "service",
      name: "Panel upgrade",
      summary: "100A to 200A service upgrades for older East Bay homes, including permit coordination.",
      price: "Typical range $3,800–$6,400 depending on the utility and panel location",
      availability: "Site visit required. Booked 2–4 weeks out after the quote.",
      details: "We pull the permit. Utility fees are passed through at cost.",
    },
    {
      id: "off_ev",
      kind: "service",
      name: "Level 2 EV charger install",
      summary:
        "Hardwired 240V charger install for a homeowner-supplied or Lumen-sourced unit, including a load calculation.",
      price: "From $890 if the panel has capacity; more if a panel upgrade is required",
      availability: "Site visit first. Install dates are typically 1–3 weeks after approval.",
      details: "We install ChargePoint, Emporia, and Tesla Wall Connector units. We do not sell cars or chargers as a storefront.",
    },
  ],
  pricingNotes:
    "The diagnostic rate is the published rate for homes inside our service area. After-hours emergency dispatch is $295 to walk in the door, then the hourly rate. We do not quote commercial work from this knowledge base.",
  policies: [
    {
      id: "pol_warranty",
      title: "Workmanship warranty",
      summary:
        "Labor is warranted for 24 months. Manufacturer warranties apply to devices we install. Damage from water intrusion, pests, or another trade is not covered.",
    },
    {
      id: "pol_cancel",
      title: "Cancellation",
      summary:
        "Cancel or reschedule with 24 hours' notice at no charge. Same-day cancellations may be billed a $95 trip fee if a technician is already routed.",
    },
  ],
  faqs: [
    {
      id: "faq_area",
      question: "Which cities do you serve?",
      answer:
        "Oakland, Berkeley, Alameda, Piedmont, Emeryville, Albany, and San Leandro. We sometimes take El Cerrito and Lafayette if the schedule allows — those go to dispatch to confirm.",
    },
    {
      id: "faq_permit",
      question: "Do you pull permits?",
      answer:
        "Yes for panel upgrades, service changes, and EV charger circuits. Like-for-like device swaps on an existing circuit usually do not need a new permit.",
    },
    {
      id: "faq_license",
      question: "Are you licensed and insured?",
      answer:
        "Yes. CSLB #1048821, general liability and workers' compensation on file. We can email certificates to a property manager on request — that request should go to a human.",
    },
  ],
  documents: [
    {
      id: "doc_prep",
      title: "How to prepare for a visit",
      visibility: "public",
      body: "Clear the panel and the work area. Park so the van can be within 50 feet when possible. Someone 18 or older must be home. Pets in another room.",
    },
    {
      id: "doc_priority",
      title: "Internal: dispatch priority",
      visibility: "internal",
      body: "Priority 1: sparking, burning smell, hot panel, no power to medical equipment. Those never wait on a website answer — call the customer. Priority 2: no power to a refrigerator. Do not publish this queue in chat.",
    },
  ],
  serviceOps: {
    serviceArea:
      "East Bay cities listed in the FAQ. We do not take San Francisco, Marin, or the South Bay.",
    bookingLeadTime:
      "Routine visits: 2–5 business days. Panel and EV work: site visit, then a scheduled install. Same-day routine work is uncommon.",
    onsiteVsRemote:
      "Almost all work is on-site. We can review photos for a rough sense of scope, but a photo is not a quote.",
    emergencyCallout:
      "Nights, weekends, and holidays: $295 dispatch plus hourly. If there is a burning smell, sparking, or a flooded panel, say to keep people away, shut off the main if it is safe, and call 911 if there is fire or smoke.",
  },
  escalation: {
    autoAnswerChat: true,
    alwaysEscalateTopics:
      "Insurance certificates, damage claims, unpaid invoices, work we already performed, anything involving a named technician",
    neverAutoAnswer:
      "Whether a live electrical hazard is 'safe to ignore', commercial bids, and any promise to arrive today unless dispatch already confirmed it",
    emergencyInstructions:
      "Sparking, smoke, burning smell, or flood at the panel: instruct them to stay clear, cut the main only if they can do so safely, and call 911 if there is fire. Then escalate to dispatch immediately.",
    handoffMessage:
      "This needs dispatch, not an automated reply. I'm handing it to the Lumen team now.",
    afterHoursNote:
      "After 5 p.m. weekdays and all weekend, only emergency electrical hazards should be offered the after-hours rate. Everything else waits for weekday dispatch.",
  },
};

const clinicKnowledge: KnowledgeBase = {
  ...emptyKnowledge("clinic"),
  businessType: "clinic",
  name: "Willowbrook Family Clinic",
  tagline: "Primary care for every season of family life",
  industry: "Family medicine clinic",
  description:
    "Willowbrook is a small family medicine clinic in Sacramento. We see infants through older adults for checkups, vaccines, and same-day sick visits. We are not an emergency department and we do not operate an online store.",
  voice:
    "Warm, plain-spoken, and careful. Publish hours, booking steps, and insurance lists. Never diagnose or suggest medication.",
  contact: {
    email: "front.desk@willowbrookclinic.example",
    phone: "(916) 555-0174",
    address: "2201 Willowbrook Ave, Sacramento, CA 95825",
    website: "https://willowbrookclinic.example",
    extra: "Fax (916) 555-0175. Patient portal messages are answered on business days.",
  },
  hours: hours(
    "America/Los_Angeles",
    "The clinic is closed on Sundays. A recorded line explains after-hours nurse triage. We are not an ER.",
    {
      monday: ["08:00", "18:00"],
      tuesday: ["08:00", "18:00"],
      wednesday: ["08:00", "18:00"],
      thursday: ["08:00", "18:00"],
      friday: ["08:00", "16:00"],
      saturday: ["09:00", "13:00"],
      sunday: "closed",
    },
  ),
  offerings: [
    {
      id: "off_physical",
      kind: "service",
      name: "Annual physical / wellness visit",
      summary: "Yearly checkup, screenings appropriate to age, and a chance to update vaccines and refills.",
      price: "Billed to insurance when covered. Self-pay $185 for a standard adult wellness visit.",
      availability: "Book 2–6 weeks ahead. New patients should arrive 20 minutes early.",
      details: "Sports physicals can often be added to a wellness visit if we already have a chart.",
    },
    {
      id: "off_sick",
      kind: "service",
      name: "Same-day sick visit",
      summary: "Short-notice visits for colds, ear pain, rashes, and similar primary-care concerns.",
      price: "Billed to insurance as an office visit. Self-pay $145.",
      availability: "Call at 8 a.m. for same-day openings. Website chat cannot reserve a slot.",
      details: "We do not treat chest pain, severe shortness of breath, or injuries that need an ER or urgent care with x-ray.",
    },
    {
      id: "off_vaccines",
      kind: "service",
      name: "Vaccines",
      summary: "Routine childhood and adult vaccines, including flu in season and Tdap.",
      price: "Most vaccines are billed to insurance. A cash price list is available at the desk.",
      availability: "Often available during a scheduled visit. Walk-in flu clinic dates are posted seasonally.",
      details: "Travel vaccines such as yellow fever are not stocked; we refer those.",
    },
  ],
  pricingNotes:
    "We publish self-pay visit prices for people without coverage. Insured patients should expect their plan's copay or deductible. We do not quote specialist or hospital prices.",
  policies: [
    {
      id: "pol_noshow",
      title: "Late and no-show",
      summary:
        "Please arrive 10 minutes early (20 if you are new). More than 15 minutes late may be rescheduled. Repeated no-shows may be billed $40.",
    },
    {
      id: "pol_privacy",
      title: "Patient privacy",
      summary:
        "We do not discuss a patient's chart, test results, or appointments with anyone except the patient or a documented proxy. Website chat and email are not for results.",
    },
  ],
  faqs: [
    {
      id: "faq_book",
      question: "How do I book an appointment?",
      answer:
        "Call (916) 555-0174 or use the patient portal. New patients will be asked for insurance, a photo ID, and a reason for the visit. Chat cannot hold a time slot.",
    },
    {
      id: "faq_kids",
      question: "Do you see children?",
      answer:
        "Yes. We see newborns through adolescents for well visits, vaccines, and many sick visits. We are not a pediatric emergency clinic.",
    },
    {
      id: "faq_records",
      question: "How do I get my records?",
      answer:
        "Use the patient portal for after-visit summaries. Full record transfers need a signed request at the front desk. Allow up to 15 days.",
    },
  ],
  documents: [
    {
      id: "doc_new_patient",
      title: "New patient packet (summary)",
      visibility: "public",
      body: "Bring photo ID, insurance card, a medication list, and prior immunization records if you have them. Arrive 20 minutes early. Forms can be started from the portal the day before.",
    },
    {
      id: "doc_nurse_line",
      title: "Internal: nurse triage phrases",
      visibility: "internal",
      body: "Chat and email must never tell a patient a symptom is fine. For fever in an infant under 3 months, head injury, dehydration, or lethargy, use the emergency protocol and page the on-call clinician.",
    },
  ],
  clinicOps: {
    appointmentBooking:
      "Phone or patient portal only. Describe the process, then ask them to call or use the portal. Do not invent open times.",
    insuranceAccepted:
      "We accept Blue Shield of California PPO, Aetna PPO, Health Net PPO, and Medicare. We do not accept Medi-Cal or Kaiser. Bring the card; we verify eligibility at check-in.",
    newPatientProcess:
      "New patients complete the packet, insurance, and ID. First visits are longer. Transfer of records is optional but helpful.",
    emergencyProtocol:
      "Chest pain, trouble breathing, severe bleeding, stroke symptoms, a seizure, or an infant under 3 months with fever: call 911 or go to the nearest emergency department. Then notify a human. Do not try to manage this in chat.",
    clinicalAdvicePolicy:
      "No diagnoses, no medication names, no 'is this urgent' answers except to send true emergencies to 911. Collect the question for a clinician.",
  },
  escalation: {
    autoAnswerChat: true,
    alwaysEscalateTopics:
      "Symptoms, medications, test results, disability forms, work notes, billing balances, records for a third party, complaints about a clinician",
    neverAutoAnswer:
      "Anything that sounds like a medical question, a request to interpret labs, or a plea to 'just tell me what to take'",
    emergencyInstructions:
      "If the message sounds like an emergency, tell them to call 911 or go to the ER, then escalate. Do not delay that instruction to look up clinic hours.",
    handoffMessage:
      "This needs a person on our clinical or front-desk team rather than an automated answer. I'm passing it to Willowbrook staff now.",
    afterHoursNote:
      "After closing, remind them we are not an ER. For urgent medical concerns they should use nurse triage or emergency services. Appointment requests wait until we reopen.",
  },
};

export const PRESETS: BusinessPreset[] = [
  {
    id: "service-lumen",
    businessType: "service",
    title: "Service business",
    subtitle: "Lumen Electrical Co.",
    blurb:
      "A licensed home-services company: rates, coverage area, booking lead time, and emergency call-out — no catalog or shipping fields.",
    knowledge: serviceKnowledge,
    suggestedQuestions: [
      "Do you work in Berkeley?",
      "What do you charge for a diagnostic visit?",
      "Can you install a Level 2 EV charger?",
      "An outlet is sparking in our kitchen",
    ],
    sampleEmails: [
      {
        fromName: "Priya Raman",
        fromEmail: "priya.raman@example.com",
        subject: "Electrician for a Berkeley bungalow?",
        body: "Hi — we just bought a 1920s bungalow in Berkeley. Do you work in this city, and what is the rate for a diagnostic visit? We also want a Level 2 charger in the garage eventually.",
        receivedAt: "Today, 8:06 AM",
      },
      {
        fromName: "Marcus Hill",
        fromEmail: "marcus.hill@example.com",
        subject: "Panel upgrade quote",
        body: "Our house still has a 100 amp panel. What does a panel upgrade usually cost, and how far out are you booking?",
        receivedAt: "Today, 7:41 AM",
      },
      {
        fromName: "Elena Voss",
        fromEmail: "elena.voss@example.com",
        subject: "Your tech cracked my TV",
        body: "The electrician you sent last Thursday knocked my TV off the wall and you need to pay for it immediately. I will call a lawyer if I don't hear back today.",
        receivedAt: "Yesterday, 6:18 PM",
      },
    ],
  },
  {
    id: "clinic-willowbrook",
    businessType: "clinic",
    title: "Clinic / appointments",
    subtitle: "Willowbrook Family Clinic",
    blurb:
      "An appointment-based clinic: hours, booking, insurance, and a hard rule that symptoms never get an automated medical answer.",
    knowledge: clinicKnowledge,
    suggestedQuestions: [
      "What are your Saturday hours?",
      "Do you take Aetna?",
      "How do I book a physical?",
      "My child has a fever of 104 and is lethargic",
    ],
    sampleEmails: [
      {
        fromName: "Jordan Hale",
        fromEmail: "jordan.hale@example.com",
        subject: "New patient physical",
        body: "Hello, I'd like to become a new patient and book an annual physical. Do you see adults, and how do I schedule? I have Aetna PPO.",
        receivedAt: "Today, 9:12 AM",
      },
      {
        fromName: "Samira Ortiz",
        fromEmail: "samira.ortiz@example.com",
        subject: "Saturday hours",
        body: "Are you open this Saturday, and can I get a vaccine then or do I need an appointment?",
        receivedAt: "Yesterday, 4:03 PM",
      },
      {
        fromName: "Chris Nguyen",
        fromEmail: "chris.nguyen@example.com",
        subject: "What antibiotic should I take?",
        body: "I've had a sore throat for four days. Can you tell me which antibiotic to start and the dosage? I don't want to come in if I don't have to.",
        receivedAt: "Yesterday, 8:55 PM",
      },
    ],
  },
  {
    id: "store-field-ember",
    businessType: "online_store",
    title: "Online store",
    subtitle: "Field & Ember Outfitters",
    blurb:
      "One sample of selling goods: products, prices, shipping, stock, and optional cash-on-delivery for pickup — not required for other businesses.",
    knowledge: storeKnowledge,
    suggestedQuestions: [
      "What are your store hours?",
      "Do you ship to Alaska?",
      "Is the Hearth Trail Jacket in stock in medium?",
      "Can I pay cash on delivery?",
    ],
    sampleEmails: [
      {
        fromName: "Alex Chen",
        fromEmail: "alex.chen@example.com",
        subject: "Shipping to Anchorage + mug pair",
        body: "Hi, do you ship the Ember Enamel Mug pair to Anchorage, Alaska, and what does shipping cost? Also, can I pick up in Portland and pay cash on delivery?",
        receivedAt: "Today, 10:22 AM",
      },
      {
        fromName: "Riley Brooks",
        fromEmail: "riley.brooks@example.com",
        subject: "Jacket size",
        body: "I wear a 40-inch chest and like a sweater underneath. Which size of the Hearth Trail Jacket should I get, and is medium in stock?",
        receivedAt: "Today, 9:04 AM",
      },
      {
        fromName: "Pat Morrow",
        fromEmail: "pat.morrow@example.com",
        subject: "Refund for a jacket I bought in January",
        body: "I bought a Hearth Trail Jacket about eight months ago and now I want a full refund. I still have it. Process this today or I will open a chargeback.",
        receivedAt: "Yesterday, 2:47 PM",
      },
    ],
  },
];

export function presetById(id: string) {
  return PRESETS.find((p) => p.id === id) ?? null;
}
