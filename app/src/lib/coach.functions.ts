import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { langFrom, translate, type Lang } from "./i18n/translate";
import { findRoleFor } from "./role-match";
import { parseCoachReply } from "./coach-reply";
import { createPassageFinder, passagesFor } from "./quote-match";

/**
 * The model only finds passages; it never writes the answer. The new hire is shown
 * the document's own text, word for word, after the server has checked each
 * one really is in the document — so nothing can be made up.
 */
const SYSTEM_PROMPT = `You find answers for a new hire in their company's onboarding documents. You never write answers yourself: the app shows the new hire only the exact passages you point to, taken word for word from the document, so anything you paraphrase, translate or invent is thrown away.

For each question:
- Read all of the documents below, including informal notes, abbreviations ("Std" = hours, "MA" = employee) and side remarks, in any language (e.g. "Urlaub" = vacation, "Probezeit" = probation, "Arbeitszeit" = working hours). The question may be in another language than the document.
- Pick every passage that answers the question: all steps of a procedure in order, every condition and exception, and who to inform or contact. A passage is a whole sentence, a list item, a table row or a question with its answer. Copy each passage word for word, exactly as it appears, without translating, shortening, merging or fixing anything.
- Use the conversation to understand follow-up questions (e.g. "and after that?").
- If the documents don't answer the question, pick the passages that say who is responsible for that topic, if there are any. Otherwise pick nothing.
- Never pick passages that are only loosely related.

Reply with exactly this and nothing else:
SOURCES:
> <first passage, copied word for word>
> <next passage>
Up to 8 passages, one per line. If nothing answers the question, reply with just "SOURCES:".`;

/** Up to this size (roughly 100 pages) company-wide documents are sent in full instead of searched. */
const FULL_COMPANY_DOCS_CHARS = 250_000;

const LANGUAGE_NAMES = { en: "English", de: "German" } as const;

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

    // The people listed in this role's own content, for pointing to who to ask.
    const primaryRow = companyRows.find((r) => r.role === primaryRole);
    const contactDirectory = [
      ...new Set(
        (primaryRow ? [primaryRow] : []).flatMap((r) => {
          const list = ((r.sections ?? {}) as Record<string, unknown>)["contacts"];
          return Array.isArray(list) ? list.map((v) => String(v).trim()).filter(Boolean) : [];
        }),
      ),
    ]
      .map((line) => `- ${line}`)
      .join("\n")
      .slice(0, 8_000);

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
    const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "system" as const, content: `Interface language: ${LANGUAGE_NAMES[data.lang]}.` },
        ...(notes.trim()
          ? [
              {
                role: "system" as const,
                content: `Original document — the manager's full notes for ${primaryRole ?? "this role"}, unedited:\n\n${notes}`,
              },
            ]
          : []),
        ...(notes.trim()
          ? []
          : [
              {
                role: "system" as const,
                content: `Role document${primaryRole ? ` for the ${primaryRole} role` : ""}:\n\n${roleContent}`,
              },
            ]),
        ...(extraContext
          ? [
              {
                role: "system" as const,
                content: `Company-wide documents — use only if the role document doesn't answer the question:\n\n${extraContext}`,
              },
            ]
          : []),
        ...(contactDirectory && !notes.trim()
          ? [
              {
                role: "system" as const,
                content: `Contact directory — the people listed in this role's content. Use it to point the new hire to the right person; names in [brackets] are placeholders that haven't been filled in:\n\n${contactDirectory}`,
              },
            ]
          : []),
        ...data.messages,
    ];

    // The coach must quote the passages it relies on; quotes that aren't in the
    // content mean it misread or invented something, so it gets one retry with
    // that pointed out, and only verified quotes are ever shown.
    const fullDocument = [documentText, extraContext].join("\n\n");
    const finder = createPassageFinder(fullDocument);
    const ask = (extra: typeof messages = []) =>
      callChatCompletion({
        feature: "coach",
        contentLength: roleContent.length + notes.length + extraContext.length,
        messages: [...messages, ...extra],
      });

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
    const record = (text: string, quotes: string[]) =>
      diagnostics.attempts.push({
        reply: text.slice(0, 1500),
        quotes: quotes.map((q) => ({ text: q, found: !!finder.find(q) })),
      });

    // Without any document for this role there is nothing to answer from; say so
    // plainly (naming the job title looked up) instead of "not covered".
    if (!fullDocument.trim()) {
      return {
        ok: true,
        text: translate(data.lang, "coach.noDocument", { role: lookedUpTitle || "—" }),
        sources: [],
        ...(showDiagnostics ? { diagnostics } : {}),
      };
    }

    const result = await ask();
    if (!result.ok) return { ok: false, message: aiFailureMessage(result.reason, data.lang, result.hint) };
    let reply = parseCoachReply(result.text);
    record(result.text, reply.quotes);
    let unverified = reply.quotes.filter((q) => !finder.find(q));
    if (unverified.length > 0 || !reply.wellFormed) {
      const problem = !reply.wellFormed
        ? 'Your reply did not use the required format. Reply with only the line "SOURCES:" followed by the passages from the documents that answer the question, one per line starting with "> ", copied word for word.'
        : `These passages do not appear in the documents: ${JSON.stringify(unverified)}. Re-read the documents and point only to passages that are really there, copied exactly. Use the same format: "SOURCES:" and the passages.`;
      const retry = await ask([
        { role: "assistant", content: result.text },
        { role: "system", content: problem },
      ]);
      if (retry.ok) {
        const second = parseCoachReply(retry.text);
        record(retry.text, second.quotes);
        // Keep the first reply if the retry came back unusable.
        if (second.wellFormed) reply = second;
        unverified = reply.quotes.filter((q) => !finder.find(q));
      }
      if (unverified.length > 0) console.error("Coach quotes not found in content", unverified);
    }
    // Show the document's own text for each passage (not the model's copy of it), in document order.
    const lines = passagesFor(reply.quotes, fullDocument);
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
