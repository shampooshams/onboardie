/**
 * Splits documents into numbered paragraphs ("[12] …") for the coach. The model
 * replies with paragraph numbers only, and the app shows those paragraphs word
 * for word — there is no text from the model to check or to get wrong.
 */

/** Paragraphs longer than this are split into sentences, so a pick stays focused. */
const MAX_UNIT_CHARS = 400;

export type NumberedDocument = {
  /** units[n - 1] is paragraph [n], exactly as written in the document. */
  units: string[];
  /** docOf[n - 1] is the index (in the documents passed in) paragraph [n] comes from. */
  docOf: number[];
  /** The documents with every paragraph prefixed by its number, for the prompt. */
  text: string;
};

function sentences(line: string): string[] {
  const parts = line.match(/[^.!?]+(?:[.!?]+["'”“)\]]*|$)\s*/g) ?? [line];
  // Re-join tiny fragments (e.g. "e.g." or "Nr.") to the sentence before them.
  const out: string[] = [];
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    if (out.length > 0 && (part.length < 25 || out[out.length - 1].length < 25)) {
      out[out.length - 1] += ` ${part}`;
    } else out.push(part);
  }
  return out;
}

export function numberDocuments(docs: { title: string; text: string }[]): NumberedDocument {
  const units: string[] = [];
  const docOf: number[] = [];
  const blocks: string[] = [];
  for (const [docIndex, doc] of docs.entries()) {
    if (!doc.text.trim()) continue;
    const lines: string[] = [];
    // PDFs uploaded before paragraphs were kept are stored as one line per page;
    // there, two or more spaces mark where a paragraph ended, so split on those.
    const rawLines = doc.text
      .split("\n")
      .flatMap((line) => (line.length > MAX_UNIT_CHARS ? line.split(/[ \t]{2,}/) : [line]));
    for (const raw of rawLines) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;
      for (const unit of line.length > MAX_UNIT_CHARS ? sentences(line) : [line]) {
        units.push(unit);
        docOf.push(docIndex);
        lines.push(`[${units.length}] ${unit}`);
      }
    }
    blocks.push(`=== ${doc.title} ===\n${lines.join("\n")}`);
  }
  return { units, docOf, text: blocks.join("\n\n") };
}

export type CoachPick = {
  numbers: number[];
  /** The documents don't fully answer it and it's a general, public-knowledge question. */
  needsWeb: boolean;
  /** The question is about the company's own rules, people or processes. */
  companySpecific: boolean;
  /** False when the reply contained nothing usable (an explicit empty list counts as usable). */
  found: boolean;
};

/** Lowercase letters and digits only, single-spaced — for comparing opening words. */
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The paragraph the model meant: its number when the paragraph really starts
 * with (or contains) the words the model copied, otherwise the paragraph that
 * does. Models sometimes get the number slightly wrong; the words catch that.
 * Returns null when neither matches, so nothing unrelated is ever shown.
 */
function resolvePick(n: number, startsWith: string, units: string[], normalized: string[]): number | null {
  const words = normalize(startsWith).split(" ").filter(Boolean).slice(0, 8).join(" ");
  if (!words) return n >= 1 && n <= units.length ? n : null;
  const fits = (i: number) => normalized[i].startsWith(words) || normalized[i].includes(words);
  if (n >= 1 && n <= units.length && fits(n - 1)) return n;
  const starts = normalized.findIndex((u) => u.startsWith(words));
  if (starts !== -1) return starts + 1;
  const contains = normalized.findIndex((u) => u.includes(words));
  return contains !== -1 ? contains + 1 : null;
}

/**
 * Reads the model's reply: {"passages": [{"paragraph": 12, "starts_with": "…"}],
 * "needs_web": bool} json (older {"paragraphs": [12]} also accepted), or, from a
 * provider without structured output, "[12]" / "PARAGRAPHS: 12, 13" in plain text
 * (the web is only searched when the json asks for it).
 */
export function readCoachPick(reply: string, units: string[]): CoachPick {
  const normalized = units.map(normalize);
  const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= units.length;
  const unique = (ns: number[]) => [...new Set(ns.filter(inRange))].sort((a, b) => a - b).slice(0, 8);

  const json = /\{[\s\S]*\}/.exec(reply)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as {
        passages?: unknown;
        paragraphs?: unknown;
        needs_web?: unknown;
        company_specific?: unknown;
      };
      const needsWeb = parsed.needs_web === true;
      const companySpecific = parsed.company_specific === true;
      if (Array.isArray(parsed.passages)) {
        const numbers = parsed.passages
          .map((p) => {
            const pick = (p ?? {}) as { paragraph?: unknown; starts_with?: unknown };
            return resolvePick(Number(pick.paragraph), String(pick.starts_with ?? ""), units, normalized);
          })
          .filter((n): n is number => n !== null);
        return { numbers: unique(numbers), needsWeb, companySpecific, found: true };
      }
      if (Array.isArray(parsed.paragraphs)) {
        return { numbers: unique(parsed.paragraphs.map(Number)), needsWeb, companySpecific, found: true };
      }
    } catch {
      // fall through to plain-text forms
    }
  }
  const bracketed = [...reply.matchAll(/\[(\d{1,5})\]/g)].map((m) => Number(m[1]));
  if (bracketed.length > 0) return { numbers: unique(bracketed), needsWeb: false, companySpecific: false, found: true };
  const listed = /paragraphs?\s*:\s*([\d,\s]*)/i.exec(reply);
  if (listed) {
    return { numbers: unique((listed[1].match(/\d+/g) ?? []).map(Number)), needsWeb: false, companySpecific: false, found: true };
  }
  return { numbers: [], needsWeb: false, companySpecific: false, found: false };
}

/**
 * The picked paragraphs grouped by the document they come from (in document
 * order); consecutive paragraphs, e.g. a question and its answer, are joined.
 */
export function groupParagraphs(
  numbers: number[],
  doc: NumberedDocument,
): { docIndex: number; passages: string[] }[] {
  const groups: { docIndex: number; passages: string[] }[] = [];
  let prev = -2;
  for (const n of numbers) {
    const docIndex = doc.docOf[n - 1];
    const text = doc.units[n - 1].replace(/^(?:[-*•▪◦–]\s*)+/, "");
    let group = groups.find((g) => g.docIndex === docIndex);
    if (!group) {
      group = { docIndex, passages: [] };
      groups.push(group);
    }
    if (n === prev + 1 && group.passages.length > 0 && doc.docOf[prev - 1] === docIndex) {
      group.passages[group.passages.length - 1] += ` ${text}`;
    } else group.passages.push(text);
    prev = n;
  }
  return groups;
}
