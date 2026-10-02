import type {
  AppointmentRequestStatus,
  CustomerIntent,
  FutureIntegrationProvider,
  IntegrationConnectionStatus,
  KnowledgeKind,
  KnowledgeSourceType,
  LeadStatus,
  QuoteRequestStatus,
  UnansweredStatus,
  WidgetPosition,
} from "./enums";

export interface KnowledgeEntryRecord {
  id: string;
  workspaceId: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  enabled: boolean;
  sourceType: KnowledgeSourceType;
  sourceUrl: string;
  sourceLabel: string;
  sourceRef: string;
  lastUpdatedAt: Date;
  createdAt: Date;
}

export interface KnowledgeEntryInput {
  kind: KnowledgeKind;
  title: string;
  content: string;
  enabled?: boolean;
  sourceType?: KnowledgeSourceType;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceRef?: string;
}

export interface KnowledgeEntryFilters {
  kind?: KnowledgeKind;
  enabled?: boolean;
  query?: string;
}

export interface UnansweredQuestionRecord {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  question: string;
  detectedLanguage: string;
  status: UnansweredStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface LeadRecord {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  name: string;
  email: string;
  phone: string;
  interest: string;
  request: string;
  notes: string;
  source: string;
  status: LeadStatus;
  intent: CustomerIntent;
  aiSummary: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadInput {
  conversationId?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  interest?: string;
  request?: string;
  notes?: string;
  source?: string;
  status?: LeadStatus;
  intent?: CustomerIntent;
  aiSummary?: string;
}

export interface QuoteRequestRecord {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  leadId: string | null;
  customerName: string;
  email: string;
  phone: string;
  productService: string;
  requirements: string;
  notes: string;
  status: QuoteRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type QuoteRequestWrite = Partial<
  Pick<
    QuoteRequestRecord,
    | "conversationId"
    | "leadId"
    | "customerName"
    | "email"
    | "phone"
    | "productService"
    | "requirements"
    | "notes"
    | "status"
  >
>;

export interface AppointmentRequestRecord {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  leadId: string | null;
  customerName: string;
  email: string;
  phone: string;
  requestedService: string;
  preferredAt: string;
  notes: string;
  status: AppointmentRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetSettingsRecord {
  id: string;
  workspaceId: string;
  businessDisplayName: string;
  logoUrl: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  accentColor: string;
  position: WidgetPosition;
  identifyAsAi: boolean;
  collectPhone: boolean;
  leadCaptureEnabled: boolean;
  placeholderPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetSettingsInput {
  businessDisplayName?: string;
  logoUrl?: string;
  welcomeMessage?: string;
  suggestedQuestions?: string[];
  accentColor?: string;
  position?: WidgetPosition;
  identifyAsAi?: boolean;
  collectPhone?: boolean;
  leadCaptureEnabled?: boolean;
  placeholderPrompt?: string;
}

export interface IntegrationConnectionRecord {
  id: string;
  workspaceId: string;
  provider: FutureIntegrationProvider;
  status: IntegrationConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeskOverviewCounts {
  conversationsTotal: number;
  conversationsNeedingHuman: number;
  conversationsUnread: number;
  conversationsOpen: number;
  leadsNew: number;
  leadsQualified: number;
  unansweredOpen: number;
  quoteRequestsOpen: number;
  appointmentRequestsOpen: number;
}
