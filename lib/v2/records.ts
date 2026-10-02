import { randomUUID } from "node:crypto";
import { parseCustomerIntent } from "./intents";
import {
  requireAppointmentStatus,
  requireIntegrationProvider,
  requireIntegrationStatus,
  requireKnowledgeKind,
  requireKnowledgeSourceType,
  requireLeadStatus,
  requireQuoteStatus,
} from "./assert";
import { parseWidgetPosition } from "./widget-settings";
import type {
  AppointmentRequestRecord,
  IntegrationConnectionRecord,
  KnowledgeEntryInput,
  KnowledgeEntryRecord,
  LeadInput,
  LeadRecord,
  QuoteRequestRecord,
  QuoteRequestWrite,
  UnansweredQuestionRecord,
  WidgetSettingsRecord,
} from "./types";

export function newKnowledgeEntry(workspaceId: string, input: KnowledgeEntryInput, now = new Date()): KnowledgeEntryRecord {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) throw new Error("knowledge_entry_incomplete");
  return {
    id: randomUUID(),
    workspaceId,
    kind: requireKnowledgeKind(input.kind),
    title,
    content,
    enabled: input.enabled ?? true,
    sourceType: requireKnowledgeSourceType(input.sourceType ?? "manual"),
    sourceUrl: (input.sourceUrl ?? "").trim(),
    sourceLabel: (input.sourceLabel ?? "").trim(),
    sourceRef: (input.sourceRef ?? "").trim(),
    lastUpdatedAt: now,
    createdAt: now,
  };
}

export function patchKnowledgeEntry(
  row: KnowledgeEntryRecord,
  patch: Partial<KnowledgeEntryInput>,
  now = new Date(),
): KnowledgeEntryRecord {
  const nextTitle = patch.title === undefined ? row.title : patch.title.trim();
  const nextContent = patch.content === undefined ? row.content : patch.content.trim();
  if (!nextTitle || !nextContent) throw new Error("knowledge_entry_incomplete");
  return {
    ...row,
    kind: patch.kind ? requireKnowledgeKind(patch.kind) : row.kind,
    title: nextTitle,
    content: nextContent,
    enabled: patch.enabled ?? row.enabled,
    sourceType: patch.sourceType ? requireKnowledgeSourceType(patch.sourceType) : row.sourceType,
    sourceUrl: patch.sourceUrl === undefined ? row.sourceUrl : patch.sourceUrl.trim(),
    sourceLabel: patch.sourceLabel === undefined ? row.sourceLabel : patch.sourceLabel.trim(),
    sourceRef: patch.sourceRef === undefined ? row.sourceRef : patch.sourceRef.trim(),
    lastUpdatedAt: now,
  };
}

export function newUnansweredQuestion(input: {
  workspaceId: string;
  conversationId?: string | null;
  question: string;
  detectedLanguage?: string;
  now?: Date;
}): UnansweredQuestionRecord {
  const question = input.question.trim();
  if (!question) throw new Error("unanswered_question_incomplete");
  const now = input.now ?? new Date();
  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    conversationId: input.conversationId ?? null,
    question,
    detectedLanguage: (input.detectedLanguage ?? "").trim(),
    status: "open",
    createdAt: now,
    resolvedAt: null,
  };
}

