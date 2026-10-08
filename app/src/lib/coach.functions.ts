import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { langFrom, translate, type Lang } from "./i18n/translate";
import { findRoleFor } from "./role-match";
import { parseCoachReply } from "./coach-reply";

/**
 * The model only finds lines; it never writes the answer. The new hire is shown
 * the document's own lines, word for word, after the server has checked each
 * one really is in the document — so nothing can be made up.
 */
const SYSTEM_PROMPT = `You find answers for a new hire in their company's onboarding documents. You never write answers yourself: the app shows the new hire only the exact lines you point to, word for word, so anything you paraphrase, translate or invent is thrown away.

For each question:
- Read all of the documents below, including informal notes, abbreviations ("Std" = hours, "MA" = employee) and side remarks, in any language (e.g. "Urlaub" = vacation, "Probezeit" = probation, "Arbeitszeit" = working hours). The question may be in another language than the document.
- Pick every line that answers the question: all steps of a procedure in order, every condition and exception, and who to inform or contact. Copy each line word for word, exactly as it appears, without translating, shortening, merging or fixing anything.
- Use the conversation to understand follow-up questions (e.g. "and after that?").
- If the documents don't answer the question, pick the lines that say who is responsible for that topic, if there are any. Otherwise pick nothing.
- Never pick lines that are only loosely related.

Reply with exactly this and nothing else:
SOURCES:
> <first line, copied word for word>
> <next line>
Up to 8 lines. If nothing answers the question, reply with just "SOURCES:".`;

/** Up to this size (roughly 100 pages) company-wide documents are sent in full instead of searched. */
const FULL_COMPANY_DOCS_CHARS = 250_000;

const LANGUAGE_NAMES = { en: "English", de: "German" } as const;

type CoachMessage = { role: "user" | "assistant"; content: string };

/** `sources` are verified, word-for-word passages from the content the answer is based on. */
export type CoachResult =
  | { ok: true; text: string; sources: string[] }
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
    const sourceText = normalizeForMatch([documentText, extraContext].join("\n"));
    const ask = (extra: typeof messages = []) =>
      callChatCompletion({
        feature: "coach",
        contentLength: roleContent.length + notes.length + extraContext.length,
        messages: [...messages, ...extra],
      });

    const result = await ask();
    if (!result.ok) return { ok: false, message: aiFailureMessage(result.reason, data.lang, result.hint) };
    let reply = parseCoachReply(result.text);
    let unverified = reply.quotes.filter((q) => !isQuoted(q, sourceText));
    if (unverified.length > 0 || !reply.wellFormed) {
      const problem = !reply.wellFormed
        ? 'Your reply did not use the required format. Reply with only the line "SOURCES:" followed by the lines from the documents that answer the question, one per line starting with "> ", copied word for word.'
        : `These lines do not appear word for word in the documents: ${JSON.stringify(unverified)}. Re-read the documents and point only to lines that are really there, copied exactly. Use the same format: "SOURCES:" and the lines.`;
      const retry = await ask([
        { role: "assistant", content: result.text },
        { role: "system", content: problem },
      ]);
      if (retry.ok) {
        const second = parseCoachReply(retry.text);
        // Keep the first reply if the retry came back unusable.
        if (second.wellFormed) reply = second;
        unverified = reply.quotes.filter((q) => !isQuoted(q, sourceText));
      }
      if (unverified.length > 0) console.error("Coach quotes not found in content", unverified);
    }
    const verified = reply.quotes.filter((q) => isQuoted(q, sourceText));
    // Show the document's own lines (not the model's copy of them), in document order.
    const lines = documentLines(verified, [documentText, extraContext].join("\n"));
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

    return { ok: true, text: answer, sources };
  });

/** Lowercases and reduces text to letters and digits, so quotes match despite spacing or bullets. */
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The original lines of the document that a verified quote came from, in the
 * order they appear there, without their own bullet markers.
 */
function documentLines(quotes: string[], document: string): string[] {
  const lines = document
    .split("\n")
    .map((text, index) => ({ index, text: text.trim(), norm: normalizeForMatch(text) }))
    .filter((l) => l.norm.length > 0);
  const picked = new Map<number, string>();
  for (const quote of quotes) {
    const parts = quote.split(/\.\.\.|…/).map(normalizeForMatch).filter(Boolean);
    for (const part of parts) {
      const containing = lines.find((l) => l.norm.includes(part));
      if (containing) {
        picked.set(containing.index, containing.text);
        continue;
      }
      // A quote spanning several lines: take each line it covers.
      for (const l of lines) if (l.norm.length >= 12 && part.includes(l.norm)) picked.set(l.index, l.text);
    }
  }
  return [...picked.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, text]) => text.replace(/^(?:[-*•▪◦–]\s*)+/, "").trim())
    .filter(Boolean);
}

/** True when every part of the quote (split at "…") appears in the content. */
function isQuoted(quote: string, normalizedSource: string): boolean {
  const parts = quote
    .split(/\.\.\.|…/)
    .map(normalizeForMatch)
    .filter((part) => part.length > 0);
  return parts.length > 0 && parts.every((part) => normalizedSource.includes(part));
}
