const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOREIGN_APPOINTMENT_RE =
  /予約|预约|預約|예약|\b(?:cita|citas|horario|horarios|rendez-vous|termin|termine)\b|\brendez\s+vous\b/i;

const NEUTRAL_TOKENS = new Set([
  "yes",
  "yeah",
  "yep",
  "no",
  "nope",
  "ok",
  "okay",
  "confirm",
  "confirmed",
  "oo",
  "opo",
  "hindi",
  "sige",
  "si",
  "vale",
  "oui",
  "non",
  "ja",
  "nein",
  "hai",
  "iie",
  "please",
  "thanks",
  "thank",
]);

const MARKERS: Record<string, string[]> = {
  tl: [
    "gusto",
    "ko",
    "po",
    "ba",
    "ang",
    "mga",
    "salamat",
    "magkano",
    "bukas",
    "ngayon",
    "oras",
    "pwede",
    "pakiusap",
    "anong",
    "ano",
    "saan",
    "kailan",
    "kumusta",
    "magandang",
  ],
  es: [
    "hola",
    "quiero",
    "cita",
    "citas",
    "gracias",
    "por",
    "favor",
    "manana",
    "disponible",
    "disponibles",
    "horario",
    "horarios",
    "necesito",
    "buenos",
    "buenas",
    "que",
    "tienes",
  ],
  fr: [
    "bonjour",
    "rendez",
    "vous",
    "merci",
    "voudrais",
    "disponible",
    "disponibles",
    "heure",
    "demain",
    "salut",
  ],
  de: ["hallo", "ich", "mochte", "termin", "termine", "bitte", "verfugbar", "morgen", "guten"],
  en: [
    "the",
    "what",
    "times",
    "available",
    "book",
    "appointment",
    "please",
    "like",
    "would",
    "tomorrow",
    "open",
    "choose",
    "name",
    "email",
  ],
};

const GREETINGS: Array<[RegExp, string]> = [
  [/^(?:hola|buenos dias|buenas tardes|buenas noches)$/, "es"],
  [/^(?:bonjour|salut)$/, "fr"],
  [/^(?:hallo|guten tag|guten morgen)$/, "de"],
  [/^(?:kumusta|magandang umaga|magandang hapon|magandang gabi)$/, "tl"],
];

const MIN_SCORE = 2;

export function asksForLiveAppointment(text: string) {
  return FOREIGN_APPOINTMENT_RE.test(text);
}

export function resolveConversationLanguage(previous: string, message: string) {
  const prior = normalizeLanguage(previous);
  const text = message.trim();
  if (!text) return prior || "en";
  if (isNeutralMessage(text, prior)) return prior || "en";
  const script = detectScript(text);
  if (script) return script;
  const greeting = greetingLanguage(text);
  if (greeting) return greeting;
  const scored = scoreLatin(text);
  if (scored) return scored;
  if (isLikelyName(text)) return prior || "en";
  return prior || "en";
}

function normalizeLanguage(value: string) {
  return value.trim().toLowerCase().split(/[_-]/)[0] ?? "";
}

function fold(text: string) {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function tokens(text: string) {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function isNeutralMessage(text: string, prior: string) {
  if (EMAIL_RE.test(text)) return true;
  if (isSlotLabel(text)) return true;
  if (isDateLike(text)) return true;
  if (prior && text.length < 3) return true;
  const parts = tokens(text);
  return parts.length > 0 && parts.length <= 3 && parts.every((part) => NEUTRAL_TOKENS.has(part));
}

function isSlotLabel(text: string) {
  if (/^slot:/i.test(text.trim())) return true;
  return /\b(?:mon|tue|wed|thu|fri|sat|sun)/i.test(text) && /\d{1,2}:\d{2}/.test(text);
}

function isDateLike(text: string) {
  const folded = fold(text).replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  if (/^\d{1,2}:\d{2}(?:\s*[ap]m)?$/.test(folded)) return true;
  if (/^\d{4}-\d{2}-\d{2}(?:t\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?z)?$/.test(folded)) return true;
  return /^(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]* \d{1,2}(?: \d{4})?(?: \d{1,2}:\d{2}(?: [ap]m)?)?$/.test(
    folded,
  );
}

function detectScript(text: string) {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u0400-\u04ff]/.test(text)) return "ru";
  if (/[\u0e00-\u0e7f]/.test(text)) return "th";
  return "";
}

function greetingLanguage(text: string) {
  const folded = fold(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const words = folded.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 2) return "";
  for (const [pattern, language] of GREETINGS) {
    if (pattern.test(folded)) return language;
  }
  return "";
}

function scoreLatin(text: string) {
  const parts = tokens(text);
  if (!parts.length) return "";
  const scores = new Map<string, number>();
  for (const [language, markers] of Object.entries(MARKERS)) {
    const markerSet = new Set(markers);
    let score = 0;
    for (const part of parts) {
      if (markerSet.has(part)) score += 1;
    }
    if (score) scores.set(language, score);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const winner = ranked[0];
  if (!winner || winner[1] < MIN_SCORE) return "";
  const runnerUp = ranked[1]?.[1] ?? 0;
  if (winner[1] <= runnerUp) return "";
  return winner[0];
}

function isLikelyName(text: string) {
  const words = text.trim().split(/\s+/);
  if (!words.length || words.length > 4) return false;
  return words.every((word) => /^[\p{L}][\p{L}'.’-]*$/u.test(word));
}
