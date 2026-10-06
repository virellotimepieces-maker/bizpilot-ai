import type { SeoLandingPage } from "@/lib/marketing/seo-pages";
import { BIZPILOT_PRO } from "@/lib/plan";
import { formatPlanPriceUsd } from "@/lib/marketing/copy";

const PLAN_PRICE = `USD ${formatPlanPriceUsd()} per month`;
const PLAN_REPLIES = BIZPILOT_PRO.replyLimit;

const HONEST =
  "Honest AI does not invent prices, policies, promotions, or missing business facts.";

export const INTENT_PAGES: readonly SeoLandingPage[] = [
  {
    path: "/ai-customer-service-for-small-business",
    label: "AI customer service for small business",
    intent: "AI customer service for small business",
    title: "AI Customer Service for Small Business — Bizlyro AI",
    description:
      "Bizlyro AI is an AI customer service for small business websites. It answers published questions 24/7 and captures leads for the owner to review.",
    eyebrow: "Small business support",
    h1: "AI customer service for small business, while you are with a customer",
    lede:
      "A small business often has one person covering the phone, the counter, and the inbox. Bizlyro AI answers the customer-service questions you have already written down, at any hour, and keeps a lead when the visitor wants a person. " +
      HONEST,
    previewHeading: "A support reply a small team can stand behind",
    previewNote:
      "The sample shows a published hours answer and a request that waits for you. The names are sample copy, not live customers.",
    sections: [
      {
        heading: "The owner is the support desk",
        paragraphs: [
          "Searchers looking for AI customer service for small business are usually not staffing a call center. They are fitting a haircut, closing a shop, or driving between jobs when someone asks whether Thursday is open, whether a cancellation fee applies, or whether a published service includes the thing they need. A contact form stores a name. It leaves the question sitting there until morning.",
          "Bizlyro AI is the website assistant for that gap. It replies from the hours, policies, and FAQs published for that one business. It can do that 24/7 because the facts are already written. It does not mean a teammate is awake. When the visitor asks for a person, or the question is a complaint, the thread waits in Inbox.",
        ],
        links: [
          { href: "/ai-customer-service-assistant", label: "How after-hours support handoff works" },
          { href: "/#inbox", label: "Inbox on the homepage" },
        ],
      },
      {
        heading: "Example: a holiday hour and a cancellation rule",
        paragraphs: [
          "A bakery publishes that it is closed the Monday after a holiday and that custom cakes need two days’ notice. A visitor asks both questions at 9 p.m. The widget can repeat those two facts because the owner wrote them. It should not add a promise that someone will decorate a cake overnight.",
          "If the holiday closure was never published, the assistant should say the information is not available and keep the gap. That is the small-business version of customer service: answer the repeat questions, and do not improvise the exception that only the owner knows.",
        ],
      },
      {
        heading: "Leads still have a place to land",
        paragraphs: [
          "Some visitors do not want an answer. They want a callback about a private event, a repair, or a complaint. The chat can collect the name, email, and the request. That row shows up in Leads for the owner to review. It is not a closed sale and it is not an email sent on its own.",
          `The plan is ${PLAN_PRICE} for one workspace, one website widget, and ${PLAN_REPLIES} AI-generated customer replies in a billing month. When the allowance is used, AI answers pause and the visitor is offered a person. There is no automatic overage charge.`,
        ],
        links: [
          { href: "/ai-lead-capture-for-small-business", label: "AI lead capture for small business" },
          { href: "/#pricing", label: "Pricing" },
        ],
      },
      {
        heading: "What you check when you are back",
        paragraphs: [
          "Inbox holds the threads that paused. You can see what the visitor asked and what was answered from Knowledge. You reply in your own words when the shop is quiet. Gmail, if you connect it, can draft a reply, and that email goes out only after you confirm.",
          "That loop is the product: publish the safe answers, let the website repeat them, and keep the human conversations in one queue. Quote prices that were never published belong on the sales guide, not in a guessed support reply.",
        ],
        links: [{ href: "/ai-sales-assistant", label: "AI sales assistant" }],
      },
    ],
    benefitsHeading: "Support coverage for a one-desk business",
    benefits: [
      {
        title: "Repeat questions get the written answer",
        body: "Hours, cancellation rules, and service notes you already give on the phone can be repeated in the widget.",
      },
      {
        title: "24/7 answers, not a night shift",
        body: "The assistant is available when the site is. A person from the business still handles complaints and anything unpublished.",
      },
      {
        title: "Callback requests stay in Leads",
        body: "Name, email, and the reason for the visit are stored for you. The assistant does not email the customer by itself.",
      },
    ],
    limitsHeading: "Limits of small-business customer service",
    limits: [
      {
        title: "Honest AI",
        body: `${HONEST} A missing holiday hour or fee stays unanswered until you publish it or reply yourself.`,
      },
      {
        title: "Not a second employee",
        body: "It does not take the phone, run the register, or promise that someone from the business is available around the clock.",
      },
      {
        title: "Sensitive threads wait",
        body: "Complaints, legal or medical questions, and emergencies are for Inbox. The assistant should not invent a policy to sound helpful.",
      },
    ],
    stepsHeading: "Put small-business support on the site",
    steps: [
      {
        title: "Create the account",
        body: `Get started opens signup. Subscribe to Bizlyro AI at ${PLAN_PRICE} when you want the paid widget.`,
      },
      {
        title: "Publish the answers you already give",
        body: "Add hours, holiday closures, and the policies you repeat. Leave one-off exceptions out.",
      },
      {
        title: "Review Inbox and Leads",
        body: "Install the snippet from the Widget page. Answered questions stay in chat. People who need you wait in the workspace.",
      },
    ],
    faqsHeading: "Small-business support questions",
    faqs: [
      {
        question: "Is AI customer service for small business the same as hiring overnight staff?",
        answer:
          "No. Bizlyro AI repeats published facts on your website at any hour. A person from your business still replies to complaints and to anyone who asked to talk to someone.",
      },
      {
        question: "Will it invent a fee or a promotion to keep the visitor happy?",
        answer: `${HONEST} If a price or offer is not in Knowledge, it should ask you rather than make one up.`,
      },
      {
        question: "Can it capture a lead during a support chat?",
        answer:
          "Yes. When a visitor shares a name and email, or asks for a callback, the request can land in Leads for you to review. It does not close a sale.",
      },
      {
        question: "What does the plan cost?",
        answer: `Bizlyro AI is ${PLAN_PRICE} for one business and ${PLAN_REPLIES} AI-generated customer replies each billing month. There is no automatic overage charge. Get started creates the account, then you subscribe.`,
      },
    ],
    relatedHeading: "Related ways to use the same assistant",
    related: [
      { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
      { href: "/ai-lead-capture-for-small-business", label: "AI lead capture for small business" },
      { href: "/ai-website-chatbot-for-small-business", label: "AI website chatbot for small business" },
      { href: "/signup", label: "Get started for $29.99/month" },
    ],
    closeHeading: "Answer the questions you already know by heart",
    closeBody: `Create an account and subscribe to Bizlyro AI for ${PLAN_PRICE}. Publish the support facts this page describes, then review the leads and handoffs yourself.`,
  },
  {
    path: "/ai-website-chatbot-for-small-business",
    label: "AI website chatbot for small business",
    intent: "AI website chatbot for small business",
    title: "AI Website Chatbot for Small Business — Bizlyro AI",
    description:
      "Bizlyro AI is an AI website chatbot for small business sites. Visitors ask on your page, get published answers, and can leave a lead.",
    eyebrow: "On your website",
    h1: "An AI website chatbot for small business, on the page they already opened",
    lede:
      "People looking for an AI website chatbot for small business want the conversation on their own site, not in a separate app the visitor must download. Bizlyro AI is that widget: it answers from the knowledge you publish and can capture a lead in the same thread. " +
      HONEST,
    previewHeading: "The chat your visitor sees",
    previewNote:
      "This is the website chat layout next to the workspace Inbox. Messages here are sample copy so the page does not pretend to show live customers.",
    sections: [
      {
        heading: "The website is where the question starts",
        paragraphs: [
          "A small-business site often explains the offer and then ends in a form. The visitor still has a question about a published package, a service area, or the hours printed on the contact page. An AI website chatbot sits on that page and answers from those facts. The visitor does not create an account.",
          "Bizlyro AI includes one installed website widget for the workspace. That is the customer surface, available 24/7 for published answers. You work from Inbox, Leads, and Knowledge. The public demo is a browser-only preview of the layout. It is not the chatbot your customers use, and it does not call an AI model.",
        ],
        links: [
          { href: "/ai-chatbot-for-small-business", label: "How a small business installs the widget" },
          { href: "/#widget", label: "Website widget" },
        ],
      },
      {
        heading: "Example: a question on the services page",
        paragraphs: [
          "A studio publishes that a beginner class is 45 minutes and listed at a price on the services page. A visitor in the widget asks what the class includes. The chatbot can explain the published length and price. It should not add a first-class promotion that was never written down.",
          "If the visitor then says they want to be contacted, the chat can take their name and email. The lead waits for the studio. The chatbot does not mark a spot reserved and does not email them a confirmation on its own.",
        ],
      },
      {
        heading: "One snippet, one business",
        paragraphs: [
          "After you subscribe, the Widget page in the paid workspace shows the snippet for that site. Customers open the chat, ask in their own words, and either receive a published answer or a handoff. There is not a second widget for a second brand on the same account.",
          `Bizlyro AI is ${PLAN_PRICE}, with ${PLAN_REPLIES} AI-generated customer replies in the billing month. When that allowance is used, answers pause. There is no automatic overage invoice and no free plan that sends live AI replies.`,
        ],
        links: [
          { href: "/ai-chatbot-for-local-businesses", label: "AI chatbot for local businesses" },
          { href: "/signup", label: "Get started for $29.99/month" },
        ],
      },
      {
        heading: "What you still do",
        paragraphs: [
          "You write the source of truth in Knowledge and, if you choose, point Bizlyro at public pages on your site. Conflicts stay visible instead of being silently merged. Unanswered questions can be stored so you can publish the missing fact later.",
          "You also decide what leaves the building. Gmail replies send only after you confirm. Social drafts publish only after that platform is connected and you confirm. The website chatbot does not post or email by itself.",
        ],
        links: [{ href: "/ai-business-assistant", label: "AI business assistant" }],
      },
    ],
    benefitsHeading: "Why the chatbot belongs on the website",
    benefits: [
      {
        title: "Answers where the visitor already is",
        body: "The widget is on your site. The visitor does not log in, and they do not have to hunt a PDF for a fact you already published.",
      },
      {
        title: "The same thread can capture a lead",
        body: "A question that turns into “please contact me” can store the name, email, and request in Leads.",
      },
      {
        title: "You keep the unpublished parts",
        body: "Missing prices, policies, and promotions are not filled in to make the chat feel complete.",
      },
    ],
    limitsHeading: "What this website chatbot will not do",
    limits: [
      {
        title: "Honest AI",
        body: `${HONEST} It answers from published knowledge, indexed public pages, and a connected catalog when one exists for that workspace.`,
      },
      {
        title: "The demo is not your live chat",
        body: "The local demo never becomes the widget on your domain. Customers use the snippet you install after you subscribe.",
      },
      {
        title: "It will not run the rest of marketing",
        body: "Email and social posts still wait for your confirmation. The chatbot does not send them.",
      },
    ],
    stepsHeading: "From signup to a chat on your site",
    steps: [
      {
        title: "Start the account",
        body: `Get started creates the login. Bizlyro AI is ${PLAN_PRICE} when you subscribe for the paid widget.`,
      },
      {
        title: "Publish what the chat may say",
        body: "Add the services, hours, and policies that are safe to repeat. Leave drafts and private exceptions out.",
      },
      {
        title: "Install the one snippet",
        body: "Use the Widget page after payment. Then watch Leads for contact requests and Inbox for handoffs.",
      },
    ],
    faqsHeading: "Website chatbot questions",
    faqs: [
      {
        question: "Do my customers need an account to use the chatbot?",
        answer:
          "No. The website widget is the customer surface. Visitors chat on your site. You sign in to the Bizlyro workspace.",
      },
      {
        question: "Will an AI website chatbot for small business invent a promotion?",
        answer: `${HONEST} A discount or offer has to be one you published before the chat may repeat it.`,
      },
      {
        question: "Can the chatbot capture a lead without answering everything?",
        answer:
          "Yes. If a fact is missing, it should say so and can still take contact details when the visitor offers them. You review that lead.",
      },
      {
        question: "How much is the website chatbot?",
        answer: `Bizlyro AI is ${PLAN_PRICE} for one business workspace and one website widget. Get started creates the account, then you subscribe. The demo is not that paid chat.`,
      },
    ],
    relatedHeading: "Install, leads, and local questions",
    related: [
      { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
      { href: "/ai-lead-capture-for-small-business", label: "AI lead capture for small business" },
      { href: "/ai-chatbot-for-local-businesses", label: "AI chatbot for local businesses" },
      { href: "/demo", label: "Open the local demo" },
    ],
    closeHeading: "Put the conversation on the site you already have",
    closeBody: `Create an account and subscribe to Bizlyro AI for ${PLAN_PRICE}. Publish the facts the chatbot may repeat, then install the single website widget.`,
  },
  {
    path: "/ai-lead-capture-for-small-business",
    label: "AI lead capture for small business",
    intent: "AI lead capture for small business",
    title: "AI Lead Capture for Small Business — Bizlyro AI",
    description:
      "Bizlyro AI is an AI lead capture for small business websites. It answers published questions and stores name, email, and the request.",
    eyebrow: "Leads",
    h1: "AI lead capture for small business that still answers the question",
    lede:
      "A form can collect a name and lose the reason someone wrote. AI lead capture for small business, in Bizlyro, answers what you have published and keeps the contact details and the request for you to review. " +
      HONEST,
    previewHeading: "A request, not a finished sale",
    previewNote:
      "The sample lead rows are layout only. They show the kind of quote or follow-up a workspace can hold. They are not live customers.",
    sections: [
      {
        heading: "The form ended the conversation too early",
        paragraphs: [
          "Small businesses lose leads when the only path is “send us a message.” The visitor wanted to know if you cover their neighborhood, what a published package includes, or whether a date is even something you take. They leave an email, or they do not. Nobody answered the question that made them willing to share it. A website assistant can give the published answer 24/7 and still store the lead.",
          "Bizlyro AI can answer that published part in the website widget and then store the next step. Name, email, and the request show up in Leads. A quote row is a request you review. It is not an invoice and it is not a price the assistant was allowed to invent.",
        ],
        links: [
          { href: "/ai-sales-assistant", label: "AI sales assistant" },
          { href: "/#pricing", label: "See pricing" },
        ],
      },
      {
        heading: "Example: a catering note for a Saturday",
        paragraphs: [
          "A caterer publishes that Saturday events need a week’s notice and that a tasting is listed at a set fee. A visitor asks about a Saturday in three weeks and leaves a name and email. The chat can repeat the notice rule and the published tasting fee, then store the event request. It should not offer a weekday promotion that is not in Knowledge.",
          "If the visitor asks for a custom menu price that was never published, the assistant should take the details and leave the number to you. The lead is the capture. The quote is your reply.",
        ],
      },
      {
        heading: "What lands in the workspace",
        paragraphs: [
          "Leads can include a quote request or an appointment request. Without a connected Google Calendar, an appointment request is not a confirmed booking. If that workspace connects Google Calendar, a time is booked only when the visitor confirms an open slot. Otherwise the row waits for a person.",
          "You review the lead in the paid workspace. The assistant does not email the visitor a contract. If you later reply from a connected Gmail account, that send still waits for your confirmation.",
        ],
        links: [
          { href: "/ai-chatbot-for-contractors", label: "AI chatbot for contractors" },
          { href: "/ai-customer-service-for-small-business", label: "AI customer service for small business" },
        ],
      },
      {
        heading: "The plan behind the capture",
        paragraphs: [
          `Bizlyro AI is ${PLAN_PRICE} for one business, one website widget, and ${PLAN_REPLIES} AI-generated customer replies each billing month. Lead rows are part of that workspace. There is no automatic overage charge when the reply allowance is used. AI answers pause, and the visitor can still be offered a person.`,
          "Get started creates the account. You subscribe before the paid widget and the Leads desk are available. The local demo can show the layout in this browser. It does not store a real lead and it does not call Stripe.",
        ],
      },
    ],
    benefitsHeading: "Lead capture that keeps the question",
    benefits: [
      {
        title: "The visitor gets an answer first",
        body: "Published hours, packages, and policies can be explained before you ask for an email.",
      },
      {
        title: "The request is specific",
        body: "Leads hold the name, email, and what they asked for, so you are not guessing which form field mattered.",
      },
      {
        title: "You still price the custom work",
        body: "Unpublished quotes stay with you. The assistant captures the ask and does not invent the number.",
      },
    ],
    limitsHeading: "What lead capture will not pretend",
    limits: [
      {
        title: "Honest AI",
        body: `${HONEST} Capturing a lead is not permission to promise a discount or a fee you never published.`,
      },
      {
        title: "Not an automatic close",
        body: "A stored quote or appointment request is for review. Payment, contracts, and exceptions stay with the business.",
      },
      {
        title: "Not a second inbox in your personal chat app",
        body: "The lead and the thread live in the Bizlyro workspace. Email still sends only after you confirm.",
      },
    ],
    stepsHeading: "Start capturing requests on your site",
    steps: [
      {
        title: "Open the account",
        body: `Get started is the signup step. Subscribe to Bizlyro AI at ${PLAN_PRICE} for the paid workspace.`,
      },
      {
        title: "Publish the facts a lead might ask",
        body: "Add the services and prices you are willing to repeat. Leave custom quotes blank on purpose.",
      },
      {
        title: "Read Leads",
        body: "Install the widget, then review new requests in Leads and paused threads in Inbox.",
      },
    ],
    faqsHeading: "Lead capture questions",
    faqs: [
      {
        question: "Does AI lead capture for small business replace my form?",
        answer:
          "It can sit on the site and answer published questions before taking contact details. You can keep a form. The chat is for visitors who still have a question.",
      },
      {
        question: "Will it quote a price that is not in Knowledge?",
        answer: `${HONEST} It may repeat a price you published. If the price is missing, it should store the request instead of inventing one.`,
      },
      {
        question: "Are appointment requests confirmed bookings?",
        answer:
          "Only when that workspace has connected Google Calendar and the visitor confirms an open time. Otherwise the appointment is a request you review.",
      },
      {
        question: "What do I pay to capture leads this way?",
        answer: `Bizlyro AI is ${PLAN_PRICE}. Get started creates the account, then you subscribe. There is no automatic overage charge after ${PLAN_REPLIES} AI replies in the billing month.`,
      },
    ],
    relatedHeading: "Quotes, support, and trade leads",
    related: [
      { href: "/ai-sales-assistant", label: "AI sales assistant" },
      { href: "/ai-chatbot-for-contractors", label: "AI chatbot for contractors" },
      { href: "/ai-website-chatbot-for-small-business", label: "AI website chatbot for small business" },
      { href: "/signup", label: "Get started for $29.99/month" },
    ],
    closeHeading: "Keep the question and the contact",
    closeBody: `Create an account and subscribe to Bizlyro AI for ${PLAN_PRICE}. Publish the offers you want repeated, and review every lead yourself.`,
  },
  {
    path: "/ai-chatbot-for-contractors",
    label: "AI chatbot for contractors",
    intent: "AI chatbot for contractors",
    title: "AI Chatbot for Contractors — Bizlyro AI",
    description:
      "Bizlyro AI is an AI chatbot for contractors. It answers published service areas and captures estimate requests without inventing a job price.",
    eyebrow: "Contractors",
    h1: "An AI chatbot for contractors that takes the job details",
    lede:
      "Contractors miss website questions while they are on a roof, in a crawl space, or between estimates. An AI chatbot for contractors can answer the service-area and hours facts you published, and it can hold the estimate request until you are back at a desk. " +
      HONEST,
    previewHeading: "An estimate request waiting for you",
    previewNote:
      "The sample chat refuses to confirm a price from the widget. That is the behavior this page describes. The names are not live customers.",
    sections: [
      {
        heading: "The phone rings when your hands are full",
        paragraphs: [
          "A contractor’s site gets “Do you work in this town?”, “Do you build decks?”, and “Can you look at a leak this week?” The owner is often with another client. A form that only says “project details” does not tell the visitor whether the town is in the published service area.",
          "Bizlyro AI answers from the services, towns, and hours you put in Knowledge. If the town is listed, the widget can say so. If it is not listed, the assistant should not guess that you will drive there. It can still take the address and the contact details as a lead.",
        ],
        links: [
          { href: "/ai-lead-capture-for-small-business", label: "AI lead capture for small business" },
          { href: "/ai-chatbot-for-local-businesses", label: "AI chatbot for local businesses" },
        ],
      },
      {
        heading: "Example: a deck estimate, not a made-up bid",
        paragraphs: [
          "You publish that deck repairs are a service and that on-site estimates are scheduled, without a flat price. A homeowner describes a small deck and asks what it will cost. The chatbot can say that deck work is something you do and that the price is an estimate you provide. It must not invent a labor rate, a materials total, or a “book this week” promotion.",
          "The name, email, town, and description can sit in Leads. You price the job. The chatbot does not send a contract and does not tell the visitor the job is booked.",
        ],
      },
      {
        heading: "Scheduling without a fake calendar",
        paragraphs: [
          "Many contractor sites ask visitors to pick a time. Bizlyro can store an appointment request for you to confirm. A time is written to Google Calendar only when that workspace has connected it and the visitor confirms an open slot. Without that connection, the chat must not pretend a crew is reserved.",
          `The subscription is ${PLAN_PRICE} for one contracting business, one website widget, and ${PLAN_REPLIES} AI replies in the billing month. When replies run out, AI pauses. There is no automatic overage charge. Get started creates the account before you subscribe.`,
        ],
        links: [{ href: "/ai-sales-assistant", label: "How quote requests stay unpublished" }],
      },
      {
        heading: "What you still handle from the truck",
        paragraphs: [
          "You publish the towns, the trades, and the rules you are tired of repeating, such as “we do not do roofing” or “emergency calls are phone-only.” The widget can repeat those lines. A visitor who needs a person, or who describes damage you have not documented, waits in Inbox.",
          "Photos, measurements, and final bids stay in your own process. Bizlyro does not claim to measure a room from chat. It captures the request so you can follow up when you choose.",
        ],
      },
    ],
    benefitsHeading: "What contractors get from the widget",
    benefits: [
      {
        title: "Service-area answers while you are on site",
        body: "Published towns and trades can be repeated 24/7. Unlisted areas are not treated as a yes.",
      },
      {
        title: "Estimate requests with the actual ask",
        body: "Leads keep the contact details and the job description. You still write the price.",
      },
      {
        title: "No invented promotion",
        body: "A seasonal discount or a “free inspection” offer is repeated only if you published it.",
      },
    ],
    limitsHeading: "What a contractor chatbot must not say",
    limits: [
      {
        title: "Honest AI",
        body: `${HONEST} A missing labor rate, permit fee, or coupon is not something the chat should fill in.`,
      },
      {
        title: "It does not book the crew by guessing",
        body: "Appointment requests wait for you unless Google Calendar is connected and the visitor confirms an open time.",
      },
      {
        title: "It is not a project manager",
        body: "The widget does not track materials, assign a crew, or mark a job complete.",
      },
    ],
    stepsHeading: "Set up the chatbot for a contracting site",
    steps: [
      {
        title: "Create the workspace",
        body: `Get started is signup. Subscribe to Bizlyro AI at ${PLAN_PRICE} for this one business.`,
      },
      {
        title: "Publish towns and services",
        body: "List the trades you want the chat to confirm and the prices, if any, you are willing to show.",
      },
      {
        title: "Install, then read Leads",
        body: "Add the widget snippet. New estimate requests show in Leads. Threads that need you show in Inbox.",
      },
    ],
    faqsHeading: "Contractor chatbot questions",
    faqs: [
      {
        question: "Can an AI chatbot for contractors send a binding quote?",
        answer:
          "No. It can capture the request and repeat a price you already published. Custom job prices stay with you. It does not invent a bid.",
      },
      {
        question: "Will it say I serve a town I never listed?",
        answer: `${HONEST} If the service area is missing, it should not guess. It can still save the visitor’s details for you.`,
      },
      {
        question: "Does it work after hours?",
        answer:
          "Yes for published facts. Visitors can ask at night and get the hours, services, and policies you wrote. A person is not claimed to be on call unless you published that.",
      },
      {
        question: "What is the price for one contractor?",
        answer: `Bizlyro AI is ${PLAN_PRICE} for one workspace and one website widget. Get started creates the account, then you subscribe. There is no automatic overage charge.`,
      },
    ],
    relatedHeading: "Leads and local service businesses",
    related: [
      { href: "/ai-lead-capture-for-small-business", label: "AI lead capture for small business" },
      { href: "/ai-chatbot-for-local-businesses", label: "AI chatbot for local businesses" },
      { href: "/ai-sales-assistant", label: "AI sales assistant" },
      { href: "/signup", label: "Get started for $29.99/month" },
    ],
    closeHeading: "Catch the estimate request while you are on the job",
    closeBody: `Create an account and subscribe to Bizlyro AI for ${PLAN_PRICE}. Publish your service area, and review every estimate request before you name a price.`,
  },
  {
    path: "/ai-chatbot-for-dental-clinics",
    label: "AI chatbot for dental clinics",
    intent: "AI chatbot for dental clinics",
    title: "AI Chatbot for Dental Clinics — Bizlyro AI",
    description:
      "Bizlyro AI is an AI chatbot for dental clinics. It repeats published hours and visit facts, captures appointment requests, and does not give dental advice.",
    eyebrow: "Dental clinics",
    h1: "An AI chatbot for dental clinics that repeats clinic facts only",
    lede:
      "A dental front desk cannot answer the website while a patient is in the chair. An AI chatbot for dental clinics can repeat the hours, insurance notes, and visit facts the clinic published, and it can hold an appointment request. It does not diagnose, recommend treatment, or invent a fee. " +
      HONEST,
    previewHeading: "Clinic facts, then a person",
    previewNote:
      "The sample widget answers a published hours question and refuses to confirm a booking from chat alone. It is sample layout, not a patient conversation.",
    sections: [
      {
        heading: "The front desk is already with a patient",
        paragraphs: [
          "Clinic sites collect the same questions all day: Are you open Friday? Are you taking new patients? What should I bring to a published new-patient visit? Those answers belong in Knowledge if the clinic wants them repeated. They do not require a clinical opinion.",
          "Bizlyro AI is a website assistant for that front-desk layer. It is not a dentist and it is not a triage line. If a visitor describes pain, an emergency, or asks for a diagnosis, the assistant should tell them to contact the clinic or emergency services and offer a human. It should not name a treatment.",
        ],
        links: [
          { href: "/ai-customer-service-for-small-business", label: "AI customer service for small business" },
          { href: "/#handoff", label: "Human handoff" },
        ],
      },
      {
        heading: "Example: Friday hours and a new-patient note",
        paragraphs: [
          "The clinic publishes Friday hours and a new-patient note that says to arrive 15 minutes early with a photo ID. A visitor asks both. The widget can repeat those lines. It should not add that a cleaning is discounted this month unless that promotion is published.",
          "If the visitor asks what a crown will cost and no fee was published, the chatbot must not invent one. It can take a name and email so the office can reply. That contact is a lead for the clinic. The fee conversation stays with the clinic.",
        ],
      },
      {
        heading: "Appointment requests are not confirmed chairs",
        paragraphs: [
          "The chat can collect an appointment request: who is asking, how to reach them, and what they said they need. That request waits in the workspace. If the clinic connects Google Calendar, a time is booked only after the visitor confirms an open slot. Without that connection, the assistant must not tell them they are on the schedule.",
          "Insurance coverage, medical history, and treatment plans are not things this chatbot should invent or infer. Publish only the administrative facts you want repeated, such as which plans the office says it accepts, and only in the wording you wrote.",
        ],
        links: [
          { href: "/ai-lead-capture-for-small-business", label: "How leads and requests are stored" },
          { href: "/ai-chatbot-for-local-businesses", label: "AI chatbot for local businesses" },
        ],
      },
      {
        heading: "One clinic, one widget",
        paragraphs: [
          `Bizlyro AI is ${PLAN_PRICE} for one clinic workspace, one website widget, and ${PLAN_REPLIES} AI-generated customer replies in a billing month. It is not a multi-location call center. A second brand needs its own account. There is no automatic overage charge when replies pause.`,
          "Staff still use Inbox for anyone who asked for a person and for anything clinical. Gmail replies, if you connect a mailbox, send only after someone at the clinic confirms. The chatbot does not email patients on its own.",
        ],
      },
    ],
    benefitsHeading: "Front-desk answers the site can repeat",
    benefits: [
      {
        title: "Hours and visit instructions 24/7",
        body: "Published office hours and the preparation notes you wrote can be repeated when the desk is with a patient.",
      },
      {
        title: "Requests reach the office",
        body: "New-patient and appointment requests can include a name and email for the clinic to review.",
      },
      {
        title: "Clinical questions stay with people",
        body: "The assistant does not diagnose, name medications, or invent a treatment plan.",
      },
    ],
    limitsHeading: "What a dental chatbot must not do",
    limits: [
      {
        title: "Honest AI",
        body: `${HONEST} That includes a fee, an insurance promise, or a new-patient promotion the clinic did not publish.`,
      },
      {
        title: "No dental advice",
        body: "Pain, emergencies, and treatment questions are handed to the clinic or to emergency services. They are not answered with a guessed procedure.",
      },
      {
        title: "No silent booking",
        body: "A chair is confirmed only through a connected Google Calendar and a time the visitor accepts. Otherwise it is a request.",
      },
    ],
    stepsHeading: "Add the chatbot to a clinic site",
    steps: [
      {
        title: "Create the clinic account",
        body: `Get started opens signup. Subscribe to Bizlyro AI at ${PLAN_PRICE} for this clinic.`,
      },
      {
        title: "Publish administrative facts only",
        body: "Add hours, location notes, and the new-patient instructions you want repeated. Leave treatment fees out unless you intend to show them.",
      },
      {
        title: "Review requests in the workspace",
        body: "Install the widget from the Widget page. Appointment requests and handoffs wait for the front desk.",
      },
    ],
    faqsHeading: "Dental clinic chatbot questions",
    faqs: [
      {
        question: "Will an AI chatbot for dental clinics give treatment advice?",
        answer:
          "No. It repeats published office facts. It does not diagnose, recommend medication, or invent a procedure. Clinical questions should go to the clinic or emergency services.",
      },
      {
        question: "Can it quote a cleaning or crown fee?",
        answer: `${HONEST} It may repeat a fee the clinic published. If the fee is missing, it should capture the request instead of inventing a number.`,
      },
      {
        question: "Does it book the appointment by itself?",
        answer:
          "It can store a request. A confirmed time requires a connected Google Calendar and a slot the visitor accepts. Otherwise the office confirms the visit.",
      },
      {
        question: "What does the clinic pay?",
        answer: `Bizlyro AI is ${PLAN_PRICE} for one business workspace and one website widget. Get started creates the account, then the clinic subscribes. There is no automatic overage charge.`,
      },
    ],
    relatedHeading: "Support, leads, and other local clinics",
    related: [
      { href: "/ai-customer-service-for-small-business", label: "AI customer service for small business" },
      { href: "/ai-lead-capture-for-small-business", label: "AI lead capture for small business" },
      { href: "/ai-chatbot-for-local-businesses", label: "AI chatbot for local businesses" },
      { href: "/signup", label: "Get started for $29.99/month" },
    ],
    closeHeading: "Cover the front-desk questions you already answer",
    closeBody: `Create an account and subscribe to Bizlyro AI for ${PLAN_PRICE}. Publish hours and visit instructions, and keep every clinical question with your team.`,
  },
  {
    path: "/ai-chatbot-for-local-businesses",
    label: "AI chatbot for local businesses",
    intent: "AI chatbot for local businesses",
    title: "AI Chatbot for Local Businesses — Bizlyro AI",
    description:
      "Bizlyro AI is an AI chatbot for local businesses. It answers published hours and service areas 24/7 and captures leads without invented facts.",
    eyebrow: "Local businesses",
    h1: "An AI chatbot for local businesses on the site people already found",
    lede:
      "Someone finds a local business from a map, a neighborhood search, or a link, then asks if you are open, where you are, and whether you serve their street. An AI chatbot for local businesses can answer those published facts and capture a lead when they want to be contacted. " +
      HONEST,
    previewHeading: "Hours and a follow-up, side by side",
    previewNote:
      "The sample shows a published hours reply and a lead list. It is a layout preview with sample names, not a live local customer.",
    sections: [
      {
        heading: "They already found you. They still have a question.",
        paragraphs: [
          "Local visitors arrive with practical questions: today’s hours, holiday closures, parking notes you published, and whether a neighborhood is inside the area you serve. If the site only offers a phone number, those questions wait until someone picks up. If the fact is on the site but buried, they still leave.",
          "Bizlyro AI puts a widget on that site. It answers from Knowledge and from public pages you choose to index. It can reply in the language the visitor writes when it can, without translating a price or a date into a different fact. It does not invent a nearby location you do not have.",
        ],
        links: [
          { href: "/ai-website-chatbot-for-small-business", label: "AI website chatbot for small business" },
          { href: "/#knowledge", label: "Knowledge on the homepage" },
        ],
      },
      {
        heading: "Example: a shop’s holiday hours and a delivery street",
        paragraphs: [
          "A neighborhood shop publishes that it closes early on Sundays and delivers only inside three named neighborhoods. A visitor asks about Sunday and about a street in one of those neighborhoods. The chatbot can repeat the Sunday hours and confirm the published neighborhood. It should not add a free-delivery promotion or a street that was never listed.",
          "If the street is outside the written area, or the area was never published, the assistant should say it cannot verify that and offer a person. The visitor can still leave a name and email. You decide whether to make the trip.",
        ],
      },
      {
        heading: "The same pattern for studios, trades, and clinics",
        paragraphs: [
          "A studio can repeat a published class time. A contractor can repeat a published town. A clinic can repeat published office hours. Those are separate jobs, and each business should publish only its own facts. This page is the shared idea: one local website, one widget, answers you wrote, leads you review.",
          "The assistant does not claim a star rating, a “customers served” total, or a ranking in local search. Bizlyro does not invent conversion numbers. It stores the conversations and leads that actually happened in the workspace.",
        ],
        links: [
          { href: "/ai-chatbot-for-contractors", label: "AI chatbot for contractors" },
          { href: "/ai-chatbot-for-dental-clinics", label: "AI chatbot for dental clinics" },
        ],
      },
      {
        heading: "One place, one plan",
        paragraphs: [
          `Bizlyro AI is ${PLAN_PRICE} for one local business, one website widget, and ${PLAN_REPLIES} AI-generated customer replies in a billing month. When the allowance is used, answers pause and visitors are offered a person. There is no automatic overage charge.`,
          "Get started creates the account on bizlyro.com. You subscribe to turn on the paid widget. The demo remains a local preview of the desk. It is not the chatbot on your storefront and it does not call an AI model or Stripe.",
        ],
        links: [{ href: "/ai-chatbot-for-small-business", label: "Install notes for a small business" }],
      },
    ],
    benefitsHeading: "Useful answers for a business people visit",
    benefits: [
      {
        title: "Hours and place, 24/7",
        body: "Published hours, holiday closures, and location notes can be repeated after you lock the door.",
      },
      {
        title: "Service area without guesswork",
        body: "The chatbot confirms neighborhoods you listed. It does not expand the map to win the chat.",
      },
      {
        title: "A lead when they want a person",
        body: "Name, email, and the request can wait in Leads while you are with another customer.",
      },
    ],
    limitsHeading: "Local answers that stay honest",
    limits: [
      {
        title: "Honest AI",
        body: `${HONEST} A missing hour, delivery rule, or promotion is left missing.`,
      },
      {
        title: "Not a local ranking promise",
        body: "The product does not guarantee search placement, reviews, or a number of new customers.",
      },
      {
        title: "Not a person on the premises",
        body: "24/7 answers mean the widget can use published facts. They do not mean staff are in the shop.",
      },
    ],
    stepsHeading: "Add it to the site locals already use",
    steps: [
      {
        title: "Start with the account",
        body: `Get started creates the workspace. Subscribe to Bizlyro AI at ${PLAN_PRICE} when you want the widget.`,
      },
      {
        title: "Write the local facts",
        body: "Add hours, the address notes you want public, and the area you actually serve.",
      },
      {
        title: "Install and review",
        body: "Place the snippet on your site. Check Leads for contact requests and Inbox for handoffs.",
      },
    ],
    faqsHeading: "Local business chatbot questions",
    faqs: [
      {
        question: "Is an AI chatbot for local businesses only for shops?",
        answer:
          "No. It fits a business with one website and facts worth repeating: shops, studios, trades, and clinics. Each workspace is one business, using the knowledge that business published.",
      },
      {
        question: "Will it invent a promotion for people nearby?",
        answer: `${HONEST} A coupon or a free offer is repeated only when you published it.`,
      },
      {
        question: "Can visitors ask in another language?",
        answer:
          "The widget can answer in the language the visitor writes when it is able to. It should not change a price, address, or date into a different fact.",
      },
      {
        question: "How do I start, and what does it cost?",
        answer: `Get started creates an account. Bizlyro AI is then ${PLAN_PRICE} for one business and one website widget. There is no automatic overage charge after ${PLAN_REPLIES} AI replies in the month.`,
      },
    ],
    relatedHeading: "Industry pages and the website widget",
    related: [
      { href: "/ai-website-chatbot-for-small-business", label: "AI website chatbot for small business" },
      { href: "/ai-chatbot-for-contractors", label: "AI chatbot for contractors" },
      { href: "/ai-chatbot-for-dental-clinics", label: "AI chatbot for dental clinics" },
      { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
    ],
    closeHeading: "Answer the local questions you already published",
    closeBody: `Create an account and subscribe to Bizlyro AI for ${PLAN_PRICE}. Put your hours and service area in Knowledge, and review every lead that asks for more.`,
  },
];
