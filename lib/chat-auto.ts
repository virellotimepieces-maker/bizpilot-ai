import { emptyKnowledge } from "./empty-knowledge";
import { generateReply } from "./reply-engine";
import type { GeneratedReply, KnowledgeBase, ReplyIntent } from "./types";

const FREEZE_INTENTS = new Set<ReplyIntent>([
  "emergency",
  "complaint",
  "legal",
  "medical_advice",
  "account_specific",
]);

function matchedEscalationRule(note: string) {
  const lower = note.toLowerCase();
  return lower.includes("escalation rule") || lower.includes("matched an escalation");
}

export function chatAutoDecision(kb: KnowledgeBase | null, question: string): {
  reply: GeneratedReply;
  autoAnswer: boolean;
} {
  const knowledge = kb ?? emptyKnowledge("custom");
  const reply = generateReply({
    query: question,
    kb: knowledge,
    channel: "chat",
  });
  const autoOff = !knowledge.escalation.autoAnswerChat && reply.intent !== "emergency";
  const autoAnswer =
    !autoOff && !FREEZE_INTENTS.has(reply.intent) && !matchedEscalationRule(reply.operatorNote);
  return { reply, autoAnswer };
}

export function freezeVisitorText(kb: KnowledgeBase | null, reply: GeneratedReply) {
  if (reply.intent === "emergency") return reply.body;
  if (kb && !kb.escalation.autoAnswerChat) {
    return kb.escalation.handoffMessage.trim() || reply.body;
  }
  return reply.body;
}
