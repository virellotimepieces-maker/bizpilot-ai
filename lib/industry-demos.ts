import { LANDING_DEMO } from "@/lib/marketing/copy";

export type IndustryDemoLead = {
  name: string;
  email: string;
  request: string;
  withheld: string;
};

export type IndustryDemo = {
  id: "contractors" | "dental" | "local";
  presetId: string;
  audience: string;
  landingPath: string;
  knownQuestion: string;
  refusalQuestion: string;
  lead: IndustryDemoLead;
};

export const INDUSTRY_DEMO_LABEL = "Sample / demo data. Not a live customer.";

export const INDUSTRY_DEMOS: IndustryDemo[] = [
  {
    id: "contractors",
    presetId: "service-lumen",
    audience: "Contractors / home services",
    landingPath: "/ai-chatbot-for-contractors",
    knownQuestion: "What do you charge for a diagnostic visit?",
    refusalQuestion: "How much is a commercial warehouse bid?",
    lead: {
      name: "Priya Raman",
      email: "priya.raman@example.com",
      request: "Diagnostic visit for a Berkeley bungalow. Asked for a callback at this email.",
      withheld: "No commercial warehouse price was quoted. That bid is not in the sample knowledge base.",
    },
  },
  {
    id: "dental",
    presetId: "clinic-harbor-dental",
    audience: "Dental clinics",
    landingPath: "/ai-chatbot-for-dental-clinics",
    knownQuestion: "What is the new-patient cleaning fee?",
    refusalQuestion: "How much is a porcelain crown?",
    lead: {
      name: "Maya Chen",
      email: "maya.chen@example.com",
      request: "New-patient cleaning request. The office can reply at this email.",
      withheld: "No crown fee and no whitening promotion were stored. Those amounts are not published.",
    },
  },
  {
    id: "local",
    presetId: "service-cedar-lane",
    audience: "Local service businesses",
    landingPath: "/ai-chatbot-for-local-businesses",
    knownQuestion: "What does a standard clean cost in the Harbor district?",
    refusalQuestion: "How much is a move-out, and is there a first-visit coupon?",
    lead: {
      name: "Andre Walsh",
      email: "andre.walsh@example.com",
      request: "Standard clean in the Harbor district. Asked to be contacted at this email.",
      withheld: "No move-out price and no coupon were captured as facts.",
    },
  },
];

const PRESET_BY_LANDING = new Map(INDUSTRY_DEMOS.map((demo) => [demo.landingPath, demo.presetId]));

export function industryDemoByPresetId(presetId: string | null | undefined) {
  if (!presetId) return null;
  return INDUSTRY_DEMOS.find((demo) => demo.presetId === presetId) ?? null;
}

export function demoHrefForSeoPath(path: string) {
  const presetId = PRESET_BY_LANDING.get(path);
  if (!presetId) return LANDING_DEMO.href;
  return `${LANDING_DEMO.href}?preset=${presetId}`;
}
