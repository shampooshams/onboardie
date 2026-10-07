import { createServerFn } from "@tanstack/react-start";
import { langFrom, translate, type Lang } from "./i18n/translate";

const SYSTEM_PROMPT = `You are structuring a manager's raw onboarding notes into a fixed format for a new-hire knowledge base. Extract and organize the content into exactly these sections: Role Overview, Learning Plan (Week 1, Week 2, Month 1, Month 2, Month 3), FAQs (question and answer pairs), Tools & How to Use Them, Who to Contact, Key Facts. Do not invent information that isn't in the source text. Accuracy matters more than completeness: every item must be directly supported by the notes. Copy numbers, amounts, dates, names, emails and links exactly as written, with their conditions (e.g. "in the first year"). Never add tools, people, goals, deadlines or figures the notes don't mention, and never fill a gap with what is typical for this kind of role. Keep bracketed placeholders exactly as written (e.g. "[Payroll Contact] — Payroll (salary, tax and payslip questions)"); never replace them with a name. If a section has no relevant content in the source, mark it as "Not provided — add manually" rather than filling it in. Preserve the granularity of the source: if the notes list several items each with their own detail (for example a table of tools with a purpose and an owner per row), keep one line per item with its own purpose and contact. Never merge distinct items into a single summarized line, and never drop which item maps to which purpose or person. Do not invent information — just avoid over-compressing what is already there.

Return the result as clearly labeled sections.`;

const JSON_INSTRUCTIONS = `Return the result as a json object with exactly these keys, each an array of strings:
{"overview": [], "plan": [], "faq": [], "tools": [], "contacts": [], "facts": []}
- overview: synthesise, don't copy tasks. The first four items must be exactly these labelled lines, each one or two crisp sentences written at the level of the role's purpose, not a to-do:
  1. "Summary: <2-3 sentence plain-language summary of the role>"
  2. "Core function: <what this role fundamentally does for the company — the function, never a single task like 'post once a day'>"
  3. "Your impact: <the difference this role makes for the company, its brand, customers or revenue>"
  4. "What success looks like: <how good performance is recognised or measured>"
  Write these four only from what the notes say or clearly imply; if the notes give no basis for one, leave that line out rather than guessing.
  Then add up to 6 short "good to know" lines. Each must be under 15 words, no full paragraphs, no repetition of the labelled lines above.
- plan: one line per learning-plan item, each prefixed with its phase, e.g. "Week 1: ...", "Week 2: ...", "Month 1: ...", "Month 2: ...", "Month 3: ...". Only put a goal in a phase the notes actually give it ("in der ersten Woche" → Week 1, "nach einem Monat" → Month 1, "bis Ende der Probezeit" is not a phase). When the notes give no timing, order the goals as the notes do and spread them across Week 1 → Month 3 by how basic they are (access, introductions and reading first; independent work and targets later); never invent goals, deadlines or numbers. The plan covers the first 90 days only: leave out every goal the notes place after day 90 (for example "Month 4", "Month 6", "after probation", "by the end of the year", "Q3").
- faq: one line per question/answer pair formatted "[Topic] Question? — Answer". Topic is the heading or category the notes file that question under (e.g. "[Brand and tone] ..."), copied as written; keep questions in the source order and never move a question to a different topic. Only when the notes give the questions no headings at all, leave out the [Topic] part.
- tools: one line per distinct tool. The part before the first "—" must be ONLY the product's own name (e.g. "Asana", "SharePoint", "Canva", "Descript") — never a board, folder or document name, and never the same product twice. If the notes describe several areas of one product, keep one line per product and separate the areas inside the detail with semicolons, prefixing each with its area, e.g. "Asana — Social media: Best-Performing Posts board tracks top posts; Project management: Design Production Timeline tracks asset deadlines | Expert: Name | Link: URL". Include Expert and Link only when the source names them, and include every tool mentioned anywhere in the notes.
- contacts: one line per person. Format: "Name — role (what they handle) | Department: Team or department | Email: address | Phone: number". Keep the role before the parentheses to 6 words or fewer. Always include Department: use the team or department the notes list the person under (a heading, table column or "Team:" field); if none is given, take it from their job title (e.g. "Head of Marketing" → Marketing, "HR Business Partner" → HR); use "General" only when neither says anything. Spell each department the same way for everyone in it. Include Email and Phone only when the source provides them. Keep every person and every distinct responsibility from the source.
- facts: one line per concrete fact a new hire may ask about, formatted "Topic: fact", e.g. "Vacation: 28 days in the first year", "Training budget: 1,000 EUR per year", "Working hours: flexible, core time 10–15", "Probation: 6 months". Cover every entitlement, benefit, budget, allowance, policy, working time, location or remote rule, pay or expense rule, equipment and deadline the notes mention, with the exact numbers, amounts and conditions as written. Notes are often informal: pick facts out of running text and side remarks too.
Nothing concrete may be lost: every number, amount, date, entitlement and rule in the notes must appear in at least one section.
If a section has no relevant content, return exactly ["Not provided — add manually"] for it.
Language: write every item in the same language as the raw notes (German notes give German content). Keep these markers exactly as written here, in English, because the app reads them: the phase prefixes ("Week 1:", "Month 1:"…), the labels "Summary:", "Core function:", "Your impact:", "What success looks like:", the [Topic] tags in faq and the "Topic:" labels in facts are written in the notes' language; the field names "Department:", "Email:", "Phone:", "Expert:", "Link:", and "Not provided — add manually". When writing German, address the reader formally with "Sie".`;


export type StructuredContent = {
  overview: string[];
  plan: string[];
  faq: string[];
  tools: string[];
  contacts: string[];
  facts: string[];
};

export type StructureResult =
  | { ok: true; sections: StructuredContent }
  | { ok: false; message: string };

const KEYS = ["overview", "plan", "faq", "tools", "contacts", "facts"] as const;
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
