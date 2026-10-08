import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { langFrom, translate, type Lang } from "./i18n/translate";
import { findRoleFor } from "./role-match";
import { groupParagraphs, numberDocuments, readCoachPick } from "./numbered-document";
import type { WebSource } from "./ai-gateway.server";

/**
 * Answers come from two clearly labelled places, in this order. First the
 * company's documents, shown word for word: they are sent as numbered
 * paragraphs and the model only returns paragraph numbers. Then, only for
 * general questions the documents don't fully answer, a conversational answer
 * from a Google Search, listed with the web pages it used.
 */
const SYSTEM_PROMPT = `You help a new hire with questions during onboarding. The company's onboarding documents are below, split into numbered paragraphs like "[12] …".

1. "passages": the paragraphs that answer the question, each given by its number and its first 5–8 words copied exactly ("starts_with"), so the app can check you picked the right one. The app shows the new hire those paragraphs word for word, labelled as coming from the company's documents.
- Read all of the documents, including informal notes, abbreviations ("Std" = hours, "MA" = employee) and side remarks, in any language (e.g. "Urlaub" = vacation, "Probezeit" = probation, "Arbeitszeit" = working hours). The question may be in another language than the documents.
- Choose a paragraph only if it directly answers the question: a new hire reading just that paragraph learns something they asked for. Choose all of them: every step of a procedure, every condition and exception, and who to inform or contact. When a question and its answer, or a sentence that continues, are in separate paragraphs, choose both.
- If the documents don't answer a company-specific question, choose the paragraphs that say who is responsible for that topic, if there are any.
- Never choose paragraphs that only touch the topic (e.g. a skill list or a tool description for a question on how to write an email). Up to 8 paragraphs.

2. "needs_web": whether the app should also look the question up on the internet.
- true when the documents don't fully answer the question and it can be answered with general, public information: e.g. how to write a good email, prepare for a 1:1 or give feedback, what a common term, law or tool means in general.
- false when the documents fully answer it, or when it is about this company specifically — its policies, entitlements, numbers, budgets, deadlines, people, internal tools or processes. Those can only come from the documents, never from the internet.

Use the conversation to understand follow-up questions (e.g. "and after that?").

Reply with only this json: {"passages": [{"paragraph": 12, "starts_with": "first words of paragraph 12"}], "needs_web": false}`;

/** For the web step: a natural, conversational answer grounded in a Google Search. */
const WEB_PROMPT = `You are a friendly, knowledgeable colleague helping a new hire during their onboarding, chatting with them like a helpful AI assistant would. Answer their latest question naturally and conversationally, using what you find on the web.
- Speak directly to them ("you"), warm and practical, like a person in a chat — no formal headings like "General guidance".
- Keep it short and easy to scan: a sentence or two, then a few bullet points or steps if useful. Under about 150 words.
- Never state anything about their company — its policies, entitlements, numbers, people, internal tools or processes. If the question touches those, say they should check with their manager or the person responsible.
- Don't mention "documents", "the guide" or "the onboarding material", and don't repeat or contradict what they were already shown from their company's documents (given below, if any).
- Don't put links or a source list in your text; the app lists the web pages you used below your answer.
- Reply in the language of their latest message. In German, address them formally with "Sie".`;

/** Makes the provider return exactly {"passages": [{paragraph, starts_with}], "needs_web": boolean}. */
const PARAGRAPHS_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "coach_reply",
    strict: true,
    schema: {
      type: "object",
      properties: {
        passages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              paragraph: { type: "integer" },
              starts_with: { type: "string" },
            },
            required: ["paragraph", "starts_with"],
            additionalProperties: false,
          },
        },
        needs_web: { type: "boolean" },
      },
      required: ["passages", "needs_web"],
      additionalProperties: false,
    },
  },
};

/** Up to this size (roughly 100 pages) company-wide documents are sent in full instead of searched. */
const FULL_COMPANY_DOCS_CHARS = 250_000;

type CoachMessage = { role: "user" | "assistant"; content: string };

/** `sources` are verified, word-for-word passages from the content the answer is based on. */
/** Shown to managers only, under each coach reply, to see why it answered as it did. */
export type CoachDiagnostics = {
  role: string | null;
  jobTitle: string;
  preview: boolean;
  usesOriginalDocument: boolean;
  documentChars: number;
  companyDocsChars: number;
  attempts: { reply: string; quotes: { text: string; found: boolean }[] }[];
  web?: { searched: boolean; queries: string[]; sources: number; error?: string };
};

