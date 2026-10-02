import { WEBSITE_NO_SOURCE_ANSWER } from "@/lib/website/answer";

export function answerLacksPublishedKnowledge(answer: string) {
  const text = answer.trim().toLowerCase();
  if (!text) return false;
  if (answer.trim() === WEBSITE_NO_SOURCE_ANSWER) return true;
  if (text.includes("information is unavailable")) return true;
  if (text.includes("don't have a reliable source") || text.includes("don’t have a reliable source")) return true;
  if (text.includes("not in the published knowledge") || text.includes("not in this business’s knowledge")) {
    return true;
  }
  return false;
}

export function normalizeUnansweredQuestion(question: string) {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}
