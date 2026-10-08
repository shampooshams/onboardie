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
    for (const raw of doc.text.split("\n")) {
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
  /** The model's own general advice, shown labelled as not from the documents. */
  general: string;
  /** False when the reply contained nothing usable (an explicit empty list counts as usable). */
  found: boolean;
};

/**
 * Reads the model's reply: {"paragraphs": [..], "general": "…"} json, or, from a
 * provider without structured output, "[12]" / "PARAGRAPHS: 12, 13" in plain text
 * (general advice is only taken from json, where it is clearly separated).
 */
export function readCoachPick(reply: string, unitCount: number): CoachPick {
  const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= unitCount;
  const unique = (ns: number[]) => [...new Set(ns.filter(inRange))].sort((a, b) => a - b).slice(0, 8);

  const json = /\{[\s\S]*\}/.exec(reply)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { paragraphs?: unknown; general?: unknown };
      if (Array.isArray(parsed.paragraphs)) {
        const general = typeof parsed.general === "string" ? parsed.general.trim().slice(0, 2000) : "";
        return { numbers: unique(parsed.paragraphs.map(Number)), general, found: true };
      }
    } catch {
      // fall through to plain-text forms
    }
  }
  const bracketed = [...reply.matchAll(/\[(\d{1,5})\]/g)].map((m) => Number(m[1]));
  if (bracketed.length > 0) return { numbers: unique(bracketed), general: "", found: true };
  const listed = /paragraphs?\s*:\s*([\d,\s]*)/i.exec(reply);
  if (listed) {
    return { numbers: unique((listed[1].match(/\d+/g) ?? []).map(Number)), general: "", found: true };
  }
  return { numbers: [], general: "", found: false };
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
