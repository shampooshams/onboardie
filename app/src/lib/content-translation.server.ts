import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "./i18n/translate";

/**
 * Translates a role's published content into the reader's language, keeping
 * its structure: the same items in the same order, with the English markers
 * the pages parse ("Week 1:", "Summary:", "| Email:" …) untouched. Any item
 * whose markers, numbers, emails or links don't survive keeps its original
 * wording. Results are saved per role and language and reused until the role
 * changes; without the translations table the content is simply translated
 * again on each load.
 */

const KEYS = ["overview", "plan", "faq", "tools", "contacts", "facts"] as const;
type Key = (typeof KEYS)[number];
export type ContentSections = Record<Key, string[]>;

const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", de: "German" };

/** Markers the pages read to structure the content; they must stay exactly as written. */
const MARKERS = [
  /^(?:Week|Month|Day)\s*\d+[^:]*:/i,
  /^(?:Summary|Core function|Your impact|What success looks like):/,
  /\| (?:Department|Team|Email|Phone|Expert|Link):/g,
  /Not provided — add manually/,
];

const PROMPT = (lang: Lang) => `Translate a new hire's onboarding content into ${LANGUAGE_NAMES[lang]}. The content is a json object of lists; return the same keys with the same number of items in the same order, each item translated. Also return "source_language": the language most of the content is written in, as "en", "de" or "other".
- Translate naturally, as a native speaker would write it for a new colleague${lang === "de" ? ', addressing the reader formally with "Sie"' : ""}. If an item is already in ${LANGUAGE_NAMES[lang]}, return it unchanged.
- Keep these exactly as written, in English: phase prefixes ("Week 1:", "Month 2:" …), the labels "Summary:", "Core function:", "Your impact:", "What success looks like:", the field names "| Department:", "| Email:", "| Phone:", "| Expert:", "| Link:", and "Not provided — add manually". Translate the text after them.
- Never change names of people, companies, products or tools, email addresses, phone numbers, links, numbers, amounts, dates or placeholders in [brackets] (you may translate words inside a [Topic] tag at the start of an FAQ item).
- Keep the separators " — " and " | " where they are.
Reply with only the json object.`;

const SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "translated_content",
    strict: true,
    schema: {
      type: "object",
      properties: {
        ...Object.fromEntries(KEYS.map((k) => [k, { type: "array", items: { type: "string" } }])),
        source_language: { type: "string", enum: ["en", "de", "other"] },
      },
      required: [...KEYS, "source_language"],
      additionalProperties: false,
    },
  },
};

/** Short, stable fingerprint of the source content, to notice when a role was changed. */
export function contentHash(sections: ContentSections): string {
  const text = JSON.stringify(KEYS.map((k) => sections[k]));
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
    h2 = (Math.imul(h2, 31) + text.charCodeAt(i)) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}-${text.length}`;
}

/** True when the translated item kept every marker, number, email and link of the original. */
function keepsStructure(original: string, translated: string): boolean {
  for (const marker of MARKERS) {
    const found = original.match(marker) ?? [];
    for (const m of found) if (!translated.includes(m)) return false;
  }
  const digits = (s: string) => (s.match(/\d+/g) ?? []).sort().join(" ");
  if (digits(original) !== digits(translated)) return false;
  const exact = [
    ...(original.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []),
    ...(original.match(/https?:\/\/\S+|www\.\S+/g) ?? []),
  ];
  return exact.every((t) => translated.includes(t));
}

async function translateWithAi(sections: ContentSections, lang: Lang): Promise<ContentSections | null> {
  const { callChatCompletion } = await import("./ai-gateway.server");
  const request = {
    feature: "content_translation",
    contentLength: JSON.stringify(sections).length,
    maxCompletionTokens: 16_000,
    messages: [
      { role: "system" as const, content: PROMPT(lang) },
      { role: "user" as const, content: JSON.stringify(sections) },
    ],
  };
  let result = await callChatCompletion({ ...request, responseFormat: SCHEMA });
  if (!result.ok && result.reason !== "busy" && result.reason !== "auth") {
    result = await callChatCompletion({ ...request, jsonObject: true });
  }
  if (!result.ok) return null;
  try {
    const raw = /\{[\s\S]*\}/.exec(result.text)?.[0] ?? "";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Content already written in the reader's language is shown exactly as written.
    if (parsed.source_language === lang) return sections;
    const out = {} as ContentSections;
    for (const key of KEYS) {
      const original = sections[key];
      const items = Array.isArray(parsed[key]) ? (parsed[key] as unknown[]).map(String) : [];
      // A list that lost or gained items can't be matched up; keep it as it was.
      out[key] =
        items.length === original.length
          ? original.map((line, i) => (keepsStructure(line, items[i]) ? items[i].trim() : line))
          : original;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * The content in `lang`, from the saved translation when it matches the current
 * content, otherwise translated now (and saved). Falls back to the original
 * content if translation isn't possible.
 */
export async function translatedSections(
  supabase: SupabaseClient,
  roleContentId: string,
  sections: ContentSections,
  lang: Lang,
): Promise<{ sections: ContentSections; translated: boolean }> {
  const hasContent = KEYS.some((k) => sections[k].length > 0);
  if (!hasContent) return { sections, translated: false };
  const hash = contentHash(sections);

  const { data: saved } = await supabase
    .from("role_content_translations" as never)
    .select("source_hash, sections")
    .eq("role_content_id", roleContentId)
    .eq("lang", lang)
    .maybeSingle();
  const row = saved as { source_hash?: string; sections?: ContentSections } | null;
  if (row?.source_hash === hash && row.sections) return { sections: row.sections, translated: true };

  const translated = await translateWithAi(sections, lang);
  if (!translated) return { sections, translated: false };

  const { error } = await supabase.from("role_content_translations" as never).upsert(
    { role_content_id: roleContentId, lang, source_hash: hash, sections: translated } as never,
    { onConflict: "role_content_id,lang" },
  );
  if (error) console.error("Saving the content translation failed", error);
  return { sections: translated, translated: true };
}
