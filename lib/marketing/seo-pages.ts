import type { Metadata } from "next";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { SEO_ROUTES, type SeoRoutePath } from "./seo-routes";

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
};

const customerService: SeoLandingPage = {
  path: "/ai-customer-service-assistant",
  label: "AI customer service assistant",
  intent: "AI customer service assistant",
  title: "AI Customer Service Assistant for Your Website — Bizlyro AI",
  description:
    "Bizlyro is an AI customer service assistant for your website. It answers published hours, policies, and FAQs, then hands the thread to you when a person should reply.",
  eyebrow: "Customer service",
  h1: "AI customer service assistant for your website",
  lede:
    "Bizlyro is an AI customer service assistant for one business. Visitors ask on the site they already opened. Answers come from the hours, policies, and FAQs you publish. When a question needs a person, the thread waits in Inbox instead of receiving a made-up policy.",
  sections: [
    {
      heading: "The questions that arrive after you close",
      paragraphs: [
        "A small site still gets “Are you open Saturday?”, “What is your return window?”, and “Do you serve my area?” when nobody is at the desk. A contact form stores the name. It does not answer the question that made someone write.",
        "An AI customer service assistant is useful when those questions repeat and the safe answer is already written down. Bizlyro reads the knowledge you published for that workspace and replies in the website widget. It is help for the facts you trained, not a claim that a teammate is on duty overnight.",
      ],
    },
    {
      heading: "Answers stay tied to your knowledge",
      paragraphs: [
        "You write hours, services, policies, and FAQs in Knowledge. Website chat uses that published material, and public pages you choose to index can sit beside it. If two sources disagree, the conflict stays visible so you can correct it. The assistant does not silently invent a third version.",
        "If the fact is missing, Bizlyro should say so and keep the gap on record. That unanswered question is a prompt to publish the missing policy, not a license to guess a price, a promise, or a legal position.",
      ],
      links: [
        { href: "/#knowledge", label: "How Bizlyro knowledge works" },
        { href: "/ai-business-assistant", label: "AI business assistant" },
      ],
    },
    {
      heading: "A person still owns the hard threads",
      paragraphs: [
        "Visitors can ask to talk to a person. Complaints, legal or medical questions, and emergencies pause the assistant and wait in Inbox. The visitor is told a teammate will reply in the widget. You answer when you are back, in your own words.",
        "The monthly reply allowance is a stop, not a surprise invoice. When it is used, AI replies pause and visitors are offered a person. There is no automatic overage charge.",
      ],
      links: [
        { href: "/#handoff", label: "Human handoff on the homepage" },
        { href: "/#inbox", label: "Inbox" },
      ],
    },
  ],
  benefits: [
    {
      title: "Support on the page they opened",
      body: "Hours, policies, and published FAQs are answered in the widget. The visitor does not have to hunt through a PDF to find the same fact.",
    },
    {
      title: "One source of truth",
      body: "Update Knowledge when a policy changes. The assistant uses what is published now, instead of an old macro copied into a separate chat tool.",
    },
    {
      title: "A queue for everything else",
      body: "Handoffs and messages that should not be automated stay in Inbox, next to the conversation, so you are not reconstructing the thread from a personal chat app.",
    },
  ],
  limits: [
    {
      title: "It is not overnight staff",
      body: "Bizlyro can answer published questions around the clock. It does not mean a person from your business is available around the clock.",
    },
    {
      title: "It does not invent policy",
      body: "Missing prices, exceptions, and promises stay unanswered until you publish them or reply yourself.",
    },
    {
      title: "Email still needs your confirmation",
      body: "Gmail replies send only after you confirm. The website assistant does not quietly email customers on its own.",
    },
  ],
  steps: [
    {
      title: "Create the workspace",
      body: "Get started opens an account for one business. The paid plan is BizPilot Pro, billed monthly after you subscribe.",
    },
    {
      title: "Publish the answers you already give",
      body: "Add hours, service area, shipping or visit policies, and the FAQs you repeat on the phone. Chat answers from that material.",
    },
    {
      title: "Install the widget and watch Inbox",
      body: "Place the snippet on your site. Answered questions stay in the widget. Threads that need you wait in Inbox.",
    },
  ],
  faqs: [
    {
      question: "Will an AI customer service assistant replace my team?",
      answer:
        "No. Bizlyro covers published questions on your website and pauses when a visitor asks for a person or raises a complaint, legal, or medical issue. Your team still replies from Inbox.",
    },
    {
      question: "What if the answer is not in Knowledge?",
      answer:
        "The assistant should not invent it. The gap can be stored so you can publish the missing fact. Until then, the thread can wait for you.",
    },
    {
      question: "Can visitors request a person?",
      answer:
        "Yes. Asking to talk to a person pauses AI on that thread. The visitor is told a teammate will reply in the widget.",
    },
  ],
  related: [
    { href: "/ai-sales-assistant", label: "AI sales assistant" },
    { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
    { href: "/ai-business-assistant", label: "AI business assistant" },
    { href: "/#pricing", label: "BizPilot Pro pricing" },
    { href: "/demo", label: "Open the local demo" },
  ],
};

const salesAssistant: SeoLandingPage = {
  path: "/ai-sales-assistant",
  label: "AI sales assistant",
  intent: "AI sales assistant",
  title: "AI Sales Assistant That Stays Inside Your Catalog — Bizlyro AI",
  description:
    "Use Bizlyro as an AI sales assistant on your site. It explains published products, services, and prices, captures quote requests, and does not invent a discount.",
  eyebrow: "Sales",
  h1: "AI sales assistant for published products and services",
  lede:
    "Bizlyro can work as an AI sales assistant on your website. It explains products, services, and prices you have published, then captures the quote or contact request for you to review. It does not invent a discount, mark an item in stock, or close a sale you did not define.",
  sections: [
    {
      heading: "Sell only what you have already said is for sale",
      paragraphs: [
        "Visitors ask which service fits, what a published price includes, and whether you cover their situation. A useful AI sales assistant answers from that catalog. It does not freelance a new offer because a sentence sounded helpful.",
        "Bizlyro uses the offerings and prices in your knowledge, and indexed public pages you connect, for that workspace only. If a price is missing, it should ask you rather than fill one in. Shopify and WooCommerce are not live catalog connections in this product. Inventory and checkout are not read from those platforms.",
      ],
    },
    {
      heading: "The next step is a request, not a fake order",
      paragraphs: [
        "When a visitor shares a name and email, or asks for a quote, the request lands in your workspace. Quote rows are requests you review. You decide the number, the scope, and whether to send it.",
        "Appointment requests work the same way unless that workspace has connected Google Calendar. With a connected calendar, the assistant can check real availability and book only a time the visitor confirms. Without one, it collects the request and does not confirm a booking.",
      ],
      links: [
        { href: "/#lead-capture", label: "Lead and quote requests" },
        { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
      ],
    },
    {
      heading: "Where sales help ends",
      paragraphs: [
        "Bizlyro will not promise a discount, a delivery date, or a custom package that is not in the material you published. It will not tell a visitor an item is available unless you published that fact. Closing the sale, taking payment, and making exceptions stay with you.",
        "That limit is the point of an AI sales assistant for a real business. The widget can keep the conversation moving after hours. You still approve anything that commits the company.",
      ],
      links: [
        { href: "/ai-business-assistant", label: "AI business assistant" },
        { href: "/#pricing", label: "See BizPilot Pro pricing" },
      ],
    },
  ],
  benefits: [
    {
      title: "Answers that match the offer",
      body: "Published services, products, and prices are explained in the visitor’s words, without a second catalog hiding in the chat tool.",
    },
    {
      title: "Leads you can actually use",
      body: "Name, email, and the request show up for review. You follow up when the question needs a custom price or a person.",
    },
    {
      title: "No invented close",
      body: "The assistant can prepare the conversation. It does not mark a deal won, collect a card, or guarantee a result.",
    },
  ],
  limits: [
    {
      title: "It does not promise revenue",
      body: "Bizlyro helps visitors understand what you published and how to ask for the next step. Results depend on your offer and your follow-up.",
    },
    {
      title: "No surprise discounts",
      body: "A discount exists only if you published it. The assistant should not offer one to be polite.",
    },
    {
      title: "Store platforms are not connected",
      body: "Shopify and WooCommerce are not live integrations. Stock and checkout are not pulled from those accounts.",
    },
  ],
  steps: [
    {
      title: "Publish the catalog you want repeated",
      body: "Add services or products, what they include, and any price you are willing to state. Leave unpublished numbers out.",
    },
    {
      title: "Let the widget take the first question",
      body: "Visitors ask in the installed widget. Answers stay inside that published material.",
    },
    {
      title: "Review quotes and leads yourself",
      body: "Open the request, confirm the details, and reply. Nothing in that queue is a completed order.",
    },
  ],
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
  ],
  related: [
    { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
    { href: "/ai-business-assistant", label: "AI business assistant" },
    { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
    { href: "/#knowledge", label: "Knowledge engine" },
    { href: "/signup", label: "Create a Bizlyro account" },
  ],
};

const businessAssistant: SeoLandingPage = {
  path: "/ai-business-assistant",
  label: "AI business assistant",
  intent: "AI business assistant",
  title: "AI Business Assistant for One Company — Bizlyro AI",
  description:
    "Bizlyro AI is an AI business assistant for one workspace. It answers website visitors from your knowledge, captures leads, and keeps drafts waiting for your confirmation.",
  eyebrow: "One workspace",
  h1: "AI business assistant for one company",
  lede:
    "Bizlyro AI is an AI business assistant for a single company. The same workspace answers website visitors, collects leads and quote requests, and holds email and social drafts until you confirm them. It is built for one business, with one website widget, trained on the knowledge you publish.",
  sections: [
    {
      heading: "Customer service and sales in the same assistant",
      paragraphs: [
        "Owners rarely split “support” and “sales” into two desks. A visitor asks whether you are open, then asks what a service costs. Bizlyro treats both as questions about published facts. The customer-service answer and the sales answer come from the same knowledge, with the same rule: do not invent what is missing.",
        "That is the practical meaning of an AI business assistant here. It is not a general chatbot you point at the public internet. It is a desk for the business you described in Knowledge, plus the public pages you index for that workspace.",
      ],
      links: [
        { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
        { href: "/ai-sales-assistant", label: "AI sales assistant" },
      ],
    },
    {
      heading: "The work that stays with you",
      paragraphs: [
        "Gmail can be connected so Bizlyro drafts a reply from the incoming email. Send goes through that Gmail account only after you confirm. Email never auto-sends. Social drafts stay in the workspace until you approve them, and a post is published only after that platform is connected and you confirm.",
        "Complaints, requests for a person, and topics that should not be automated pause AI and wait in Inbox. You remain the one who commits the business: the custom quote, the exception, the message that leaves your mailbox.",
      ],
      links: [
        { href: "/#inbox", label: "Inbox and drafts" },
        { href: "/#integrations", label: "Which integrations are live" },
      ],
    },
    {
      heading: "Why it is one workspace",
      paragraphs: [
        "BizPilot Pro is one business workspace and one installed website widget. Conversations, knowledge, and drafts for that widget stay with that account. Another subscriber’s workspace is not a source of answers.",
        "The monthly allowance covers AI-generated customer replies. When it is used, replies pause for the rest of the billing period and visitors are offered a person. Cancel anytime in Billing. Stored knowledge remains until you ask for the workspace to be deleted.",
      ],
      links: [
        { href: "/#how-it-works", label: "How setup works" },
        { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
      ],
    },
  ],
  benefits: [
    {
      title: "One place for the repetitive work",
      body: "Website questions, lead details, and drafts sit in the same workspace, so you are not copying facts into a separate bot for every channel.",
    },
    {
      title: "A boundary you can explain",
      body: "Customers get answers you published. Anything that commits money, medicine, law, or a personal reply waits for you.",
    },
    {
      title: "A plan sized for one business",
      body: "You are not buying a call-center suite. The subscription is one workspace, one widget, and a monthly reply allowance with no automatic overage.",
    },
  ],
  limits: [
    {
      title: "Not a staffed front desk",
      body: "The assistant answers from published knowledge. It does not put a person on the clock overnight.",
    },
    {
      title: "Not an open-ended researcher",
      body: "It should not browse for an answer you did not publish, and it should not borrow another business’s facts.",
    },
    {
      title: "Drafts are not sent for you",
      body: "Email and social posts leave the building only after you confirm them. There is no silent send.",
    },
  ],
  steps: [
    {
      title: "Open the account",
      body: "Get started creates the login and the workspace. Subscribe to BizPilot Pro when you want the paid widget and dashboard.",
    },
    {
      title: "Train it on this business only",
      body: "Publish hours, services, policies, and prices you stand behind. Index public pages if you want those facts beside what you typed.",
    },
    {
      title: "Use the desk, not a pile of tools",
      body: "Read website threads in Inbox, review leads, and confirm any Gmail or social draft before it is sent or published.",
    },
  ],
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
      answer:
        "No. Get started creates an account, then you subscribe to BizPilot Pro. The price is on the homepage. The local demo is a browser-only preview. It is not a free workspace and does not call an AI model or Stripe.",
    },
  ],
  related: [
    { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
    { href: "/ai-sales-assistant", label: "AI sales assistant" },
    { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#how-it-works", label: "How it works" },
  ],
};

const smallBusinessChatbot: SeoLandingPage = {
  path: "/ai-chatbot-for-small-business",
  label: "AI chatbot for small business",
  intent: "AI chatbot for small business",
  title: "AI Chatbot for Small Business Websites — Bizlyro AI",
  description:
    "Bizlyro is an AI chatbot for small business websites. Publish hours, services, and policies, then review leads and handoffs from a single workspace.",
  eyebrow: "Small business",
  h1: "AI chatbot for small business websites",
  lede:
    "Bizlyro is an AI chatbot for small business owners who want website answers without hiring a round-the-clock front desk. You publish hours, services, and policies. The chatbot uses those facts on your site. You review leads and any thread that should not be answered automatically.",
  sections: [
    {
      heading: "What a small-business chatbot is for",
      paragraphs: [
        "A shop, clinic, or service company does not need a call-center script. It needs a straight answer to the questions already on the website: when you are open, what you offer, where you work, and how to ask for a quote or a visit.",
        "An AI chatbot for small business is a poor fit when you want it to improvise. Bizlyro is a better fit when you can write the facts down once. The installed widget then repeats those facts to each visitor, including after you have locked the door.",
      ],
    },
    {
      heading: "What to publish before you install it",
      paragraphs: [
        "Start with the answers you already give by phone. Hours and holiday closures. The services you actually sell. The area you cover. Shipping, booking, or visit policies. A price only if you are willing to state it. A short FAQ for the exceptions people ask about.",
        "You can also point Bizlyro at public pages on your own site so indexed copy sits beside what you typed. Do not expect it to know a fact that appears in neither place. Unanswered questions stay on record so you can add the missing line.",
      ],
      links: [
        { href: "/#knowledge", label: "What belongs in Knowledge" },
        { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
      ],
    },
    {
      heading: "One widget on the site you already have",
      paragraphs: [
        "BizPilot Pro includes one website widget. Customers never log in. They open the chat on your site, ask a question, and either get a published answer or a handoff. You install it with the snippet from the paid Widget page.",
        "The public demo is a separate, browser-only preview of the desk layout. It is not the chatbot your customers would use, it is not billed, and it does not call an AI model. Use it to see the screens. Use the subscription when you want the widget on your domain.",
      ],
      links: [
        { href: "/#widget", label: "Website widget" },
        { href: "/demo", label: "Open the local demo" },
        { href: "/ai-business-assistant", label: "AI business assistant" },
      ],
    },
  ],
  benefits: [
    {
      title: "Written for one company",
      body: "The chatbot is trained on your knowledge, not on a generic small-business script that mentions services you do not offer.",
    },
    {
      title: "Honest when it does not know",
      body: "Missing facts are not filled in. You can publish the answer later and the next visitor gets the updated version.",
    },
    {
      title: "A desk behind the chat",
      body: "Leads, handoffs, and drafts are in the workspace, so the chatbot is not a widget with nowhere for the follow-up to go.",
    },
  ],
  limits: [
    {
      title: "The demo is not the live chatbot",
      body: "The local demo never becomes your customer-facing widget. The installed chatbot is part of BizPilot Pro.",
    },
    {
      title: "There is no free chatbot plan",
      body: "Get started creates an account. The website chatbot is available on the paid plan. There is no trial workspace that sends live AI replies.",
    },
    {
      title: "It will not run your marketing unsupervised",
      body: "Social drafts and Gmail replies wait for confirmation. The chatbot does not post or email on its own.",
    },
  ],
  steps: [
    {
      title: "Look at the layout",
      body: "Open the local demo if you want to click through Inbox, Knowledge, and chat before you pay. It stays in this browser.",
    },
    {
      title: "Subscribe and publish",
      body: "Create an account, subscribe to BizPilot Pro, and add the facts the chatbot is allowed to repeat.",
    },
    {
      title: "Add the snippet",
      body: "Install the one widget on your site. Check Inbox for handoffs and Leads for people who asked to be contacted.",
    },
  ],
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
  ],
  related: [
    { href: "/ai-business-assistant", label: "AI business assistant" },
    { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
    { href: "/ai-sales-assistant", label: "AI sales assistant" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/signup", label: "Get started with Bizlyro" },
  ],
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

export function seoPageMetadata(page: SeoLandingPage): Metadata {
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
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function seoPageJsonLd(page: SeoLandingPage) {
  const url = `${BIZLYRO_PUBLIC_ORIGIN}${page.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: "en",
        isPartOf: {
          "@type": "WebSite",
          name: "Bizlyro AI",
          url: BIZLYRO_PUBLIC_ORIGIN,
        },
        about: {
          "@type": "SoftwareApplication",
          name: "Bizlyro AI",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: BIZLYRO_PUBLIC_ORIGIN,
        },
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