export function newLead(workspaceId: string, input: LeadInput = {}, now = new Date()): LeadRecord {
  return {
    id: randomUUID(),
    workspaceId,
    conversationId: input.conversationId ?? null,
    name: (input.name ?? "").trim(),
    email: (input.email ?? "").trim().toLowerCase(),
    phone: (input.phone ?? "").trim(),
    interest: (input.interest ?? "").trim(),
    request: (input.request ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    source: (input.source ?? "website").trim() || "website",
    status: requireLeadStatus(input.status ?? "new"),
    intent: parseCustomerIntent(input.intent),
    aiSummary: (input.aiSummary ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function patchLead(row: LeadRecord, patch: LeadInput, now = new Date()): LeadRecord {
  return {
    ...row,
    conversationId: patch.conversationId === undefined ? row.conversationId : patch.conversationId,
    name: patch.name === undefined ? row.name : patch.name.trim(),
    email: patch.email === undefined ? row.email : patch.email.trim().toLowerCase(),
    phone: patch.phone === undefined ? row.phone : patch.phone.trim(),
    interest: patch.interest === undefined ? row.interest : patch.interest.trim(),
    request: patch.request === undefined ? row.request : patch.request.trim(),
    notes: patch.notes === undefined ? row.notes : patch.notes.trim(),
    source: patch.source === undefined ? row.source : patch.source.trim() || row.source,
    status: patch.status === undefined ? row.status : requireLeadStatus(patch.status),
    intent: patch.intent === undefined ? row.intent : parseCustomerIntent(patch.intent),
    aiSummary: patch.aiSummary === undefined ? row.aiSummary : patch.aiSummary.trim(),
    updatedAt: now,
  };
}

export function newQuoteRequest(
  workspaceId: string,
  input: QuoteRequestWrite = {},
  now = new Date(),
): QuoteRequestRecord {
  return {
    id: randomUUID(),
    workspaceId,
    conversationId: input.conversationId ?? null,
    leadId: input.leadId ?? null,
    customerName: (input.customerName ?? "").trim(),
    email: (input.email ?? "").trim().toLowerCase(),
    phone: (input.phone ?? "").trim(),
    productService: (input.productService ?? "").trim(),
    requirements: (input.requirements ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    status: requireQuoteStatus(input.status ?? "requested"),
    createdAt: now,
    updatedAt: now,
  };
}

export function patchQuoteRequest(
  row: QuoteRequestRecord,
  patch: QuoteRequestWrite,
  now = new Date(),
): QuoteRequestRecord {
  return {
    ...row,
    conversationId: patch.conversationId === undefined ? row.conversationId : patch.conversationId,
    leadId: patch.leadId === undefined ? row.leadId : patch.leadId,
    customerName: patch.customerName === undefined ? row.customerName : patch.customerName.trim(),
    email: patch.email === undefined ? row.email : patch.email.trim().toLowerCase(),
    phone: patch.phone === undefined ? row.phone : patch.phone.trim(),
    productService:
      patch.productService === undefined ? row.productService : patch.productService.trim(),
    requirements: patch.requirements === undefined ? row.requirements : patch.requirements.trim(),
    notes: patch.notes === undefined ? row.notes : patch.notes.trim(),
    status: patch.status === undefined ? row.status : requireQuoteStatus(patch.status),
    updatedAt: now,
  };
}

export function newAppointmentRequest(
  workspaceId: string,
  input: Partial<
    Pick<
      AppointmentRequestRecord,
      | "conversationId"
      | "leadId"
      | "customerName"
      | "email"
      | "phone"
      | "requestedService"
      | "preferredAt"
      | "notes"
      | "status"
    >
  > = {},
  now = new Date(),
): AppointmentRequestRecord {
  return {
    id: randomUUID(),
    workspaceId,
    conversationId: input.conversationId ?? null,
    leadId: input.leadId ?? null,
    customerName: (input.customerName ?? "").trim(),
    email: (input.email ?? "").trim().toLowerCase(),
    phone: (input.phone ?? "").trim(),
    requestedService: (input.requestedService ?? "").trim(),
    preferredAt: (input.preferredAt ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    status: requireAppointmentStatus(input.status ?? "requested"),
    createdAt: now,
    updatedAt: now,
  };
}

export function newIntegrationConnection(input: {
  workspaceId: string;
  provider: string;
  status?: string;
  now?: Date;
}): IntegrationConnectionRecord {
  const now = input.now ?? new Date();
  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    provider: requireIntegrationProvider(input.provider),
    status: requireIntegrationStatus(input.status ?? "disconnected"),
    createdAt: now,
    updatedAt: now,
  };
}

export function asSuggestedQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is string => typeof row === "string").map((row) => row.trim()).filter(Boolean);
}

export function mapWidgetSettings(row: {
  id: string;
  workspaceId: string;
  businessDisplayName: string;
  logoUrl: string;
  welcomeMessage: string;
  suggestedQuestions: unknown;
  accentColor: string;
  position: string;
  identifyAsAi: boolean;
  collectPhone: boolean;
  leadCaptureEnabled: boolean;
  placeholderPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}): WidgetSettingsRecord {
  return {
    ...row,
    suggestedQuestions: asSuggestedQuestions(row.suggestedQuestions),
    position: parseWidgetPosition(row.position),
  };
}
