import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { langFrom, translate, type Lang } from "./i18n/translate";
import { findRoleFor } from "./role-match";
import { groupParagraphs, numberDocuments, readParagraphNumbers } from "./numbered-document";

/**
 * The model never writes the answer. The documents are sent as numbered
 * paragraphs and the model replies with paragraph numbers only; the new hire is
 * shown those paragraphs exactly as written — so nothing can be made up.
 */
const SYSTEM_PROMPT = `You find answers for a new hire in their company's onboarding documents. The documents below are split into numbered paragraphs like "[12] …". You never write answers: you only reply with the numbers of the paragraphs that answer the question, and the app shows the new hire those paragraphs word for word.

For each question:
- Read all of the documents, including informal notes, abbreviations ("Std" = hours, "MA" = employee) and side remarks, in any language (e.g. "Urlaub" = vacation, "Probezeit" = probation, "Arbeitszeit" = working hours). The question may be in another language than the documents.
- Choose every paragraph that answers the question: all steps of a procedure, every condition and exception, and who to inform or contact. When a question and its answer are separate paragraphs, choose both.
- Use the conversation to understand follow-up questions (e.g. "and after that?").
- If the documents don't answer the question, choose the paragraphs that say who is responsible for that topic, if there are any. Otherwise choose none.
- Never choose paragraphs that are only loosely related.

Reply with only this json: {"paragraphs": [12, 13]} — up to 8 paragraph numbers, or {"paragraphs": []} if nothing answers the question.`;

/** Makes the provider return exactly {"paragraphs": number[]}. */
const PARAGRAPHS_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "paragraphs",
    strict: true,
    schema: {
      type: "object",
      properties: { paragraphs: { type: "array", items: { type: "integer" } } },
      required: ["paragraphs"],
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
};

export type CoachResult =
  | { ok: true; text: string; sources: string[]; diagnostics?: CoachDiagnostics }
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
    const { callChatCompletion, aiFailureMessage, recordAiFailure } = await import(
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
        const title = /^Source: (.+)$/m.exec(part)?.[1]?.trim() ?? "Company-wide document";
        return { title: `Company-wide document: ${title}`, text: part.replace(/^Source: .+\n?/, "") };
      });
    const numbered = numberDocuments([
      { title: `Role document: ${primaryRole ?? "this role"}`, text: documentText },
      ...companyDocs,
    ]);

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
    let picked = readParagraphNumbers(result.text, numbered.units.length);
    record(result.text, picked.numbers);
    if (!picked.found) {
      // The model wrote text instead of numbers; ask once more.
      const retry = await ask([
        { role: "assistant", content: result.text },
        {
          role: "system",
          content:
            'Do not write an answer. Reply with only the json {"paragraphs": [...]} listing the numbers of the paragraphs that answer the question.',
        },
      ]);
      if (retry.ok) {
        picked = readParagraphNumbers(retry.text, numbered.units.length);
        record(retry.text, picked.numbers);
      }
    }

    // Show the chosen paragraphs exactly as written, in document order.
    const lines = groupParagraphs(picked.numbers, numbered.units);
    const answer =
      lines.length > 0
        ? `${translate(data.lang, "coach.fromDocument")}\n${lines.map((l) => `- ${l}`).join("\n")}`
        : translate(data.lang, "coach.notCovered");
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
        { user_id: context.userId, role: "coach", text: answer, sources },
      ] as never);
      if (error) console.error("Saving chat history failed", error);
    }

    return { ok: true, text: answer, sources, ...(showDiagnostics ? { diagnostics } : {}) };
  });
