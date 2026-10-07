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
    instagram: "@fieldandember",
    facebook: "facebook.com/fieldandember",
    tiktok: "@fieldandember",
    messenger: "m.me/fieldandember",
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
    "Lumen Electrical is sample demo data for a licensed, insured residential electrical contractor. It is not a real customer. The sample covers repairs, panel upgrades, lighting, and EV charger installs for homes in Oakland, Berkeley, Alameda, and nearby East Bay cities. It is not a retail store and it does not sell products online.",
  voice:
    "Calm, direct, and safety-first. Quote published rates only. Never diagnose a hazard as 'probably fine'.",
  contact: {
    email: "dispatch@lumenelectrical.example",
    phone: "(510) 555-0192",
    address: "Serving the East Bay from our Oakland shop, 880 27th St",
    website: "https://lumenelectrical.example",
    extra: "CSLB #1048821. Text the dispatch line for same-day triage.",
    instagram: "@lumenelectrical",
    facebook: "facebook.com/lumenelectrical",
    tiktok: "",
    messenger: "m.me/lumenelectrical",
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
    instagram: "@willowbrookclinic",
    facebook: "facebook.com/willowbrookclinic",
    tiktok: "",
    messenger: "",
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

const dentalKnowledge: KnowledgeBase = {
  ...emptyKnowledge("clinic"),
  businessType: "clinic",
  name: "Harbor Dental",
  tagline: "Sample neighborhood dental office",
  industry: "Dental clinic",
  description:
    "Harbor Dental is sample demo data for a small dental clinic. It is not a real practice and not a live patient. The published facts are office hours, the new-patient cleaning fee, and how to request a visit.",
  voice:
    "Calm and specific. Repeat published hours and the published cleaning fee. Never diagnose, recommend treatment, or invent a fee.",
  contact: {
    email: "frontdesk@harbordental.example",
    phone: "(415) 555-0164",
    address: "18 Harbor Lane, Oakland, CA 94607",
    website: "https://harbordental.example",
    extra: "Sample office. Appointment requests wait for the front desk.",
    instagram: "",
    facebook: "",
    tiktok: "",
    messenger: "",
  },
  hours: hours(
    "America/Los_Angeles",
    "The sample office is closed Saturday and Sunday. After hours, callers can leave a message. This is not an emergency department.",
    {
      monday: ["08:00", "17:00"],
      tuesday: ["08:00", "17:00"],
      wednesday: ["08:00", "17:00"],
      thursday: ["08:00", "17:00"],
      friday: ["08:00", "14:00"],
      saturday: "closed",
      sunday: "closed",
    },
  ),
  offerings: [
    {
      id: "off_cleaning",
      kind: "service",
      name: "New-patient cleaning and exam",
      summary: "First visit for an adult cleaning and exam at this sample office.",
      price: "$189 self-pay for the published new-patient cleaning and exam",
      availability: "Request a visit. Chat cannot hold a time or say a chair is open.",
      details: "Arrive 15 minutes early with photo ID and an insurance card if you have one.",
    },
  ],
  pricingNotes:
    "The new-patient cleaning and exam is the only published fee. Crown fees, filling fees, and whitening fees are not published. There is no published promotion or discount.",
  policies: [
    {
      id: "pol_cancel",
      title: "Cancellation",
      summary:
        "Cancel or reschedule with one business day's notice. A late-cancellation fee is not published.",
    },
    {
      id: "pol_privacy",
      title: "Patient privacy",
      summary:
        "Chat and email are not for charts, images, or treatment plans. The sample office does not discuss another person's visit.",
    },
  ],
  faqs: [
    {
      id: "faq_saturday",
      question: "Are you open on Saturday?",
      answer: "No. The sample office is closed Saturday and Sunday.",
    },
    {
      id: "faq_request",
      question: "How do I request an appointment?",
      answer:
        "Call (415) 555-0164 or leave a name and email. The front desk confirms a time. Chat cannot reserve a chair.",
    },
  ],
  documents: [
    {
      id: "doc_unlisted_fees",
      title: "Internal: unlisted fees",
      visibility: "internal",
      body: "Do not quote a crown, filling, or whitening fee from chat. Those numbers are not in the published list.",
    },
  ],
  clinicOps: {
    appointmentBooking:
      "Phone, or a request with a name and email. The office confirms the time. Chat cannot reserve a slot or say a day is open.",
    insuranceAccepted:
      "Delta Dental PPO and Cigna PPO are the published plans. Other plans are not listed. Bring the card.",
    newPatientProcess:
      "New patients can request the published cleaning and exam. Arrive 15 minutes early with photo ID.",
    emergencyProtocol:
      "Swelling, uncontrolled bleeding, trauma, or trouble breathing: call 911 or go to an emergency department. This sample office is not an emergency department.",
    clinicalAdvicePolicy:
      "No diagnosis, no medication, and no treatment advice. Tooth pain and 'what should I do' go to the dentist. Chat repeats published hours and the published cleaning fee only.",
  },
  escalation: {
    autoAnswerChat: true,
    alwaysEscalateTopics:
      "Symptoms, medications, x-rays, treatment plans, billing balances, complaints about a clinician",
    neverAutoAnswer:
      "Dental advice, medication, and any promise that a specific time is open",
    emergencyInstructions:
      "If the message describes swelling, bleeding, trauma, or trouble breathing, tell them to call 911 or go to an emergency department, then hand off.",
    handoffMessage:
      "This needs the Harbor Dental front desk, not an automated dental answer. I'm passing it to the office now.",
    afterHoursNote:
      "After closing, repeat that the office is closed and that a time is not reserved. Appointment requests wait until the office is open.",
  },
};

const localServiceKnowledge: KnowledgeBase = {
  ...emptyKnowledge("service"),
  businessType: "service",
  name: "Cedar Lane Home Cleaning",
  tagline: "Sample local cleaning service",
  industry: "Local home services",
  description:
    "Cedar Lane Home Cleaning is sample demo data for a local service business. It is not a real company and not a live customer. Published facts are the neighborhoods, hours, and the standard clean rate.",
  voice:
    "Plain and local. Repeat the published rate and the listed neighborhoods. Never invent a coupon or a price that is not written down.",
  contact: {
    email: "hello@cedarlane.example",
    phone: "(510) 555-0133",
    address: "Serving listed neighborhoods from 400 Cedar Lane, Oakland, CA 94606",
    website: "https://cedarlane.example",
    extra: "Sample business. A requested date is not a reserved visit.",
    instagram: "",
    facebook: "",
    tiktok: "",
    messenger: "",
  },
  hours: hours(
    "America/Los_Angeles",
    "Crews run on the hours below. Chat can repeat them. It cannot promise a crew is free on a requested day.",
    {
      monday: ["08:00", "18:00"],
      tuesday: ["08:00", "18:00"],
      wednesday: ["08:00", "18:00"],
      thursday: ["08:00", "18:00"],
      friday: ["08:00", "18:00"],
      saturday: ["09:00", "13:00"],
      sunday: "closed",
    },
  ),
  offerings: [
    {
      id: "off_standard_clean",
      kind: "service",
      name: "Standard home clean",
      summary: "Recurring or one-time clean for a home up to 1,500 square feet in Cedar Lane, Maple Court, or the Harbor district.",
      price: "$145 for a published standard clean",
      availability: "Usually booked 4–7 days out. Chat cannot hold a date.",
      details: "Supplies are included. A requested day is a request for the owner to confirm.",
    },
  ],
  pricingNotes:
    "The standard clean rate is the only published price. Move-out prices and coupons are not published. There is no published first-visit discount.",
  policies: [
    {
      id: "pol_reschedule",
      title: "Reschedule",
      summary:
        "Reschedule with one business day's notice. A same-day cancellation fee is not published.",
    },
  ],
  faqs: [
    {
      id: "faq_area",
      question: "Which neighborhoods do you clean?",
      answer: "Cedar Lane, Maple Court, and the Harbor district. Other neighborhoods are not listed.",
    },
    {
      id: "faq_pets",
      question: "Do you clean homes with dogs?",
      answer: "Yes, if the dog is in another room during the clean. That is the published note.",
    },
  ],
  documents: [
    {
      id: "doc_unlisted_prices",
      title: "Internal: unlisted prices",
      visibility: "internal",
      body: "Do not invent a move-out price or a coupon. Only the standard clean rate is published.",
    },
  ],
  serviceOps: {
    serviceArea: "Cedar Lane, Maple Court, and the Harbor district. Other neighborhoods are not listed.",
    bookingLeadTime:
      "Standard cleans are usually 4–7 days out. A requested date is a request, not a reserved visit.",
    onsiteVsRemote: "Cleaning is on-site. Photos are not a quote.",
    emergencyCallout: "This sample business does not offer emergency call-out.",
  },
  escalation: {
    autoAnswerChat: true,
    alwaysEscalateTopics: "Damage claims, unpaid invoices, access codes, and complaints about a cleaner",
    neverAutoAnswer: "Unpublished prices, coupons, and any promise that a specific day is reserved",
    emergencyInstructions:
      "This is a cleaning sample, not emergency services. If someone reports a hazard, tell them to contact local emergency services, then hand off.",
    handoffMessage:
      "This needs the Cedar Lane owner, not an automated promise. I'm handing it over now.",
    afterHoursNote:
      "After the published hours, repeat the hours and do not reserve a crew.",
  },
};

export const PRESETS: BusinessPreset[] = [
  {
    id: "service-lumen",
    businessType: "service",
    title: "Service business",
    subtitle: "Lumen Electrical Co.",
    blurb:
      "Sample contractor / home services data. Published rates and service area only. Not a real customer.",
    knowledge: serviceKnowledge,
    suggestedQuestions: [
      "Do you work in Berkeley?",
      "What do you charge for a diagnostic visit?",
      "Can you install a Level 2 EV charger?",
      "How much is a commercial warehouse bid?",
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
    sampleSocials: [
      {
        platform: "instagram",
        fromName: "Priya Raman",
        handle: "@priya.home",
        body: "Hi — we just bought a 1920s bungalow in Berkeley. Do you work in this city, and what is the rate for a diagnostic visit?",
        receivedAt: "Today, 8:14 AM",
      },
      {
        platform: "messenger",
        fromName: "Elena Voss",
        handle: "Elena Voss",
        body: "An outlet is sparking in our kitchen. What should we do right now?",
        receivedAt: "Yesterday, 9:02 PM",
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
    sampleSocials: [
      {
        platform: "facebook",
        fromName: "Jordan Hale",
        handle: "Jordan Hale",
        body: "Are you open this Saturday, and can I get a vaccine then or do I need an appointment?",
        receivedAt: "Yesterday, 4:11 PM",
      },
      {
        platform: "instagram",
        fromName: "Chris Nguyen",
        handle: "@chris.n",
        body: "I've had a sore throat for four days. Can you tell me which antibiotic to start and the dosage?",
        receivedAt: "Yesterday, 8:58 PM",
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
    sampleSocials: [
      {
        platform: "instagram",
        fromName: "Riley Brooks",
        handle: "@rileyhikes",
        body: "I wear a 40-inch chest and like a sweater underneath. Which size of the Hearth Trail Jacket should I get, and is medium in stock?",
        receivedAt: "Today, 9:11 AM",
      },
      {
        platform: "tiktok",
        fromName: "Alex Chen",
        handle: "@alexc",
        body: "Do you ship the Ember Enamel Mug pair to Anchorage, Alaska, and what does shipping cost?",
        receivedAt: "Today, 10:30 AM",
      },
    ],
  },
  {
    id: "clinic-harbor-dental",
    businessType: "clinic",
    title: "Dental clinic",
    subtitle: "Harbor Dental",
    blurb:
      "Sample dental clinic. Published hours and one cleaning fee. Crown fees and promotions are not in the knowledge base.",
    knowledge: dentalKnowledge,
    suggestedQuestions: [
      "Are you open on Saturday?",
      "What is the new-patient cleaning fee?",
      "How much is a porcelain crown?",
      "Do you have a whitening promotion this month?",
    ],
    sampleEmails: [
      {
        fromName: "Maya Chen",
        fromEmail: "maya.chen@example.com",
        subject: "New patient cleaning",
        body: "Hello, I would like a new-patient cleaning. What is the published fee, and can the office contact me at this email?",
        receivedAt: "Today, 9:20 AM",
      },
      {
        fromName: "Luis Ortega",
        fromEmail: "luis.ortega@example.com",
        subject: "Crown price",
        body: "How much is a porcelain crown, and do you have a whitening promotion this month?",
        receivedAt: "Today, 8:05 AM",
      },
    ],
    sampleSocials: [
      {
        platform: "facebook",
        fromName: "Maya Chen",
        handle: "Maya Chen",
        body: "Are you open on Saturday, and what is the new-patient cleaning fee?",
        receivedAt: "Today, 9:28 AM",
      },
    ],
  },
  {
    id: "service-cedar-lane",
    businessType: "service",
    title: "Local service business",
    subtitle: "Cedar Lane Home Cleaning",
    blurb:
      "Sample local service business. Published neighborhoods and the standard clean rate. Move-out prices and coupons are not published.",
    knowledge: localServiceKnowledge,
    suggestedQuestions: [
      "What does a standard clean cost in the Harbor district?",
      "Do you serve the Harbor district?",
      "How much is a move-out, and is there a first-visit coupon?",
      "Can you reserve Tuesday at 2?",
    ],
    sampleEmails: [
      {
        fromName: "Andre Walsh",
        fromEmail: "andre.walsh@example.com",
        subject: "Standard clean in the Harbor district",
        body: "Hi — what does a standard clean cost in the Harbor district? Please contact me at this email.",
        receivedAt: "Today, 11:02 AM",
      },
      {
        fromName: "Nina Patel",
        fromEmail: "nina.patel@example.com",
        subject: "Move-out price",
        body: "How much is a move-out, and is there a first-visit coupon?",
        receivedAt: "Yesterday, 3:40 PM",
      },
    ],
    sampleSocials: [
      {
        platform: "instagram",
        fromName: "Andre Walsh",
        handle: "@andrewalsh",
        body: "What does a standard clean cost in the Harbor district?",
        receivedAt: "Today, 11:10 AM",
      },
    ],
  },
];

export function presetById(id: string) {
  return PRESETS.find((p) => p.id === id) ?? null;
}
