import { createServerFn } from "@tanstack/react-start";
import { langFrom, translate, type Lang } from "./i18n/translate";

const SYSTEM_PROMPT = `You are structuring a manager's raw onboarding notes into a fixed format for a new-hire knowledge base. Extract and organize the content into exactly these sections: Role Overview, Learning Plan (Week 1, Week 2, Month 1, Month 2, Month 3), FAQs (question and answer pairs), Tools & How to Use Them, Who to Contact. Do not invent information that isn't in the source text. If a section has no relevant content in the source, mark it as "Not provided — add manually" rather than filling it in. Preserve the granularity of the source: if the notes list several items each with their own detail (for example a table of tools with a purpose and an owner per row), keep one line per item with its own purpose and contact. Never merge distinct items into a single summarized line, and never drop which item maps to which purpose or person. Do not invent information — just avoid over-compressing what is already there.

Return the result as clearly labeled sections.`;

const JSON_INSTRUCTIONS = `Return the result as a json object with exactly these keys, each an array of strings:
{"overview": [], "plan": [], "faq": [], "tools": [], "contacts": []}
- overview: synthesise, don't copy tasks. The first four items must be exactly these labelled lines, each one or two crisp sentences written at the level of the role's purpose, not a to-do:
  1. "Summary: <2-3 sentence plain-language summary of the role>"
  2. "Core function: <what this role fundamentally does for the company — the function, never a single task like 'post once a day'>"
  3. "Your impact: <the difference this role makes for the company, its brand, customers or revenue>"
  4. "What success looks like: <how good performance is recognised or measured>"
  Then add up to 6 short "good to know" lines. Each must be under 15 words, no full paragraphs, no repetition of the labelled lines above.
- plan: one line per learning-plan item, each prefixed with its phase, e.g. "Week 1: ...", "Week 2: ...", "Month 1: ...", "Month 2: ...", "Month 3: ...".
- faq: one line per question/answer pair formatted "Question? — Answer".
- tools: one line per distinct tool. The part before the first "—" must be ONLY the product's own name (e.g. "Asana", "SharePoint", "Canva", "Descript") — never a board, folder or document name, and never the same product twice. If the notes describe several areas of one product, keep one line per product and separate the areas inside the detail with semicolons, prefixing each with its area, e.g. "Asana — Social media: Best-Performing Posts board tracks top posts; Project management: Design Production Timeline tracks asset deadlines | Expert: Name | Link: URL". Include Expert and Link only when the source names them, and include every tool mentioned anywhere in the notes.
- contacts: one line per person. Format: "Name — role (what they handle) | Department: Team or department | Email: address | Phone: number". Keep the role before the parentheses to 6 words or fewer. Include Department, Email and Phone only when the source provides them. Keep every person and every distinct responsibility from the source.
If a section has no relevant content, return exactly ["Not provided — add manually"] for it.
Language: write every item in the same language as the raw notes (German notes give German content). Keep these markers exactly as written here, in English, because the app reads them: the phase prefixes ("Week 1:", "Month 1:"…), the labels "Summary:", "Core function:", "Your impact:", "What success looks like:", the field names "Department:", "Email:", "Phone:", "Expert:", "Link:", and "Not provided — add manually". When writing German, address the reader formally with "Sie".`;


export type StructuredContent = {
  overview: string[];
  plan: string[];
  faq: string[];
  tools: string[];
  contacts: string[];
};

export type StructureResult =
  | { ok: true; sections: StructuredContent }
  | { ok: false; message: string };

const KEYS = ["overview", "plan", "faq", "tools", "contacts"] as const;
const FALLBACK = "Not provided — add manually";
const CHUNK_CHARS = 30_000;

function validate(input: unknown): { role: string; content: string; lang: Lang } {
  const data = input as { role?: unknown; content?: unknown; lang?: unknown };
  if (typeof data?.content !== "string" || data.content.trim().length === 0) {
    throw new Error("content is required");
  }
  return {
    role: typeof data.role === "string" && data.role.trim() ? data.role.trim() : "New hire role",
    content: data.content.slice(0, 300_000),
    lang: langFrom(data.lang),
  };
}

function normalize(raw: unknown): StructuredContent {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const out = {} as StructuredContent;
  for (const key of KEYS) {
    const value = obj[key];
    const items = Array.isArray(value)
      ? value.map((v) => String(v).trim()).filter(Boolean)
      : typeof value === "string" && value.trim()
        ? [value.trim()]
        : [];
    out[key] = items;
  }
  return out;
}

/**
 * Parses the model's JSON, tolerating a response that was cut off mid-array
 * (the previous version threw and reported a generic failure instead).
 */
function parseTolerant(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const body = start === -1 ? text : text.slice(start);
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    // Salvage whatever complete strings each key already produced.
    const salvaged: Record<string, string[]> = {};
    for (const key of KEYS) {
      const section = body.split(`"${key}"`)[1];
      if (!section) continue;
      const arrayText = section.slice(0, section.indexOf("]") === -1 ? undefined : section.indexOf("]"));
      const items = [...arrayText.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
        .map((m) => m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim())
        .filter(Boolean);
      if (items.length > 0) salvaged[key] = items;
    }
    return Object.keys(salvaged).length > 0 ? salvaged : null;
  }
}

/** Splits very long notes on paragraph boundaries so no single request is oversized. */
function chunk(content: string): string[] {
  if (content.length <= CHUNK_CHARS) return [content];
  const parts: string[] = [];
  let current = "";
  for (const paragraph of content.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length > CHUNK_CHARS) {
      parts.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + paragraph;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function mergeSections(all: StructuredContent[]): StructuredContent {
  const out = {} as StructuredContent;
  for (const key of KEYS) {
    const seen = new Set<string>();
    const items: string[] = [];
    for (const part of all) {
      for (const item of part[key]) {
        const fingerprint = item.toLowerCase().replace(/\s+/g, " ").trim();
        if (fingerprint === FALLBACK.toLowerCase() || seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        items.push(item);
      }
    }
    out[key] = items.length > 0 ? items : [FALLBACK];
  }
  return out;
}

export const structureContent = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }): Promise<StructureResult> => {
    const { callChatCompletion, aiFailureMessage, recordAiFailure } = await import(
      "./ai-gateway.server"
    );

    const chunks = chunk(data.content);
    const results: StructuredContent[] = [];

    for (const [index, part] of chunks.entries()) {
      const label =
        chunks.length > 1 ? `\n\n(This is part ${index + 1} of ${chunks.length} of the notes.)` : "";
      const result = await callChatCompletion({
        feature: "structuring",
        contentLength: part.length,
        jsonObject: true,
        maxCompletionTokens: 16_000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: JSON_INSTRUCTIONS },
          {
            role: "user",
            content: `Role: ${data.role}${label}\n\nRaw onboarding notes:\n\n${part}`,
          },
        ],
      });

      if (!result.ok) return { ok: false, message: aiFailureMessage(result.reason, data.lang, result.hint) };

      const parsed = parseTolerant(result.text);
      if (!parsed) {
        await recordAiFailure({
          feature: "structuring",
          reason: "unknown",
          detail: `unparseable model output: ${result.text.slice(0, 400)}`,
          contentLength: part.length,
        });
        return { ok: false, message: translate(data.lang, "ai.badFormat") };
      }
      results.push(normalize(parsed));
    }

    return { ok: true, sections: mergeSections(results) };
  });
