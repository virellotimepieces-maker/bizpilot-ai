"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { emptyKnowledge, normalizeKnowledge } from "./empty-knowledge";
import { nid } from "./id";
import { presetById } from "./presets";
import { emptyChat, buildInboxFromPreset, buildSocialInboxFromPreset, rebuildEmailDraft } from "./sample-traffic";
import { generateReply } from "./reply-engine";
import { draftSocialFromInbound, rebuildSocialDraft } from "./social";
import type {
  BusinessType,
  ChatMessage,
  ChatSession,
  EmailMessage,
  EmailStatus,
  KnowledgeBase,
  SocialMessage,
  SocialStatus,
  WorkspaceState,
} from "./types";

const STORAGE_KEY = "bizpilot-workspace-v1";

const initialState: WorkspaceState = {
  knowledge: null,
  presetId: null,
  emails: [],
  socials: [],
  chats: [],
  activeChatId: null,
};

interface WorkspaceContextValue {
  ready: boolean;
  knowledge: KnowledgeBase | null;
  presetId: string | null;
  emails: EmailMessage[];
  socials: SocialMessage[];
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
  updateSocial: (id: string, patch: Partial<SocialMessage>) => void;
  setSocialStatus: (id: string, status: SocialStatus) => void;
  regenerateSocialDraft: (id: string) => void;
  simulateIncomingSocial: (input: {
    platform: SocialMessage["platform"];
    fromName: string;
    handle: string;
    body: string;
    conversationUrl?: string;
  }) => void;
  sendVisitorMessage: (text: string) => void;
  resetChat: () => void;
  resetWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function ensureStoreShape(kb: KnowledgeBase): KnowledgeBase {
  const next = normalizeKnowledge({ ...kb });
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
      socials: parsed.socials ?? [],
      chats: parsed.chats ?? [],
      activeChatId: parsed.activeChatId ?? parsed.chats?.[0]?.id ?? null,
    };
  } catch {
    return initialState;
  }
}

function isEmptyWorkspace(state: WorkspaceState) {
  return !state.knowledge && state.emails.length === 0 && state.socials.length === 0 && state.chats.length === 0;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setState(parseStored(window.localStorage.getItem(STORAGE_KEY)));
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isEmptyWorkspace(state)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const loadPreset = useCallback((presetId: string) => {
    const preset = presetById(presetId);
    if (!preset) return;
    const knowledge = structuredClone(preset.knowledge);
    const chat = emptyChat("Website visitor");
    setState({
      knowledge,
      presetId,
      emails: buildInboxFromPreset(preset, knowledge),
      socials: buildSocialInboxFromPreset(preset, knowledge),
      chats: [chat],
      activeChatId: chat.id,
    });
  }, []);

  const startBlank = useCallback((type: BusinessType) => {
    const knowledge = emptyKnowledge(type);
    const chat = emptyChat("Website visitor");
    setState({
      knowledge,
      presetId: "custom",
      emails: [],
      socials: [],
      chats: [chat],
      activeChatId: chat.id,
    });
  }, []);

  const updateKnowledge = useCallback((next: KnowledgeBase) => {
    setState((prev) => ({ ...prev, knowledge: ensureStoreShape(next) }));
  }, []);

  const setBusinessType = useCallback((type: BusinessType) => {
    setState((prev) => {
      if (!prev.knowledge) return prev;
      return { ...prev, knowledge: ensureStoreShape({ ...prev.knowledge, businessType: type }) };
    });
  }, []);

  const updateEmail = useCallback((id: string, patch: Partial<EmailMessage>) => {
    setState((prev) => ({
      ...prev,
      emails: prev.emails.map((email) => (email.id === id ? { ...email, ...patch } : email)),
    }));
  }, []);

  const setEmailStatus = useCallback((id: string, status: EmailStatus) => {
    setState((prev) => ({
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
    setState((prev) => {
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
      setState((prev) => {
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

  const updateSocial = useCallback((id: string, patch: Partial<SocialMessage>) => {
    setState((prev) => ({
      ...prev,
      socials: prev.socials.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  }, []);

  const setSocialStatus = useCallback((id: string, status: SocialStatus) => {
    setState((prev) => ({
      ...prev,
      socials: prev.socials.map((row) =>
        row.id === id
          ? {
              ...row,
              status,
              postedAt: status === "posted" ? new Date().toISOString() : row.postedAt,
            }
          : row,
      ),
    }));
  }, []);

  const regenerateSocialDraft = useCallback((id: string) => {
    setState((prev) => {
      if (!prev.knowledge) return prev;
      return {
        ...prev,
        socials: prev.socials.map((row) =>
          row.id === id ? rebuildSocialDraft(row, prev.knowledge!) : row,
        ),
      };
    });
  }, []);

  const simulateIncomingSocial = useCallback(
    (input: {
      platform: SocialMessage["platform"];
      fromName: string;
      handle: string;
      body: string;
      conversationUrl?: string;
    }) => {
      setState((prev) => {
        if (!prev.knowledge) return prev;
        const message: SocialMessage = {
          id: nid("soc"),
          ...draftSocialFromInbound({
            kb: prev.knowledge,
            platform: input.platform,
            fromName: input.fromName,
            handle: input.handle,
            body: input.body,
            conversationUrl: input.conversationUrl,
          }),
        };
        return { ...prev, socials: [message, ...prev.socials] };
      });
    },
    [],
  );

  const sendVisitorMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((prev) => {
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
    setState((prev) => ({
      ...prev,
      chats: [chat],
      activeChatId: chat.id,
    }));
  }, []);

  const resetWorkspace = useCallback(() => {
    setState(initialState);
  }, []);

  const activeChat = useMemo(
    () => state.chats.find((c) => c.id === state.activeChatId) ?? state.chats[0] ?? null,
    [state.chats, state.activeChatId],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ready: true,
      knowledge: state.knowledge,
      presetId: state.presetId,
      emails: state.emails,
      socials: state.socials,
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
      updateSocial,
      setSocialStatus,
      regenerateSocialDraft,
      simulateIncomingSocial,
      sendVisitorMessage,
      resetChat,
      resetWorkspace,
    }),
    [
      state.knowledge,
      state.presetId,
      state.emails,
      state.socials,
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
      updateSocial,
      setSocialStatus,
      regenerateSocialDraft,
      simulateIncomingSocial,
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
