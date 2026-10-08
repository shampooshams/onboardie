/**
 * Reads the coach model's reply: a markdown answer, then a "SOURCES:" line and
 * the quoted passages, one per line starting with "> ". If the model sends json
 * instead (it has invented its own shapes before), it's turned into readable
 * text — a new hire must never see raw json.
 */
export type CoachReply = {
  quotes: string[];
  answer: string;
  /** False when the reply didn't follow the requested format, so it's worth asking again. */
  wellFormed: boolean;
};

const ANSWER_KEYS = ["answer", "message", "reply", "response", "text", "content"];

/** The line that separates the answer from its quoted passages. */
const SOURCES_LINE = /^[ \t]*[*_#]*\s*(?:sources|quellen)\s*[*_]*\s*:?[*_]*[ \t]*$/im;

export function parseCoachReply(text: string): CoachReply {
  const raw = text.trim().replace(/^```(?:json|markdown|md)?\s*/i, "").replace(/\s*```$/, "");
  if (!raw.startsWith("{")) return parsePlain(raw);
  return parseJson(raw);
}

function parsePlain(raw: string): CoachReply {
  const match = SOURCES_LINE.exec(raw);
  if (!match) {
    // Lines quoted with "> " but without the SOURCES heading still count.
    const quoted = raw.split("\n").filter((line) => /^\s*>/.test(line));
    return quoted.length > 0
      ? { quotes: cleanQuotes(quoted), answer: "", wellFormed: true }
      : { quotes: [], answer: raw, wellFormed: false };
  }
  const answer = raw.slice(0, match.index).trim();
  const quotes = cleanQuotes(raw.slice(match.index + match[0].length).split("\n"));
  return { quotes, answer, wellFormed: true };
}

function cleanQuotes(lines: string[]): string[] {
  return lines
    .map((line) =>
      line
        .replace(/^\s*(?:>|[-*•]|\d+[.)])\s*/, "")
        .trim()
        .replace(/^["„“”«»']+|["„“”«»']+$/g, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 8);
}

function parseJson(raw: string): CoachReply {
  const start = 0;

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
  const items = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
  return items
    .map(inline)
    .filter(Boolean)
    .map((v) => `- ${v}`)
    .join("\n");
}

/** One bullet's text: an object's text values joined, e.g. "Collect documents — Gather paperwork". */
function inline(value: unknown): string {
  if (typeof value === "string") return value.trim().replace(/\n+/g, " ");
  const items = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
  return items.map(inline).filter(Boolean).join(" — ");
}

function stripJsonNoise(text: string): string {
  return text.replace(/[{}[\]"]/g, "").replace(/^\s*\w+\s*:\s*/gm, "").trim();
}
