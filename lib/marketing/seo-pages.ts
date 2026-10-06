import type { Metadata, ResolvingMetadata } from "next";
import { BIZPILOT_PRO } from "@/lib/plan";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { formatPlanPriceUsd, HOME_METADATA } from "./copy";
import { SEO_ROUTES, type SeoRoutePath } from "./seo-routes";
import { BIZLYRO_SOFTWARE_ID, BIZLYRO_WEBSITE_ID, bizlyroEntityGraph } from "./site";

const PLAN_PRICE = `USD ${formatPlanPriceUsd()} per month`;
const PLAN_REPLIES = BIZPILOT_PRO.replyLimit;

export type SeoTextLink = { href: string; label: string };

export type SeoLandingPage = {
  path: SeoRoutePath;
  label: string;
  intent: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lede: string;
  sections: { heading: string; paragraphs: string[]; links?: SeoTextLink[] }[];
  benefits: { title: string; body: string }[];
  limits: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  faqs: { question: string; answer: string }[];
  related: SeoTextLink[];
  previewHeading: string;
  previewNote: string;
  benefitsHeading: string;
  limitsHeading: string;
  stepsHeading: string;
  faqsHeading: string;
  relatedHeading: string;
  closeHeading: string;
  closeBody: string;
};

const customerService: SeoLandingPage = {
  path: "/ai-customer-service-assistant",
  label: "AI customer service assistant",
  intent: "AI customer service assistant",
  title: "AI Customer Service Assistant — Bizlyro AI",
  description:
    "Bizlyro AI is an AI customer service assistant for your website. It answers published hours and policies, then hands the thread to you.",
  eyebrow: "Customer service",
  h1: "AI customer service assistant for after-hours questions",
  lede:
    "Bizlyro AI answers customer-service questions from the hours, policies, and FAQs you publish. A visitor can ask after you have locked the door. When the question needs a person, the thread waits in Inbox instead of receiving a made-up policy.",
  previewHeading: "A sample support answer",
  previewNote:
    "The Saturday hours reply is the kind of published fact this assistant can repeat. The quote row is a different job, covered on the sales guide. Names in this sample are not live customers.",
  sections: [
    {
      heading: "Support questions that arrive after you close",
      paragraphs: [
        "A small site still gets “Are you open Saturday?”, “What is your return window?”, and “Do you serve my area?” when nobody is at the desk. A contact form stores the name. It does not answer the question that made someone write.",
        "An AI customer service assistant is useful when those questions repeat and the safe answer is already written down. Bizlyro AI reads the knowledge published for that workspace and replies in the website widget. It is help for the facts you trained. It is not a claim that a teammate is on duty overnight.",
      ],
    },
    {
      heading: "Example: Saturday hours from Knowledge",
      paragraphs: [
        "You publish Saturday as 9:00–14:00 in Knowledge. A visitor asks, “What time do you open on Saturday?” The widget can answer with those hours because you wrote them down. It should not add a promise that someone will be on the phone at 9:00.",
        "If Saturday hours are missing, the assistant should say the fact is not available and keep the gap on record. That unanswered question is a prompt to publish the hours, not a license to guess a schedule.",
      ],
      links: [
        { href: "/#knowledge", label: "How Bizlyro knowledge works" },
        { href: "/ai-chatbot-for-small-business", label: "How a small business publishes those facts" },
      ],
    },
    {
      heading: "Example: the visitor asks for a person",
      paragraphs: [
        "A visitor writes, “I need to talk to someone about a complaint.” Asking for a person pauses AI on that thread. Complaints, legal or medical questions, and emergencies wait in Inbox. The visitor is told a teammate will reply in the widget.",
        "You answer when you are back, in your own words. The assistant does not email the customer on its own. If Gmail is connected, a draft can be prepared, and it is sent through that Gmail account only after you confirm.",
      ],
      links: [
        { href: "/#handoff", label: "Human handoff on the homepage" },
        { href: "/#inbox", label: "Inbox" },
      ],
    },
    {
      heading: "The reply allowance is a stop, not an invoice",
      paragraphs: [
        `Bizlyro AI is ${PLAN_PRICE} for one website widget and ${PLAN_REPLIES} AI-generated customer replies in a billing month. The official website is bizlyro.com. When those replies are used, AI answers pause and the visitor is offered a person. There is no automatic overage charge.`,
        "Support questions that are really about a price or a quote belong on the sales guide. This page stays with hours, policies, FAQs, and the handoff.",
      ],
      links: [
        { href: "/ai-sales-assistant", label: "AI sales assistant" },
        { href: "/ai-business-assistant", label: "AI business assistant" },
      ],
    },
    {
      heading: "What you do with a thread that is waiting",
      paragraphs: [
        "A paused thread stays in Inbox with the visitor’s messages. You read what was already answered from Knowledge and what was held back. You reply in that conversation when you are ready. The assistant does not keep talking on a thread you have taken over.",
        "That is the customer-service loop: publish the safe answers, let the widget repeat them, and use Inbox for complaints, missing policies, and anyone who asked for a person. A quote or a custom price is a different conversation.",
      ],
    },
  ],
  benefitsHeading: "What this does for support",
  benefits: [
    {
      title: "Answers on the page they opened",
      body: "Published hours, return rules, and service-area facts are repeated in the widget. The visitor does not have to hunt through a PDF for the same line.",
    },
    {
      title: "One support source",
      body: "Change the policy in Knowledge. The next visitor gets the updated fact, instead of an old macro copied into a separate chat tool.",
    },
    {
      title: "A queue for the rest",
      body: "Handoffs stay in Inbox next to the conversation, so you are not reconstructing the thread from a personal chat app.",
    },
  ],
  limitsHeading: "What this assistant will not do",
  limits: [
    {
      title: "It is not overnight staff",
      body: "Bizlyro AI can answer published support questions around the clock. It does not mean a person from your business is available around the clock.",
    },
    {
      title: "It does not invent a policy",
      body: "A missing return window, exception, or promise stays unanswered until you publish it or reply yourself.",
    },
    {
      title: "It does not email the customer for you",
      body: "Gmail replies send only after you confirm. The website assistant does not quietly email customers on its own.",
    },
  ],
  stepsHeading: "How to put support answers on your site",
  steps: [
    {
      title: "Open one workspace",
      body: `Get started creates the account. Subscribe to Bizlyro AI at ${PLAN_PRICE} when you want the paid widget.`,
    },
    {
      title: "Publish the answers you already give",
      body: "Add hours, holiday closures, service area, and the policies you repeat on the phone. Leave unpublished exceptions out.",
    },
    {
      title: "Watch Inbox for handoffs",
      body: "Install the snippet from the Widget page. Answered questions stay in the widget. Threads that need you wait in Inbox.",
    },
  ],
  faqsHeading: "Support questions",
  faqs: [
    {
      question: "Will an AI customer service assistant replace my team?",
      answer:
        "No. Bizlyro AI covers published support questions on your website and pauses when a visitor asks for a person or raises a complaint, legal, or medical issue. Your team still replies from Inbox.",
    },
    {
      question: "What if the hours or policy are not in Knowledge?",
      answer:
        "The assistant should not invent them. The gap can be stored so you can publish the missing fact. Until then, the thread can wait for you.",
    },
    {
      question: "Can visitors request a person?",
      answer:
        "Yes. Asking to talk to a person pauses AI on that thread. The visitor is told a teammate will reply in the widget.",
    },
    {
      question: "What happens when the monthly support replies are used?",
      answer: `AI-generated customer replies pause for the rest of that billing month after ${PLAN_REPLIES} replies. Visitors are offered a person. There is no automatic overage charge.`,
    },
  ],
  relatedHeading: "When the question is not support",
  related: [
    { href: "/ai-sales-assistant", label: "AI sales assistant" },
    { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
    { href: "/ai-business-assistant", label: "AI business assistant" },
    { href: "/#pricing", label: "Bizlyro AI pricing" },
    { href: "/demo", label: "Open the local demo" },
  ],
  closeHeading: "Answer published support questions on your site",
  closeBody:
    "Create an account, subscribe to Bizlyro AI, and publish the hours and policies this page describes. Use the sales guide when the visitor is asking for a quote instead of a policy.",
};

const salesAssistant: SeoLandingPage = {
  path: "/ai-sales-assistant",
  label: "AI sales assistant",
  intent: "AI sales assistant",
  title: "AI Sales Assistant for Quote Requests — Bizlyro AI",
  description:
    "Bizlyro AI is an AI sales assistant for your website. It explains published products and prices, captures quote requests, and does not invent a discount.",
  eyebrow: "Sales",
  h1: "AI sales assistant for published offers and quote requests",
  lede:
    "Bizlyro AI handles sales questions about products, services, and prices you have already published. It can capture a quote request or a lead for you to review. It does not invent a discount, mark an item in stock, or close a sale you did not define.",
  previewHeading: "A sample quote request",
  previewNote:
    "The kitchen-install message shows a request the assistant can take without confirming a price. The Saturday hours line is a support answer, not a sale. Names in this sample are not live customers.",
  sections: [
    {
      heading: "Sales questions about what you already offer",
      paragraphs: [
        "Visitors ask which service fits, what a published price includes, and whether you cover their situation. A useful AI sales assistant answers from that offer. It does not freelance a new package because a sentence sounded helpful.",
        "Bizlyro AI uses the offerings and prices in your knowledge, and indexed public pages you connect, for that workspace only. If a price is missing, it should ask you rather than fill one in. Shopify and WooCommerce are not live catalog connections. Inventory and checkout are not read from those platforms.",
      ],
    },
    {
      heading: "Example: a price you already published",
      paragraphs: [
        "You publish a service named “Standard visit” at a price you are willing to state, and a short note about what the visit includes. A visitor asks what that visit costs. The widget can repeat the published price and the included scope.",
        "If the visitor asks for a discount that is not in Knowledge, the assistant should not offer one to be polite. If the price field is empty, it should not invent a number. The gap stays for you to fill or to answer yourself.",
      ],
    },
    {
      heading: "Example: a quote request stays a request",
      paragraphs: [
        "A visitor asks for a quote on a kitchen install and leaves a name and email. The request lands in your workspace. Quote rows are requests you review. You decide the number, the scope, and whether to send it. Nothing in that queue is a completed order or a card payment.",
        "Appointment requests work the same way unless that workspace has connected Google Calendar. With a connected calendar, the assistant can check real availability and book only a time the visitor confirms. Without one, it collects the request and does not confirm a booking.",
      ],
      links: [
        { href: "/#lead-capture", label: "Lead and quote requests" },
        { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
      ],
    },
    {
      heading: "The plan does not take the payment",
      paragraphs: [
        `Subscribe to Bizlyro AI at ${PLAN_PRICE} on bizlyro.com. The plan is one widget and ${PLAN_REPLIES} AI replies in the billing month, with no automatic overage. A quote request is not a charge. Gmail and social posts leave only after you confirm them.`,
        "Hours-and-policy questions are the customer-service guide. Installing the widget on a small-business site is the chatbot guide. This page is the sales conversation: explain the published offer, capture the request, and stop before you commit the company.",
      ],
      links: [
        { href: "/ai-business-assistant", label: "AI business assistant" },
        { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
        { href: "/#pricing", label: "See Bizlyro AI pricing" },
      ],
    },
    {
      heading: "What “qualify” means here",
      paragraphs: [
        "The assistant can ask which published service the visitor means and collect a name and email with the request. That is the qualification it can do: enough detail for you to answer. It does not score the lead, predict a close, or tell you the conversation is worth a certain amount.",
        "You open Leads, read the request, and decide the follow-up. If the question was only about hours or a return rule, it belongs with customer service, not in a quote queue.",
      ],
    },
  ],
  benefitsHeading: "What this does in a sales conversation",
  benefits: [
    {
      title: "The offer you published",
      body: "Services, products, and prices you wrote down are explained in the visitor’s words. There is no second catalog hiding in the chat tool.",
    },
    {
      title: "A lead you can answer",
      body: "Name, email, and the request show up for review. You follow up when the question needs a custom price or a person.",
    },
    {
      title: "No invented close",
      body: "The assistant can keep the conversation moving. It does not mark a deal won, collect a card, or guarantee a result.",
    },
  ],
  limitsHeading: "What this assistant will not promise",
  limits: [
    {
      title: "It does not promise revenue",
      body: "Bizlyro AI helps visitors understand a published offer and how to ask for the next step. Results depend on your offer and your follow-up.",
    },
    {
      title: "No surprise discounts",
      body: "A discount exists only if you published it. The assistant should not create one during the chat.",
    },
    {
      title: "Store platforms are not the catalog",
      body: "Shopify and WooCommerce are not live integrations. Stock and checkout are not pulled from those accounts.",
    },
  ],
  stepsHeading: "How to use it for quotes and leads",
  steps: [
    {
      title: "Publish the offer you want repeated",
      body: "Add services or products, what they include, and any price you are willing to state. Leave unpublished numbers out.",
    },
    {
      title: "Let the widget take the first sales question",
      body: "Visitors ask in the installed widget. Answers stay inside that published material.",
    },
    {
      title: "Review the request yourself",
      body: "Open the quote or lead, confirm the details, and reply. You send the price. Bizlyro AI does not.",
    },
  ],
  faqsHeading: "Sales questions",
  faqs: [
    {
      question: "Can the AI sales assistant close a sale on its own?",
      answer:
        "No. It can explain published products and services and capture a lead or quote request. You review the request and decide what to send. It does not take payment or mark a sale complete.",
    },
    {
      question: "Will it offer a discount that I did not publish?",
      answer:
        "It should not. Discounts, packages, and prices have to be in the knowledge or indexed pages you published. If they are missing, the assistant should not invent them.",
    },
    {
      question: "Does it read my Shopify or WooCommerce catalog?",
      answer:
        "No. Those store connections are not live. Put the products, services, and prices you want used into Knowledge, or index the public pages that already state them.",
    },
    {
      question: "Can it book a time during a sales chat?",
      answer:
        "Only if that workspace has connected Google Calendar, and only for a time the visitor confirms. Otherwise it can store an appointment request and must not confirm a booking.",
    },
  ],
  relatedHeading: "Support and setup, separate from the sale",
  related: [
    { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
    { href: "/ai-business-assistant", label: "AI business assistant" },
    { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
    { href: "/#knowledge", label: "Knowledge engine" },
    { href: "/signup", label: "Create a Bizlyro account" },
  ],
  closeHeading: "Capture the request. You close the sale.",
  closeBody:
    "Create an account and subscribe to Bizlyro AI, then publish the offers this page is allowed to repeat. The assistant can qualify the question and store the lead. Payment and exceptions stay with you.",
};

const businessAssistant: SeoLandingPage = {
  path: "/ai-business-assistant",
  label: "AI business assistant",
  intent: "AI business assistant",
  title: "AI Business Assistant for One Company — Bizlyro AI",
  description:
    "Bizlyro AI is an AI business assistant for one company. It answers visitors from your knowledge, captures leads, and holds drafts until you confirm.",
  eyebrow: "One workspace",
  h1: "AI business assistant for one company",
  lede:
    "Bizlyro AI is an AI customer service and sales assistant, and its official website is bizlyro.com. One workspace answers website visitors, collects leads and quote requests, and holds email and social drafts until you confirm them. It is built for one business and one website widget.",
  previewHeading: "The widget and the desk",
  previewNote:
    "Visitors use the chat. You review website threads in Inbox and requests in Leads. This sample layout is not live customer data. The support and sales guides explain each job on its own.",
  sections: [
    {
      heading: "The hub for support and sales",
      paragraphs: [
        "Owners rarely split “support” and “sales” into two products. A visitor asks whether you are open, then asks what a service costs. Bizlyro AI treats both as questions about published facts, with the same rule: do not invent what is missing.",
        "This page is the overview. The customer-service guide is hours, policies, and handoff. The sales guide is published offers, quote requests, and leads. The small-business chatbot guide is what to publish and how the widget is installed.",
      ],
      links: [
        { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
        { href: "/ai-sales-assistant", label: "AI sales assistant" },
        { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
      ],
    },
    {
      heading: "Example: hours first, then a price",
      paragraphs: [
        "A visitor asks if you are open Saturday and then what a published visit costs. Both answers come from the same Knowledge for that workspace. The hours answer does not invent a staffed front desk. The price answer uses only the number you published.",
        "If either fact is missing, the assistant should say so. It should not browse the public internet for a stand-in, and it should not borrow another subscriber’s workspace.",
      ],
    },
    {
      heading: "Example: a Gmail draft and a social draft wait",
      paragraphs: [
        "Gmail can be connected so Bizlyro AI drafts a reply from the incoming email. Send goes through that Gmail account only after you press Send reply and confirm. Email never auto-sends.",
        "A social draft stays in the workspace until you approve it. A post is published only after that platform is connected and you confirm. Copy stays available when a platform is not set up. The assistant does not post for you.",
      ],
      links: [
        { href: "/#inbox", label: "Inbox and drafts" },
        { href: "/#integrations", label: "Which integrations are live" },
      ],
    },
    {
      heading: "One company, one widget, one monthly allowance",
      paragraphs: [
        `Bizlyro AI is ${PLAN_PRICE} for one business workspace and one installed website widget, with ${PLAN_REPLIES} AI-generated customer replies in a billing month. When the allowance is used, replies pause and visitors are offered a person. There is no automatic overage charge. Cancel anytime in Billing. Stored knowledge remains until you ask for the workspace to be deleted.`,
        "Another subscriber’s knowledge is not a source of answers. Conversations, leads, and drafts for this widget stay with this account.",
      ],
      links: [
        { href: "/#how-it-works", label: "How setup works" },
        { href: "/#pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Counts come from this workspace only",
      paragraphs: [
        "Reply usage, threads waiting on a person, and lead rows come from records stored for this account. The workspace can show those counts. It does not estimate revenue, a close rate, or how many customers you served.",
        "Use the three guides when you want the working detail. This page is the map: one company, the facts you publish, and the actions that still require you.",
      ],
    },
  ],
  benefitsHeading: "What the workspace covers",
  benefits: [
    {
      title: "Support and sales in one place",
      body: "Website questions, lead details, and drafts sit in the same workspace, so you are not copying facts into a separate bot for every job.",
    },
    {
      title: "A boundary you can explain",
      body: "Customers get answers you published. Anything that commits money, medicine, law, or a personal reply waits for you.",
    },
    {
      title: "Sized for one business",
      body: `The subscription is one workspace, one widget, and ${PLAN_REPLIES} AI replies a month. It is not a call-center suite and it does not add an overage invoice.`,
    },
  ],
  limitsHeading: "What stays with you",
  limits: [
    {
      title: "Not a staffed front desk",
      body: "The assistant answers from published knowledge. It does not put a person on the clock overnight.",
    },
    {
      title: "Not an open-ended researcher",
      body: "It should not look up an answer you did not publish, and it should not use another business’s facts.",
    },
    {
      title: "Drafts are not sent for you",
      body: "Email and social posts leave only after you confirm them. There is no silent send.",
    },
  ],
  stepsHeading: "How one company sets it up",
  steps: [
    {
      title: "Open the account on bizlyro.com",
      body: `Get started creates the login and the workspace. Subscribe to Bizlyro AI at ${PLAN_PRICE} when you want the paid widget and dashboard.`,
    },
    {
      title: "Train it on this business only",
      body: "Publish hours, services, policies, and prices you stand behind. Index public pages on your own site if you want those facts beside what you typed.",
    },
    {
      title: "Use the specialized guides for the details",
      body: "Read the customer-service guide for handoff, the sales guide for quotes, and the chatbot guide for the install. Then confirm any Gmail or social draft before it is sent.",
    },
  ],
  faqsHeading: "Questions about the assistant",
  faqs: [
    {
      question: "Is Bizlyro an AI business assistant or only a help widget?",
      answer:
        "The visitor-facing piece is the website widget. The assistant behind it also captures leads and quote requests and can draft Gmail and social posts for you to confirm. It is one workspace for that work, not a separate bot per task.",
    },
    {
      question: "Can one account run several businesses?",
      answer:
        "This version maps one account to one workspace and one installed website widget. Train it on that business’s knowledge.",
    },
    {
      question: "Is there a free plan?",
      answer: `No. Get started creates an account, then you subscribe to Bizlyro AI for ${PLAN_PRICE}. The local demo is a browser-only preview. It is not a free workspace and does not call an AI model or Stripe.`,
    },
    {
      question: "Does Bizlyro AI send email or social posts by itself?",
      answer:
        "No. A Gmail reply is sent only after you confirm. A social post is published only after that platform is connected and you confirm. Drafts can sit in the workspace until then.",
    },
  ],
  relatedHeading: "Specialized Bizlyro guides",
  related: [
    { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
    { href: "/ai-sales-assistant", label: "AI sales assistant" },
    { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#how-it-works", label: "How it works" },
  ],
  closeHeading: "One assistant for this business",
  closeBody:
    "Create an account on bizlyro.com and subscribe to Bizlyro AI. Publish the facts for this company, then use the customer-service, sales, and chatbot guides for the job you are setting up.",
};

const smallBusinessChatbot: SeoLandingPage = {
  path: "/ai-chatbot-for-small-business",
  label: "AI chatbot for small business",
  intent: "AI chatbot for small business",
  title: "AI Chatbot for Small Business — Bizlyro AI",
  description:
    "Bizlyro AI is an AI chatbot for small business websites. Publish hours and policies once, install one widget, and review leads yourself.",
  eyebrow: "Small business",
  h1: "AI chatbot for small business websites",
  lede:
    "Bizlyro AI is an AI chatbot for small business owners who want website answers without hiring a round-the-clock front desk. You publish the business once. Customers use one widget on the site you already have. You review leads and any thread that should not be answered automatically.",
  previewHeading: "What the visitor sees, and what you review",
  previewNote:
    "The chat panel is the widget on your site. Inbox and Leads are the desk behind it. This sample is not a live customer, and the local demo does not install the widget for you.",
  sections: [
    {
      heading: "Publish the business before you install anything",
      paragraphs: [
        "A shop, clinic, or service company needs a straight answer to questions already on the website: when you are open, what you offer, where you work, and how to ask for a quote or a visit. It does not need a call-center script.",
        "Start with the answers you already give by phone. Hours and holiday closures. The services you actually sell. The area you cover. Shipping, booking, or visit policies. A price only if you are willing to state it. A short FAQ for the exceptions people ask about.",
      ],
      links: [{ href: "/#knowledge", label: "What belongs in Knowledge" }],
    },
    {
      heading: "Example: a return window you wrote down",
      paragraphs: [
        "You add a policy: returns are accepted within 14 days if the item is unused. A visitor asks about returns on your site. The chatbot can repeat that window because it is in Knowledge. It should not extend the window, invent a restocking fee, or promise an exception.",
        "You can also point Bizlyro AI at public pages on your own site so indexed copy sits beside what you typed. Do not expect it to know a fact that appears in neither place. Unanswered questions stay on record so you can add the missing line.",
      ],
    },
    {
      heading: "Example: one snippet from the Widget page",
      paragraphs: [
        "After you subscribe, the paid Widget page shows the snippet for that workspace. You add it to the site you already run. Customers never log in. They open the chat, ask a question, and either get a published answer or a handoff.",
        "The public demo is a separate, browser-only preview of the desk layout. It is not the chatbot your customers would use, it is not billed, and it does not call an AI model. Use it to click through the screens. Use the subscription when you want the widget on your domain. The official website is bizlyro.com.",
      ],
      links: [
        { href: "/#widget", label: "Website widget" },
        { href: "/demo", label: "Open the local demo" },
      ],
    },
    {
      heading: "Quotes are a sales conversation, not the install",
      paragraphs: [
        `Bizlyro AI is ${PLAN_PRICE} for that one widget and ${PLAN_REPLIES} AI replies in a billing month. There is no automatic overage, and there is no free chatbot plan that sends live AI replies. Email and social posts still wait for your confirmation.`,
        "If the visitor is asking for a custom price rather than a published fact, send them through the sales guide. This page is how a small business writes the facts down and puts the widget on the site.",
      ],
      links: [
        { href: "/ai-sales-assistant", label: "AI sales assistant" },
        { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
        { href: "/ai-business-assistant", label: "AI business assistant" },
      ],
    },
    {
      heading: "What a visitor does, and what you check afterward",
      paragraphs: [
        "A visitor opens the chat on your site and asks a question in their own words. If the answer is in the knowledge you published, the widget can give that answer. If they ask for a person, or the fact is missing, the thread waits for you.",
        "You do not watch the chat in real time for it to be useful. Later, Inbox shows handoffs and Leads shows people who left a name or email. The snippet you installed is the only customer-facing piece. There is not a second widget for a second brand on the same account.",
      ],
    },
  ],
  benefitsHeading: "Why a small business uses one chatbot",
  benefits: [
    {
      title: "Written for this company",
      body: "The chatbot is trained on your knowledge, not on a generic script that mentions services you do not offer.",
    },
    {
      title: "Honest when a fact is missing",
      body: "Missing hours or policies are not filled in. Publish the answer later and the next visitor gets the updated line.",
    },
    {
      title: "A desk behind the chat",
      body: "Leads and handoffs are in the workspace, so the follow-up has a place to go after the visitor closes the widget.",
    },
  ],
  limitsHeading: "What the chatbot will not do",
  limits: [
    {
      title: "The demo is not the live chatbot",
      body: "The local demo never becomes your customer-facing widget. The installed chatbot is part of Bizlyro AI.",
    },
    {
      title: "There is no free chatbot plan",
      body: "Get started creates an account. The website chatbot is available on the paid plan. The demo does not send live AI replies.",
    },
    {
      title: "It will not run marketing unsupervised",
      body: "Social drafts and Gmail replies wait for confirmation. The chatbot does not post or email on its own.",
    },
  ],
  stepsHeading: "Publish, subscribe, then install",
  steps: [
    {
      title: "Look at the layout first, if you want",
      body: "Open the local demo to click through Inbox, Knowledge, and chat before you pay. It stays in this browser.",
    },
    {
      title: "Subscribe and write the facts",
      body: `Create an account, subscribe to Bizlyro AI at ${PLAN_PRICE}, and add the hours, services, and policies the chatbot is allowed to repeat.`,
    },
    {
      title: "Add the one snippet",
      body: "Install the widget from the paid Widget page. Check Inbox for handoffs and Leads for people who asked to be contacted.",
    },
  ],
  faqsHeading: "Questions before you install",
  faqs: [
    {
      question: "Is this AI chatbot only for small businesses?",
      answer:
        "It is built for one business workspace and one website widget, which matches how many small businesses operate. The limit is the product shape: one company, your knowledge, your review. It is not a multi-brand call-center platform.",
    },
    {
      question: "Do I need a developer to install the chatbot?",
      answer:
        "You add one snippet from the Widget page in the paid workspace to the site you already run. The public demo does not install that snippet for you.",
    },
    {
      question: "Will the chatbot make up prices or policies?",
      answer:
        "It is not supposed to. It answers from published knowledge and indexed public pages. If a price or policy is missing, it should not invent one.",
    },
    {
      question: "Is the demo the chatbot my customers use?",
      answer:
        "No. The demo is a browser-only preview of the desk. Customers use the widget you install after you subscribe to Bizlyro AI. The demo does not call an AI model.",
    },
  ],
  relatedHeading: "Sales and support after the widget is in",
  related: [
    { href: "/ai-sales-assistant", label: "AI sales assistant" },
    { href: "/ai-business-assistant", label: "AI business assistant" },
    { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/signup", label: "Get started with Bizlyro" },
  ],
  closeHeading: "Install one widget on the site you already have",
  closeBody:
    "Create an account, subscribe to Bizlyro AI, and publish the facts the chatbot may repeat. Use the sales guide when a visitor asks for a quote instead of a published policy.",
};

export const SEO_PAGES: readonly SeoLandingPage[] = [
  customerService,
  salesAssistant,
  businessAssistant,
  smallBusinessChatbot,
];

export function seoPageByPath(path: SeoRoutePath) {
  const page = SEO_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`Missing SEO page for ${path}`);
  return page;
}

type InheritedImages = NonNullable<Metadata["openGraph"]>["images"];

export function seoPageMetadata(page: SeoLandingPage, images?: InheritedImages): Metadata {
  const url = `${BIZLYRO_PUBLIC_ORIGIN}${page.path}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: "Bizlyro AI",
      title: page.title,
      description: page.description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      ...(images ? { images } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/** Keep the root opengraph-image when this page replaces the layout Open Graph object. */
export async function seoPageGenerateMetadata(page: SeoLandingPage, parent: ResolvingMetadata): Promise<Metadata> {
  const images = (await parent).openGraph?.images;
  return seoPageMetadata(page, images);
}

export function seoPageJsonLd(page: SeoLandingPage) {
  const url = `${BIZLYRO_PUBLIC_ORIGIN}${page.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...bizlyroEntityGraph(HOME_METADATA.description, {
        price: String(BIZPILOT_PRO.amountCents / 100),
        priceCurrency: BIZPILOT_PRO.currency.toUpperCase(),
        url: `${BIZLYRO_PUBLIC_ORIGIN}/signup`,
      }),
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: "en",
        isPartOf: { "@id": BIZLYRO_WEBSITE_ID },
        about: { "@id": BIZLYRO_SOFTWARE_ID },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mainEntity: { "@id": `${url}#faq` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: BIZLYRO_PUBLIC_ORIGIN,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.label,
            item: url,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}
