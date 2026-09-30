/**
 * Cheap keyword retrieval over content we already have.
 *
 * No embeddings, no vector store: the question is reduced to keywords and
 * scored against chunks of the content already published for this company (and
 * the shared Notion content the MCP tool exposes). Only the best few chunks are
 * attached to the model call as optional extra context.
 */

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "do", "does", "did", "doing", "have", "has",
  "had", "of", "in", "on", "at", "to", "for", "with", "about", "from", "by", "as", "it", "its",
  "i", "me", "my", "we", "our", "you", "your", "they", "them", "their", "he", "she", "his", "her",
  "what", "when", "where", "who", "whom", "which", "how", "why", "can", "could", "should", "would",
  "will", "shall", "may", "might", "must", "not", "no", "yes", "there", "here", "any", "some",
  "get", "got", "need", "want", "know", "please", "help", "into", "out", "up", "down", "am", "im",
]);

function keywords(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

export type Chunk = { source: string; text: string };

/** Splits a document into paragraph-sized chunks that keep their heading. */
export function chunkDocument(source: string, body: string, maxChars = 900): Chunk[] {
  const chunks: Chunk[] = [];
  let heading = "";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) chunks.push({ source, text: heading ? `${heading}\n${text}` : text });
    buffer = [];
  };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const isHeading = /^#{1,6}\s+/.test(line) || /^##\s*/.test(line);
    if (isHeading) {
      flush();
      heading = line.replace(/^#{1,6}\s*/, "").trim();
      continue;
    }
    buffer.push(line);
    if (buffer.join("\n").length >= maxChars) flush();
  }
  flush();
  return chunks;
}

/** Returns the chunks most likely to answer the question, best first. */
export function findRelevantChunks(question: string, chunks: Chunk[], limit = 6): Chunk[] {
  const terms = keywords(question);
  if (terms.length === 0) return [];

  const scored = chunks.map((chunk) => {
    const haystack = chunk.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(term)) score += term.length >= 6 ? 2 : 1;
      else if (term.length > 5 && haystack.includes(term.slice(0, Math.ceil(term.length * 0.7))))
        score += 1;
    }
    // Slight preference for shorter, denser chunks.
    return { chunk, score: score - Math.min(chunk.text.length / 4000, 0.5) };
  });

  return scored
    .filter((s) => s.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.chunk);
}

/** Turns published role sections into a searchable markdown document. */
export function sectionsToMarkdown(role: string, sections: unknown): string {
  const map = (sections ?? {}) as Record<string, unknown>;
  const body = Object.entries(map)
    .map(([key, value]) =>
      Array.isArray(value) && value.length
        ? `## ${key}\n${value.map((v) => `- ${String(v)}`).join("\n")}`
        : "",
    )
    .filter(Boolean)
    .join("\n\n");
  return body ? `# ${role}\n${body}` : "";
}
