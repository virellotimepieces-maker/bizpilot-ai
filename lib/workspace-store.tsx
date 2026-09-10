"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { emptyKnowledge } from "./empty-knowledge";
import { nid } from "./id";
import { presetById } from "./presets";
import { emptyChat, buildInboxFromPreset, rebuildEmailDraft } from "./sample-traffic";
import { generateReply } from "./reply-engine";
import type {
  BusinessType,
  ChatMessage,
  ChatSession,
  EmailMessage,
  EmailStatus,
  KnowledgeBase,
  WorkspaceState,
} from "./types";

const STORAGE_KEY = "replypilot-workspace-v1";

const initialState: WorkspaceState = {
  knowledge: null,
  presetId: null,
  emails: [],
  chats: [],
  activeChatId: null,
};

interface WorkspaceContextValue {
  ready: boolean;
  knowledge: KnowledgeBase | null;
  presetId: string | null;
  emails: EmailMessage[];
  chats: ChatSession[];
  activeChat: ChatSession | null;
  loadPreset: (presetId: string) => void;
  startBlank: (type: BusinessType) => void;
  updateKnowledge: (next: KnowledgeBase) => void;
  setBusinessType: (type: BusinessType) => void;
  updateEmail: (id: string, patch: Partial<EmailMessage>) => void;
  setEmailStatus: (id: string, status: EmailStatus) => void;
  regenerateDraft: (id: string) => void;
  simulateIncomingEmail: (input: {
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
  }) => void;
  sendVisitorMessage: (text: string) => void;
  resetChat: () => void;
  resetWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function ensureStoreShape(kb: KnowledgeBase): KnowledgeBase {
  const next = { ...kb };
  if (kb.businessType === "online_store") {
    next.store = kb.store ?? {
      shippingPolicy: "",
      stockMessaging: "",
      paymentMethods: "",
      cashOnDelivery: false,
      orderTrackingNotes: "",
    };
  }
  if (kb.businessType === "service") {
    next.serviceOps = kb.serviceOps ?? {
      serviceArea: "",
      bookingLeadTime: "",
      onsiteVsRemote: "",
      emergencyCallout: "",
    };
  }
  if (kb.businessType === "clinic") {
    next.clinicOps = kb.clinicOps ?? {
      appointmentBooking: "",
      insuranceAccepted: "",
      newPatientProcess: "",
      emergencyProtocol: "",
      clinicalAdvicePolicy: "",
    };
  }
  return next;
}

function parseStored(raw: string | null): WorkspaceState {
  if (!raw) return initialState;
  try {
    const parsed = JSON.parse(raw) as WorkspaceState;
    return {
      knowledge: parsed.knowledge ? ensureStoreShape(parsed.knowledge) : null,
      presetId: parsed.presetId ?? null,
      emails: parsed.emails ?? [],
      chats: parsed.chats ?? [],
      activeChatId: parsed.activeChatId ?? parsed.chats?.[0]?.id ?? null,
    };
  } catch {
    return initialState;
  }
}

const listeners = new Set<() => void>();
let snapshot: WorkspaceState = initialState;

if (typeof window !== "undefined") {
  snapshot = parseStored(localStorage.getItem(STORAGE_KEY));
}

function emit() {
  for (const listener of listeners) listener();
}

function persist(next: WorkspaceState) {
  snapshot = next;
  if (typeof window !== "undefined") {
    if (!next.knowledge && next.emails.length === 0 && next.chats.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }
  emit();
}

function write(updater: (prev: WorkspaceState) => WorkspaceState) {
  persist(updater(snapshot));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getClientReady() {
  return true;
}

function getServerReady() {
  return false;
}

function readySubscribe() {
  return () => {};
}

function getServerSnapshot() {
  return initialState;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(readySubscribe, getClientReady, getServerReady);

  const loadPreset = useCallback((presetId: string) => {
    const preset = presetById(presetId);
    if (!preset) return;
    const knowledge = structuredClone(preset.knowledge);
    const chat = emptyChat("Website visitor");
    persist({
      knowledge,
      presetId,
      emails: buildInboxFromPreset(preset, knowledge),
      chats: [chat],
      activeChatId: chat.id,
    });
  }, []);

  const startBlank = useCallback((type: BusinessType) => {
    const knowledge = emptyKnowledge(type);
    const chat = emptyChat("Website visitor");
    persist({
      knowledge,
      presetId: "custom",
      emails: [],
      chats: [chat],
      activeChatId: chat.id,
    });
  }, []);

  const updateKnowledge = useCallback((next: KnowledgeBase) => {
    write((prev) => ({ ...prev, knowledge: ensureStoreShape(next) }));
  }, []);

  const setBusinessType = useCallback((type: BusinessType) => {
    write((prev) => {
      if (!prev.knowledge) return prev;
      return { ...prev, knowledge: ensureStoreShape({ ...prev.knowledge, businessType: type }) };
    });
  }, []);

  const updateEmail = useCallback((id: string, patch: Partial<EmailMessage>) => {
    write((prev) => ({
      ...prev,
      emails: prev.emails.map((email) => (email.id === id ? { ...email, ...patch } : email)),
    }));
  }, []);

  const setEmailStatus = useCallback((id: string, status: EmailStatus) => {
    write((prev) => ({
      ...prev,
      emails: prev.emails.map((email) =>
        email.id === id
          ? {
              ...email,
              status,
              sentAt: status === "sent" ? new Date().toISOString() : email.sentAt,
            }
          : email,
      ),
    }));
  }, []);

  const regenerateDraft = useCallback((id: string) => {
    write((prev) => {
      if (!prev.knowledge) return prev;
      return {
        ...prev,
        emails: prev.emails.map((email) =>
          email.id === id ? rebuildEmailDraft(email, prev.knowledge!) : email,
        ),
      };
    });
  }, []);

  const simulateIncomingEmail = useCallback(
    (input: { fromName: string; fromEmail: string; subject: string; body: string }) => {
      write((prev) => {
        if (!prev.knowledge) return prev;
        const reply = generateReply({
          query: `${input.subject}\n${input.body}`,
          kb: prev.knowledge,
          channel: "email",
          customerName: input.fromName,
        });
        const needsCarefulReview =
          reply.intent === "emergency" ||
          reply.intent === "legal" ||
          reply.intent === "complaint" ||
          reply.intent === "medical_advice" ||
          reply.usedInternalKnowledge;
        const email: EmailMessage = {
          id: nid("mail"),
          fromName: input.fromName,
          fromEmail: input.fromEmail,
          subject: input.subject,
          body: input.body,
          receivedAt: "Just now",
          status: needsCarefulReview ? "escalated" : "draft_ready",
          draftSubject: `Re: ${input.subject}`,
          draftBody: reply.body,
          intent: reply.intent,
          sources: reply.sources,
          operatorNote: reply.operatorNote,
          usedInternalKnowledge: reply.usedInternalKnowledge,
        };
        return { ...prev, emails: [email, ...prev.emails] };
      });
    },
    [],
  );

  const sendVisitorMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    write((prev) => {
      if (!prev.knowledge) return prev;
      let chats = prev.chats;
      let activeId = prev.activeChatId;
      if (!activeId || !chats.some((c) => c.id === activeId)) {
        const created = emptyChat("Website visitor");
        chats = [created, ...chats];
        activeId = created.id;
      }
      const reply = generateReply({
        query: trimmed,
        kb: prev.knowledge,
        channel: "chat",
      });
      const now = new Date().toISOString();
      const visitor: ChatMessage = {
        id: nid("msg"),
        role: "visitor",
        content: trimmed,
        at: now,
      };
      const assistant: ChatMessage = {
        id: nid("msg"),
        role: "assistant",
        content: reply.safeForChatAuto ? reply.body : prev.knowledge.escalation.handoffMessage,
        at: now,
        autoAnswered: reply.safeForChatAuto,
        requiresHuman: reply.requiresHuman || !reply.safeForChatAuto,
        sources: reply.sources,
        intent: reply.intent,
      };
      return {
        ...prev,
        activeChatId: activeId,
        chats: chats.map((chat) =>
          chat.id === activeId
            ? {
                ...chat,
                waitingOnHuman: assistant.requiresHuman ?? false,
                messages: [...chat.messages, visitor, assistant],
              }
            : chat,
        ),
      };
    });
  }, []);

  const resetChat = useCallback(() => {
    const chat = emptyChat("Website visitor");
    write((prev) => ({
      ...prev,
      chats: [chat],
      activeChatId: chat.id,
    }));
  }, []);

  const resetWorkspace = useCallback(() => {
    persist(initialState);
  }, []);

  const activeChat = useMemo(
    () => state.chats.find((c) => c.id === state.activeChatId) ?? state.chats[0] ?? null,
    [state.chats, state.activeChatId],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ready,
      knowledge: state.knowledge,
      presetId: state.presetId,
      emails: state.emails,
      chats: state.chats,
      activeChat,
      loadPreset,
      startBlank,
      updateKnowledge,
      setBusinessType,
      updateEmail,
      setEmailStatus,
      regenerateDraft,
      simulateIncomingEmail,
      sendVisitorMessage,
      resetChat,
      resetWorkspace,
    }),
    [
      ready,
      state.knowledge,
      state.presetId,
      state.emails,
      state.chats,
      activeChat,
      loadPreset,
      startBlank,
      updateKnowledge,
      setBusinessType,
      updateEmail,
      setEmailStatus,
      regenerateDraft,
      simulateIncomingEmail,
      sendVisitorMessage,
      resetChat,
      resetWorkspace,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
