/**
 * Finds where a passage the model quoted sits in the original document, so the
 * new hire is shown the document's own text. Matching ignores case, spacing and
 * punctuation, and tolerates small slips (a list number the model added, a
 * word joined differently by the PDF reader), but most of the quote must appear
 * in order in the document — a passage that isn't there is never matched.
 */

type Normalized = { norm: string; map: number[] };

/** Letters and digits only, lowercased, single spaces; `map` points back to the original index. */
function normalizeWithMap(text: string): Normalized {
  let norm = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const chars = text[i].normalize("NFKC").toLowerCase();
    for (const c of chars) {
      if (/[\p{L}\p{N}]/u.test(c)) {
        norm += c;
        map.push(i);
      } else if (norm.length > 0 && norm[norm.length - 1] !== " ") {
        norm += " ";
        map.push(i);
      }
    }
  }
  return { norm, map };
}

const CHUNK_WORDS = 4;
/** Share of the quote's word chunks that must be found, in order, in the document. */
const MIN_MATCHED = 0.75;

export type Passage = { start: number; end: number; text: string };

export function createPassageFinder(document: string) {
  const source = normalizeWithMap(document);

  function find(quote: string): Passage | null {
    const q = normalizeWithMap(quote).norm.trim();
    if (q.length < 8) return null;

    let range: [number, number] | null = null;
    const exact = source.norm.indexOf(q);
    if (exact !== -1) range = [exact, exact + q.length];
    else {
      const words = q.split(" ");
      if (words.length < CHUNK_WORDS * 2) return null;
      const chunks: string[] = [];
      for (let i = 0; i < words.length; i += CHUNK_WORDS) {
        chunks.push(words.slice(i, i + CHUNK_WORDS).join(" "));
      }
      // Chunks must appear in order and close together, as one passage.
      let first = -1;
      let last = -1;
      let cursor = 0;
      let matched = 0;
      for (const chunk of chunks) {
        const window = first === -1 ? source.norm : source.norm.slice(cursor, cursor + q.length * 2);
        const at = window.indexOf(chunk);
        if (at === -1) continue;
        const pos = first === -1 ? at : cursor + at;
        if (first === -1) first = pos;
        last = pos + chunk.length;
        cursor = last;
        matched++;
      }
      if (first === -1 || matched / chunks.length < MIN_MATCHED) return null;
      if (last - first > q.length * 1.5) return null;
      range = [first, last];
    }

    let start = source.map[range[0]];
    let end = source.map[range[1] - 1] + 1;
    // Start at the beginning of the sentence if the passage starts mid-sentence
    // (e.g. the model dropped or added the first words), keeping opening brackets.
    const before = document.slice(Math.max(0, start - 120), start);
    const sentenceStart = Math.max(
      before.lastIndexOf(". "),
      before.lastIndexOf("? "),
      before.lastIndexOf("! "),
      before.lastIndexOf("\n"),
    );
    if (sentenceStart !== -1 && !/[.!?]\s*$|^\s*$/.test(before)) {
      start = start - before.length + sentenceStart + 1;
    }
    while (start > 0 && /[[(„"'«]/.test(document[start - 1])) start--;
    // Finish the sentence the passage ends in, if it ends mid-sentence.
    const rest = document.slice(end, end + 160);
    const stop = /^[^.!?\n]*[.!?]/.exec(rest);
    if (stop && !/[.!?]\s*$/.test(document.slice(start, end))) end += stop[0].length;
    const text = document.slice(start, end).replace(/\s+/g, " ").trim();
    return text ? { start, end, text } : null;
  }

  return { find };
}

/** The passages found for these quotes, in document order, overlapping ones merged. */
export function passagesFor(quotes: string[], document: string): string[] {
  const finder = createPassageFinder(document);
  const found = quotes
    .map((q) => finder.find(q))
    .filter((p): p is Passage => p !== null)
    .sort((a, b) => a.start - b.start);
  const merged: Passage[] = [];
  for (const p of found) {
    const prev = merged[merged.length - 1];
    if (prev && p.start <= prev.end) {
      if (p.end > prev.end) {
        prev.end = p.end;
        prev.text = document.slice(prev.start, prev.end).replace(/\s+/g, " ").trim();
      }
    } else merged.push({ ...p });
  }
  return merged.map((p) => p.text);
}
