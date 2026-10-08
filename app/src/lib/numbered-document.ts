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
  const blocks: string[] = [];
  for (const doc of docs) {
    if (!doc.text.trim()) continue;
    const lines: string[] = [];
    for (const raw of doc.text.split("\n")) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;
      for (const unit of line.length > MAX_UNIT_CHARS ? sentences(line) : [line]) {
        units.push(unit);
        lines.push(`[${units.length}] ${unit}`);
      }
    }
    blocks.push(`=== ${doc.title} ===\n${lines.join("\n")}`);
  }
  return { units, text: blocks.join("\n\n") };
}

/**
 * Reads the paragraph numbers from the model's reply: {"paragraphs": [..]} json,
 * or "[12]" / "PARAGRAPHS: 12, 13" in plain text. `found` is false when the reply
 * contained no usable numbers at all (an explicit empty list counts as found).
 */
export function readParagraphNumbers(
  reply: string,
  unitCount: number,
): { numbers: number[]; found: boolean } {
  const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= unitCount;
  const unique = (ns: number[]) => [...new Set(ns.filter(inRange))].sort((a, b) => a - b).slice(0, 8);

  const json = /\{[\s\S]*\}/.exec(reply)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { paragraphs?: unknown };
      if (Array.isArray(parsed.paragraphs)) {
        return { numbers: unique(parsed.paragraphs.map(Number)), found: true };
      }
    } catch {
      // fall through to plain-text forms
    }
  }
  const bracketed = [...reply.matchAll(/\[(\d{1,5})\]/g)].map((m) => Number(m[1]));
  if (bracketed.length > 0) return { numbers: unique(bracketed), found: true };
  const listed = /paragraphs?\s*:\s*([\d,\s]*)/i.exec(reply);
  if (listed) {
    return { numbers: unique((listed[1].match(/\d+/g) ?? []).map(Number)), found: true };
  }
  return { numbers: [], found: false };
}

/** Consecutive picked paragraphs (e.g. a question and its answer) are shown together. */
export function groupParagraphs(numbers: number[], units: string[]): string[] {
  const groups: string[] = [];
  let prev = -2;
  for (const n of numbers) {
    const text = units[n - 1].replace(/^(?:[-*•▪◦–]\s*)+/, "");
    if (n === prev + 1 && groups.length > 0) groups[groups.length - 1] += ` ${text}`;
    else groups.push(text);
    prev = n;
  }
  return groups;
}
