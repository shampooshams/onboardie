/**
 * Reads the coach model's reply. The model is asked for {"quotes": [], "answer": ""},
 * but sometimes picks other keys ("message", "suggested_actions"…). Whatever it
 * sends, a new hire must only ever see readable text, never raw json.
 */
export type CoachReply = {
  quotes: string[];
  answer: string;
  /** False when the reply didn't follow the requested format, so it's worth asking again. */
  wellFormed: boolean;
};

const ANSWER_KEYS = ["answer", "message", "reply", "response", "text", "content"];

export function parseCoachReply(text: string): CoachReply {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  if (start === -1) return { quotes: [], answer: raw, wellFormed: false };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.slice(start, raw.lastIndexOf("}") + 1)) as Record<string, unknown>;
  } catch {
    // Text that merely contains a brace is a plain answer.
    return { quotes: [], answer: start === 0 ? stripJsonNoise(raw) : raw, wellFormed: false };
  }

  const quotes = Array.isArray(parsed.quotes)
    ? parsed.quotes.map((q) => String(q).trim()).filter(Boolean).slice(0, 5)
    : [];
  if (typeof parsed.answer === "string" && parsed.answer.trim()) {
    return { quotes, answer: parsed.answer.trim(), wellFormed: true };
  }
  const key = ANSWER_KEYS.find((k) => typeof parsed[k] === "string" && (parsed[k] as string).trim());
  const rest = Object.entries(parsed).filter(([k]) => k !== "quotes" && k !== key);
  const answer = [key ? (parsed[key] as string).trim() : "", ...rest.map(([, v]) => readable(v))]
    .filter(Boolean)
    .join("\n\n");
  return { quotes, answer, wellFormed: false };
}

/** A saved coach message, cleaned up if an earlier version stored raw json. */
export function readableStoredAnswer(text: string): string {
  return text.trim().startsWith("{") ? parseCoachReply(text).answer || text : text;
}

/** Turns leftover json values into markdown: text as paragraphs, lists as bullets. */
function readable(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((v) => readable(v))
      .filter(Boolean)
      .map((v) => `- ${v.replace(/\n+/g, " ")}`)
      .join("\n");
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map((v) => readable(v))
      .filter(Boolean)
      .map((v) => (v.startsWith("- ") ? v : `- ${v}`))
      .join("\n");
  }
  return "";
}

function stripJsonNoise(text: string): string {
  return text.replace(/[{}[\]"]/g, "").replace(/^\s*\w+\s*:\s*/gm, "").trim();
}