/** The web part of an answer: the pages it used, and Google's required Search Suggestions. */
export type CoachWeb = {
  sources: WebSource[];
  /** Google Search Suggestions html, shown unmodified as Google requires. */
  suggestionsHtml: string;
  /** False when no web search was possible and the answer is general knowledge. */
  searched: boolean;
};

export type CoachResult =
  | { ok: true; text: string; sources: string[]; web?: CoachWeb; diagnostics?: CoachDiagnostics }
  | { ok: false; message: string };

function validate(input: unknown): {
  messages: CoachMessage[];
  previewRoleId: string | null;
  lang: Lang;
} {
  const data = input as { messages?: unknown; previewRoleId?: unknown; lang?: unknown };
  if (!Array.isArray(data?.messages)) throw new Error("messages are required");
  const messages = data.messages
    .filter(
      (m): m is CoachMessage =>
        !!m &&
        typeof (m as CoachMessage).content === "string" &&
        ((m as CoachMessage).role === "user" || (m as CoachMessage).role === "assistant"),
    )
    .slice(-12);
  if (messages.length === 0) throw new Error("messages are required");
  const previewRoleId =
    typeof data.previewRoleId === "string" && data.previewRoleId.trim()
      ? data.previewRoleId.trim()
      : null;
  return { messages, previewRoleId, lang: langFrom(data.lang) };
}

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<CoachResult> => {
    const { callChatCompletion, callGroundedSearch, aiFailureMessage, recordAiFailure } = await import(
      "./ai-gateway.server"
    );
    const { chunkDocument, findRelevantChunks, sectionsToMarkdown } = await import(
      "./retrieval.server"
    );

    const { companyIdFor } = await import("./company.server");
    let companyId: string | null = null;
    try {
      companyId = await companyIdFor(context.supabase, context.userId);
    } catch (error) {
      console.error("Company lookup failed", error);
    }

    type Row = { id: string; role: string; sections: unknown };
    let roleContent: string;
    let companyRows: Row[] = [];
    let primaryRole: string | null = null;
    let lookedUpTitle = "";
    let originalNotes = "";
    const rawOf = (sections: unknown) => {
      const value = (sections as { raw?: unknown } | null)?.raw;
      return typeof value === "string" ? value : "";
    };

    try {
      let companyContent = "";
      if (companyId) {
        const { data: allRows } = await context.supabase
          .from("role_content")
          .select("id, role, sections")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false });
        companyRows = (allRows ?? []) as Row[];

        if (data.previewRoleId) {
          // Manager preview: answer strictly as the previewed role would be answered.
          const row = companyRows.find((r) => r.id === data.previewRoleId);
          if (row) {
            primaryRole = row.role;
            originalNotes = rawOf(row.sections);
            companyContent = sectionsToMarkdown(row.role, row.sections);
          }
        } else {
          // Answer from the hire's own role content, so a role change in Settings
          // immediately changes what the coach knows about.
          const { data: profileRow } = await context.supabase
            .from("profiles")
            .select("role_title")
            .eq("id", context.userId)
            .maybeSingle();
          const roleTitle = (profileRow?.role_title ?? "").trim();
          lookedUpTitle = roleTitle;
          const match = roleTitle
            ? findRoleFor(companyRows, roleTitle, (r) => r.role)
            : companyRows[0];
          if (match) {
            primaryRole = match.role;
            originalNotes = rawOf(match.sections);
            companyContent = sectionsToMarkdown(match.role, match.sections);
          }
        }
      }

      if (companyContent.trim()) {
        roleContent = companyContent.slice(0, 60_000);
      } else if (companyRows.length > 0) {
        // The company has its own content, just none for this role: never borrow
        // the shared demo roles, whose people and details aren't this company's.
        roleContent = "";
      } else {
        const { getRoleContent, isNotionConfigured } = await import("./notion.server");
        roleContent = isNotionConfigured() ? await getRoleContent() : "";
      }
    } catch (error) {
      await recordAiFailure({
        feature: "coach",
        reason: "unknown",
        detail: `role content unavailable: ${error instanceof Error ? error.message : String(error)}`,
      });
      return {
        ok: false,
        message: translate(data.lang, "ai.roleContentUnavailable"),
      };
    }

    const lastQuestion = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Lean retrieval: besides the hire's own role, only documents the manager
    // marked as company-wide are searched. Other roles' content and the shared
    // demo roles are left out, so answers never name people or details from a
    // document that wasn't written for this hire.

    let extraContext = "";
    if (lastQuestion) {
      try {
        const chunks: ReturnType<typeof chunkDocument> = [];

        // Company-wide documents the manager marked as applying to everyone.
        // While they're small enough, the coach reads them in full: a keyword
        // search can miss the right passage (e.g. an English question against
        // German notes), which made answers less accurate.
        if (companyId) {
          const { data: docs } = await context.supabase
            .from("company_docs")
            .select("title, content")
            .eq("company_id", companyId);
          const full = (docs ?? [])
            .filter((doc) => doc.content?.trim())
            .map((doc) => `Source: ${doc.title}\n${doc.content}`)
            .join("\n\n---\n\n");
          if (full.length <= FULL_COMPANY_DOCS_CHARS) {
            extraContext = full;
          } else {
            for (const doc of docs ?? []) {
              chunks.push(...chunkDocument(doc.title, doc.content));
            }
          }
        }

        // Demo content only for a company that hasn't uploaded anything yet.
        const { getRoleContent, isNotionConfigured } = await import("./notion.server");
        if (isNotionConfigured() && companyRows.length === 0) {
          try {
            const shared = await getRoleContent();
            for (const doc of shared.split("\n---\n")) {
              const title = /^#\s*(.+)$/m.exec(doc)?.[1]?.trim() || "Company content";
              chunks.push(...chunkDocument(title, doc));
            }
          } catch (error) {
            console.error("Shared company content unavailable for retrieval", error);
          }
        }

        const relevant = findRelevantChunks(lastQuestion, chunks, 6);
        if (!extraContext && relevant.length > 0) {
          extraContext = relevant
            .map((c) => `Source: ${c.source}\n${c.text}`)
            .join("\n\n---\n\n")
            .slice(0, 20_000);
        }
      } catch (error) {
        console.error("Wider content search failed", error);
      }
    }

    const notes = originalNotes.slice(0, 200_000);
    // Answers come from the uploaded document itself. The approved summary is
    // AI-written, so it's only used for roles uploaded before the original
    // document was kept.
    const documentText = notes.trim() ? notes : roleContent;
    // Company-wide documents arrive either in full or as "Source: title\n…" extracts.
    const companyDocs = extraContext
      .split("\n\n---\n\n")
      .filter((part) => part.trim())
      .map((part) => {
        const name = /^Source: (.+)$/m.exec(part)?.[1]?.trim() ?? "Company-wide document";
        return { name, title: `Company-wide document: ${name}`, text: part.replace(/^Source: .+\n?/, "") };
      });
    const sourceDocs = [
      { name: primaryRole ?? "", title: `Role document: ${primaryRole ?? "this role"}`, text: documentText, companyWide: false },
      ...companyDocs.map((d) => ({ ...d, companyWide: true })),
    ];
    const numbered = numberDocuments(sourceDocs);

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "system" as const, content: `Documents:\n\n${numbered.text}` },
      ...data.messages,
    ];
    const ask = async (extra: typeof messages = []) => {
      const request = {
        feature: "coach",
        contentLength: numbered.text.length,
        messages: [...messages, ...extra],
      };
      const strict = await callChatCompletion({ ...request, responseFormat: PARAGRAPHS_SCHEMA });
      // A provider that doesn't support json_schema gets the plain request instead.
      if (strict.ok || strict.reason === "busy" || strict.reason === "auth") return strict;
      return callChatCompletion(request);
    };

    const { isManager } = await import("./company.server");
    const showDiagnostics = await isManager(context.supabase, context.userId).catch(() => false);
    const diagnostics: CoachDiagnostics = {
      role: primaryRole,
      jobTitle: lookedUpTitle,
      preview: !!data.previewRoleId,
      usesOriginalDocument: notes.trim().length > 0,
      documentChars: documentText.length,
      companyDocsChars: extraContext.length,
      attempts: [],
    };
    const record = (text: string, numbers: number[]) =>
      diagnostics.attempts.push({
        reply: text.slice(0, 1500),
        quotes: numbers.map((n) => ({ text: `[${n}] ${numbered.units[n - 1]}`, found: true })),
      });

    // Without any document for this role there is nothing to answer from; say so
    // plainly (naming the job title looked up) instead of "not covered".
    if (numbered.units.length === 0) {
      return {
        ok: true,
        text: translate(data.lang, "coach.noDocument", { role: lookedUpTitle || "—" }),
        sources: [],
        ...(showDiagnostics ? { diagnostics } : {}),
      };
    }

    const result = await ask();
    if (!result.ok) return { ok: false, message: aiFailureMessage(result.reason, data.lang, result.hint) };
    let picked = readCoachPick(result.text, numbered.units);
    record(result.text, picked.numbers);
    if (!picked.found) {
      // The model wrote text instead of numbers; ask once more.
      const retry = await ask([
        { role: "assistant", content: result.text },
        {
          role: "system",
          content:
            'Reply with only the json {"passages": [{"paragraph": 12, "starts_with": "first words"}], "needs_web": false}: the paragraphs that answer the question, and whether to also look it up on the internet.',
        },
      ]);
      if (retry.ok) {
        picked = readCoachPick(retry.text, numbered.units);
        record(retry.text, picked.numbers);
      }
    }

    // 1. Document paragraphs exactly as written, labelled with the document they come from.
    const blocks: string[] = [];
    const shownPassages: string[] = [];
    for (const group of groupParagraphs(picked.numbers, numbered)) {
      const doc = sourceDocs[group.docIndex];
      const heading = doc.companyWide
        ? translate(data.lang, "coach.fromCompanyDoc", { doc: doc.name })
        : doc.name
          ? translate(data.lang, "coach.fromRoleDoc", { role: doc.name })
          : translate(data.lang, "coach.fromDocument");
      blocks.push(`**📄 ${heading}**\n${group.passages.map((p) => `- ${p}`).join("\n")}`);
      shownPassages.push(...group.passages);
    }

    // 2. Only for general questions the documents don't fully answer: a natural
    // answer from a Google Search, with the web pages it used. Without web search
    // (another AI provider, or the search failing) it's answered from general
    // knowledge and marked as such.
    let web: CoachWeb | undefined;
    if (picked.needsWeb) {
      const already = shownPassages.length
        ? `\n\nAlready shown to them from their company's documents:\n${shownPassages.map((p) => `- ${p}`).join("\n")}`
        : "";
      const grounded = await callGroundedSearch({
        feature: "coach_web",
        system: WEB_PROMPT + already,
        messages: data.messages,
      });
      if (grounded.ok) {
        blocks.push(grounded.text);
        web = { sources: grounded.sources, suggestionsHtml: grounded.suggestionsHtml, searched: true };
        diagnostics.web = { searched: true, queries: grounded.queries, sources: grounded.sources.length };
      } else {
        const plain = await callChatCompletion({
          feature: "coach_web",
          messages: [{ role: "system", content: WEB_PROMPT + already }, ...data.messages],
        });
        if (plain.ok && plain.text.trim()) {
          blocks.push(plain.text.trim());
          web = { sources: [], suggestionsHtml: "", searched: false };
        }
        diagnostics.web = { searched: false, queries: [], sources: 0, error: grounded.reason };
      }
    }

    if (blocks.length === 0) blocks.push(translate(data.lang, "coach.notCovered"));
    const answer = blocks.join("\n\n");
    const sources: string[] = [];

    // Manager-only insight: bucket the question by topic. Never surfaced to the new hire.
    // Preview questions are the manager's own, so they are not logged as hire questions.
    if (lastQuestion && !data.previewRoleId) {
      try {
        const { logQuestion } = await import("./insights.server");
        await logQuestion(lastQuestion, companyId);
      } catch (error) {
        console.error("Question logging unavailable", error);
      }
    }

    // Keep the conversation so the hire can pick it up later, on any device.
    // Manager previews are tests and aren't saved. A missing table (setup SQL
    // not run yet) only means no history; the answer is still returned.
    if (lastQuestion && !data.previewRoleId) {
      const { error } = await context.supabase.from("coach_messages" as never).insert([
        { user_id: context.userId, role: "user", text: lastQuestion, sources: [] },
        { user_id: context.userId, role: "coach", text: answer, sources: web ? { web } : sources },
      ] as never);
      if (error) console.error("Saving chat history failed", error);
    }

    return {
      ok: true,
      text: answer,
      sources,
      ...(web ? { web } : {}),
      ...(showDiagnostics ? { diagnostics } : {}),
    };
  });
