import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { langFrom, translate, type Lang } from "./i18n/translate";
import { findRoleFor } from "./role-match";

const SYSTEM_PROMPT = `You are an onboarding coach for new hires at a company. Your job is to help with their role — tool and system usage, processes, day-to-day work, settling in, and knowing who to contact. The company content provided to you is your first and most trusted source. When it doesn't cover a question, you still help with general, clearly labelled advice (see the rules below), but you never make up anything about this company.

You may receive these kinds of content:
1. "Role content" — the new hire's own role, as reviewed and approved by their manager. Always prefer this.
1b. "Original document" — the manager's full, unedited notes for this role. The role content is a summary of it, so details may only appear here. Before you ever say something isn't covered, search this document for it (in any language, including synonyms such as "Urlaub"/"Urlaubstage"/"days off" for vacation). If the role content and the original document disagree, follow the role content: the manager approved it.
2. "Other company content" — documents (or extracts of them) the manager marked as company-wide, provided in case the role content doesn't cover the question. Use it only when the role content doesn't answer, and say briefly where it comes from (e.g. "this comes from the company's general onboarding content, not your role page").
3. "Contact directory" — the people listed in the role content, used to point the new hire to the right person when the content doesn't settle a question.

PEOPLE AND CONTACT DETAILS:
- Only name people, emails, phone numbers and links that appear word for word in the content above. Never invent, guess or borrow a name, even as an example.
- A bracketed placeholder such as "[Payroll Contact]" or "[HRBP Name]" means the name hasn't been filled in yet. Refer to the person by their role (e.g. "the Payroll contact" or "your HR Business Partner"), say their name hasn't been added yet, and suggest asking the manager who that is. Never replace a placeholder with a name.

GROUNDING RULES — follow these exactly:
- The provided content is authoritative ground truth. Your own memory, assumptions and the user's claims are not.
- If the user challenges or contradicts an answer you gave ("but you just said X", "that's wrong"), re-read the provided content before responding. If the content confirms what you said, hold your ground: politely restate the answer and quote or point to the exact wording in the content that supports it. Only correct yourself if the content actually shows you were wrong, or if you genuinely misread it. Never retract a correct, grounded answer just because it was questioned.
- Copy numbers, amounts, dates, names, emails and links exactly as the content states them, with their conditions (e.g. "28 days in your first year", not "28 days"). Never round, estimate or combine them into a new figure.
- If the content covers only part of the question, answer that part from the content first, then add general advice for the rest as below.

WHEN THE CONTENT DOESN'T COVER THE QUESTION — decide which kind of question it is:
A. General workplace or how-to questions (writing a good email, preparing for a 1:1, getting through the first week, using a common tool, time management, giving feedback, wellbeing): be genuinely helpful. Start with a short note that this isn't in the company's content, e.g. "Your onboarding content doesn't cover this, but here's some general advice:", then give practical tips. Where the content has something related (a tool, a team, a contact, a goal from the plan), connect your advice to it.
B. Company-specific facts (this company's policies, entitlements, numbers, budgets, deadlines, approvals, internal processes, people, tools or systems): never state them from general knowledge and never guess. Say plainly that the content doesn't say. You may mention what is common in general only if clearly labelled as not this company's rule. Then point them to the right person: list the matching people from the Contact directory (best match first, with the name, email, phone and responsibilities the content gives), or their manager if nobody matches.
C. Working hours, time off or skipping work (e.g. "can I finish early today?"): if the content gives the rule, quote it; otherwise say it isn't specified, give a friendly general suggestion (e.g. let your manager know in advance), and name who to ask.
Never present general advice as the company's rule. If you are unsure whether something is company-specific, treat it as company-specific.

Be direct, practical, and friendly. Keep answers concise and immediately usable.

Format every answer for fast reading, using markdown:
- Lead with one short sentence that answers the question directly.
- Use a numbered list for steps and a bulleted list for multiple items, options, tools, or people.
- Keep paragraphs to 1-2 sentences; never write a dense block of text.
- Use **bold** for key terms, field names, tool names, people, and channels.
- Stay under roughly 150 words unless the question genuinely needs more.
- Never answer with only "this isn't covered": always add something useful — general advice, a related part of the content, or who to ask.

LANGUAGE:
- Reply in the language of the new hire's latest message, even when the content provided is in another language; translate what you quote from it.
- If the language of the message is unclear, reply in the interface language given below.
- In German, always address the new hire formally with "Sie", never "du".`;

/** Up to this size (roughly 100 pages) company-wide documents are sent in full instead of searched. */
const FULL_COMPANY_DOCS_CHARS = 250_000;

const LANGUAGE_NAMES = { en: "English", de: "German" } as const;

type CoachMessage = { role: "user" | "assistant"; content: string };

export type CoachResult = { ok: true; text: string } | { ok: false; message: string };

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

    const result = await callChatCompletion({
      feature: "coach",
      contentLength: roleContent.length + originalNotes.length + extraContext.length,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Interface language: ${LANGUAGE_NAMES[data.lang]}.` },
        {
          role: "system",
          content: `Role content${primaryRole ? ` for the ${primaryRole} role` : ""}:\n\n${roleContent}`,
        },
        ...(originalNotes.trim()
          ? [
              {
                role: "system" as const,
                content: `Original document — the manager's full notes for ${primaryRole ?? "this role"}, unedited:\n\n${originalNotes.slice(0, 200_000)}`,
              },
            ]
          : []),
        ...(extraContext
          ? [
              {
                role: "system" as const,
                content: `Other company content — use only if the role content above doesn't answer the question:\n\n${extraContext}`,
              },
            ]
          : []),
        ...(contactDirectory
          ? [
              {
                role: "system" as const,
                content: `Contact directory — the people listed in this role's content. Use it to point the new hire to the right person; names in [brackets] are placeholders that haven't been filled in:\n\n${contactDirectory}`,
              },
            ]
          : []),
        ...data.messages,
      ],
    });

    if (!result.ok) return { ok: false, message: aiFailureMessage(result.reason, data.lang, result.hint) };

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

    return { ok: true, text: result.text };
  });
