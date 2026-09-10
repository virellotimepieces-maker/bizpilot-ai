export type BusinessType = "online_store" | "service" | "clinic" | "custom";

export type OfferingKind = "product" | "service";

export type KnowledgeVisibility = "public" | "internal";

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface DayHours {
  day: DayKey;
  closed: boolean;
  open: string;
  close: string;
}

export interface BusinessHours {
  timezone: string;
  notes: string;
  days: DayHours[];
}

export interface ContactDetails {
  email: string;
  phone: string;
  address: string;
  website: string;
  extra: string;
}

export interface Offering {
  id: string;
  kind: OfferingKind;
  name: string;
  summary: string;
  price: string;
  availability: string;
  details: string;
}

export interface Policy {
  id: string;
  title: string;
  summary: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  body: string;
  visibility: KnowledgeVisibility;
}

export interface EscalationRules {
  autoAnswerChat: boolean;
  alwaysEscalateTopics: string;
  neverAutoAnswer: string;
  emergencyInstructions: string;
  handoffMessage: string;
  afterHoursNote: string;
}

export interface StoreOperations {
  shippingPolicy: string;
  stockMessaging: string;
  paymentMethods: string;
  cashOnDelivery: boolean;
  orderTrackingNotes: string;
}

export interface ServiceOperations {
  serviceArea: string;
  bookingLeadTime: string;
  onsiteVsRemote: string;
  emergencyCallout: string;
}

export interface ClinicOperations {
  appointmentBooking: string;
  insuranceAccepted: string;
  newPatientProcess: string;
  emergencyProtocol: string;
  clinicalAdvicePolicy: string;
}

export interface KnowledgeBase {
  businessType: BusinessType;
  name: string;
  tagline: string;
  description: string;
  industry: string;
  voice: string;
  contact: ContactDetails;
  hours: BusinessHours;
  offerings: Offering[];
  pricingNotes: string;
  policies: Policy[];
  faqs: FaqItem[];
  documents: KnowledgeDocument[];
  escalation: EscalationRules;
  store?: StoreOperations;
  serviceOps?: ServiceOperations;
  clinicOps?: ClinicOperations;
}

export type ReplyChannel = "chat" | "email";

export type ReplyIntent =
  | "hours"
  | "contact"
  | "offerings"
  | "pricing"
  | "availability"
  | "policy"
  | "faq"
  | "document"
  | "store_shipping"
  | "store_stock"
  | "store_payment"
  | "service_area"
  | "appointments"
  | "insurance"
  | "emergency"
  | "complaint"
  | "medical_advice"
  | "legal"
  | "account_specific"
  | "unknown";

export interface ReplySource {
  kind:
    | "business"
    | "hours"
    | "contact"
    | "offering"
    | "pricing"
    | "policy"
    | "faq"
    | "document"
    | "store"
    | "service"
    | "clinic"
    | "escalation";
  title: string;
  visibility?: KnowledgeVisibility;
}

export interface GeneratedReply {
  channel: ReplyChannel;
  intent: ReplyIntent;
  body: string;
  greetingName?: string;
  confidence: number;
  sources: ReplySource[];
  operatorNote: string;
  safeForChatAuto: boolean;
  requiresHuman: boolean;
  usedInternalKnowledge: boolean;
}

export type EmailStatus =
  | "draft_ready"
  | "needs_review"
  | "escalated"
  | "sent"
  | "discarded";

export interface EmailMessage {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: EmailStatus;
  draftSubject: string;
  draftBody: string;
  intent: ReplyIntent;
  sources: ReplySource[];
  operatorNote: string;
  usedInternalKnowledge: boolean;
  sentAt?: string;
}

export interface ChatMessage {
  id: string;
  role: "visitor" | "assistant" | "human";
  content: string;
  at: string;
  autoAnswered?: boolean;
  requiresHuman?: boolean;
  sources?: ReplySource[];
  intent?: ReplyIntent;
}

export interface ChatSession {
  id: string;
  visitorName: string;
  startedAt: string;
  messages: ChatMessage[];
  waitingOnHuman: boolean;
}

export interface WorkspaceState {
  knowledge: KnowledgeBase | null;
  presetId: string | null;
  emails: EmailMessage[];
  chats: ChatSession[];
  activeChatId: string | null;
}

export interface BusinessPreset {
  id: string;
  businessType: BusinessType;
  title: string;
  subtitle: string;
  blurb: string;
  knowledge: KnowledgeBase;
  suggestedQuestions: string[];
  sampleEmails: Omit<
    EmailMessage,
    | "id"
    | "status"
    | "draftSubject"
    | "draftBody"
    | "intent"
    | "sources"
    | "operatorNote"
    | "usedInternalKnowledge"
    | "sentAt"
  >[];
}
